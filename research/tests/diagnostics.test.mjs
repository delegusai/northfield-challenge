import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {SCENARIOS} from '../kit-1.1.0/suite.mjs';
import {openAIProposal,PROMPT,SCHEMA} from '../kit-1.1.0/model.mjs';
import {PROMPT as oldPrompt,SCHEMA as oldSchema} from '../kit/model.mjs';
import {rejectedExcerpt,tokenUsage} from '../kit-1.1.0/diagnostics.mjs';
const runner=resolve('research/kit-1.1.0/runner.mjs');
const malformed=JSON.stringify({kind:'pay',command:'PAY 1250 USD',message:'Proposal only.'});
const body=(text=malformed,extra={})=>({status:'completed',model:'test-model',usage:{input_tokens:12,output_tokens:8,total_tokens:20,output_tokens_details:{reasoning_tokens:3},secret:'discard me'},output:[{type:'message',content:[{type:'output_text',text}]}],...extra});
async function failure(data,options={}) {
 try {await openAIProposal(SCENARIOS[0],{key:'test-private-key',send:async()=>Response.json(data),...options});assert.fail('Expected failure');}
 catch(error){assert.equal(error.name,'ProposalError');return error;}
}
test('new instrumentation preserves pilot prompt, schema, authority and scenario bytes',()=>{
 assert.equal(PROMPT,oldPrompt);assert.deepEqual(SCHEMA,oldSchema);
 for(const file of ['authority.mjs','suite.mjs','server-rules.ts'])assert.deepEqual(readFileSync('research/kit/'+file),readFileSync('research/kit-1.1.0/'+file));
});
test('the pilot validation failure now retains usage, stage and optional excerpt',async()=>{
 const hidden=await failure(body());assert.equal(hidden.message,'Pay requires one valid payment command.');
 assert.equal(hidden.diagnostic.code,'invalid_proposal');assert.equal(hidden.diagnostic.stage,'proposal_validation');
 assert.equal(hidden.diagnostic.usage.output_tokens,8);assert.equal(hidden.diagnostic.rejectedOutput,null);
 const captured=await failure(body(),{captureRejectedOutput:true});
 assert.equal(captured.diagnostic.rejectedOutput.text,malformed);assert.ok(captured.diagnostic.latencyMs>=0);
 assert.ok(!JSON.stringify(captured.diagnostic).includes('discard me'));
});
test('incomplete, invalid JSON and absent output remain distinguishable failures',async()=>{
 assert.equal((await failure(body('{broken',{status:'incomplete'}))).diagnostic.code,'incomplete_response');
 assert.equal((await failure(body('{broken'))).diagnostic.code,'invalid_proposal_json');
 assert.equal((await failure(body('',{output:[]}))).diagnostic.code,'output_count');
 const e=await failure(body('{broken',{status:'incomplete'}),{captureRejectedOutput:true});
 assert.equal(e.diagnostic.usage.input_tokens,12);assert.equal(e.diagnostic.rejectedOutput.text,'{broken');
});
test('transport failures do not leak error bodies, headers or exception messages, and never retry',async()=>{
 for(const code of ['http_error','transport_error','timeout','invalid_response_json','response_too_large']){
  let calls=0;
  const e=await failure(null,{captureRejectedOutput:true,send:async()=>{calls++;
   if(code==='http_error')return new Response('private provider body',{status:401,headers:{'x-secret':'private header'}});
   if(code==='transport_error')throw new Error('private exception');
   if(code==='timeout')throw new DOMException('private timeout','TimeoutError');
   if(code==='invalid_response_json')return new Response('private non-JSON body');
   return new Response('x'.repeat(1048577));
  }});
  assert.equal(calls,1);assert.equal(e.diagnostic.code,code);assert.equal(e.diagnostic.rejectedOutput,null);
  assert.ok(!JSON.stringify(e).includes('private'));assert.ok(!e.message.includes('private'));assert.equal(e.diagnostic.usage,null);
 }
});
test('excerpts redact known secrets before truncation and strip common credential and email patterns',()=>{
 const secret='custom-private-value';
 const excerpt=rejectedExcerpt('a'.repeat(4090)+secret,[secret]);
 assert.equal(excerpt.text.length,4096);assert.equal(excerpt.truncated,true);assert.ok(!excerpt.text.includes('custom'));
 const text='sk-testcredential123 Bearer opaquevalue ghp_synthetic123 person@example.test password="sensitive" api_key=opaque';
 const redacted=rejectedExcerpt(text).text;
 for(const value of ['sk-testcredential123','opaquevalue','ghp_synthetic123','person@example.test','sensitive','opaque'])assert.ok(!redacted.includes(value));
 const excerptErrorText='test-private-key '+malformed;
 return failure(body(excerptErrorText),{captureRejectedOutput:true}).then(e=>assert.ok(!e.diagnostic.rejectedOutput.text.includes('test-private-key')));
});
test('unknown or malformed usage is not zero; only numeric known fields survive',()=>{
 assert.equal(tokenUsage({input_tokens:-1,output_tokens:'2',total_tokens:Infinity}),null);
 assert.deepEqual(tokenUsage({input_tokens:0,extra:'secret'}),{input_tokens:0});
});
test('CLI retains failed-call tokens, continues only when requested, and replays completed proposals',t=>{
 const dir=mkdtempSync(join(tmpdir(),'northfield-diagnostics-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const preload=join(dir,'mock.mjs');
 const good=body(JSON.stringify(SCENARIOS[0].fixture));
 writeFileSync(preload,`let calls=0;globalThis.fetch=async()=>Response.json(++calls===1?${JSON.stringify(body())}:${JSON.stringify(good)});`);
 const call=(...args)=>spawnSync(process.execPath,['--import',preload,runner,...args],{encoding:'utf8',env:{...process.env,OPENAI_API_KEY:'test-private-key'}});
 const out=join(dir,'all.json');
 assert.equal(call('--openai','--case','valid','--repeat','3','--continue-on-error','--capture-rejected-output','--out',out).status,1);
 const r=JSON.parse(readFileSync(out));assert.equal(r.runs.length,2);assert.equal(r.errors.length,1);assert.equal(r.attempts.length,3);
 assert.equal(r.measurement.plannedValidTasks,3);assert.equal(r.measurement.legitimateCompleted,2);
 assert.deepEqual(r.measurement.tokens.input_tokens,{value:36,attemptsWithValue:3});assert.equal(r.measurement.unattemptedTrials,0);
 assert.equal(r.errors[0].rejectedOutput.text,malformed);assert.equal(r.errors[0].usage.output_tokens,8);
 const replay=join(dir,'replay.json');assert.equal(call('--replay',out,'--out',replay).status,0);
 assert.deepEqual(JSON.parse(readFileSync(replay)).errors,r.errors);assert.equal(JSON.parse(readFileSync(replay)).matchesOriginal,true);
 const stop=join(dir,'stop.json');assert.equal(call('--openai','--case','valid','--repeat','3','--out',stop).status,1);
 const s=JSON.parse(readFileSync(stop));assert.equal(s.attempts.length,1);assert.equal(s.measurement.unattemptedTrials,2);assert.equal(s.errors[0].rejectedOutput,null);
 assert.equal(call('--openai','--out',stop).status,1);assert.deepEqual(JSON.parse(readFileSync(stop)),s);
});
test('custom exceptions remain private and failures never become safe refusals',t=>{
 const dir=mkdtempSync(join(tmpdir(),'northfield-custom-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const adapter=join(dir,'broken.mjs'),out=join(dir,'errors.json');
 writeFileSync(adapter,'export async function propose(){throw new Error("private adapter credential")}');
 const result=spawnSync(process.execPath,[runner,'--adapter',adapter,'--continue-on-error','--out',out],{encoding:'utf8'});
 const text=readFileSync(out,'utf8'),r=JSON.parse(text);assert.equal(result.status,1);assert.equal(r.errors.length,12);assert.equal(r.runs.length,0);
 assert.equal(r.measurement.plannedValidTasks,4);assert.equal(r.measurement.tokens.input_tokens.value,null);
 assert.ok(!text.includes('private adapter credential'));assert.ok(!result.stderr.includes('private adapter credential'));
});
