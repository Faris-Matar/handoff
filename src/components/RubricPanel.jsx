import { useState } from 'react';
import RuleCard from './RuleCard.jsx';

let ruleIdCounter = 0;
const newRuleId = () => `rule_${Date.now()}_${ruleIdCounter++}`;

export default function RubricPanel({ columns, rules, setRules, threshold, setThreshold }) {
  const [rubricText, setRubricText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error | done
  const [errorMsg, setErrorMsg] = useState('');
  const [lastAdded, setLastAdded] = useState(0);

  async function interpret() {
    if (!rubricText.trim() || columns.length === 0) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/interpret-rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubricText, columns }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const incoming = (data.rules || []).map(r => ({
        id: newRuleId(),
        field: r.field || '',
        operator: r.operator || '',
        value: r.value ?? '',
        weight: r.weight ?? 0,
      }));
      setRules(prev => [...prev, ...incoming]);
      if (typeof data.threshold === 'number') setThreshold(data.threshold);
      setLastAdded(incoming.length);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err.message === 'Failed to fetch'
          ? "Couldn't reach the interpreter. Add rules manually below instead."
          : `Couldn't interpret that rubric (${err.message}). Add rules manually below instead.`
      );
    }
  }

  function addRule() {
    setRules(prev => [...prev, { id: newRuleId(), field: '', operator: '', value: '', weight: 0 }]);
  }
  function updateRule(id, next) {
    setRules(prev => prev.map(r => (r.id === id ? next : r)));
  }
  function removeRule(id) {
    setRules(prev => prev.filter(r => r.id !== id));
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
          Describe a good lead
        </label>
        <textarea
          className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 min-h-[70px] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          placeholder="e.g. prioritise 50-500 employee companies, prefer SaaS or fintech, deprioritise anything under 10 employees, flag personal email domains"
          value={rubricText}
          onChange={e => setRubricText(e.target.value)}
          disabled={columns.length === 0}
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={interpret}
            disabled={columns.length === 0 || !rubricText.trim() || status === 'loading'}
            className="text-sm font-medium bg-indigo-600 text-white px-3.5 py-1.5 rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 inline-flex items-center gap-2"
          >
            {status === 'loading' && (
              <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {status === 'loading' ? 'Interpreting…' : 'Interpret with AI'}
          </button>
          {columns.length === 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500">Load a CSV first</span>
          )}
        </div>
        {status === 'error' && (
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{errorMsg}</p>
        )}
        {status === 'done' && lastAdded > 0 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            Added {lastAdded} rule{lastAdded > 1 ? 's' : ''} from your rubric, review below.
          </p>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Rules {rules.length > 0 && <span className="text-slate-400 dark:text-slate-500 font-normal">({rules.length})</span>}
          </label>
          <button onClick={addRule} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus-visible:outline-2 focus-visible:outline-indigo-500 rounded">
            + Add rule manually
          </button>
        </div>

        {rules.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic py-3">
            No rules yet. Interpret a rubric above, or add rules manually.
          </p>
        ) : (
          <div className="space-y-1.5">
            {rules.map(r => (
              <RuleCard
                key={r.id}
                rule={r}
                columns={columns}
                onChange={next => updateRule(r.id, next)}
                onRemove={() => removeRule(r.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Qualify at score ≥
        </label>
        <input
          type="number"
          className="w-20 text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 font-mono bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
          value={threshold}
          onChange={e => setThreshold(e.target.value)}
        />
      </div>
    </div>
  );
}
