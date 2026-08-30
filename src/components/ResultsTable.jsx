import { useMemo, useState } from 'react';
import { toCSV } from '../lib/csv.js';

const HYGIENE_LABEL = { ready: 'Clean', review: 'Needs a look', missing: 'Missing email' };
const HYGIENE_COLOR = {
  ready: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  review: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
  missing: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-400/20',
};

const COLUMNS = [
  { key: 'company', label: 'Company' },
  { key: 'contact', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'domain', label: 'Domain' },
  { key: 'size', label: 'Employees' },
  { key: 'score', label: 'Fit score' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'hygiene', label: 'Hygiene' },
];

function ScoreBar({ score, maxAbs }) {
  if (score === null || score === undefined || !maxAbs) return <span className="w-16 shrink-0" />;
  const pct = Math.min(100, (Math.abs(score) / maxAbs) * 50);
  const positive = score >= 0;
  return (
    <div className="relative w-16 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-sm overflow-hidden shrink-0">
      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300 dark:bg-slate-600" />
      {positive ? (
        <div className="absolute inset-y-0 left-1/2 bg-emerald-500 dark:bg-emerald-400 rounded-r-sm" style={{ width: `${pct}%` }} />
      ) : (
        <div className="absolute inset-y-0 right-1/2 bg-rose-500 dark:bg-rose-400 rounded-l-sm" style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}

export default function ResultsTable({ records }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [hygieneFilter, setHygieneFilter] = useState('all');
  const [qualifiedFilter, setQualifiedFilter] = useState('all');

  const hasScoring = records.some(r => r.score !== null && r.score !== undefined);
  const maxAbsScore = useMemo(() => {
    const scores = records.filter(r => r.score !== null && r.score !== undefined).map(r => Math.abs(r.score));
    return scores.length ? Math.max(...scores) : 0;
  }, [records]);

  const filtered = useMemo(() => {
    let rows = records;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        [r.company, r.contact, r.email, r.domain].some(v => (v || '').toLowerCase().includes(q))
      );
    }
    if (hygieneFilter !== 'all') rows = rows.filter(r => r.hygiene === hygieneFilter);
    if (qualifiedFilter !== 'all') {
      rows = rows.filter(r => (qualifiedFilter === 'yes' ? r.qualified === true : r.qualified === false));
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (av === null || av === undefined) av = -Infinity;
        if (bv === null || bv === undefined) bv = -Infinity;
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [records, search, hygieneFilter, qualifiedFilter, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function download() {
    const blob = new Blob([toCSV(filtered)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'handoff-cleaned.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const counts = useMemo(() => ({
    total: records.length,
    ready: records.filter(r => r.hygiene === 'ready').length,
    review: records.filter(r => r.hygiene === 'review').length,
    missing: records.filter(r => r.hygiene === 'missing').length,
    qualified: records.filter(r => r.qualified === true).length,
  }), [records]);

  if (records.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-slate-400 dark:text-slate-500">
            <path d="M4 6h16M4 12h10M4 18h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm text-slate-400 dark:text-slate-500">Paste a CSV on the left to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">{counts.total} total</span>
        <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-400/20">{counts.ready} clean</span>
        <span className="text-xs font-mono text-amber-700 dark:text-amber-400 px-2 py-1 bg-amber-50 dark:bg-amber-500/10 rounded ring-1 ring-inset ring-amber-600/20 dark:ring-amber-400/20">{counts.review} need a look</span>
        <span className="text-xs font-mono text-rose-700 dark:text-rose-400 px-2 py-1 bg-rose-50 dark:bg-rose-500/10 rounded ring-1 ring-inset ring-rose-600/20 dark:ring-rose-400/20">{counts.missing} missing email</span>
        {hasScoring && (
          <span className="text-xs font-mono text-indigo-700 dark:text-indigo-400 px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 rounded ring-1 ring-inset ring-indigo-600/20 dark:ring-indigo-400/20">{counts.qualified} qualified</span>
        )}
        <button
          onClick={download}
          className="ml-auto text-xs font-medium bg-slate-900 dark:bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 dark:hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-indigo-400 transition-colors"
        >
          Download cleaned CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="text"
          placeholder="Search company, contact, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 flex-1 min-w-[180px] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-600"
        />
        <select
          value={hygieneFilter}
          onChange={e => setHygieneFilter(e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <option value="all">All hygiene</option>
          <option value="ready">Clean</option>
          <option value="review">Needs a look</option>
          <option value="missing">Missing email</option>
        </select>
        {hasScoring && (
          <select
            value={qualifiedFilter}
            onChange={e => setQualifiedFilter(e.target.value)}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <option value="all">All leads</option>
            <option value="yes">Qualified only</option>
            <option value="no">Not qualified</option>
          </select>
        )}
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-auto flex-1 bg-white dark:bg-slate-800/40">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="text-left font-medium text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wide px-3 py-2 border-b border-slate-200 dark:border-slate-700 cursor-pointer select-none whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {col.label}
                  {sortKey === col.key && <span className="ml-1 text-slate-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{r.company}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.contact || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{r.email || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{r.domain || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{r.size || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200 w-6 tabular-nums">
                      {r.score === null || r.score === undefined ? '—' : r.score}
                    </span>
                    <ScoreBar score={r.score} maxAbs={maxAbsScore} />
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.qualified === null || r.qualified === undefined ? (
                    <span className="text-slate-300 dark:text-slate-600">—</span>
                  ) : (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${
                      r.qualified
                        ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-400/20'
                        : 'bg-slate-100 text-slate-500 ring-slate-400/20 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-500/20'
                    }`}>
                      {r.qualified ? 'Yes' : 'No'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${HYGIENE_COLOR[r.hygiene]}`}>
                    {HYGIENE_LABEL[r.hygiene]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-10">No rows match those filters.</div>
        )}
      </div>
    </div>
  );
}
