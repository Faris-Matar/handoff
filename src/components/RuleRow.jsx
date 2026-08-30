import { OPERATORS } from '../lib/rules.js';

export default function RuleRow({ rule, columns, onChange, onRemove }) {
  const update = (patch) => onChange({ ...rule, ...patch });

  return (
    <div className="grid grid-cols-12 gap-2 items-center py-2 border-b border-slate-200 last:border-b-0">
      <select
        className="col-span-3 text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900"
        value={rule.field}
        onChange={e => update({ field: e.target.value })}
      >
        <option value="">Field…</option>
        {columns.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <select
        className="col-span-3 text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-800 focus-visible:outline-2 focus-visible:outline-slate-900"
        value={rule.operator}
        onChange={e => update({ operator: e.target.value })}
      >
        <option value="">Condition…</option>
        {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>

      <input
        className="col-span-3 text-sm border border-slate-300 rounded-md px-2 py-1.5 font-mono disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-slate-900"
        placeholder="value"
        value={rule.value}
        disabled={rule.operator === 'is_empty' || rule.operator === 'is_not_empty'}
        onChange={e => update({ value: e.target.value })}
      />

      <input
        type="number"
        className="col-span-2 text-sm border border-slate-300 rounded-md px-2 py-1.5 font-mono focus-visible:outline-2 focus-visible:outline-slate-900"
        placeholder="+/- pts"
        value={rule.weight}
        onChange={e => update({ weight: e.target.value })}
      />

      <button
        onClick={onRemove}
        aria-label="Remove rule"
        className="col-span-1 text-slate-400 hover:text-rose-600 text-sm justify-self-end focus-visible:outline-2 focus-visible:outline-slate-900 rounded"
      >
        ✕
      </button>
    </div>
  );
}
