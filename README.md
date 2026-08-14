# AfterSum

An offline-first installable finance PWA with four independent sections:
**Track** (personal spending), **Split** (trip/group expenses),
**Lend** (personal lending ledger), plus an **Overview** that aggregates
read-only.

## Stack

- Vite + React + TypeScript (strict)
- TanStack Router
- TanStack Form
- Dexie / IndexedDB (canonical store)
- Tailwind CSS
- vite-plugin-pwa (Workbox-backed service worker)
- Zod (validation)
- fflate (ZIP exports)
- Vitest + React Testing Library
- Playwright (offline E2E)

## Privacy and storage model

AfterSum does not require an account or backend. Financial records stay in the
browser's IndexedDB unless the user explicitly saves a portable backup or
exports data.

- IndexedDB is the canonical database.
- A separate local IndexedDB keeps rotating recovery checkpoints.
- Portable backups are complete JSON snapshots that can be saved/shared using
  the device's normal file or share flow.
- AfterSum does not connect to Google Drive, Google Sheets, Dropbox, or another
  cloud provider directly.
- CSV/ZIP exports are for inspection and analysis; portable backups are the
  restore format.

This keeps hosting and infrastructure requirements close to zero while letting
users choose their own storage provider.

## Module isolation

`Track`, `Split`, and `Lend` are independent financial ledgers. They share only
`Person` records (identity) and core utilities. Balances never flow between
modules automatically. Overview is read-only.

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
  backup/      local recovery + portable backup helpers
  routes/      app screens
  db/          Dexie schema, compatibility tables, transaction helper
  shared/      people, money, dates, ids, validation, settings
  modules/     track/, split/, lend/
  overview/    read-only projections, queries, adapters
  export/      csv, json, zip
  components/  ui primitives
  tests/       unit + e2e
```

The original `work.md` remains as a historical implementation specification.
The current README and application code are the source of truth for the shipped
local-first architecture.
