#!/usr/bin/env node
import {readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {VERSION,compare,summarize,validateProposal} from './authority.mjs';
import {SCENARIOS,SUITE_VERSION} from './suite.mjs';
import {PROMPT,taskInput,openAIProposal,modelPayload} from './model.mjs';
import {KIT_VERSION,REPORT_VERSION,ProposalError,measurementSummary} from './diagnostics.mjs';
const args=process.argv.slice(2),flag=name=>args.includes(name),option=(name,fallback)=>{const i=args.indexOf(name);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`${name} needs a value`);return args[i+1];};
async function main(){
 if(flag('--help')||!args.length){console.log('Northfield research runner (Node 22+)\nnode runner.mjs --fixture [--out report.json]\nnode runner.mjs --openai --model gpt-5.4-mini [--case valid] [--repeat 3]\nnode runner.mjs --adapter ./my-agent.mjs [--repeat 3] [--label my-agent-v1]\nnode runner.mjs --replay report.json [--out replay.json]\nAdd --continue-on-error to attempt every planned slot (no retries).\nAdd --capture-rejected-output for bounded, redacted OpenAI output excerpts; review before sharing.\nAdd --ci to exit 1 for unsafe execution, intent mismatches, or failed legitimate tasks in the enforced path.\nModel runs use your local credentials and incur provider charges. Fixture/replay mode makes no network requests.');return;}
 const modes=['--fixture','--openai','--adapter','--replay'].filter(flag);if(modes.length!==1)throw new Error('Choose exactly one mode.');
 const output=option('--out','northfield-report.json');
 try{await access(output);throw new Error('Output already exists; choose another --out path.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const sourceHashes={};for(const name of ['authority.mjs','suite.mjs','model.mjs','runner.mjs','diagnostics.mjs'])sourceHashes[name]=createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex');
 if(flag('--replay')){
  const original=JSON.parse(await readFile(option('--replay'),'utf8'));
  if(original.protocol!==VERSION||original.suite!==SUITE_VERSION||!Array.isArray(original.runs)||original.runs.length>1200)throw new Error('Unsupported report or protocol.');
  for(const name of ['authority.mjs','suite.mjs','model.mjs','diagnostics.mjs'])if(original.sourceHashes?.[name]!==sourceHashes[name])throw new Error(`Source hash mismatch for ${name}; use the kit matching this report.`);
  const runs=original.runs.map(r=>({...r,result:compare(r.scenario,r.proposal)}));
  const report={...original,mode:'recorded-proposal-replay',replayedAt:new Date().toISOString(),runs,summary:summarize(runs),matchesOriginal:runs.every((r,i)=>JSON.stringify(r.result)===JSON.stringify(original.runs[i].result))};
  await writeFile(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({output,matchesOriginal:report.matchesOriginal,summary:report.summary},null,2));if(!report.matchesOriginal)process.exitCode=1;return;
 }
 const count=Number(option('--repeat','1'));if(!Number.isInteger(count)||count<1||count>100)throw new Error('--repeat must be 1–100.');
 const caseId=option('--case',null),suite=SCENARIOS.filter(s=>!caseId||s.id===caseId);if(!suite.length)throw new Error('Unknown case ID.');
 const adapter=flag('--adapter')?(await import(pathToFileURL(resolve(option('--adapter'))).href)).propose:null;if(flag('--adapter')&&typeof adapter!=='function')throw new Error('Adapter must export async propose(input).');
 const runs=[],errors=[],attempts=[];
 outer: for(const scenario of suite)for(let trial=1;trial<=count;trial++){
  const started=Date.now(),at=new Date().toISOString();let answer;
  try{
  if(flag('--fixture'))answer={proposal:scenario.fixture,model:null,latencyMs:null,usage:null};
  else if(adapter)answer={proposal:validateProposal(await adapter(structuredClone(taskInput(scenario)))),model:option('--label','custom-adapter'),latencyMs:Date.now()-started,usage:null};
  else answer=await openAIProposal(scenario,{key:process.env.OPENAI_API_KEY,model:option('--model','gpt-5.4-mini'),captureRejectedOutput:flag('--capture-rejected-output')});
  const {fixture,...publicScenario}=scenario;runs.push({scenario:publicScenario,trial,source:flag('--fixture')?'scripted-fixture':adapter?'custom-adapter':'live-model',...answer,result:compare(publicScenario,answer.proposal)});
  attempts.push({case:scenario.id,trial,at,status:'completed',latencyMs:answer.latencyMs});
  console.error(`Completed ${scenario.id} trial ${trial}`);
  }catch(error){
   const known=!adapter&&error instanceof ProposalError;
   const diagnostic=known?error.diagnostic:{code:'adapter_error',stage:'custom_adapter',usage:null,rejectedOutput:null};
   const failure={case:scenario.id,trial,at,message:known?error.message:'Custom adapter failed or returned an invalid proposal. Review its local logs.',...diagnostic,latencyMs:Date.now()-started};
   errors.push(failure);attempts.push({case:scenario.id,trial,at,status:'error',latencyMs:failure.latencyMs});
   console.error(`Failed ${scenario.id} trial ${trial} (${failure.code})`);
   if(!flag('--continue-on-error'))break outer;
  }
 }
 const report={kit:KIT_VERSION,reportVersion:REPORT_VERSION,protocol:VERSION,suite:SUITE_VERSION,at:new Date().toISOString(),mode:flag('--fixture')?'scripted-fixture':'agent-evaluation',prompt:adapter?null:PROMPT,modelSettings:flag('--openai')?{model:option('--model','gpt-5.4-mini'),max_output_tokens:1500,reasoning:{effort:'low'},schema:modelPayload(suite[0],option('--model','gpt-5.4-mini')).text.format}:null,sourceHashes,plannedTrials:suite.length*count,errors,attempts,execution:{continueOnError:flag('--continue-on-error'),captureRejectedOutput:flag('--capture-rejected-output'),retries:0},measurement:measurementSummary(runs,errors,attempts,suite.length*count,suite.filter(s=>s.expected==='pay').length*count),conditions:'Same proposal in two simulated paths. Syntax checked in both. Independent authority enforced only in the second. No human review, tool-use loop or real payments.',runs,summary:summarize(runs)};
 await writeFile(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({output,summary:report.summary},null,2));
 if(errors.length){console.error('Errors saved in report; failed attempts are not successful safety refusals.');process.exitCode=1;}
 const m=report.summary.enforced;if(flag('--ci')&&(m.unauthorizedExecuted||m.intentMismatches||m.validRequestBlocked))process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
