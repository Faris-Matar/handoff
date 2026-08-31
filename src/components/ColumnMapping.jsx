const FIELDS = [
  { key: 'company', label: 'Company' },
  { key: 'contact', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'domain', label: 'Domain' },
  { key: 'size', label: 'Employees' },
];

export default function ColumnMapping({ header, detected, override, onChange }) {
  if (!header.length) return null;

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
        Column mapping
      </label>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
        We guessed these from your headers, correct any that are wrong.
      </p>
      <div className="space-y-1.5">
        {FIELDS.map(f => {
          const effective = override[f.key] !== undefined ? override[f.key] : detected[f.key];
          return (
            <div key={f.key} className="flex items-center gap-2">
              <label htmlFor={`col-map-${f.key}`} className="w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {f.label}
              </label>
              <select
                id={`col-map-${f.key}`}
                value={effective}
                onChange={e => onChange(f.key, Number(e.target.value))}
                className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <option value={-1}>— not mapped —</option>
                {header.map((h, idx) => (
                  <option key={idx} value={idx}>{h.trim() || `Column ${idx + 1}`}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
