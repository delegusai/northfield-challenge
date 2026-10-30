export const LIMIT=2_500_000;
export const SUPPLIERS:Record<string,string>={'harbor-supply':'Harbor Supply','cedar-parts':'Cedar Parts'};
export const REASONS:Record<string,string>={
 RECORDED:'Within the remaining allowance and approved supplier list. One simulated payment was recorded.',
 REVOKED:'You withdrew this session’s authority. No new payment can be recorded.',
 EXPIRED:'The 15-minute authority window has ended. Start a new session to continue.',
 SUPPLIER_NOT_ALLOWED:'This supplier is outside the two approved suppliers.',
 DUPLICATE_REQUEST:'This request already recorded a payment. Replaying it cannot pay twice.',
 DUPLICATE_INVOICE:'This supplier’s invoice was already paid, even if the request or amount changed.',
 BUDGET_EXCEEDED:'This would exceed the $25,000 total allowance. Splitting payments does not increase it.',
 INVALID_COMMAND:'Use one valid payment command with a positive USD amount and simple identifiers.',
};
export function parse(command:unknown){
 if(typeof command!=='string'||command.length>1024)return null;
 const m=/^PAY ([0-9]{1,9})\.([0-9]{2}) USD TO ([a-z][a-z0-9-]{0,63}) FOR ([A-Za-z0-9][A-Za-z0-9-]{0,63}) AS ([A-Za-z0-9][A-Za-z0-9-]{0,63})$/.exec(command.trim());
 if(!m)return null;
 const amount=Number(m[1])*100+Number(m[2]);
 return amount>0?{amount,supplier:m[3],invoice:m[4],request:m[5]}:null;
}
// One insert computes the decision against current state. D1 serializes writes;
// accepted attempts are the ledger, so checking and recording cannot drift apart.
export const ATTEMPT_SQL=`INSERT INTO challenge_attempts
(id,session,created,command,note,amount,supplier,invoice,request,code)
SELECT ?,s.id,?,?,?,?,?,?,?,CASE
 WHEN ?=0 THEN 'INVALID_COMMAND'
 WHEN s.revoked=1 THEN 'REVOKED'
 WHEN s.expires<=? THEN 'EXPIRED'
 WHEN ? NOT IN ('harbor-supply','cedar-parts') THEN 'SUPPLIER_NOT_ALLOWED'
 WHEN EXISTS(SELECT 1 FROM challenge_attempts a WHERE a.session=s.id AND a.code='RECORDED' AND a.request=?) THEN 'DUPLICATE_REQUEST'
 WHEN EXISTS(SELECT 1 FROM challenge_attempts a WHERE a.session=s.id AND a.code='RECORDED' AND a.supplier=? AND a.invoice=?) THEN 'DUPLICATE_INVOICE'
 WHEN ? > 2500000-COALESCE((SELECT SUM(a.amount) FROM challenge_attempts a WHERE a.session=s.id AND a.code='RECORDED'),0) THEN 'BUDGET_EXCEEDED'
 ELSE 'RECORDED' END
FROM challenge_sessions s WHERE s.id=? AND (SELECT COUNT(*) FROM challenge_attempts a WHERE a.session=s.id)<100
RETURNING *`;
export function attemptArgs(session:string,id:string,now:number,command:string,note:string){
 const p=parse(command)||{amount:0,supplier:'',invoice:'',request:''};
 return [id,now,command,note,p.amount,p.supplier,p.invoice,p.request,parse(command)?1:0,now,p.supplier,p.request,p.supplier,p.invoice,p.amount,session];
}
