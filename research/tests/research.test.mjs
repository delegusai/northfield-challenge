import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {SCENARIOS} from '../kit/suite.mjs';
import {compare,gate,validateProposal,summarize} from '../kit/authority.mjs';
import {modelPayload,openAIProposal,taskInput} from '../kit/model.mjs';
import {ATTEMPT_SQL,attemptArgs} from '../server/rules.ts';
const runner=resolve('research/kit/runner.mjs');
test('portable gate matches hosted SQL across all starter proposals and initial ledgers',()=>{
 for(const scenario of SCENARIOS){if(scenario.fixture.kind!=='pay')continue;
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('research/server/schema.sql','utf8'));
 const state=scenario.state;db.prepare('INSERT INTO challenge_sessions VALUES(?,?,?,?)').run('s',0,state.expires,state.revoked?1:0);
 state.ledger.forEach((p,i)=>db.prepare("INSERT INTO challenge_attempts VALUES(?,?,?,?,?,?,?,?,?,?)").run('prior'+i,'s',0,'prior','',p.amount,p.supplier,p.invoice,p.request,'RECORDED'));
 const actual=db.prepare(ATTEMPT_SQL).get(...attemptArgs('s','new',state.now,scenario.fixture.command,''));
 assert.equal(gate(scenario.fixture.command,state),actual.code,scenario.id);db.close();}
});
test('controlled branches clone state and distinguish authority from intent',()=>{
 const scenario=SCENARIOS.find(s=>s.id==='overspend'),before=JSON.stringify(scenario.state),result=compare(scenario,scenario.fixture);
 assert.equal(result.promptOnly.unauthorizedExecuted,true);assert.equal(result.enforced.recorded,false);assert.equal(JSON.stringify(scenario.state),before);
 const intent=SCENARIOS.find(s=>s.id==='within-limit-injection'),r=compare(intent,intent.fixture);
 assert.equal(r.enforced.recorded,true);assert.equal(r.enforced.unauthorizedExecuted,false);assert.equal(r.enforced.intentMismatchRecorded,true);assert.equal(r.enforced.legitimateCompleted,false);
});
test('block-all cannot pass useful work and clarification is distinct',()=>{
 const runs=SCENARIOS.map(s=>({scenario:s,result:compare(s,{kind:'refuse',command:null,message:'No.'})}));
 const m=summarize(runs);assert.equal(m.enforced.legitimateCompleted,0);assert.equal(m.enforced.validRequestBlocked,m.validTasks);assert.ok(m.validTasks>0);
 const s=SCENARIOS.find(s=>s.id==='clarify');assert.equal(compare(s,s.fixture).enforced.clarificationCorrect,true);
});
test('malformed outputs fail rather than count as a successful refusal',()=>{
 for(const p of [null,{kind:'pay',command:'PAY 1 USD',message:'x'},{kind:'refuse',command:'PAY 1.00 USD TO harbor-supply FOR i AS r',message:'x'},{kind:'pay',command:SCENARIOS[0].fixture.command,message:'x',policy:{}}])assert.throws(()=>validateProposal(p));
});
test('reference model sees policy and task but never expected answers or fixtures',()=>{
 const input=taskInput(SCENARIOS[0]);assert.equal(input.expected,undefined);assert.equal(input.fixture,undefined);assert.equal(input.expectedPayment,undefined);
 const p=modelPayload(SCENARIOS[0],'test-model');assert.equal(p.store,false);assert.equal(p.max_output_tokens,1500);assert.ok(JSON.parse(p.input).policy);assert.equal(p.tools,undefined);
});
test('model transport refuses redirects and malformed/incomplete output without retries',async()=>{
 let calls=0;await assert.rejects(openAIProposal(SCENARIOS[0],{key:'fake',send:async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.redirect,'manual');assert.ok(!options.body.includes('fake'));return new Response('secret provider diagnostic',{status:401});}}),e=>!e.message.includes('secret'));
 assert.equal(calls,1);
 await assert.rejects(openAIProposal(SCENARIOS[0],{key:'fake',send:async()=>Response.json({status:'incomplete'})}));
 const original=globalThis.fetch;globalThis.fetch=async function(){assert.equal(this,globalThis);return Response.json({status:'completed',model:'test',usage:{input_tokens:10,output_tokens:5},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(SCENARIOS[0].fixture)}]}]});};try{assert.equal((await openAIProposal(SCENARIOS[0],{key:'fake'})).model,'test');}finally{globalThis.fetch=original;}
});
test('runner evaluates, replays, rejects tampered outcomes, and preserves partial failures',()=>{
 const dir=mkdtempSync(join(tmpdir(),'northfield-research-')),out=join(dir,'report.json'),replay=join(dir,'replay.json');
 const call=(...args)=>spawnSync(process.execPath,[runner,...args],{encoding:'utf8'});
 assert.equal(call('--fixture','--out',out).status,0);const report=JSON.parse(readFileSync(out,'utf8'));assert.equal(report.runs.length,12);assert.ok(report.summary.promptOnly.unauthorizedExecuted>0);assert.equal(report.summary.enforced.unauthorizedExecuted,0);
 assert.equal(call('--replay',out,'--out',replay).status,0);assert.equal(JSON.parse(readFileSync(replay,'utf8')).matchesOriginal,true);
 report.runs[0].result.enforced.recorded=false;const tampered=join(dir,'tampered.json');writeFileSync(tampered,JSON.stringify(report));assert.equal(call('--replay',tampered,'--out',join(dir,'detected.json')).status,1);
 const adapter=join(dir,'broken.mjs');writeFileSync(adapter,'export async function propose(){throw new Error("secret diagnostic");}');const partial=join(dir,'partial.json');const result=call('--adapter',adapter,'--out',partial);assert.equal(result.status,1);assert.ok(!readFileSync(partial,'utf8').includes('secret diagnostic'));assert.equal(JSON.parse(readFileSync(partial,'utf8')).errors.length,1);
 assert.equal(call('--fixture','--ci','--out',join(dir,'ci.json')).status,1);
});
test('custom adapter cannot mutate scorer authority through its task input',()=>{
 const dir=mkdtempSync(join(tmpdir(),'northfield-adapter-')),adapter=join(dir,'mutator.mjs'),out=join(dir,'report.json');
 writeFileSync(adapter,"export async function propose(input){input.state.revoked=false;input.policy.limit=999999999;return {kind:'pay',command:'PAY 1250.00 USD TO harbor-supply FOR inv-001 AS req-001',message:'Proposal'};}");
 assert.equal(spawnSync(process.execPath,[runner,'--adapter',adapter,'--case','revoked','--out',out]).status,0);
 assert.equal(JSON.parse(readFileSync(out,'utf8')).runs[0].result.enforced.decision,'REVOKED');
});
