# Track module implementation plan

## Phase 1: Foundation fixes
- [ ] Add `@tests/*` alias to vitest.config.ts and tsconfig.app.json (needed for track tests; also fixes overview/export test imports)

## Phase 2: Track domain layer
- [ ] `src/modules/track/domain/types.ts` — type helpers (TrackTransactionWithCategory, etc.)
- [ ] `src/modules/track/domain/validation.ts` — Zod schemas for category, transaction, budget, recurring, transactionInput

## Phase 3: Track services (pure functions)
- [ ] `src/modules/track/services/aggregations.ts` — monthlyTotal, categoryTotals, dailyTotals, filterTransactions, budgetProgress, recentTransactions
- [ ] `src/modules/track/services/aggregations.test.ts`

## Phase 4: Track repositories
- [ ] `src/modules/track/repositories/trackCategoryRepository.ts`
- [ ] `src/modules/track/repositories/trackTransactionRepository.ts`
- [ ] `src/modules/track/repositories/trackBudgetRepository.ts`
- [ ] `src/modules/track/repositories/trackRecurringRepository.ts`
- [ ] `src/modules/track/repositories/repositories.test.ts` — exercise create/update/softDelete/restore/listByMonth

## Phase 5: Track live queries
- [ ] `src/modules/track/queries/index.ts` — useTrackCategories, useTrackTransactionsForMonth, useTrackTransaction, useTrackBudget, useTrackMonthlySummary, useTrackRecurring

## Phase 6: Track components
- [ ] `src/modules/track/components/MonthNavigator.tsx`
- [ ] `src/modules/track/components/TransactionListItem.tsx`
- [ ] `src/modules/track/components/CategoryBreakdown.tsx`

## Phase 7: Route pages
- [ ] `src/routes/track/TrackPage.tsx` (landing)
- [ ] `src/routes/track/TrackMonthPage.tsx` ($year/$month)
- [ ] `src/routes/track/TrackAddPage.tsx`
- [ ] `src/routes/track/TrackTransactionPage.tsx`
- [ ] `src/routes/track/TrackCategoriesPage.tsx`
- [ ] `src/routes/track/TrackBudgetPage.tsx`
- [ ] `src/routes/track/TrackRecurringPage.tsx`

## Phase 8: Final verification
- [ ] pnpm typecheck — must pass with zero errors
- [ ] pnpm test — all track tests must pass; document pre-existing failures
- [ ] pnpm build — must succeed
- [ ] Commit
