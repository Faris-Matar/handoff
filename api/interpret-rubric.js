// POST /api/interpret-rubric
// Body: { rubricText: string, columns: string[] }
// Returns: { rules: [{ field, operator, value, weight }], threshold: number }
//
// IMPORTANT: only the rubric description and the CSV's column names are sent
// here, never the actual lead rows. The API key lives only in this server-side
// function via process.env.GEMINI_API_KEY, it is never sent to the browser.
//
// Reliability design: Gemini's responseSchema is given the real column names
// and the real operator list as `enum` constraints, so the model is structurally
// unable to invent a field that doesn't exist or an operator we don't support.
// The only thing left to a model's judgement is *which* rules to write, the
// shape of the output is guaranteed by the schema, not by hoping it followed
// the prompt.

const OPERATOR_VALUES = [
  'contains', 'not_contains', 'equals', 'not_equals',
  'is_empty', 'is_not_empty', 'in_list', 'between',
  'greater_than', 'less_than',
];

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

function buildSchema(columns) {
  return {
    type: 'object',
    properties: {
      rules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', enum: columns },
            operator: { type: 'string', enum: OPERATOR_VALUES },
            value: { type: 'string', description: 'For between, use "min-max". For in_list, comma-separate options. Leave empty for is_empty/is_not_empty.' },
            weight: { type: 'integer', description: 'Points added (or subtracted, if negative) when this rule matches.' },
          },
          required: ['field', 'operator', 'value', 'weight'],
        },
      },
      threshold: { type: 'integer', description: 'Minimum total score for a lead to count as qualified.' },
    },
    required: ['rules', 'threshold'],
  };
}

function buildPrompt(rubricText, columns) {
  return [
    'You convert a recruiter/salesperson\'s plain-English description of a good lead into a small set of scoring rules.',
    `The available data columns are: ${columns.join(', ')}.`,
    'Only ever reference these exact column names in the "field" property.',
    'Use "between" for numeric ranges (value format "min-max"), "in_list" when the person names multiple acceptable categories (comma-separate them in value), "contains"/"equals" for text matching, and "is_empty"/"is_not_empty" when a field simply needs to be present or absent (leave value blank in that case).',
    'Give each rule a "weight": a positive integer for things that make a lead more attractive, a negative integer for things that make it less attractive.',
    'Set "threshold" to a sensible minimum total score for a lead to count as qualified, given the rules you wrote.',
    'Write as few rules as needed to faithfully capture what was described, do not invent criteria the person did not mention.',
    '',
    `Description: "${rubricText}"`,
  ].join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    return;
  }

  const { rubricText, columns } = req.body || {};
  if (!rubricText || !Array.isArray(columns) || columns.length === 0) {
    res.status(400).json({ error: 'rubricText and a non-empty columns array are required' });
    return;
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(rubricText, columns) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: buildSchema(columns),
          },
        }),
      }
    );

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => '');
      res.status(502).json({ error: `Gemini request failed (${upstream.status}). ${errBody.slice(0, 200)}` });
      return;
    }

    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: 'Gemini returned no interpretable content' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      res.status(502).json({ error: 'Gemini returned malformed JSON' });
      return;
    }

    // Belt-and-braces validation even though the schema should already guarantee this.
    const validColumns = new Set(columns);
    const rules = (parsed.rules || []).filter(
      r => r && validColumns.has(r.field) && OPERATOR_VALUES.includes(r.operator)
    );

    res.status(200).json({
      rules,
      threshold: Number.isFinite(parsed.threshold) ? parsed.threshold : 0,
    });
  } catch (err) {
    res.status(500).json({ error: `Unexpected server error: ${err.message}` });
  }
}
