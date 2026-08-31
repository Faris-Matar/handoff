import { useState } from 'react';

const STORAGE_KEY = 'handoff-rubric-presets';
let loadIdCounter = 0;
const newLoadedRuleId = () => `preset_${Date.now()}_${loadIdCounter++}`;

function loadPresets() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresets(presets) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage can be unavailable (private browsing, quota exceeded) —
    // presets simply won't persist across reloads in that case.
  }
}

export default function RubricPresets({ rules, threshold, setRules, setThreshold }) {
  const [presets, setPresets] = useState(() => loadPresets());
  const [name, setName] = useState('');

  function saveCurrent() {
    const trimmed = name.trim();
    if (!trimmed || rules.length === 0) return;
    const next = [...presets.filter(p => p.name !== trimmed), { name: trimmed, rules, threshold }];
    setPresets(next);
    savePresets(next);
    setName('');
  }

  function loadPreset(preset) {
    setRules(preset.rules.map(r => ({ ...r, id: newLoadedRuleId() })));
    setThreshold(preset.threshold);
  }

  function deletePreset(presetName) {
    const next = presets.filter(p => p.name !== presetName);
    setPresets(next);
    savePresets(next);
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
        Saved presets
      </label>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name this rubric…"
          className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-600"
        />
        <button
          onClick={saveCurrent}
          disabled={!name.trim() || rules.length === 0}
          className="text-xs font-medium bg-slate-900 dark:bg-indigo-600 text-white px-2.5 py-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Save
        </button>
      </div>
      {presets.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">No saved presets yet.</p>
      ) : (
        <ul className="space-y-1">
          {presets.map(p => (
            <li key={p.name} className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-800/60 rounded-md px-2.5 py-1.5">
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                {p.rules.length} rule{p.rules.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => loadPreset(p)}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus-visible:outline-2 focus-visible:outline-indigo-500 rounded shrink-0"
              >
                Load
              </button>
              <button
                onClick={() => deletePreset(p.name)}
                aria-label={`Delete preset ${p.name}`}
                className="text-slate-400 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-indigo-500 rounded shrink-0"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
