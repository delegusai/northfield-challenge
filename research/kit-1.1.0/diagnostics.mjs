// Diagnostics are local evidence, not a guarantee that a report is safe to publish.
export const KIT_VERSION = '1.1.0';
export const REPORT_VERSION = 'northfield-report/1.1.0';
export function tokenUsage(value) {
 const out = {};
 for (const key of ['input_tokens', 'output_tokens', 'total_tokens']) {
  if (Number.isSafeInteger(value?.[key]) && value[key] >= 0) out[key] = value[key];
 }
 for (const [group, key] of [['input_tokens_details', 'cached_tokens'], ['output_tokens_details', 'reasoning_tokens']]) {
  if (Number.isSafeInteger(value?.[group]?.[key]) && value[group][key] >= 0) out[group] = {[key]: value[group][key]};
 }
 return Object.keys(out).length ? out : null;
}
export function rejectedExcerpt(text, secrets = []) {
 if (typeof text !== 'string') return null;
 // Redact before truncation so a cut through a credential does not expose its prefix.
 for (const secret of secrets.filter(s => typeof s === 'string' && s.length)) text = text.split(secret).join('[REDACTED]');
 text = text.replace(/\b(?:sk-[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|AKIA[A-Z0-9]{16})\b/g, '[REDACTED]')
  .replace(/\bBearer\s+[^\s"'\\,}]+/gi, 'Bearer [REDACTED]')
  .replace(/(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, '$1"[REDACTED]"')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
 return {text: text.slice(0, 4096), truncated: text.length > 4096, redaction: 'known-secret-and-patterns/1'};
}
export class ProposalError extends Error {
 constructor(code, message, details = {}) {
  super(message);
  this.name = 'ProposalError';
  this.diagnostic = {code, ...details};
 }
}
export function measurementSummary(runs, errors, attempts, plannedTrials, plannedValidTasks) {
 const observed = [...runs, ...errors].map(r => r.usage).filter(Boolean);
 const tokens = {};
 for (const key of ['input_tokens', 'output_tokens', 'total_tokens']) {
  const values = observed.filter(u => Number.isSafeInteger(u[key]));
  tokens[key] = {value: values.length ? values.reduce((sum, u) => sum + u[key], 0) : null, attemptsWithValue: values.length};
 }
 const times = attempts.map(a => a.latencyMs).filter(Number.isFinite).sort((a,b) => a-b);
 const n = times.length;
 return {plannedTrials, attemptedTrials: attempts.length, unattemptedTrials: plannedTrials-attempts.length,
  completedTrials: runs.length, errorTrials: errors.length, plannedValidTasks,
  legitimateCompleted: runs.filter(r => r.result.enforced.legitimateCompleted).length,
  medianAttemptMs: n ? (times[Math.floor((n-1)/2)] + times[Math.floor(n/2)])/2 : null,
  tokens, tokenScope: 'Reported fields from completed and failed attempts; missing fields are unknown. Not a billing total.'};
}
