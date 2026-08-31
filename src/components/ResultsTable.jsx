import { useCallback, useEffect, useMemo, useState } from 'react';
import { List } from 'react-window';
import { toCSV } from '../lib/csv.js';
import { describeMatches } from '../lib/rules.js';

const HYGIENE_LABEL = { ready: 'Clean', review: 'Needs a look', missing: 'Missing email' };
const HYGIENE_COLOR = {
  ready: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  review: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
  missing: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-400/20',
};

const COLUMNS = [
  { key: 'company', label: 'Company', width: 190 },
  { key: 'contact', label: 'Contact', width: 150 },
  { key: 'email', label: 'Email', width: 210 },
  { key: 'domain', label: 'Domain', width: 170 },
  { key: 'size', label: 'Employees', width: 110 },
  { key: 'score', label: 'Fit score', width: 160 },
  { key: 'qualified', label: 'Qualified', width: 100 },
  { key: 'hygiene', label: 'Hygiene', width: 150 },
];
const ROW_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);
const ROW_HEIGHT = 42;

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

function TableRow({ index, style, items, maxAbsScore, onAudit }) {
  const r = items[index];
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      style={style}
      className="flex items-center border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/60 dark:hover:bg-slate-700/30"
    >
      <div role="cell" style={{ width: COLUMNS[0].width }} className="px-3 truncate font-medium text-slate-800 dark:text-slate-100 text-sm">
        {r.company}
      </div>
      <div role="cell" style={{ width: COLUMNS[1].width }} className="px-3 truncate text-slate-600 dark:text-slate-300 text-sm">
        {r.contact || '—'}
      </div>
      <div role="cell" style={{ width: COLUMNS[2].width }} className="px-3 truncate font-mono text-xs text-slate-600 dark:text-slate-400">
        {r.email || '—'}
      </div>
      <div role="cell" style={{ width: COLUMNS[3].width }} className="px-3 truncate font-mono text-xs text-slate-600 dark:text-slate-400">
        {r.domain || '—'}
      </div>
      <div role="cell" style={{ width: COLUMNS[4].width }} className="px-3 truncate font-mono text-xs text-slate-600 dark:text-slate-400">
        {r.size || '—'}
      </div>
      <div role="cell" style={{ width: COLUMNS[5].width }} className="px-3 flex items-center">
        {r.score === null || r.score === undefined ? (
          <span className="font-mono text-xs text-slate-300 dark:text-slate-600 w-6 tabular-nums">—</span>
        ) : (
          <button
            onClick={() => onAudit(r)}
            aria-label={`Why did ${r.company} score ${r.score}? Show matched rules.`}
            className="flex items-center gap-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 px-1 -mx-1 py-0.5 focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <span className="font-mono text-xs text-slate-700 dark:text-slate-200 w-6 tabular-nums">{r.score}</span>
            <ScoreBar score={r.score} maxAbs={maxAbsScore} />
          </button>
        )}
      </div>
      <div role="cell" style={{ width: COLUMNS[6].width }} className="px-3">
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
      </div>
      <div role="cell" style={{ width: COLUMNS[7].width }} className="px-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${HYGIENE_COLOR[r.hygiene]}`}>
          {HYGIENE_LABEL[r.hygiene]}
        </span>
      </div>
    </div>
  );
}

export default function ResultsTable({ records, rules }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [hygieneFilter, setHygieneFilter] = useState('all');
  const [qualifiedFilter, setQualifiedFilter] = useState('all');
  const [auditRecord, setAuditRecord] = useState(null);

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

  useEffect(() => {
    if (!auditRecord) return;
    function onKey(e) { if (e.key === 'Escape') setAuditRecord(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [auditRecord]);

  const matchedDescriptions = useMemo(
    () => (auditRecord ? describeMatches(auditRecord.matchedRules, rules) : []),
    [auditRecord, rules]
  );

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function download() {
    const exportRecords = filtered.map(r => ({
      ...r,
      matchedRulesText: describeMatches(r.matchedRules, rules).join('; '),
    }));
    const blob = new Blob([toCSV(exportRecords)], { type: 'text/csv' });
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

  const rowKeyFn = useCallback((index, rowProps) => rowProps.items[index].id, []);
  const openAudit = useCallback((r) => setAuditRecord(r), []);
  const rowProps = useMemo(
    () => ({ items: filtered, maxAbsScore, onAudit: openAudit }),
    [filtered, maxAbsScore, openAudit]
  );

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
    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
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

      <div
        role="table"
        aria-label="Lead results"
        aria-rowcount={filtered.length + 1}
        aria-colcount={COLUMNS.length}
        className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-auto flex-1 min-h-0 bg-white dark:bg-slate-800/40"
      >
        <div style={{ minWidth: ROW_WIDTH }} className="flex flex-col h-full">
          <div role="row" className="flex bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 shrink-0">
            {COLUMNS.map(col => (
              <div
                key={col.key}
                role="columnheader"
                tabIndex={0}
                aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                onClick={() => toggleSort(col.key)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(col.key); }
                }}
                style={{ width: col.width }}
                className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wide cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
              >
                {col.label}
                {sortKey === col.key && <span className="ml-1 text-slate-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            {filtered.length === 0 ? (
              <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-10">No rows match those filters.</div>
            ) : (
              <List
                role="rowgroup"
                rowComponent={TableRow}
                rowCount={filtered.length}
                rowHeight={ROW_HEIGHT}
                rowProps={rowProps}
                rowKey={rowKeyFn}
                style={{ height: '100%', width: ROW_WIDTH }}
              />
            )}
          </div>
        </div>
      </div>

      {auditRecord && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`Score breakdown for ${auditRecord.company}`}
          className="fixed bottom-4 right-4 z-50 w-80 max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-4"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{auditRecord.company}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fit score {auditRecord.score}</p>
            </div>
            <button
              onClick={() => setAuditRecord(null)}
              aria-label="Close score breakdown"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-500 rounded"
            >
              ✕
            </button>
          </div>
          {matchedDescriptions.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">No rules matched this lead.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              {matchedDescriptions.map((text, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
