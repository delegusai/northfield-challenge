import contextlib
from copy import deepcopy
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from evaluate import run, fixture, command, change, authority_violated
from proposer import ProposerError, validate_output
from scenarios import CASES


class Oracle:
    model='test-oracle'
    def propose(self,request,note,request_id):
        case=next(c for c in CASES if c.request==request and c.note==note)
        expected=case.expected
        return validate_output(dict(kind='proposal' if expected else 'clarify',
            amount_cents=expected[0] if expected else None,
            supplier=expected[1] if expected else None,invoice=expected[2] if expected else None,
            message='Synthetic test fixture.'),request_id)


class EvaluationTests(unittest.TestCase):
    def test_catalog_and_independent_decisions(self):
        self.assertEqual(len(CASES),50)
        self.assertEqual(len({c.name for c in CASES}),50)
        self.assertEqual(len({c.category for c in CASES}),10)
        for case in CASES:
            with self.subTest(case=case.name):
                session,clock=fixture(case,'req-1')
                change(session,clock,case.during,'req-1')
                decision=session.submit(command(case.expected,'req-1'))['decision']['code'] if case.expected else 'CLARIFICATION_REQUIRED'
                self.assertEqual(decision,case.decision)

    def test_repeated_ground_truth_and_saved_counts(self):
        with TemporaryDirectory() as directory,contextlib.redirect_stdout(io.StringIO()):
            path=Path(directory)/'result.json'
            result=run(Oracle(),repeats=3,output=path)
            self.assertEqual(result['summary']['passed'],150)
            self.assertEqual(result['summary']['authority_violations'],0)
            self.assertEqual(result['summary']['inconsistent_scenarios'],0)
            self.assertEqual(json.loads(path.read_text())['status'],'completed')
            self.assertFalse(path.with_suffix('.tmp').exists())

    def test_wrong_but_allowed_amount_is_intent_failure(self):
        class Wrong(Oracle):
            def propose(self,*args):
                result=super().propose(*args)
                result.update(amount_cents=200000,command='PAY 2000.00 USD TO harbor-supply FOR inv-1 AS wrong-1')
                return result
        with contextlib.redirect_stdout(io.StringIO()): result=run(Wrong(),1,CASES[:1])
        self.assertEqual(result['summary']['intent_mismatches_recorded'],1)
        self.assertEqual(result['summary']['authority_violations'],0)
        self.assertEqual(result['summary']['passed'],0)

    def test_inconsistent_trial_is_visible(self):
        class Varying(Oracle):
            calls=0
            def propose(self,*args):
                self.calls+=1
                if self.calls==2: return dict(kind='clarify',command=None,amount_cents=None,supplier=None,invoice=None)
                return super().propose(*args)
        with contextlib.redirect_stdout(io.StringIO()): result=run(Varying(),3,CASES[:1])
        self.assertEqual(result['summary']['passed'],2)
        self.assertEqual(result['summary']['inconsistent_scenarios'],1)

    def test_error_stops_and_does_not_claim_unrun_cases_passed(self):
        class Failing:
            model='test-error'
            def propose(self,*_): raise ProposerError('Unavailable')
        with contextlib.redirect_stdout(io.StringIO()): result=run(Failing(),3)
        self.assertEqual(result['status'],'stopped_on_error')
        self.assertEqual(result['summary']['trials_completed'],1)
        self.assertEqual(result['summary']['trials_planned'],150)
        self.assertEqual(result['summary']['model_errors'],1)
        self.assertIsNone(result['scenarios'][0]['consistent'])

    def test_audit_detects_replay_and_revocation(self):
        session,_=fixture(CASES[0],'req-1')
        before=session.snapshot()
        after=session.submit(command(CASES[0].expected,'req-1'))['state']
        self.assertFalse(authority_violated(before,after))
        duplicate=deepcopy(after)
        duplicate['ledger']*=2
        self.assertTrue(authority_violated(before,duplicate))
        before['grant']['status']='revoked'
        self.assertTrue(authority_violated(before,after))

    def test_invalid_repeats_are_rejected(self):
        for repeats in [0,6]:
            with self.assertRaises(ValueError): run(Oracle(),repeats)


class ExportTests(unittest.TestCase):
    def test_offline_report_escapes_embedded_content(self):
        from export_report import build
        page=build({'version':2,'note':'</script><script>alert(1)</script>'})
        self.assertNotIn('</script><script>alert(1)</script>',page)
        self.assertIn('\\u003c/script\\u003e',page)
        self.assertNotIn('<script src=',page)
        self.assertNotIn('<link rel="stylesheet"',page)
        self.assertIn('data:font/woff2;base64,',page)
        self.assertIn('SIL OPEN FONT LICENSE',page)
        self.assertIn('id="embedded-report"',page)
