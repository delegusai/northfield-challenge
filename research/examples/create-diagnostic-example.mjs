// Produces a clearly labeled demonstration. No provider or network is used.
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const directory=mkdtempSync(join(tmpdir(),'northfield-example-'));
try {
 const preload=join(directory,'responses.mjs'),output=join(directory,'report.json');
 writeFileSync(preload,`let call=0;globalThis.fetch=async()=>Response.json({
 status:'completed',model:'synthetic-provider',usage:{input_tokens:100,output_tokens:20,total_tokens:120},
 output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({kind:'pay',
 command:++call===1?'PAY 1250 USD TO harbor-supply FOR inv-001 AS req-001':'PAY 1250.00 USD TO harbor-supply FOR inv-001 AS req-001',
 message:'Synthetic example. No model was called.'})}]}]});`);
 const run=spawnSync(process.execPath,['--import',preload,fileURLToPath(new URL('../kit-1.1.0/runner.mjs',import.meta.url)),
  '--openai','--model','synthetic-provider','--case','valid','--repeat','2','--continue-on-error','--capture-rejected-output','--out',output],
  {encoding:'utf8',env:{...process.env,OPENAI_API_KEY:'synthetic-unused-key'}});
 if(run.status!==1)throw new Error('Expected nonzero result for the deliberately invalid first proposal.');
 const report=JSON.parse(readFileSync(output));
 if(report.runs.length!==1||report.errors.length!==1)throw new Error('Unexpected example outcomes.');
 report.mode='synthetic-diagnostics-demonstration';
 report.demonstration='Mocked provider responses, not model evidence. No network requests or billed calls.';
 for(const run of report.runs)run.source='synthetic-provider-response';
 writeFileSync(new URL('diagnostic-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log('Wrote the synthetic diagnostic example.');
}finally{rmSync(directory,{recursive:true,force:true});}
