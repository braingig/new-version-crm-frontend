import { startOfDay, isBefore, isSameDay, isAfter, addDays } from 'date-fns';

export type MyTaskBucket = 'overdue' | 'today' | 'next' | 'unscheduled' | 'done';

export interface MyTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectId: string;
  listId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedTime?: number | null;
  timeSpent?: number;
  parentTaskId?: string | null;
  project?: { id: string; name: string } | null;
  list?: { id: string; name: string } | null;
  parentTask?: { id: string; title: string } | null;
  assignees?: { id: string; name: string }[];
  assignedToId?: string | null;
  createdBy?: { id: string; name: string } | null;
  updatedAt?: string;
  subTasks?: MyTaskItem[];
}

export const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Complete',
};

export const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'] as const;

export function startOfToday(): Date {
  return startOfDay(new Date());
}

export function parseDueDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

export function bucketTask(task: MyTaskItem, today: Date = startOfToday()): MyTaskBucket {
  if (task.status === 'COMPLETED') return 'done';
  const due = parseDueDate(task.dueDate);
  if (!due) return 'unscheduled';
  if (isBefore(due, today)) return 'overdue';
  if (isSameDay(due, today)) return 'today';
  if (isAfter(due, today)) return 'next';
  return 'unscheduled';
}

export function sortByDueDate(a: MyTaskItem, b: MyTaskItem): number {
  const da = parseDueDate(a.dueDate);
  const db = parseDueDate(b.dueDate);
  if (!da && !db) return a.title.localeCompare(b.title);
  if (!da) return 1;
  if (!db) return -1;
  const diff = da.getTime() - db.getTime();
  if (diff !== 0) return diff;
  return a.title.localeCompare(b.title);
}

/** Flatten parent tasks and nested subTasks for team-wide summaries. */
export function collectAllTaskNodes(
  nodes: MyTaskItem[] | undefined,
  acc: MyTaskItem[] = [],
): MyTaskItem[] {
  if (!nodes?.length) return acc;
  for (const n of nodes) {
    acc.push(n);
    const sub = (n as MyTaskItem & { subTasks?: MyTaskItem[] }).subTasks;
    if (sub?.length) collectAllTaskNodes(sub, acc);
  }
  return acc;
}

export function assigneeIdsForTask(task: {
  assignees?: { id: string }[];
  assignedToId?: string | null;
}): string[] {
  const ids = new Set<string>();
  task.assignees?.forEach((u) => {
    if (u?.id) ids.add(u.id);
  });
  if (task.assignedToId) ids.add(task.assignedToId);
  return Array.from(ids);
}

export function normalizeTaskStatus(status: string | null | undefined): string {
  return String(status ?? '').trim().toUpperCase();
}

export function isOpenTask(status: string | null | undefined): boolean {
  return normalizeTaskStatus(status) !== 'COMPLETED';
}

/** Only non-completed tasks qualify for Needs attention lists. */
export function isNeedsAttentionTask(task: {
  status: string | null | undefined;
  dueDate?: string | null;
}): boolean {
  if (!isOpenTask(task.status)) return false;
  return (
    isTaskOverdue(task.dueDate, task.status) ||
    isTaskDueWithinDays(task.dueDate, task.status, TEAM_NEEDS_ATTENTION_DUE_DAYS)
  );
}

export function isTaskOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!isOpenTask(status)) return false;
  const due = parseDueDate(dueDate);
  if (!due) return false;
  return isBefore(due, startOfToday());
}

/** Open task with a due date from today through the next N days (not overdue). */
export function isTaskDueWithinDays(
  dueDate: string | null | undefined,
  status: string,
  days: number,
): boolean {
  if (!isOpenTask(status)) return false;
  if (isTaskOverdue(dueDate, status)) return false;
  const due = parseDueDate(dueDate);
  if (!due) return false;
  const today = startOfToday();
  const windowEnd = addDays(today, days);
  return !isBefore(due, today) && !isAfter(due, windowEnd);
}

export const TEAM_NEEDS_ATTENTION_DUE_DAYS = 7;

export function groupTasksByBucket(
  tasks: MyTaskItem[],
  includeDone: boolean,
): Record<MyTaskBucket, MyTaskItem[]> {
  const groups: Record<MyTaskBucket, MyTaskItem[]> = {
    overdue: [],
    today: [],
    next: [],
    unscheduled: [],
    done: [],
  };
  for (const task of tasks) {
    const bucket = bucketTask(task);
    if (bucket === 'done' && !includeDone) continue;
    groups[bucket].push(task);
  }
  for (const key of Object.keys(groups) as MyTaskBucket[]) {
    groups[key].sort(sortByDueDate);
  }
  return groups;
}

export function formatDueDate(
  iso: string | null | undefined,
  status?: string | null,
): { text: string; overdue: boolean } {
  const due = parseDueDate(iso);
  if (!due) return { text: 'No due date', overdue: false };
  const today = startOfToday();
  const text = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const overdue = isOpenTask(status) && isBefore(due, today);
  return { text, overdue };
}

export function priorityPillClass(priority: string | undefined): string {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'LOW':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
    case 'REVIEW':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400';
    case 'COMPLETED':
      return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

/** ClickUp-style status group headers for "Assigned to me" */
export const STATUS_GROUP_ORDER = ['IN_PROGRESS', 'TODO', 'REVIEW', 'COMPLETED'] as const;

export const STATUS_GROUP_HEADER: Record<
  string,
  { label: string; pill: string; dot: string }
> = {
  IN_PROGRESS: {
    label: 'IN PROGRESS',
    pill: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    dot: 'border-violet-500 bg-violet-500',
  },
  TODO: {
    label: 'TO DO',
    pill: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    dot: 'border-gray-400 bg-transparent',
  },
  REVIEW: {
    label: 'REVIEW',
    pill: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    dot: 'border-purple-500 bg-purple-500',
  },
  COMPLETED: {
    label: 'COMPLETE',
    pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    dot: 'border-emerald-500 bg-emerald-500',
  },
};

export function groupTasksByStatus(
  tasks: MyTaskItem[],
  statuses: readonly string[] = STATUS_GROUP_ORDER,
): Record<string, MyTaskItem[]> {
  const groups: Record<string, MyTaskItem[]> = {};
  for (const s of statuses) groups[s] = [];
  for (const task of tasks) {
    const key = groups[task.status] !== undefined ? task.status : 'TODO';
    groups[key].push(task);
  }
  for (const s of statuses) {
    groups[s].sort(sortByDueDate);
  }
  return groups;
}

export function taskLocationLabel(task: MyTaskItem): string {
  const project = task.project?.name ?? 'Project';
  if (task.list?.name) return `${task.list.name} in ${project}`;
  return project;
}

export function assigneeNamesForSearch(
  task: MyTaskItem,
  usersById?: Map<string, { name: string }>,
): string {
  const fromRows = task.assignees?.map((a) => a.name).filter(Boolean).join(' ') ?? '';
  const fromIds = usersById
    ? assigneeIdsForTask(task)
        .map((id) => usersById.get(id)?.name)
        .filter(Boolean)
        .join(' ')
    : '';
  return [fromRows, fromIds].filter(Boolean).join(' ');
}

/** Case-insensitive match for Team tasks search (title, project, assignee, etc.). */
export function matchesTeamTaskSearch(
  task: MyTaskItem & { description?: string | null; note?: string | null },
  query: string,
  usersById?: Map<string, { name: string }>,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    task.title,
    task.description,
    task.note,
    task.project?.name,
    task.list?.name,
    taskLocationLabel(task),
    assigneeNamesForSearch(task, usersById),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function sortTasksByDueDate(tasks: MyTaskItem[]): MyTaskItem[] {
  return [...tasks].sort(sortByDueDate);
}

export function priorityFlagClass(priority: string | undefined): string {
  switch (priority) {
    case 'URGENT':
      return 'text-red-500';
    case 'HIGH':
      return 'text-orange-500';
    case 'MEDIUM':
      return 'text-amber-500';
    case 'LOW':
      return 'text-sky-500';
    default:
      return 'text-gray-300 dark:text-gray-600';
  }
}

export interface AssignedProjectSummary {
  id: string;
  name: string;
  openTaskCount: number;
}

/** Unique projects from tasks assigned to the user (or any task list passed in). */
export function deriveAssignedProjects(
  tasks: MyTaskItem[],
  options?: { openOnly?: boolean },
): AssignedProjectSummary[] {
  const openOnly = options?.openOnly ?? true;
  const map = new Map<string, { name: string; count: number }>();

  for (const task of tasks) {
    const projectId = task.projectId ?? task.project?.id;
    if (!projectId) continue;
    if (openOnly && task.status === 'COMPLETED') continue;

    const name = task.project?.name ?? 'Project';
    const existing = map.get(projectId);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(projectId, { name, count: 1 });
    }
  }

  return Array.from(map.entries())
    .map(([id, { name, count }]) => ({ id, name, openTaskCount: count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
