# Rowzen

**Clean data. Confident imports.**

Rowzen is the public name of the existing DataRehearsal CSV preflight workspace. This presentation rebrand preserves internal package names, routes, OAuth callbacks, APIs, stored identities and browser-local CSV handling. See the [architecture](docs/architecture.md), [security rules](docs/security.md) and [branding foundation](docs/rowzen-branding-foundation.md).

## Historical DataRehearsal core validation starter v0.1

The original starter notes below are retained for reference. Their scope limits describe the original core module, not the current application's complete capabilities.

This starter contains a deterministic TypeScript **preflight validator**, not a complete SaaS or PostgreSQL execution simulator. No uploaded customer data is transmitted or persisted by this core module.

## Add to an existing Next.js App Router project
1. `npx create-next-app@latest datarehearsal --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`
2. `cd datarehearsal`
3. Copy `src/lib/rehearsal/engine.ts` from this zip into your new project's `src/lib/rehearsal/engine.ts`.
4. Copy `samples/` and `tests/` directories into your project.
5. `npm install -D vitest`
6. For tests, use Vitest: rename `tests/engine.test.mjs` to `tests/engine.test.ts`, change `import test from 'node:test'; import assert ...` to `import { test, expect } from 'vitest';` and translate assertions; or run the included test directly using Node.js 22+ (see next command).
7. `node --experimental-strip-types --test tests/engine.test.mjs` (run under Node.js 22+ with this experimental flag if supported, or migrate tests to Vitest).
8. Parse CSV files with Papa Parse into `{name,rows,primaryKey,required,foreignKeys}` and call `validateDatasets()`.
9. Call `suggestImportOrder()` to show dependencies and cycles.

## Scope limits
- Assumes already-parsed CSV rows with column names; parser, UI, auth, API, database, deployment are NOT included.
- `rowNumber = index + 2` assumes first row is CSV header and no skipped blank rows.
- Basic required, PK uniqueness and foreign-key validation only. No email/date/number, composite PK, SQL collation, nullable behavior beyond required rules, foreign-key cycles simulation, transaction isolation, live DB state, or fix suggestions.
- This starter reports indexes of local files, not actual PostgreSQL results.
- `blocked=false` means the implemented checks found no errors; it is never a migration success guarantee.
- Run validation and export with synthetic records until privacy and security are reviewed.

## Optional browser demo route
Copy `src/app/rehearsal/page.tsx` to the matching path in your Next.js app, then:

```powershell
npm install papaparse
npm install -D @types/papaparse
npm run dev
```

Open `http://localhost:3000/rehearsal` and upload the two included sample CSVs simultaneously. The UI displays six total rows, two invalid student records (three issue entries), parents-first import order, and a downloadable JSON report. The page has **not** been browser-tested in this container, unlike the engine tests. CSV row numbers are illustrative if parser skips blank lines. This is a **demo route**, not a general-schema importer, SaaS, or production-ready CSV validation system.
