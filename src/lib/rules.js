// Deterministic scoring engine. Takes confirmed structured rules and applies
// them to records with zero AI involvement, this is the part that must be
// 100% reliable and reproducible.

import { parseRange } from './csv.js';

export const OPERATORS = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'in_list', label: 'is one of (comma-separated)' },
  { value: 'between', label: 'is between (e.g. 50-500)' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than', label: 'is less than' },
];

function getFieldValue(record, field) {
  if (!field) return '';
  const keys = Object.keys(record.raw || {});
  const match = keys.find(k => k.toLowerCase() === field.toLowerCase());
  return match ? (record.raw[match] ?? '') : '';
}

function firstNumber(str) {
  const m = String(str ?? '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function evaluateRule(record, rule) {
  const raw = getFieldValue(record, rule.field);
  const rawStr = String(raw ?? '').trim();
  const rawLower = rawStr.toLowerCase();
  const val = (rule.value ?? '').trim();

  switch (rule.operator) {
    case 'contains':
      return rawLower.includes(val.toLowerCase());
    case 'not_contains':
      return !rawLower.includes(val.toLowerCase());
    case 'equals':
      return rawLower === val.toLowerCase();
    case 'not_equals':
      return rawLower !== val.toLowerCase();
    case 'is_empty':
      return rawStr === '';
    case 'is_not_empty':
      return rawStr !== '';
    case 'in_list': {
      const options = val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      return options.includes(rawLower);
    }
    case 'between': {
      const range = parseRange(val); // rule's target range, e.g. "60-500"
      const rowRange = parseRange(rawStr) || (firstNumber(rawStr) !== null ? [firstNumber(rawStr), firstNumber(rawStr)] : null);
      if (!range || !rowRange) return false;
      // Deliberate design choice: a company reported as "10-50" employees and a
      // rule targeting "50-500" are treated as overlapping at the shared boundary
      // (50), since a range-vs-range comparison can't know the company's exact
      // headcount. This is inclusive-overlap semantics, not a bug.
      return rowRange[0] <= range[1] && rowRange[1] >= range[0];
    }
    case 'greater_than': {
      const n = firstNumber(rawStr);
      const target = firstNumber(val);
      if (n === null || target === null) return false;
      return n > target;
    }
    case 'less_than': {
      const n = firstNumber(rawStr);
      const target = firstNumber(val);
      if (n === null || target === null) return false;
      return n < target;
    }
    default:
      return false;
  }
}

export function scoreRecord(record, rules) {
  let score = 0;
  const matched = [];
  for (const rule of rules) {
    if (!rule.field || !rule.operator) continue;
    try {
      if (evaluateRule(record, rule)) {
        score += Number(rule.weight) || 0;
        matched.push(rule.id);
      }
    } catch {
      // A single malformed rule should never break scoring for the whole record.
      continue;
    }
  }
  return { score, matched };
}

export function applyRules(records, rules, threshold) {
  const activeRules = (rules || []).filter(r => r.field && r.operator);
  return records.map(record => {
    if (activeRules.length === 0) {
      return { ...record, score: null, qualified: null };
    }
    const { score, matched } = scoreRecord(record, activeRules);
    return { ...record, score, matchedRules: matched, qualified: score >= Number(threshold || 0) };
  });
}
