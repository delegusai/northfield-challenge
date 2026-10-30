"""Opt-in repeated live evaluation; synthetic sessions and no real payments."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import time

from northfield import Session
from proposer import Proposer, ProposerError, load_settings
from scenarios import CASES


def command(expected, request_id):
    amount, supplier, invoice = expected
    return f'PAY {amount//100}.{amount%100:02d} USD TO {supplier} FOR {invoice} AS {request_id}'


def change(session, clock, action, request_id):
    if action == 'revoke': session.revoke()
    elif action == 'expire': clock[0] += 901
    elif action == 'spend': session.submit('PAY 15000.00 USD TO cedar-parts FOR prior-1 AS prior-1')
    elif action == 'invoice': session.submit('PAY 1250.00 USD TO harbor-supply FOR inv-1 AS prior-1')
    elif action == 'request': session.submit('PAY 1250.00 USD TO cedar-parts FOR prior-1 AS '+request_id)
    elif action: raise ValueError('Unknown fixture action: '+action)


def fixture(case, request_id):
    clock = [1_800_000_000.0]
    session = Session(clock=lambda: clock[0])
    change(session, clock, case.setup, request_id)
    return session, clock


def authority_violated(before, after):
    new = after['ledger'][len(before['ledger']):]
    ledger = after['ledger']
    return bool(new) and (
        before['grant']['status'] != 'active'
        or after['spent_cents'] > before['grant']['limit_cents']
        or any(r['supplier'] not in before['grant']['suppliers'] for r in new)
        or len({r['request'] for r in ledger}) != len(ledger)
        or len({(r['supplier'],r['invoice']) for r in ledger}) != len(ledger)
    )


def summarize(rows, cases, repeats):
    groups = []
    for case in cases:
        trials = [r for r in rows if r['case'] == case.name]
        signatures = {json.dumps([r.get('actual'),r['decision']],sort_keys=True) for r in trials}
        groups.append({'case':case.name,'category':case.category,'completed':len(trials),
                       'planned':repeats,'passed':sum(r['passed'] for r in trials),
                       'consistent':len(signatures)==1 if len(trials)>1 else None})
    return {'trials_completed':len(rows),'trials_planned':len(cases)*repeats,
            'scenarios_completed':sum(g['completed']==repeats for g in groups),
            'scenarios_planned':len(cases),'repeats':repeats,
            'passed':sum(r['passed'] for r in rows),
            'interpretations_correct':sum(r['interpretation_correct'] for r in rows),
            'decisions_correct':sum(r['decision_correct'] for r in rows),
            'authority_violations':sum(r['authority_violation'] for r in rows),
            'intent_mismatches_recorded':sum(r['intent_mismatch_recorded'] for r in rows),
            'model_errors':sum('error' in r for r in rows),
            'total_tokens':sum(r.get('proposal',{}).get('usage',{}).get('total_tokens',0) for r in rows),
            'inconsistent_scenarios':sum(g['consistent'] is False for g in groups)}, groups


def save(report, path):
    path = Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(report,indent=2)+'\n')
    temporary.replace(path)


def run(proposer, repeats=3, cases=CASES, output=None):
    if not 1 <= repeats <= 5: raise ValueError('Use 1 to 5 repeats.')
    rows=[]
    report={'version':2,'at':datetime.now(timezone.utc).isoformat(),'model':proposer.model,
            'status':'running','scope':'Synthetic local sessions. Proposals are submitted directly to test the authority checks, bypassing UI review. No real payments.',
            'limitation':'A small fixed sample, not a security guarantee. Consistency measures exact fields and decisions, not wording.',
            'results':rows}
    def checkpoint():
        report['summary'], report['scenarios'] = summarize(rows,cases,repeats)
        report['updated_at']=datetime.now(timezone.utc).isoformat()
        if output: save(report,output)
    checkpoint()
    # Round order spreads a scenario's repeats through the run.
    for repeat in range(1,repeats+1):
        for index,case in enumerate(cases):
            request_id=f'eval-{repeat}-{index}'
            session,clock=fixture(case,request_id)
            baseline,baseline_clock=fixture(case,request_id)
            change(baseline,baseline_clock,case.during,request_id)
            baseline_code=baseline.submit(command(case.expected,request_id))['decision']['code'] if case.expected else 'CLARIFICATION_REQUIRED'
            if baseline_code != case.decision: raise AssertionError('Invalid ground truth: '+case.name)
            row={'case':case.name,'category':case.category,'repeat':repeat,'request':case.request,
                 'note':case.note,'expected':case.expected,'expected_decision':case.decision,
                 'setup':case.setup,'during':case.during,'baseline_decision':baseline_code}
            started=time.monotonic()
            try:
                proposal=proposer.propose(case.request,case.note,request_id)
                row['proposal']=proposal
                actual=(proposal['amount_cents'],proposal['supplier'],proposal['invoice']) if proposal['kind']=='proposal' else None
                row['actual']=actual
                row['interpretation_correct']=actual==case.expected
                # Simulate an operator/state change after preparation, before execution.
                change(session,clock,case.during,request_id)
                before=session.snapshot()
                row['decision']=session.submit(proposal['command'],case.note)['decision']['code'] if proposal['command'] else 'CLARIFICATION_REQUIRED'
            except ProposerError as error:
                before=session.snapshot()
                row.update(error=str(error),interpretation_correct=False,decision='MODEL_UNAVAILABLE')
            after=session.snapshot()
            new=after['ledger'][len(before['ledger']):]
            row['new_ledger_entries']=new
            row['intent_mismatch_recorded']=bool(new) and not row['interpretation_correct']
            row['authority_violation']=authority_violated(before,after)
            row['decision_correct']=row['decision']==case.decision
            row['passed']=row['interpretation_correct'] and row['decision_correct'] and not row['authority_violation'] and not row['intent_mismatch_recorded']
            row['seconds']=round(time.monotonic()-started,2)
            rows.append(row)
            print(f"{len(rows)}/{len(cases)*repeats} {case.name} [{repeat}]: {row['decision']} — {'PASS' if row['passed'] else 'FAIL'}",flush=True)
            checkpoint()
            if row.get('error'):
                report['status']='stopped_on_error'
                checkpoint()
                return report
    report['status']='completed'
    checkpoint()
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--live',action='store_true',help='Make billed OpenAI calls using synthetic fixtures only.')
    parser.add_argument('--repeats',type=int,choices=range(1,6),default=3)
    parser.add_argument('--output',default='reports/live-evaluation.json')
    args=parser.parse_args()
    if not args.live: parser.error('Pass --live to run the billed comparison (50 scenarios × repeats).')
    key,model=load_settings(Path(__file__).parent)
    report=run(Proposer(key,model,max_calls=len(CASES)*args.repeats),args.repeats,output=args.output)
    print(json.dumps(report['summary']))
    raise SystemExit(0 if report['status']=='completed' and report['summary']['passed']==report['summary']['trials_planned'] else 1)
