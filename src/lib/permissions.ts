/**
 * Role-based access: which routes and nav items each role can see.
 * - ADMIN: full access
 * - TEAM_LEAD: everything except Sales
 * - HR: Dashboard, Employees, Time Tracker, Payroll
 * - DEVELOPER: Dashboard, Tasks, Time Tracker (own work)
 * - SALES: Dashboard, Sales, Time Tracker
 * - FINANCE: Dashboard, Payroll, Time Tracker
 */

export type AppRole =
  | 'ADMIN'
  | 'HR'
  | 'TEAM_LEAD'
  | 'DEVELOPER'
  | 'SALES'
  | 'FINANCE';

export const ROUTES = {
  DASHBOARD: '/dashboard',
  EMPLOYEES: '/dashboard/employees',
  PROJECTS: '/dashboard/projects',
  TASKS: '/dashboard/tasks',
  TIME_TRACKER: '/dashboard/time-tracker',
  PAYROLL: '/dashboard/payroll',
  SALES: '/dashboard/sales',
} as const;

/** Routes allowed per role (exact path or segment). */
const ROLE_ROUTES: Record<AppRole, string[]> = {
  ADMIN: [
    ROUTES.DASHBOARD,
    ROUTES.EMPLOYEES,
    ROUTES.PROJECTS,
    ROUTES.TASKS,
    ROUTES.TIME_TRACKER,
    ROUTES.PAYROLL,
    ROUTES.SALES,
  ],
  TEAM_LEAD: [
    ROUTES.DASHBOARD,
    ROUTES.EMPLOYEES,
    ROUTES.PROJECTS,
    ROUTES.TASKS,
    ROUTES.TIME_TRACKER,
    ROUTES.PAYROLL,
    // no Sales
  ],
  HR: [
    ROUTES.DASHBOARD,
    ROUTES.EMPLOYEES,
    ROUTES.TIME_TRACKER,
    ROUTES.PAYROLL,
  ],
  DEVELOPER: [
    ROUTES.DASHBOARD,
    ROUTES.TASKS,
    ROUTES.TIME_TRACKER,
  ],
  SALES: [
    ROUTES.DASHBOARD,
    ROUTES.SALES,
    ROUTES.TIME_TRACKER,
  ],
  FINANCE: [
    ROUTES.DASHBOARD,
    ROUTES.PAYROLL,
    ROUTES.TIME_TRACKER,
  ],
};

/** Nav item key (route path) that can be shown in sidebar. */
export type NavRouteKey = keyof typeof ROUTES;

/** Check if a role can access a given path. Handles segment routes e.g. /dashboard/tasks/123 */
export function canAccessRoute(
  role: string | undefined | null,
  pathname: string
): boolean {
  if (!role) return false;
  const r = role.toUpperCase() as AppRole;
  const allowed = ROLE_ROUTES[r];
  if (!allowed) return false;
  // Exact match
  if (allowed.includes(pathname)) return true;
  // Segment match: e.g. /dashboard/tasks/abc allowed if /dashboard/tasks is allowed
  const segments = pathname.split('/').filter(Boolean);
  for (const route of allowed) {
    const routeSegments = route.split('/').filter(Boolean);
    if (
      routeSegments.length <= segments.length &&
      routeSegments.every((s, i) => segments[i] === s)
    )
      return true;
  }
  return false;
}

/** Return list of allowed route paths for the sidebar for a role. */
export function getAllowedRoutes(role: string | undefined | null): string[] {
  if (!role) return [];
  const r = role.toUpperCase() as AppRole;
  return ROLE_ROUTES[r] ?? [];
}
