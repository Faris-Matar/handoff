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

process.env.GEMINI_API_KEY = 'test-key-not-real';

// ---- happy path: mock Gemini returning a well-formed schema response ----
global.fetch = async (url, opts) => {
  check('calls the correct endpoint', url.includes('generateContent'));
  check('sends api key header', opts.headers['x-goog-api-key'] === 'test-key-not-real');
  const body = JSON.parse(opts.body);
  check('sends responseSchema', !!body.generationConfig.responseSchema);
  check('constrains field to real columns', JSON.stringify(body.generationConfig.responseSchema.properties.rules.items.properties.field.enum) === JSON.stringify(['Company', 'Employees', 'Industry']));
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        rules: [
          { field: 'Employees', operator: 'between', value: '50-500', weight: 10 },
          { field: 'Industry', operator: 'in_list', value: 'SaaS,Fintech', weight: 5 },
        ],
        threshold: 10,
      }) }] } }],
    }),
  };
};

const req1 = { method: 'POST', body: { rubricText: 'prioritise 50-500 employee SaaS or fintech companies', columns: ['Company', 'Employees', 'Industry'] } };
const res1 = mockRes();
await handler(req1, res1);
check('happy path returns 200', res1._status === 200);
check('happy path returns 2 rules', res1._json.rules.length === 2);
check('happy path returns threshold', res1._json.threshold === 10);

// ---- Gemini invents a field not in the schema enum somehow (defensive filtering) ----
global.fetch = async () => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      rules: [
        { field: 'Employees', operator: 'between', value: '50-500', weight: 10 },
        { field: 'MadeUpField', operator: 'equals', value: 'x', weight: 5 },
      ],
      threshold: 5,
    }) }] } }],
  }),
});
const res2 = mockRes();
await handler({ method: 'POST', body: { rubricText: 'test', columns: ['Company', 'Employees'] } }, res2);
check('filters out rules with invalid fields even if the model hallucinates one', res2._json.rules.length === 1);

// ---- Gemini API errors out ----
global.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited' });
const res3 = mockRes();
await handler({ method: 'POST', body: { rubricText: 'test', columns: ['Company'] } }, res3);
check('upstream error returns 502 with a message', res3._status === 502 && res3._json.error.includes('429'));

// ---- Gemini returns unparseable JSON ----
global.fetch = async () => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text: 'not valid json{{{' }] } }] }),
});
const res4 = mockRes();
await handler({ method: 'POST', body: { rubricText: 'test', columns: ['Company'] } }, res4);
check('malformed JSON from model returns 502, does not crash', res4._status === 502);

// ---- missing inputs ----
const res5 = mockRes();
await handler({ method: 'POST', body: { rubricText: '', columns: [] } }, res5);
check('missing rubricText/columns returns 400', res5._status === 400);

// ---- wrong HTTP method ----
const res6 = mockRes();
await handler({ method: 'GET', body: {} }, res6);
check('non-POST returns 405', res6._status === 405);

// ---- missing API key ----
delete process.env.GEMINI_API_KEY;
const res7 = mockRes();
await handler({ method: 'POST', body: { rubricText: 'test', columns: ['Company'] } }, res7);
check('missing API key returns clear 500, not a crash', res7._status === 500 && res7._json.error.includes('GEMINI_API_KEY'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
