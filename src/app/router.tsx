/**
 * TanStack Router setup.
 *
 * Module landing pages and detail/form pages are siblings under
 * the root shell. This keeps the landing page from becoming a
 * layout route that would otherwise need to render an <Outlet />.
 *
 * Hash history is intentional: AfterSum is deployed as a static
 * GitHub Pages PWA, where the server cannot rewrite arbitrary SPA
 * paths back to index.html. The server only sees /AfterSum/ while
 * the client owns everything after the hash, so refreshes, direct
 * links and installed-PWA relaunches remain reliable.
 */

import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { RootLayout } from './layout/RootLayout';

const OverviewPage = lazyRouteComponent(
  () => import('@/routes/overview/OverviewPage'),
  'OverviewPage',
);
const SearchPage = lazyRouteComponent(
  () => import('@/routes/overview/SearchPage'),
  'SearchPage',
);
const OnboardingPage = lazyRouteComponent(
  () => import('@/routes/OnboardingPage'),
  'OnboardingPage',
);

const TrackPage = lazyRouteComponent(() => import('@/routes/track/TrackPage'), 'TrackPage');
const TrackMonthPage = lazyRouteComponent(
  () => import('@/routes/track/TrackMonthPage'),
  'TrackMonthPage',
);
const TrackAddPage = lazyRouteComponent(
  () => import('@/routes/track/TrackAddPage'),
  'TrackAddPage',
);
const TrackTransactionPage = lazyRouteComponent(
  () => import('@/routes/track/TrackTransactionPage'),
  'TrackTransactionPage',
);
const TrackCategoriesPage = lazyRouteComponent(
  () => import('@/routes/track/TrackCategoriesPage'),
  'TrackCategoriesPage',
);
const TrackBudgetPage = lazyRouteComponent(
  () => import('@/routes/track/TrackBudgetPage'),
  'TrackBudgetPage',
);
const TrackRecurringPage = lazyRouteComponent(
  () => import('@/routes/track/TrackRecurringPage'),
  'TrackRecurringPage',
);

const SplitPage = lazyRouteComponent(() => import('@/routes/split/SplitPage'), 'SplitPage');
const SplitGroupPage = lazyRouteComponent(
  () => import('@/routes/split/SplitGroupPage'),
  'SplitGroupPage',
);
const SplitGroupAddPage = lazyRouteComponent(
  () => import('@/routes/split/SplitGroupAddPage'),
  'SplitGroupAddPage',
);
const SplitGroupBalancesPage = lazyRouteComponent(
  () => import('@/routes/split/SplitGroupBalancesPage'),
  'SplitGroupBalancesPage',
);
const SplitGroupActivityPage = lazyRouteComponent(
  () => import('@/routes/split/SplitGroupActivityPage'),
  'SplitGroupActivityPage',
);
const SplitGroupSettlePage = lazyRouteComponent(
  () => import('@/routes/split/SplitGroupSettlePage'),
  'SplitGroupSettlePage',
);
const SplitGroupSettingsPage = lazyRouteComponent(
  () => import('@/routes/split/SplitGroupSettingsPage'),
  'SplitGroupSettingsPage',
);

const LendPage = lazyRouteComponent(() => import('@/routes/lend/LendPage'), 'LendPage');
const LendPersonPage = lazyRouteComponent(
  () => import('@/routes/lend/LendPersonPage'),
  'LendPersonPage',
);
const LendLedgerPage = lazyRouteComponent(
  () => import('@/routes/lend/LendLedgerPage'),
  'LendLedgerPage',
);
const LendAddPage = lazyRouteComponent(
  () => import('@/routes/lend/LendAddPage'),
  'LendAddPage',
);

const SettingsPage = lazyRouteComponent(
  () => import('@/routes/settings/SettingsPage'),
  'SettingsPage',
);
const PeoplePage = lazyRouteComponent(
  () => import('@/routes/settings/PeoplePage'),
  'PeoplePage',
);
const BackupPage = lazyRouteComponent(
  () => import('@/routes/settings/BackupPage'),
  'BackupPage',
);

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

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/overview',
  component: OverviewPage,
});
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchPage,
});
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: OnboardingPage,
});

const trackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/track',
  component: TrackPage,
});
const trackMonthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/track/month/$year/$month',
  component: TrackMonthPage,
});
const trackAddRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/track/add',
  component: TrackAddPage,
});
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
const trackBudgetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/track/budget',
  component: TrackBudgetPage,
});
const trackRecurringRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/track/recurring',
  component: TrackRecurringPage,
});

const splitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/split',
  component: SplitPage,
});
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

const lendRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lend',
  component: LendPage,
});
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
const lendAddRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lend/add',
  component: LendAddPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/people',
  component: PeoplePage,
});
const backupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/backup',
  component: BackupPage,
});

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

const history = createHashHistory();

export const router = createRouter({
  routeTree,
  history,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
