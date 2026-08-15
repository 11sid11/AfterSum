# Contributing to AfterSum

Thanks for helping improve AfterSum. The project is intentionally small, local-first, and conservative about financial correctness. Contributions are welcome when they preserve those properties.

## Before you start

Please open or comment on an issue before a large feature or architectural change. Small bug fixes, tests, accessibility improvements, documentation, and focused UX improvements can usually go straight to a pull request.

## Local development

Requirements:

- Node.js 20+
- pnpm 9+

```bash
pnpm install
pnpm dev
```

Useful checks:

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

## Architecture rules

These are product invariants, not implementation suggestions:

1. **IndexedDB is the operational database.** Dexie remains the canonical local store.
2. **Track, Split, and Lend are independent financial modules.** They may share `Person` identity records, but they must not silently mutate one another.
3. **Overview is read-only.** It derives projections and never owns financial records.
4. **Balances are derived from persisted events.** Do not add mutable “current balance” state that can drift from history.
5. **Money is stored as integer minor units.** Avoid floating-point canonical amounts.
6. **No required backend or account.** Features should work offline unless explicitly designed as optional integrations.
7. **Backups remain user-controlled.** Portable backup/export flows must not make a cloud provider the operational database.
8. **Existing local data is sacred.** Schema or migration changes require explicit compatibility reasoning and tests.

## Code style

- TypeScript is strict; do not suppress type errors to make a change compile.
- Prefer small domain helpers over duplicated route logic.
- Keep persistence logic in repositories/services rather than UI components.
- Keep components focused and accessible: semantic controls, keyboard support, visible focus states, and reduced-motion support where applicable.
- Avoid adding a dependency when a small browser/platform API or existing utility already solves the problem.
- Add regression tests for bugs that can reasonably recur.

## Pull requests

A good pull request explains:

- the user-facing problem;
- the root cause when fixing a bug;
- the smallest safe implementation;
- any data-model or compatibility impact;
- how the change was validated.

Before opening a PR, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Product scope

AfterSum is a personal finance utility, not a bank-account or investment platform. Please discuss proposals for bank integrations, payment processing, server accounts, OCR/image processing, or automatic cross-module debt reconciliation before implementing them.

## Privacy when reporting bugs

Do not attach real financial exports, backups, phone numbers, email addresses, or screenshots containing sensitive personal data. Reproduce issues with synthetic data whenever possible.

By contributing, you agree that your contributions will be licensed under the repository's MIT License.
