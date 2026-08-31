import handler from './api/interpret-rubric.js';

let pass = 0, fail = 0;
function check(name, cond) { if (cond) pass++; else { fail++; console.error('FAIL:', name); } }

function mockRes() {
  return {
    _status: null, _json: null,
    status(s) { this._status = s; return this; },
    json(j) { this._json = j; return this; },
  };
}

// Every request gets its own client IP by default so tests never contaminate
// each other's rate-limit bucket; pass an explicit x-forwarded-for to opt out
// (used by the rate-limit tests themselves).
let ipSeq = 0;
function makeReq({ method = 'POST', body = {}, headers = {} } = {}) {
  ipSeq++;
  return {
    method,
    body,
    headers: { 'x-forwarded-for': `198.51.100.${ipSeq}`, host: 'handoff.example.com', ...headers },
  };
}

function happyUpstream(rules = [{ field: 'Employees', operator: 'between', value: '50-500', weight: 10 }], threshold = 10) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ rules, threshold }) }] } }],
    }),
  };
}

process.env.GEMINI_API_KEY = 'test-key-not-real';

// ---- happy path: mock Gemini returning a well-formed schema response ----
global.fetch = async (url, opts) => {
  check('calls the correct endpoint', url.includes('generateContent'));
  check('sends api key header', opts.headers['x-goog-api-key'] === 'test-key-not-real');
  const body = JSON.parse(opts.body);
  check('sends responseSchema', !!body.generationConfig.responseSchema);
  check('constrains field to real columns', JSON.stringify(body.generationConfig.responseSchema.properties.rules.items.properties.field.enum) === JSON.stringify(['Company', 'Employees', 'Industry']));
  return happyUpstream(
    [
      { field: 'Employees', operator: 'between', value: '50-500', weight: 10 },
      { field: 'Industry', operator: 'in_list', value: 'SaaS,Fintech', weight: 5 },
    ],
    10
  );
};

const res1 = mockRes();
await handler(makeReq({ body: { rubricText: 'prioritise 50-500 employee SaaS or fintech companies', columns: ['Company', 'Employees', 'Industry'] } }), res1);
check('happy path returns 200', res1._status === 200);
check('happy path returns 2 rules', res1._json.rules.length === 2);
check('happy path returns threshold', res1._json.threshold === 10);

// ---- Gemini invents a field not in the schema enum somehow (defensive filtering) ----
global.fetch = async () => happyUpstream(
  [
    { field: 'Employees', operator: 'between', value: '50-500', weight: 10 },
    { field: 'MadeUpField', operator: 'equals', value: 'x', weight: 5 },
  ],
  5
);
const res2 = mockRes();
await handler(makeReq({ body: { rubricText: 'test', columns: ['Company', 'Employees'] } }), res2);
check('filters out rules with invalid fields even if the model hallucinates one', res2._json.rules.length === 1);

// ---- Gemini returns unparseable JSON ----
global.fetch = async () => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text: 'not valid json{{{' }] } }] }),
});
const res4 = mockRes();
await handler(makeReq({ body: { rubricText: 'test', columns: ['Company'] } }), res4);
check('malformed JSON from model returns 502, does not crash', res4._status === 502);

// ---- missing inputs ----
const res5 = mockRes();
await handler(makeReq({ body: { rubricText: '', columns: [] } }), res5);
check('missing rubricText/columns returns 400', res5._status === 400);

// ---- wrong HTTP method ----
const res6 = mockRes();
await handler(makeReq({ method: 'GET', body: {} }), res6);
check('non-POST returns 405', res6._status === 405);

// ---- origin / referer check ----
global.fetch = async () => happyUpstream();

const crossOriginRes = mockRes();
await handler(
  makeReq({ body: { rubricText: 'test', columns: ['Company'] }, headers: { origin: 'https://evil.example.com' } }),
  crossOriginRes
);
check('cross-origin Origin header is rejected with 403', crossOriginRes._status === 403);

const crossRefererRes = mockRes();
await handler(
  makeReq({ body: { rubricText: 'test', columns: ['Company'] }, headers: { referer: 'https://evil.example.com/page' } }),
  crossRefererRes
);
check('cross-origin Referer header is rejected with 403', crossRefererRes._status === 403);

const sameOriginRes = mockRes();
await handler(
  makeReq({ body: { rubricText: 'test', columns: ['Company'] }, headers: { origin: 'https://handoff.example.com' } }),
  sameOriginRes
);
check('matching Origin header is allowed', sameOriginRes._status === 200);

const noOriginRes = mockRes();
await handler(makeReq({ body: { rubricText: 'test', columns: ['Company'] } }), noOriginRes);
check('no Origin/Referer header at all is allowed', noOriginRes._status === 200);

// ---- input size caps ----
global.fetch = async () => { throw new Error('fetch should not be called for a rejected request'); };

const oversizedRubricRes = mockRes();
await handler(makeReq({ body: { rubricText: 'x'.repeat(2001), columns: ['Company'] } }), oversizedRubricRes);
check('oversized rubricText is rejected with 400', oversizedRubricRes._status === 400);
check('oversized rubricText error message is clear', /2000/.test(oversizedRubricRes._json.error));

const oversizedColumnsRes = mockRes();
await handler(
  makeReq({ body: { rubricText: 'test', columns: Array.from({ length: 51 }, (_, i) => `Col${i}`) } }),
  oversizedColumnsRes
);
check('oversized columns array is rejected with 400', oversizedColumnsRes._status === 400);
check('oversized columns error message is clear', /50/.test(oversizedColumnsRes._json.error));

// ---- rate limiting ----
global.fetch = async () => happyUpstream();
const rateLimitedClient = '192.0.2.50';
let lastRateLimitRes;
for (let i = 0; i < 11; i++) {
  lastRateLimitRes = mockRes();
  await handler(
    makeReq({ body: { rubricText: 'a good lead is 50-500 employees', columns: ['Company'] }, headers: { 'x-forwarded-for': rateLimitedClient } }),
    lastRateLimitRes
  );
}
check('11th request from the same client within the window is rate limited', lastRateLimitRes._status === 429);

const otherClientRes = mockRes();
await handler(
  makeReq({ body: { rubricText: 'a good lead is 50-500 employees', columns: ['Company'] }, headers: { 'x-forwarded-for': '192.0.2.99' } }),
  otherClientRes
);
check('a different client is unaffected by another client\'s rate limit', otherClientRes._status === 200);

// ---- Gemini upstream: 4xx never retries ----
{
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return { ok: false, status: 429, text: async () => 'rate limited upstream' };
  };
  const res3 = mockRes();
  await handler(makeReq({ body: { rubricText: 'test', columns: ['Company'] } }), res3);
  check('upstream 4xx returns 502 with a message', res3._status === 502 && res3._json.error.includes('429'));
  check('upstream 4xx is never retried', calls === 1);
}

// ---- Gemini upstream: 5xx retries exactly once, succeeds on the second attempt ----
{
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503, text: async () => 'temporarily unavailable' };
    return happyUpstream();
  };
  const retryRes = mockRes();
  await handler(makeReq({ body: { rubricText: 'test', columns: ['Company', 'Employees'] } }), retryRes);
  check('5xx followed by success returns 200', retryRes._status === 200);
  check('5xx retried exactly once', calls === 2);
}

// ---- Gemini upstream: persistent timeout returns 504, never hangs ----
{
  let calls = 0;
  global.fetch = async () => {
    calls++;
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  };
  const timeoutRes = mockRes();
  await handler(makeReq({ body: { rubricText: 'test', columns: ['Company'] } }), timeoutRes);
  check('persistent timeout returns 504', timeoutRes._status === 504);
  check('persistent timeout retried exactly once before giving up', calls === 2);
}

// ---- missing API key (must run last: this permanently clears it for the process) ----
delete process.env.GEMINI_API_KEY;
const res7 = mockRes();
await handler(makeReq({ body: { rubricText: 'test', columns: ['Company'] } }), res7);
check('missing API key returns clear 500, not a crash', res7._status === 500 && res7._json.error.includes('GEMINI_API_KEY'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
