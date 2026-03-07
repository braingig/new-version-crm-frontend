/**
 * Role-based access for tech agency.
 * - ADMIN: full access
 * - TEAM_LEAD: everything except Sales
 * - HR: Dashboard, Employees, Payroll, Reports
 * - DEVELOPER: Dashboard, Tasks, Projects
 * - SALES: Dashboard, Sales, Projects
 * - SEO_EXPERT: Dashboard, Tasks, Projects, Reports (content/SEO work)
 */

export type AppRole =
  | 'ADMIN'
  | 'HR'
  | 'TEAM_LEAD'
  | 'DEVELOPER'
  | 'SALES'
  | 'SEO_EXPERT';

export const ROUTES = {
  DASHBOARD: '/dashboard',
  EMPLOYEES: '/dashboard/employees',
  PROJECTS: '/dashboard/projects',
  TASKS: '/dashboard/tasks',
  TIME_TRACKER: '/dashboard/time-tracker',
  PAYROLL: '/dashboard/payroll',
  SALES: '/dashboard/sales',
  REPORTS: '/dashboard/reports',
} as const;

/** Routes allowed per role (exact path or segment). Time Tracker commented out for now. */
const ROLE_ROUTES: Record<AppRole, string[]> = {
  ADMIN: [
    ROUTES.DASHBOARD,
    ROUTES.EMPLOYEES,
    ROUTES.PROJECTS,
    ROUTES.TASKS,
    // ROUTES.TIME_TRACKER,
    ROUTES.PAYROLL,
    ROUTES.SALES,
    ROUTES.REPORTS,
  ],
  TEAM_LEAD: [
    ROUTES.DASHBOARD,
    ROUTES.EMPLOYEES,
    ROUTES.PROJECTS,
    ROUTES.TASKS,
    // ROUTES.TIME_TRACKER,
    ROUTES.PAYROLL,
    ROUTES.REPORTS,
  ],
  HR: [
    ROUTES.DASHBOARD,
    ROUTES.EMPLOYEES,
    ROUTES.PROJECTS,
    // ROUTES.TIME_TRACKER,
    ROUTES.PAYROLL,
    ROUTES.REPORTS,
  ],
  DEVELOPER: [
    ROUTES.DASHBOARD,
    ROUTES.TASKS,
    ROUTES.PROJECTS,
    // ROUTES.TIME_TRACKER,
  ],
  SALES: [
    ROUTES.DASHBOARD,
    ROUTES.SALES,
    ROUTES.PROJECTS,
    // ROUTES.TIME_TRACKER,
  ],
  SEO_EXPERT: [
    ROUTES.DASHBOARD,
    ROUTES.TASKS,
    ROUTES.PROJECTS,
    ROUTES.REPORTS,
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
