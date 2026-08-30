import { useState } from 'react';
import { OPERATORS } from '../lib/rules.js';

const OPERATOR_LABEL = Object.fromEntries(OPERATORS.map(o => [o.value, o.label]));

function summarize(rule) {
  if (!rule.field || !rule.operator) return 'New rule, click to configure';
  const label = OPERATOR_LABEL[rule.operator] || rule.operator;
  const needsValue = !['is_empty', 'is_not_empty'].includes(rule.operator);
  return (
    <>
      <span className="font-semibold">{rule.field}</span>{' '}
      <span className="text-slate-500 dark:text-slate-400">{label}</span>{' '}
      {needsValue && <span className="font-semibold">{rule.value || '…'}</span>}
    </>
  );
}

export default function RuleCard({ rule, columns, onChange, onRemove }) {
  const [editing, setEditing] = useState(!rule.field);
  const update = (patch) => onChange({ ...rule, ...patch });
  const points = Number(rule.weight) || 0;

  if (!editing) {
    return (
      <div className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
        <span
          className={`shrink-0 font-mono text-xs font-semibold px-2 py-1 rounded-md tabular-nums ${
            points > 0
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : points < 0
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
          }`}
        >
          {points > 0 ? `+${points}` : points}
        </span>
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">{summarize(rule)}</span>
        <button
          onClick={() => setEditing(true)}
          aria-label="Edit rule"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity text-xs px-1.5 focus-visible:outline-2 focus-visible:outline-indigo-500 rounded"
        >
          Edit
        </button>
        <button
          onClick={onRemove}
          aria-label="Remove rule"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity focus-visible:outline-2 focus-visible:outline-indigo-500 rounded"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-300 dark:border-indigo-500/50 bg-indigo-50/40 dark:bg-indigo-500/5 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
          value={rule.field}
          onChange={e => update({ field: e.target.value })}
        >
          <option value="">Field…</option>
          {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
          value={rule.operator}
          onChange={e => update({ operator: e.target.value })}
        >
          <option value="">Condition…</option>
          {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 font-mono bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-indigo-600"
          placeholder="value"
          value={rule.value}
          disabled={rule.operator === 'is_empty' || rule.operator === 'is_not_empty'}
          onChange={e => update({ value: e.target.value })}
        />
        <input
          type="number"
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 font-mono bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
          placeholder="+/- pts"
          value={rule.weight}
          onChange={e => update({ weight: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-3 pt-0.5">
        <button onClick={onRemove} className="text-xs text-slate-400 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-indigo-500 rounded">
          Remove
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={!rule.field || !rule.operator}
          className="text-xs font-medium bg-slate-900 dark:bg-indigo-600 text-white px-2.5 py-1 rounded disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Done
        </button>
      </div>
    </div>
  );
}
