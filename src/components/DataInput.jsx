import { useState, useRef } from 'react';

export default function DataInput({ csvText, setCsvText }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  function readFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(e.target.result);
    reader.readAsText(file);
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
        Paste or drop a CSV
      </label>
      <textarea
        className="w-full text-xs font-mono border border-slate-300 rounded-md px-3 py-2 min-h-[130px] focus-visible:outline-2 focus-visible:outline-slate-900"
        placeholder={'Company,Contact,Email,Domain,Employees\nAcme Robotics,Dana Cole,dana@acme.io,https://acme.io/,50-200'}
        value={csvText}
        onChange={e => setCsvText(e.target.value)}
      />
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          readFile(e.dataTransfer.files?.[0]);
        }}
        className={`mt-2 flex items-center justify-between gap-3 border border-dashed rounded-md px-3 py-2.5 text-xs transition-colors ${
          dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 text-slate-500'
        }`}
      >
        <span>or drop a .csv file here</span>
        <button
          onClick={() => fileRef.current?.click()}
          className="font-medium text-slate-700 bg-white border border-slate-300 rounded px-2.5 py-1 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900"
        >
          Choose file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => readFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
