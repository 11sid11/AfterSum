# Finance Utility

An offline-first installable finance PWA with four independent sections:
**Track** (personal spending), **Split** (trip/group expenses),
**Lend** (personal lending ledger), plus an **Overview** that aggregates
read-only.

Built per the `work.md` specification.

## Stack

- Vite + React + TypeScript (strict)
- TanStack Router (file-based typed routes)
- TanStack Form
- Dexie / IndexedDB (canonical store)
- Tailwind CSS
- vite-plugin-pwa (Workbox-backed service worker)
- Zod (validation)
- fflate (ZIP)
- Vitest + React Testing Library
- Playwright (offline E2E)

## Module Isolation

`Track`, `Split`, and `Lend` are independent financial ledgers.
They share only `Person` records (identity) and core utilities.
Balances never flow between modules automatically. Overview is
read-only.

## Optional Google Sheets backup

Google backup is deliberately secondary to the local database:

- IndexedDB remains the source of truth.
- Backups are manual snapshots to a private Google Sheet created by AfterSum.
- Restore is explicit and downloads a local safety JSON backup first.
- OAuth uses the narrow `drive.file` scope.
- Short-lived authorization stays in browser memory only.
- No OAuth client secret or refresh token is used by the PWA.

For local development, set the public OAuth web client ID in `.env.local`:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

The Google Cloud project must have the Google Drive API and Google Sheets API enabled, and the web OAuth client must authorize the origin serving the app.

## Scripts

```bash
pnpm install
pnpm dev          # local dev server
pnpm build        # production build
pnpm preview      # serve built dist
pnpm test         # vitest unit tests
pnpm test:e2e     # playwright offline E2E
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
```

## Layout

```
src/
  app/         router, providers, layout
  routes/      TanStack file routes
  db/          Dexie schema, migrations, transaction helper
  shared/      people, money, dates, ids, validation, settings
  modules/     track/, split/, lend/
  overview/    read-only projections, queries, adapters
  sync/        google auth/drive/sheets, queue, status
  export/      csv, json, zip
  components/  ui primitives
  tests/       unit + e2e
```

See `work.md` for the full specification and `docs/ARCHITECTURE.md`
for module boundaries.
