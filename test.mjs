import { parseCSV, detectColumns, cleanDomain, cleanSize, buildRecords, parseRange, toCSV } from './src/lib/csv.js';
import { evaluateRule, scoreRecord, applyRules, describeRule, describeMatches } from './src/lib/rules.js';

function buildFromText(text) {
  const parsedRows = parseCSV(text);
  const header = parsedRows[0] || [];
  const cols = detectColumns(header);
  return buildRecords(parsedRows.slice(1), header, cols);
}

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

// ---- threshold parsing: empty/whitespace/non-numeric means "unset", not 0 ----
const emptyThresholdApplied = applyRules(records, rules, '');
check('empty string threshold yields qualified: null for every record', emptyThresholdApplied.every(r => r.qualified === null));
check('empty string threshold still computes a real score', emptyThresholdApplied.every(r => typeof r.score === 'number'));

const whitespaceThresholdApplied = applyRules(records, rules, '   ');
check('whitespace-only threshold yields qualified: null for every record', whitespaceThresholdApplied.every(r => r.qualified === null));

const nonNumericThresholdApplied = applyRules(records, rules, 'not a number');
check('non-numeric threshold yields qualified: null for every record', nonNumericThresholdApplied.every(r => r.qualified === null));

const undefinedThresholdApplied = applyRules(records, rules, undefined);
check('undefined threshold yields qualified: null for every record', undefinedThresholdApplied.every(r => r.qualified === null));

const zeroThresholdApplied = applyRules(records, rules, 0);
check('numeric 0 threshold is treated as valid, not unset', zeroThresholdApplied.every(r => r.qualified !== null));
check('numeric 0 threshold qualifies a non-negative score', zeroThresholdApplied.find(r => r.company === 'Nimbus Data').qualified === true);

const zeroStringThresholdApplied = applyRules(records, rules, '0');
check('string "0" threshold is treated as valid, not unset', zeroStringThresholdApplied.every(r => r.qualified !== null));

// ---- CSV injection protection on export ----
const exportBase = (company) => ({
  company, contact: 'C', email: 'e@x.com', domain: 'x.com', size: '10',
  score: 5, qualified: true, hygiene: 'ready', hygieneNote: 'Clean', matchedRulesText: '',
});
function exportDataLine(record) {
  return toCSV([record]).split('\n')[1];
}
check('neutralizes = formula injection', exportDataLine(exportBase('=SUM(A1:A9)')).startsWith(`"'=SUM(A1:A9)"`));
check('neutralizes + formula injection', exportDataLine(exportBase('+1+1')).startsWith(`"'+1+1"`));
check('neutralizes - formula injection', exportDataLine(exportBase('-1+1')).startsWith(`"'-1+1"`));
check('neutralizes @ formula injection', exportDataLine(exportBase('@SUM(1)')).startsWith(`"'@SUM(1)"`));
check('applies the formula guard to every exported field, not just company', exportDataLine({ ...exportBase('Acme'), contact: '=cmd|calc' }).includes(`"'=cmd|calc"`));
check('leaves normal values completely untouched', exportDataLine(exportBase('Acme Corp')).includes('"Acme Corp"'));
check('does not add a stray leading quote to a normal value', !exportDataLine(exportBase('Acme Corp')).includes("'Acme Corp"));

// ---- rule audit descriptions ("why did this lead get this score") ----
check('describes a between rule in plain language', describeRule({ field: 'Employees', operator: 'between', value: '50-500', weight: 20 }) === 'Employees is between 50-500 → +20');
check('describes an in_list rule with friendly comma spacing', describeRule({ field: 'Industry', operator: 'in_list', value: 'SaaS,Fintech', weight: 15 }) === 'Industry is one of SaaS, Fintech → +15');
check('describes a negative-weight rule with a minus sign', describeRule({ field: 'Email', operator: 'contains', value: 'gmail', weight: -3 }) === 'Email contains gmail → -3');
check('describeMatches resolves matched ids back to rule text', describeMatches(['r1', 'r2'], rules).length === 2);
check('describeMatches ignores unknown ids without throwing', describeMatches(['not-a-real-id'], rules).length === 0);

// ---- ragged rows: fewer or more columns than the header ----
const raggedCsv = [
  'Company,Contact,Email,Domain,Employees',
  'ShortRow,OnlyTwoFields',
  'LongRow,A Contact,long@example.com,long.com,50,ExtraCol1,ExtraCol2',
].join('\n');
const raggedRecords = buildFromText(raggedCsv);
check('ragged rows do not throw', raggedRecords.length === 2);
check('row with fewer columns than header gets empty string for missing fields', raggedRecords[0].email === '' && raggedRecords[0].size === '');
check('row with more columns than header still parses the mapped fields', raggedRecords[1].company === 'LongRow' && raggedRecords[1].domain === 'long.com');

// ---- duplicate header names: first match wins, consistently ----
const dupHeaderCols = detectColumns(['Company', 'Email', 'Email']);
check('duplicate header names: column detection picks the first match', dupHeaderCols.email === 1);

// ---- empty and near-empty CSVs ----
check('completely empty CSV produces zero records without error', buildFromText('').length === 0);
check('whitespace-only CSV produces zero records without error', buildFromText('   \n   \n').length === 0);
check('header-only CSV with zero data rows produces zero records', buildFromText('Company,Contact,Email,Domain,Employees').length === 0);

// ---- extremely long field values ----
const longCompanyName = 'A'.repeat(10000) + ' Corp';
const longFieldRecords = buildFromText(`Company,Contact,Email\n${longCompanyName},John,j@example.com`);
check('extremely long field value cleans without error', longFieldRecords.length === 1);
check('extremely long field value is not truncated', longFieldRecords[0].company === longCompanyName);

// ---- unicode and RTL text ----
const unicodeCsv = [
  'Company,Contact,Email',
  'شركة الأمل,محمد أحمد,m@example.com',
  '株式会社サンプル,田中太郎,t@example.jp',
].join('\n');
const unicodeRecords = buildFromText(unicodeCsv);
check('Arabic (RTL) company name round-trips intact', unicodeRecords[0].company === 'شركة الأمل');
check('Arabic (RTL) contact name round-trips intact', unicodeRecords[0].contact === 'محمد أحمد');
check('Japanese company name round-trips intact', unicodeRecords[1].company === '株式会社サンプル');
check('Japanese contact name round-trips intact', unicodeRecords[1].contact === '田中太郎');

// ---- every operator with a malformed value: never throws, simply no match ----
const malformedTargetRecord = records.find(r => r.company === 'Acme Robotics' && r.contact === 'Dana Cole');
check(
  'between with a non-range string evaluates to no match, does not throw',
  evaluateRule(malformedTargetRecord, { field: 'Employees', operator: 'between', value: 'not-a-range', weight: 5 }) === false
);
check(
  'greater_than with a non-numeric value evaluates to no match, does not throw',
  evaluateRule(malformedTargetRecord, { field: 'Employees', operator: 'greater_than', value: 'abc', weight: 5 }) === false
);
check(
  'less_than with a non-numeric value evaluates to no match, does not throw',
  evaluateRule(malformedTargetRecord, { field: 'Employees', operator: 'less_than', value: 'abc', weight: 5 }) === false
);
check(
  'a rule with an empty field evaluates to no match, does not throw',
  evaluateRule(malformedTargetRecord, { field: '', operator: 'contains', value: 'x', weight: 5 }) === false
);
check(
  'a rule with an unrecognized operator evaluates to no match, does not throw',
  evaluateRule(malformedTargetRecord, { field: 'Company', operator: 'frobnicate', value: 'x', weight: 5 }) === false
);
check(
  'scoreRecord runs a batch of malformed rules without throwing',
  scoreRecord(malformedTargetRecord, [
    { id: 'm1', field: 'Employees', operator: 'between', value: 'not-a-range', weight: 5 },
    { id: 'm2', field: 'Employees', operator: 'greater_than', value: 'abc', weight: 5 },
    { id: 'm3', field: '', operator: 'contains', value: 'x', weight: 5 },
    { id: 'm4', field: 'Company', operator: 'frobnicate', value: 'x', weight: 5 },
  ]).score === 0
);

// ---- performance sanity checks (not strict benchmarks) ----
const manyRules = Array.from({ length: 200 }, (_, i) => ({
  id: `perf_${i}`, field: 'Employees', operator: 'greater_than', value: String(i), weight: 1,
}));
const perfStart1 = Date.now();
applyRules(records, manyRules, 10);
check('200 rules against a small dataset completes well under a second', Date.now() - perfStart1 < 1000);

const bigLines = ['Company,Contact,Email,Domain,Employees,Industry'];
for (let i = 0; i < 5000; i++) {
  bigLines.push(`Company ${i},Contact ${i},c${i}@example.com,example${i}.com,${(i % 900) + 1},Industry${i % 5}`);
}
const perfStart2 = Date.now();
const bigRecords = buildFromText(bigLines.join('\n'));
const bigApplied = applyRules(bigRecords, rules, 10);
check('parsing, cleaning, and scoring 5,000 rows completes well under a second', Date.now() - perfStart2 < 1000);
check('5,000-row CSV produces exactly 5,000 records, none dropped', bigApplied.length === 5000);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
