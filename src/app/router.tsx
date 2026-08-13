/**
 * TanStack Router setup.
 *
 * Module landing pages and detail/form pages are siblings under
 * the root shell. This keeps the landing page from becoming a
 * layout route that would otherwise need to render an <Outlet />.
 */

import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import { RootLayout } from './layout/RootLayout';
import { OverviewPage } from '@/routes/overview/OverviewPage';
import { TrackPage } from '@/routes/track/TrackPage';
import { TrackMonthPage } from '@/routes/track/TrackMonthPage';
import { TrackAddPage } from '@/routes/track/TrackAddPage';
import { TrackTransactionPage } from '@/routes/track/TrackTransactionPage';
import { TrackCategoriesPage } from '@/routes/track/TrackCategoriesPage';
import { TrackBudgetPage } from '@/routes/track/TrackBudgetPage';
import { TrackRecurringPage } from '@/routes/track/TrackRecurringPage';
import { SplitPage } from '@/routes/split/SplitPage';
import { SplitGroupPage } from '@/routes/split/SplitGroupPage';
import { SplitGroupAddPage } from '@/routes/split/SplitGroupAddPage';
import { SplitGroupBalancesPage } from '@/routes/split/SplitGroupBalancesPage';
import { SplitGroupActivityPage } from '@/routes/split/SplitGroupActivityPage';
import { SplitGroupSettlePage } from '@/routes/split/SplitGroupSettlePage';
import { SplitGroupSettingsPage } from '@/routes/split/SplitGroupSettingsPage';
import { LendPage } from '@/routes/lend/LendPage';
import { LendPersonPage } from '@/routes/lend/LendPersonPage';
import { LendLedgerPage } from '@/routes/lend/LendLedgerPage';
import { LendAddPage } from '@/routes/lend/LendAddPage';
import { SettingsPage } from '@/routes/settings/SettingsPage';
import { PeoplePage } from '@/routes/settings/PeoplePage';
import { BackupPage } from '@/routes/settings/BackupPage';
import { SearchPage } from '@/routes/overview/SearchPage';
import { OnboardingPage } from '@/routes/OnboardingPage';

const rootRoute = createRootRoute({
  component: () => (
    <RootLayout>
      <Outlet />
    </RootLayout>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/overview' });
  },
});

const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/overview', component: OverviewPage });
const searchRoute = createRoute({ getParentRoute: () => rootRoute, path: '/search', component: SearchPage });
const onboardingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/onboarding', component: OnboardingPage });

const trackRoute = createRoute({ getParentRoute: () => rootRoute, path: '/track', component: TrackPage });
const trackMonthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/track/month/$year/$month',
  component: TrackMonthPage,
});
const trackAddRoute = createRoute({ getParentRoute: () => rootRoute, path: '/track/add', component: TrackAddPage });
const trackTransactionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/track/transaction/$transactionId',
  component: TrackTransactionPage,
});
const trackCategoriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/track/categories',
  component: TrackCategoriesPage,
});
const trackBudgetRoute = createRoute({ getParentRoute: () => rootRoute, path: '/track/budget', component: TrackBudgetPage });
const trackRecurringRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/track/recurring',
  component: TrackRecurringPage,
});

const splitRoute = createRoute({ getParentRoute: () => rootRoute, path: '/split', component: SplitPage });
const splitGroupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/split/group/$groupId',
  component: SplitGroupPage,
});
const splitGroupAddRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/split/group/$groupId/add',
  component: SplitGroupAddPage,
});
const splitGroupBalancesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/split/group/$groupId/balances',
  component: SplitGroupBalancesPage,
});
const splitGroupActivityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/split/group/$groupId/activity',
  component: SplitGroupActivityPage,
});
const splitGroupSettleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/split/group/$groupId/settle',
  component: SplitGroupSettlePage,
});
const splitGroupSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/split/group/$groupId/settings',
  component: SplitGroupSettingsPage,
});

const lendRoute = createRoute({ getParentRoute: () => rootRoute, path: '/lend', component: LendPage });
const lendPersonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lend/person/$personId',
  component: LendPersonPage,
});
const lendLedgerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lend/ledger/$ledgerId',
  component: LendLedgerPage,
});
const lendAddRoute = createRoute({ getParentRoute: () => rootRoute, path: '/lend/add', component: LendAddPage });

const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage });
const peopleRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings/people', component: PeoplePage });
const backupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings/backup', component: BackupPage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  onboardingRoute,
  overviewRoute,
  searchRoute,
  trackRoute,
  trackMonthRoute,
  trackAddRoute,
  trackTransactionRoute,
  trackCategoriesRoute,
  trackBudgetRoute,
  trackRecurringRoute,
  splitRoute,
  splitGroupRoute,
  splitGroupAddRoute,
  splitGroupBalancesRoute,
  splitGroupActivityRoute,
  splitGroupSettleRoute,
  splitGroupSettingsRoute,
  lendRoute,
  lendPersonRoute,
  lendLedgerRoute,
  lendAddRoute,
  settingsRoute,
  peopleRoute,
  backupRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
