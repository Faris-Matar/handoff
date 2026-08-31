// CSV parsing, column detection, and data hygiene cleaning.
// Pure functions, no side effects, fully unit-testable.

export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const t = String(text ?? '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i], next = t[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip, \n handles the break */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

// When two header names both match the same field (e.g. two columns named
// "Email"), findIndex's left-to-right scan means the first match always wins.
export function detectColumns(header) {
  const norm = header.map(h => (h || '').trim().toLowerCase());
  const find = (...keys) => {
    for (const k of keys) {
      const idx = norm.findIndex(h => h.includes(k));
      if (idx !== -1) return idx;
    }
    return -1;
  };
  return {
    company: find('company', 'account', 'organisation', 'organization'),
    contact: find('contact', 'name'),
    email: find('email'),
    domain: find('domain', 'website', 'url'),
    size: find('employee', 'size', 'headcount'),
  };
}

export function cleanDomain(raw) {
  if (!raw) return '';
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0];
  d = d.split('?')[0];
  return d.trim();
}

export function cleanSize(raw) {
  if (!raw) return '';
  return raw
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-') // figure/en/em/horizontal-bar dashes -> hyphen
    .replace(/\s*-\s*/g, '-')
    .trim();
}

export function normCompany(raw) {
  return (raw || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Parses a "50-200" style range into [min, max]. Returns null if not parseable.
export function parseRange(raw) {
  if (!raw) return null;
  const cleaned = cleanSize(raw);
  const plusMatch = cleaned.match(/^(\d+)\+$/);
  if (plusMatch) return [Number(plusMatch[1]), Infinity];
  const rangeMatch = cleaned.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) return [Number(rangeMatch[1]), Number(rangeMatch[2])];
  const singleMatch = cleaned.match(/^(\d+)$/);
  if (singleMatch) return [Number(singleMatch[1]), Number(singleMatch[1])];
  return null;
}

// Builds the raw row objects with hygiene fields cleaned, before scoring.
export function buildRecords(bodyRows, header, cols) {
  const companyCounts = {};
  bodyRows.forEach(r => {
    const key = normCompany(r[cols.company]);
    if (key) companyCounts[key] = (companyCounts[key] || 0) + 1;
  });

  return bodyRows.map((r, i) => {
    const raw = {};
    header.forEach((h, idx) => { raw[h.trim() || `col_${idx}`] = r[idx] ?? ''; });

    const company = (cols.company !== -1 ? r[cols.company] : '') || '(no company listed)';
    const contact = cols.contact !== -1 ? (r[cols.contact] || '') : '';
    const emailRaw = cols.email !== -1 ? (r[cols.email] || '') : '';
    const domainRaw = cols.domain !== -1 ? (r[cols.domain] || '') : '';
    const sizeRaw = cols.size !== -1 ? (r[cols.size] || '') : '';

    const domain = cleanDomain(domainRaw);
    const size = cleanSize(sizeRaw);
    const key = normCompany(company);
    const isDup = key && companyCounts[key] > 1;
    const missingEmail = !emailRaw.trim();

    return {
      id: i,
      raw,
      company,
      contact,
      email: emailRaw.trim(),
      domain,
      size,
      hygiene: missingEmail ? 'missing' : (isDup ? 'review' : 'ready'),
      hygieneNote: missingEmail
        ? 'No email on file'
        : (isDup ? `${companyCounts[key]} contacts at this company` : 'Clean'),
    };
  });
}

// Guards against CSV/formula injection: a field value starting with =, +, -,
// or @ can be interpreted as a formula by Excel/Sheets when the exported file
// is reopened there. Lead data comes from an untrusted external source, so a
// leading apostrophe forces spreadsheet apps to treat the value as literal
// text. Values that don't start with one of those characters are untouched.
function csvField(value) {
  const str = String(value ?? '');
  const guarded = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCSV(records) {
  const header = ['Company', 'Contact', 'Email', 'Domain', 'Employees', 'Fit Score', 'Qualified', 'Hygiene', 'Note', 'Reasoning'];
  const lines = [header.join(',')];
  records.forEach(d => {
    const row = [
      d.company, d.contact, d.email, d.domain, d.size,
      d.score ?? '', d.qualified === undefined ? '' : (d.qualified ? 'Yes' : 'No'),
      d.hygiene, d.hygieneNote, d.matchedRulesText ?? '',
    ].map(csvField);
    lines.push(row.join(','));
  });
  return lines.join('\n');
}
