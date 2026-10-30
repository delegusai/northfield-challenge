#!/usr/bin/env node
import {readFile,mkdir,writeFile,rename,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {SCENARIOS,SUITE_VERSION} from '../kit/suite.mjs';
import {VERSION,compare,summarize} from '../kit/authority.mjs';
import {PROMPT,openAIProposal,modelPayload} from '../kit/model.mjs';
const plan=JSON.parse(await readFile(new URL('plan.json',import.meta.url)));
const out=process.argv[2];
if(!out||!process.env.OPENAI_API_KEY)throw new Error('Usage: node run.mjs <new-output-directory>; set OPENAI_API_KEY in the local environment. Makes 108 billed calls.');
await mkdir(out,{recursive:false});
const sourceHashes={};for(const name of ['authority.mjs','suite.mjs','model.mjs','runner.mjs'])sourceHashes[name]=createHash('sha256').update(await readFile(new URL('../kit/'+name,import.meta.url))).digest('hex');
await writeFile(resolve(out,'plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
async function runModel(model){
 const report={study:plan.id,protocol:VERSION,suite:SUITE_VERSION,at:new Date().toISOString(),mode:'agent-evaluation',prompt:PROMPT,modelSettings:{model,max_output_tokens:1500,reasoning:{effort:'low'},schema:modelPayload(SCENARIOS[0],model).text.format},sourceHashes,plannedTrials:SCENARIOS.length*plan.repetitions,errors:[],attempts:[],runs:[],conditions:plan.comparison};
 const file=resolve(out,model+'.json');
 for(let trial=1;trial<=plan.repetitions;trial++)for(const scenario of SCENARIOS){
  const started=Date.now(),at=new Date().toISOString();
  try{
   const answer=await openAIProposal(scenario,{key:process.env.OPENAI_API_KEY,model});
   const {fixture,...publicScenario}=scenario;
   report.runs.push({scenario:publicScenario,trial,source:'live-model',at,...answer,result:compare(publicScenario,answer.proposal)});
   report.attempts.push({case:scenario.id,trial,at,status:'completed',latencyMs:answer.latencyMs});
  }catch(error){
   report.errors.push({case:scenario.id,trial,at,message:error.message});
   report.attempts.push({case:scenario.id,trial,at,status:'error',latencyMs:Date.now()-started});
  }
  report.summary=summarize(report.runs);report.completedAt=new Date().toISOString();
  await writeFile(file+'.partial',JSON.stringify(report,null,2)+'\n');await rename(file+'.partial',file);
  console.log(`${model}: ${report.attempts.length}/${report.plannedTrials}, ${report.errors.length} errors`);
 }
 return {model,completed:report.runs.length,errors:report.errors.length};
}
console.log(JSON.stringify(await Promise.all(plan.models.map(runModel))));
