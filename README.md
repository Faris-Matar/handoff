# Handoff

Cleans and scores a lead list before it hits the CRM: normalizes domains and
messy fields, flags missing emails and duplicate contacts at the same company,
and (optionally) scores every lead against a rubric you describe in plain
English.

## How it works

- CSV parsing, domain/field cleaning, duplicate detection, and the actual
  scoring math are all deterministic client-side logic (`src/lib/csv.js`,
  `src/lib/rules.js`). Nothing about scoring a lead once rules exist depends
  on an AI call, so it's reproducible every time.
- The only AI-assisted step is turning a plain-English rubric into structured
  rules (`api/interpret-rubric.js`), a Vercel serverless function that calls
  Gemini with a schema that constrains its output to real column names and
  supported operators. If that call ever fails, the app falls back to the
  manual rule builder, nothing else breaks.
- Actual lead data (names, emails, every CSV row) never leaves the browser.
  Only the rubric description and the CSV's column headers are sent to the
  interpretation endpoint.

## One-time setup after deploying

The interpretation feature needs a Gemini API key, set as an environment
variable in the Vercel project:

1. Get a free key from Google AI Studio.
2. In the Vercel dashboard: Project -> Settings -> Environment Variables ->
   add `GEMINI_API_KEY` with your key.
3. Redeploy (or it picks it up on the next deploy automatically).

Optional: `GEMINI_MODEL` env var overrides the default model
(`gemini-3.5-flash`) if you want to point it at a different one.

Everything else, CSV cleaning, hygiene flags, manual rule building, sorting,
filtering, CSV export, works with zero configuration and no key at all.

## Tests

`npm test` runs the full logic and API test suite (60 checks: CSV parsing
edge cases, domain/field cleaning, the rule engine including negative
weights and boundary conditions, and the serverless function's request
building, response parsing, and error handling against mocked responses).
