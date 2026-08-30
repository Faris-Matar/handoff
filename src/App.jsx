import { useMemo, useState } from 'react';
import DataInput from './components/DataInput.jsx';
import RubricPanel from './components/RubricPanel.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import { parseCSV, detectColumns, buildRecords } from './lib/csv.js';
import { applyRules } from './lib/rules.js';

export default function App() {
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
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-3.5 flex items-center gap-3">
        <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center">
          <span className="text-white text-xs font-bold">H</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight">Handoff</h1>
          <p className="text-xs text-slate-500 leading-tight">Clean and score leads before they reach the CRM</p>
        </div>
        <span className="ml-auto text-xs text-slate-400">Runs in your browser. Lead data never leaves this tab.</span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[380px] shrink-0 border-r border-slate-200 bg-white overflow-y-auto p-5 space-y-6">
          <DataInput csvText={csvText} setCsvText={setCsvText} />
          <div className="border-t border-slate-200 pt-5">
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
