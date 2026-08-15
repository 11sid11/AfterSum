## What changed

<!-- Describe the user-facing change and the implementation at a high level. -->

## Why

<!-- What problem or friction does this solve? For bugs, include the root cause. -->

## Safety / architecture

- [ ] Track, Split, and Lend remain independent financial modules.
- [ ] Overview remains read-only.
- [ ] Money remains canonical in integer minor units.
- [ ] No unintended Dexie schema or migration change.
- [ ] No required backend/account/cloud dependency was added.
- [ ] Existing local data and backup compatibility were considered.

## Validation

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`

## Screenshots / notes

<!-- Add UI screenshots when useful. Use synthetic data only; never attach real financial records or backups. -->
