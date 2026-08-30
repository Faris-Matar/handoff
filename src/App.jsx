import { useEffect, useMemo, useState } from 'react';
import DataInput from './components/DataInput.jsx';
import RubricPanel from './components/RubricPanel.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import Logo from './components/Logo.jsx';
import { parseCSV, detectColumns, buildRecords } from './lib/csv.js';
import { applyRules } from './lib/rules.js';

function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem('handoff-theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('handoff-theme', theme);
  }, [theme]);

  return [theme, setTheme];
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const [csvText, setCsvText] = useState('');
  const [rules, setRules] = useState([]);
  const [threshold, setThreshold] = useState(10);

  const parsed = useMemo(() => {
    if (!csvText.trim()) return { header: [], baseRecords: [] };
    const rows = parseCSV(csvText);
    if (rows.length < 2) return { header: rows[0] || [], baseRecords: [] };
    const header = rows[0];
    const cols = detectColumns(header);
    const baseRecords = buildRecords(rows.slice(1), header, cols);
    return { header, baseRecords };
  }, [csvText]);

  const columns = parsed.header.map(h => h.trim()).filter(Boolean);
  const records = useMemo(
    () => applyRules(parsed.baseRecords, rules, threshold),
    [parsed.baseRecords, rules, threshold]
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <header className="relative border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3.5 flex items-center gap-3 overflow-hidden">
        <div className="ambient-glow" />
        <div className="relative z-[1] flex items-center gap-3 w-full">
          <Logo size={26} />
          <div>
            <h1 className="text-sm font-semibold leading-tight">Handoff</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">Clean and score leads before they reach the CRM</p>
          </div>
          <span className="ml-auto hidden sm:inline text-xs text-slate-400 dark:text-slate-500">
            Runs in your browser. Lead data never leaves this tab.
          </span>
          <button
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle dark mode"
            className="ml-2 w-8 h-8 rounded-md flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[380px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-5 space-y-6">
          <DataInput csvText={csvText} setCsvText={setCsvText} />
          <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
            <h2 className="text-sm font-semibold mb-3">Scoring rubric</h2>
            <RubricPanel
              columns={columns}
              rules={rules}
              setRules={setRules}
              threshold={threshold}
              setThreshold={setThreshold}
            />
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-5 flex flex-col overflow-hidden">
          <ResultsTable records={records} />
        </main>
      </div>
    </div>
  );
}
