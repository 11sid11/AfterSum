<p align="center">
  <img src="public/pwa-192x192.png" width="96" height="96" alt="AfterSum logo" />
</p>

<h1 align="center">AfterSum</h1>

<p align="center">
  <strong>Personal money tracking, shared expenses, and lending — without an account or financial backend.</strong>
</p>

<p align="center">
  Offline-first · Installable PWA · Local IndexedDB · Open source
</p>

<p align="center">
  <a href="https://11sid11.github.io/AfterSum/"><strong>Open AfterSum</strong></a>
  ·
  <a href="CONTRIBUTING.md">Contributing</a>
  ·
  <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <a href="https://github.com/11sid11/AfterSum/actions/workflows/deploy.yml"><img alt="Deploy to GitHub Pages" src="https://github.com/11sid11/AfterSum/actions/workflows/deploy.yml/badge.svg" /></a>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-6d5dfc" />
</p>

---

## Why AfterSum exists

Many money apps start by asking for an account, a bank connection, or permission to store financial history on a server. AfterSum takes the opposite approach.

Your operational data lives in your browser. The app is useful offline. Backups and exports leave the device only when **you explicitly choose to save or share them**.

AfterSum is intentionally a finance **utility**, not a bank-account, investment, or payment-processing product.

## What it does

AfterSum has four primary surfaces:

### Track

Personal expenses and income.

- monthly spending and income totals;
- categories and category filtering;
- optional payment method;
- monthly budgets;
- recurring personal transactions;
- current-month CSV export.

### Split

Shared expenses for trips, households, dinners, events, and similar groups.

- reusable people and trip membership;
- equal, exact, percentage, and share-based splits;
- multiple payers;
- saved default splits;
- manual itemization;
- recurring shared expenses;
- manual foreign-currency conversion into the trip currency;
- derived balances and simplified settlement suggestions;
- recorded payments with undo/history;
- local CSV import.

### Lend

Direct money owed between you and another person.

- lent and borrowed entries;
- repayments received/given;
- per-person history;
- derived receive/owe balances.

### Overview

A read-only projection across the other modules.

- personal monthly spending;
- Split receivables/payables;
- Lend receivables/payables;
- recent cross-module activity.

Overview never owns or mutates financial records.

## Local-first by design

```text
React UI
   │
   ▼
repositories / domain logic
   │
   ▼
Dexie
   │
   ▼
IndexedDB on this device
```

There is no required AfterSum account and no application backend.

### Financial boundaries

`Track`, `Split`, and `Lend` are separate ledgers. They share `Person` records for identity, but they do not silently reconcile or mutate one another.

For example, the same person can simultaneously:

- owe you money in Lend;
- owe you money in one Split trip;
- be owed money by you in another Split trip.

AfterSum can summarize those facts, but it does not invent one universal debt record.

### Money representation

Canonical money values are stored as **integer minor units**. Balances are derived from persisted events rather than stored as mutable totals.

## Backup, export, and recovery

AfterSum separates **restoreable backup** from **analysis exports**.

### Portable backup

A portable backup is a complete readable JSON snapshot (`.aftersum.json`) that can be restored later.

On devices that support file sharing, AfterSum opens the operating system share sheet so you can choose a destination such as Files, Google Drive, Dropbox, WhatsApp, or another installed app. AfterSum does not receive cloud-provider credentials and does not learn which destination you choose.

If native file sharing is unavailable, the browser falls back to a normal download.

### CSV / ZIP exports

CSV exports are designed for spreadsheets, inspection, and analysis. The full CSV package is delivered as a ZIP. These exports use the same **native-share-first, download-fallback** behavior as portable backups.

### Automatic recovery

A separate local recovery database keeps:

- one rolling automatic recovery snapshot;
- up to three pre-restore safety checkpoints.

Local recovery helps with accidental changes, but it cannot recover a lost/reset device. Keep a portable backup outside the device if the data matters.

## PWA behavior

AfterSum can be installed from a supported browser and works offline after the app shell is cached.

When a newer deployed version is ready, the app shows an **Update now / Later** prompt. Updating replaces the cached app shell; it does not require uninstalling the PWA or clearing IndexedDB.

## Privacy notes

- No required account or backend.
- No bank connection.
- No payment processing.
- No OCR or receipt-image processing.
- No analytics dependency is required for the app to function.
- Portable backups are currently readable JSON; treat them as sensitive files.
- Privacy Mode hides amounts on screen, but it is not authentication or encryption.
- IndexedDB is browser-origin scoped. A dedicated origin provides stronger isolation than hosting unrelated applications on the same origin.

## Tech stack

- **React 19 + TypeScript** (strict)
- **Vite**
- **TanStack Router**
- **TanStack Form**
- **Dexie / IndexedDB**
- **Tailwind CSS**
- **vite-plugin-pwa / Workbox**
- **Zod**
- **fflate** for ZIP exports
- **Vitest + React Testing Library**
- **Playwright** for browser E2E coverage

## Run locally

Requirements:

- Node.js 20+
- pnpm 9+

```bash
git clone https://github.com/11sid11/AfterSum.git
cd AfterSum
pnpm install
pnpm dev
```

### Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For browser E2E tests:

```bash
pnpm test:e2e:install
pnpm test:e2e
```

## Project layout

```text
src/
  app/         router, providers, shell, PWA integration
  backup/      portable backup + local recovery
  components/  shared UI primitives
  db/          Dexie schema and database helpers
  export/      CSV, JSON, and ZIP serialization
  modules/     Track, Split, and Lend domain/repository code
  overview/    read-only projections and queries
  routes/      application screens
  shared/      money, dates, people, settings, file handoff, utilities
  tests/       shared test helpers and E2E coverage
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before making larger changes; it documents the financial invariants and validation expectations that should not be broken by refactors.

Please use synthetic data in issues and screenshots. Never upload a real AfterSum backup or private financial export to a public issue.

- [Report a bug](https://github.com/11sid11/AfterSum/issues/new/choose)
- [Security policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## Product non-goals

The project deliberately avoids several categories unless its direction changes materially:

- bank-account aggregation or balances;
- card/bank credential storage;
- payment processing;
- investment tracking;
- OCR / receipt-image processing;
- mandatory cloud sync or user accounts;
- automatic cross-module debt settlement.

Keeping these boundaries explicit helps AfterSum remain small, understandable, inexpensive to host, and usable offline.

## License

AfterSum is available under the [MIT License](LICENSE).
