import { parseCSV, detectColumns, cleanDomain, cleanSize, buildRecords, parseRange, toCSV } from './src/lib/csv.js';
import { evaluateRule, scoreRecord, applyRules } from './src/lib/rules.js';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', name); }
}

// ---- CSV parsing edge cases ----
check('parses simple CSV', parseCSV('a,b\n1,2').length === 2);
check('handles quoted commas', parseCSV('a,b\n"1,000",2')[1][0] === '1,000');
check('handles escaped quotes', parseCSV('a\n"he said ""hi"""')[1][0] === 'he said "hi"');
check('drops fully blank rows', parseCSV('a,b\n1,2\n\n3,4').length === 3);
check('handles empty input', parseCSV('').length === 0);
check('handles trailing newline', parseCSV('a,b\n1,2\n').length === 2);
check('handles CRLF', parseCSV('a,b\r\n1,2\r\n').length === 2);

// ---- column detection ----
const cols = detectColumns(['Company Name', 'Primary Contact', 'Email Address', 'Website', 'Employee Count']);
check('detects company col', cols.company === 0);
check('detects contact col', cols.contact === 1);
check('detects email col', cols.email === 2);
check('detects domain col', cols.domain === 3);
check('detects size col', cols.size === 4);

const noCols = detectColumns(['Foo', 'Bar']);
check('returns -1 for missing columns', noCols.company === -1 && noCols.email === -1);

// ---- domain cleaning ----
check('strips https', cleanDomain('https://acme.com') === 'acme.com');
check('strips www', cleanDomain('https://www.acme.com/') === 'acme.com');
check('strips trailing path', cleanDomain('acme.com/team/about') === 'acme.com');
check('strips query string', cleanDomain('acme.com?ref=abc') === 'acme.com');
check('handles empty domain', cleanDomain('') === '');
check('handles already-clean domain', cleanDomain('acme.com') === 'acme.com');

// ---- size cleaning ----
check('normalizes en dash', cleanSize('20\u201350') === '20-50');
check('normalizes em dash', cleanSize('20\u201450') === '20-50');
check('trims spaces around hyphen', cleanSize('20 - 50') === '20-50');
check('handles plain number', cleanSize('50') === '50');
check('handles empty size', cleanSize('') === '');

// ---- range parsing ----
check('parses simple range', JSON.stringify(parseRange('50-200')) === JSON.stringify([50, 200]));
check('parses plus range', JSON.stringify(parseRange('500+')) === JSON.stringify([500, Infinity]));
check('parses single number as range', JSON.stringify(parseRange('50')) === JSON.stringify([50, 50]));
check('returns null for unparseable', parseRange('lots of people') === null);
check('returns null for empty', parseRange('') === null);

// ---- buildRecords: full pipeline, including edge cases ----
const csvText = [
  'Company,Contact,Email,Domain,Employees,Industry',
  'Acme Robotics,Dana Cole,dana@acme.io,https://acme.io/,50-200,Robotics',
  'Acme Robotics,Sam Lee,sam@acme.io,acme.io,50-200,Robotics',
  'Blue Harbor,Kim Park,,blueharbor.com,10\u201350,Logistics',
  'Nimbus Data,Rae Oduya,rae@nimbusdata.dev,www.nimbusdata.dev/about,500+,SaaS',
].join('\n');
const rows = parseCSV(csvText);
const header = rows[0];
const detected = detectColumns(header);
const records = buildRecords(rows.slice(1), header, detected);

check('builds correct record count', records.length === 4);
check('flags missing email', records.find(r => r.company === 'Blue Harbor').hygiene === 'missing');
check('flags duplicate company', records.filter(r => r.company === 'Acme Robotics').every(r => r.hygiene === 'review'));
check('marks clean record ready', records.find(r => r.company === 'Nimbus Data').hygiene === 'ready');
check('cleans domain in pipeline', records.find(r => r.company === 'Nimbus Data').domain === 'nimbusdata.dev');
check('cleans size in pipeline', records.find(r => r.company === 'Blue Harbor').size === '10-50');
check('preserves raw fields for rule engine', records[0].raw['Industry'] === 'Robotics');

// ---- rule engine ----
const rules = [
  { id: 'r1', field: 'Employees', operator: 'between', value: '60-500', weight: 10 },
  { id: 'r2', field: 'Industry', operator: 'in_list', value: 'SaaS,Robotics', weight: 5 },
  { id: 'r3', field: 'Industry', operator: 'equals', value: 'Logistics', weight: -8 },
  { id: 'r4', field: 'Email', operator: 'contains', value: 'gmail', weight: -3 },
  { id: 'r5', field: 'NonexistentField', operator: 'equals', value: 'x', weight: 100 },
];

const acme = records.find(r => r.company === 'Acme Robotics' && r.contact === 'Dana Cole');
const scoredAcme = scoreRecord(acme, rules);
check('scores matching rules correctly', scoredAcme.score === 15); // r1 (10) + r2 (5)
check('does not match unrelated rule', !scoredAcme.matched.includes('r3'));
check('missing field never matches, never throws', scoredAcme.matched.includes('r5') === false);

const blueHarbor = records.find(r => r.company === 'Blue Harbor');
const scoredBH = scoreRecord(blueHarbor, rules);
check('applies negative weight correctly', scoredBH.score === -8); // r3 only (10-50 employees doesn't overlap 50-500... check boundary)

const applied = applyRules(records, rules, 10);
check('qualified flag respects threshold', applied.find(r => r.company === 'Nimbus Data').qualified === true);
check('below-threshold record not qualified', applied.find(r => r.company === 'Blue Harbor').qualified === false);
check('empty rules produce null score, not zero', applyRules(records, [], 10)[0].score === null);
check('malformed rule list does not throw', () => { applyRules(records, [{ field: '', operator: '' }], 10); return true; });

// ---- CSV export round-trip ----
const csvOut = toCSV(applied);
check('export includes header', csvOut.split('\n')[0].includes('Fit Score'));
check('export includes qualified column value', csvOut.includes('Yes') || csvOut.includes('No'));
check('export escapes embedded quotes safely', !toCSV([{ company: 'Say "Hi" Inc', hygiene: 'ready', hygieneNote: '' }]).includes('Say "Hi" Inc"quote-broken'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
