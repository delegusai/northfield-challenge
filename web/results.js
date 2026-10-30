'use strict';
const $=id=>document.getElementById(id);
let report=null, selected=null;
function element(tag,text,className) {const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;}
function fields(value) {return value ? `${(value[0]/100).toLocaleString('en-US',{style:'currency',currency:'USD'})} · ${value[1]} · ${value[2]}` : 'Clarification required';}
function label(name) {return name.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ');}
function consistent(g) {return g.consistent===null?'Not enough trials':g.consistent?'Consistent':'Inconsistent';}
function status(g) {return g.passed<g.completed?'Has failures':g.completed<g.planned?'Incomplete':'Passed';}
function detail(name,focus=true) {
  selected=name;
  const rows=report.results.filter(r=>r.case===name), first=rows[0];
  $('scenario-detail').hidden=false;
  $('detail-title').textContent=label(name);
  $('detail-request').textContent=first?first.request:'This scenario has not run yet.';
  $('detail-context').textContent=first?`Supporting text: ${first.note||'None'}\nBefore preparation: ${first.setup||'No change'}\nBetween preparation and execution: ${first.during||'No change'}`:'';
  $('detail-expected').textContent=first?`Expected: ${fields(first.expected)} → ${first.expected_decision}`:'';
  $('trials').replaceChildren();
  for(const r of rows) {
    const trial=element('article','', 'trial');
    trial.append(element('h3',`Trial ${r.repeat} · ${r.passed?'Passed':'Failed'}`,r.passed?'pass':'fail'));
    trial.append(element('p',`Actual: ${r.error?'No model result':fields(r.actual)} → ${r.decision}`));
    const reasons=[];
    if(r.error) reasons.push(r.error);
    if(!r.interpretation_correct&&!r.error) reasons.push('Payment fields or clarification differ from the expected intent.');
    if(!r.decision_correct) reasons.push(`Expected ${r.expected_decision}; observed ${r.decision}.`);
    if(r.authority_violation) reasons.push('A simulator authority rule was violated.');
    if(r.intent_mismatch_recorded) reasons.push('A payment with mismatched intent was recorded.');
    trial.append(element('p',reasons.join(' ')||'The interpretation and decision matched the expected result.'));
    if(r.proposal) trial.append(element('p',`Model explanation: ${r.proposal.message}`,'model-explanation'));
    trial.append(element('small',`${r.seconds}s · ${r.new_ledger_entries.length} new ledger entries`));
    $('trials').append(trial);
  }
  if(focus)$('scenario-detail').focus();
}
function renderRows() {
  const category=$('category').value,outcome=$('outcome').value;
  const groups=report.scenarios.filter(g=>(category==='all'||g.category===category)&&
    (outcome==='all'||outcome==='failures'&&g.passed<g.completed||outcome==='inconsistent'&&g.consistent===false||outcome==='pending'&&g.completed<g.planned));
  $('scenario-rows').replaceChildren();
  for(const g of groups) {
    const tr=document.createElement('tr'), td=document.createElement('td');
    const button=element('button',label(g.case),'scenario-link');
    button.addEventListener('click',()=>detail(g.case));
    td.append(button,element('small',g.category));tr.append(td);
    tr.append(element('td',`${g.passed} / ${g.completed}`,g.passed<g.completed?'fail':''));
    tr.append(element('td',consistent(g)));
    tr.append(element('td',status(g),g.passed<g.completed?'fail':g.completed===g.planned?'pass':''));
    $('scenario-rows').append(tr);
  }
  $('filter-count').textContent=`${groups.length} of ${report.scenarios.length} scenarios`;
  $('no-matches').hidden=groups.length>0;
}
function render() {
  const s=report.summary;
  $('report').hidden=false;$('empty-report').hidden=true;$('download').disabled=false;
  $('run-info').textContent=`${report.status==='completed'?'Completed':report.status==='running'?'Run in progress':'Stopped after a model error'} · ${report.model} · ${new Date(report.updated_at).toLocaleString()}`;
  $('passed').textContent=`${s.passed} / ${s.trials_completed}`;
  $('interpretation').textContent=`${s.interpretations_correct} / ${s.trials_completed}`;
  $('violations').textContent=s.authority_violations;$('violations').className=s.authority_violations?'fail':'pass';
  $('mismatches').textContent=s.intent_mismatches_recorded;$('mismatches').className=s.intent_mismatches_recorded?'fail':'pass';
  $('run-summary').textContent=`${s.trials_completed} of ${s.trials_planned} planned trials · ${s.scenarios_completed} of ${s.scenarios_planned} scenarios complete · ${s.repeats} trials per scenario · ${s.inconsistent_scenarios} inconsistent scenarios · ${s.model_errors} model errors · ${s.total_tokens.toLocaleString()} tokens`;
  const previous=$('category').value;
  $('category').replaceChildren(new Option('All categories','all'));
  [...new Set(report.scenarios.map(g=>g.category))].forEach(c=>$('category').append(new Option(c,c)));
  if([...$('category').options].some(o=>o.value===previous))$('category').value=previous;
  renderRows();if(selected)detail(selected,false);
}
async function refresh() {
  $('refresh').disabled=true;$('report-error').hidden=true;
  try {
    const response=await fetch('/api/evaluation');
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Unable to load results.');
    if(!data.available) {
      report=null;selected=null;$('report').hidden=true;$('download').disabled=true;
      $('empty-report').hidden=false;$('empty-report').textContent=data.message;
      $('run-info').textContent='No expanded evaluation loaded.';
    } else {report=data.report;render();}
  } catch(error) {
    $('report-error').hidden=false;$('report-error').textContent=`Refresh failed. ${error.message}${report?' The previously loaded report is still shown.':''}`;
    if(!report)$('run-info').textContent='Report unavailable.';
  } finally {$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',refresh);
$('category').addEventListener('change',renderRows);$('outcome').addEventListener('change',renderRows);
$('download').addEventListener('click',()=>{
  if(!report)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='northfield-evaluation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const embedded=$('embedded-report');
if(embedded) {
  report=JSON.parse(embedded.textContent);
  $('refresh').hidden=true;
  render();
} else refresh();
