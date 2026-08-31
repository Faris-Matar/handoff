# Handoff

Cleans and scores a lead list before it hits the CRM: normalizes messy
fields, flags missing emails and duplicate contacts at the same company,
and scores every lead against a rubric you describe in plain English.

## Architecture

The app is split into two layers on purpose:

- **Deterministic core** (`src/lib/csv.js`, `src/lib/rules.js`): CSV
  parsing, field cleaning, duplicate detection, and the actual scoring
  math. None of this depends on an AI call, so a given CSV and rule set
  always produces the same result, reproducible, not probabilistic.
- **AI-assisted step, isolated** (`api/interpret-rubric.js`): the only
  place an LLM is involved is turning a plain-English rubric into
  structured rules. It calls Gemini with a `responseSchema` constrained to
  the CSV's real column names and a fixed operator list, so the model
  can't invent a field or condition that doesn't exist. If the call fails
  for any reason, the app falls back to the manual rule builder, nothing
  else breaks.

**Privacy:** actual lead data (names, emails, every row) never leaves the
browser. Only the rubric text and the CSV's column headers are sent to the
interpretation endpoint.

## Security & reliability

- CSV export is sanitized against formula/CSV injection, any field
  starting with `=`, `+`, `-`, or `@` is neutralized before export.
- The interpretation endpoint has per-client rate limiting, an
  origin check, and input size caps.
- The Gemini call has a 20-second timeout with exactly one retry on a
  transient (5xx or timeout) failure, never retried on a 4xx.
- A top-level error boundary means an unexpected crash shows a recovery
  screen, not a blank page.

## Features

- **Row-level rule audit**: click a lead's fit score to see exactly which
  rules matched and why, also included in the CSV export.
- **Saved rubric presets**: name and reuse a rule set across sessions.
- **Manual column-mapping override**: correct auto-detected columns when a
  CSV uses non-standard headers.
- **Virtualized results table**: stays responsive on datasets with
  thousands of rows.
- Dark mode.

## Setup

The interpretation feature needs a free Gemini API key:

1. Get one from Google AI Studio.
2. In Vercel: Project → Settings → Environment Variables → add
   `GEMINI_API_KEY`.
3. Redeploy.

Everything else, cleaning, hygiene flags, manual rule building, sorting,
filtering, export, works with no configuration and no key at all.

## Local development
npm install
npm run dev # local dev server
npm run build # production build
npm test # full test suite

## Testing

117 automated checks across CSV parsing edge cases (ragged rows, duplicate
headers, unicode, empty/huge files), the rule engine (including negative
weights and boundary conditions), and the API layer's rate limiting,
origin checks, retry logic, and error handling against mocked responses.
Gated on every push via GitHub Actions.

## Known limitations

- No user authentication, anyone with the link can use it on any data.
- Rate limiting is in-memory and per warm function instance, a real
  guarantee under sustained abuse would need a shared store (Redis/Vercel
  KV). Documented, not hidden.
- Saved presets live in the browser's local storage, not synced across
  devices or shared between users.
  
