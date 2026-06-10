import { format } from 'date-fns';
import type { CalendarEventKind, CrmCalendarEvent } from './calendarTypes';

export interface CalendarEventDisplay {
  badge: string;
  primary: string;
  subtitle?: string;
  meta?: string;
  tooltip?: string;
}

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Complete',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

function statusLabel(status?: string): string | undefined {
  if (!status) return undefined;
  return STATUS_LABELS[status] ?? status;
}

function priorityLabel(priority?: string): string | undefined {
  if (!priority) return undefined;
  return PRIORITY_LABELS[priority] ?? priority;
}

function formatTaskMetaParts(
  status?: string,
  priority?: string,
  assigneeNames?: string[],
): string[] {
  const parts: string[] = [];
  const statusText = statusLabel(status);
  const priorityText = priorityLabel(priority);

  if (statusText) parts.push(statusText);
  if (priorityText) parts.push(`${priorityText} priority`);
  if (assigneeNames?.length) parts.push(assigneeNames.join(', '));

  return parts;
}

function formatTaskDateLabel(iso?: string, fallback?: Date): string | undefined {
  if (!iso) return fallback ? format(fallback, 'MMM d, yyyy') : undefined;
  const datePart = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split('-').map(Number);
    return format(new Date(year, month - 1, day), 'MMM d, yyyy');
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? undefined : format(parsed, 'MMM d, yyyy');
}

function buildTaskTooltip(
  taskTitle: string,
  projectName: string,
  status?: string,
  priority?: string,
  assigneeNames?: string[],
  dateLabel?: string,
): string {
  const metaParts = formatTaskMetaParts(status, priority, assigneeNames);
  return [`Task: ${taskTitle}`, projectName, dateLabel, ...metaParts].filter(Boolean).join(' · ');
}

function getTaskTitle(event: CrmCalendarEvent): string {
  return event.resource.taskTitle ?? event.title.replace(/^Start:\s*/i, '');
}

function getMeetingTitle(event: CrmCalendarEvent): string {
  return event.resource.meetingTitle ?? event.title;
}

function getProjectLabel(event: CrmCalendarEvent): string {
  return event.resource.projectName ?? 'No project';
}

function formatMeetingTimeRange(event: CrmCalendarEvent): string {
  const sameDay = format(event.start, 'yyyy-MM-dd') === format(event.end, 'yyyy-MM-dd');
  if (sameDay) {
    return `${format(event.start, 'h:mm a')} – ${format(event.end, 'h:mm a')}`;
  }
  return `${format(event.start, 'MMM d, h:mm a')} – ${format(event.end, 'MMM d, h:mm a')}`;
}

/** Calendar grid: task date, project name on the chip. */
export function getCalendarGridDisplay(event: CrmCalendarEvent): CalendarEventDisplay {
  const { kind, status, priority, assigneeNames, location } = event.resource;

  if (kind === 'MEETING') {
    const meetingTitle = getMeetingTitle(event);
    const projectName = getProjectLabel(event);
    const timeRange = formatMeetingTimeRange(event);
    const assigneePart = assigneeNames?.length
      ? assigneeNames.join(', ')
      : undefined;
    const metaParts = [timeRange, location, assigneePart].filter(Boolean);

    return {
      badge: format(event.start, 'h:mm a'),
      primary: projectName,
      tooltip: [`Meeting: ${meetingTitle}`, projectName, ...metaParts].filter(Boolean).join(' · '),
    };
  }

  if (kind === 'TASK_STATUS' || kind === 'TASK_DUE') {
    const taskTitle = getTaskTitle(event);
    const projectName = getProjectLabel(event);
    const statusText = statusLabel(status);
    const dueLabel = formatTaskDateLabel(event.resource.dueDate);
    const duePart = dueLabel ? `Due ${dueLabel}` : undefined;
    const priorityPart = priorityLabel(priority);
    const priorityMeta = priorityPart ? `${priorityPart} priority` : undefined;
    const assigneePart = assigneeNames?.length ? assigneeNames.join(', ') : undefined;
    const metaParts = [statusText, duePart, priorityMeta, assigneePart].filter(Boolean);

    return {
      badge: '',
      primary: projectName,
      tooltip: [`Task: ${taskTitle}`, projectName, ...metaParts].filter(Boolean).join(' · '),
    };
  }

  if (kind === 'TASK_START') {
    const taskTitle = getTaskTitle(event);
    const projectName = getProjectLabel(event);
    const startLabel = formatTaskDateLabel(event.resource.startDate, event.start);
    const dateLabel = startLabel ? `Starts ${startLabel}` : undefined;

    return {
      badge: 'Start',
      primary: projectName,
      tooltip: buildTaskTooltip(taskTitle, projectName, status, priority, assigneeNames, dateLabel),
    };
  }

  if (kind === 'PROJECT_START') {
    return {
      badge: 'Project',
      primary: getProjectLabel(event),
      subtitle: 'Project start',
    };
  }

  if (kind === 'PROJECT_END') {
    return {
      badge: 'Project',
      primary: getProjectLabel(event),
      subtitle: 'Project deadline',
    };
  }

  return {
    badge: 'Project',
    primary: getProjectLabel(event),
    subtitle: 'Project timeline',
  };
}

/** Selected day panel: project name + task/meeting details. */
export function getCalendarDayPanelDisplay(event: CrmCalendarEvent): CalendarEventDisplay {
  const { kind, status, priority, assigneeNames, location } = event.resource;

  if (kind === 'MEETING') {
    const meetingTitle = getMeetingTitle(event);
    const projectName = getProjectLabel(event);
    const timeRange = formatMeetingTimeRange(event);
    const assigneePart = assigneeNames?.length
      ? assigneeNames.join(', ')
      : undefined;
    const meta = [timeRange, location, assigneePart].filter(Boolean).join(' · ');

    return {
      badge: 'Meeting',
      primary: projectName,
      subtitle: meetingTitle,
      meta: meta || undefined,
      tooltip: [projectName, meetingTitle, timeRange, assigneePart].filter(Boolean).join(' · '),
    };
  }

  if (kind === 'TASK_STATUS' || kind === 'TASK_DUE') {
    const taskTitle = getTaskTitle(event);
    const projectName = getProjectLabel(event);
    const statusText = statusLabel(status);
    const dueLabel = formatTaskDateLabel(event.resource.dueDate);
    const duePart = dueLabel ? `Due ${dueLabel}` : undefined;
    const priorityPart = priorityLabel(priority);
    const priorityMeta = priorityPart ? `${priorityPart} priority` : undefined;
    const assigneePart = assigneeNames?.length ? assigneeNames.join(', ') : undefined;
    const meta = [statusText, duePart, priorityMeta, assigneePart].filter(Boolean).join(' · ');

    return {
      badge: '',
      primary: projectName,
      subtitle: `Task: ${taskTitle}`,
      meta: meta || undefined,
      tooltip: [`Task: ${taskTitle}`, projectName, statusText, duePart].filter(Boolean).join(' · '),
    };
  }

  if (kind === 'TASK_START') {
    const taskTitle = getTaskTitle(event);
    const projectName = getProjectLabel(event);
    const startLabel = formatTaskDateLabel(event.resource.startDate, event.start);
    const dateLabel = startLabel ? `Starts ${startLabel}` : undefined;
    const metaParts = formatTaskMetaParts(status, priority, assigneeNames);
    const meta = [dateLabel, ...metaParts].filter(Boolean).join(' · ');

    return {
      badge: 'Start',
      primary: projectName,
      subtitle: `Task: ${taskTitle}`,
      meta: meta || undefined,
      tooltip: buildTaskTooltip(taskTitle, projectName, status, priority, assigneeNames, dateLabel),
    };
  }

  if (kind === 'PROJECT_START') {
    return {
      badge: 'Project',
      primary: getProjectLabel(event),
      subtitle: 'Project start date',
    };
  }

  if (kind === 'PROJECT_END') {
    return {
      badge: 'Project',
      primary: getProjectLabel(event),
      subtitle: 'Project deadline',
    };
  }

  return {
    badge: 'Project',
    primary: getProjectLabel(event),
    subtitle: 'Project timeline',
  };
}

export function isTaskCalendarEvent(event: CrmCalendarEvent): boolean {
  return (
    event.resource.kind === 'TASK_STATUS' ||
    event.resource.kind === 'TASK_DUE' ||
    event.resource.kind === 'TASK_START'
  );
}

export function isMeetingCalendarEvent(event: CrmCalendarEvent): boolean {
  return event.resource.kind === 'MEETING';
}

export function isProjectCalendarEvent(event: CrmCalendarEvent): boolean {
  return (
    event.resource.kind === 'PROJECT_START' ||
    event.resource.kind === 'PROJECT_END' ||
    event.resource.kind === 'PROJECT_SPAN'
  );
}

export function getProjectEventsForDay(events: CrmCalendarEvent[]): CrmCalendarEvent[] {
  return sortCalendarEventsForDay(events.filter(isProjectCalendarEvent));
}

export function sortCalendarEventsForDay(events: CrmCalendarEvent[]): CrmCalendarEvent[] {
  const order: Record<CalendarEventKind, number> = {
    MEETING: 0,
    TASK_STATUS: 1,
    TASK_DUE: 2,
    TASK_START: 3,
    PROJECT_END: 4,
    PROJECT_START: 5,
    PROJECT_SPAN: 6,
  };

  return [...events].sort((a, b) => {
    const byKind = order[a.resource.kind] - order[b.resource.kind];
    if (byKind !== 0) return byKind;
    if (a.resource.kind === 'MEETING' && b.resource.kind === 'MEETING') {
      return a.start.getTime() - b.start.getTime();
    }
    const projectA = getProjectLabel(a);
    const projectB = getProjectLabel(b);
    if (projectA !== projectB) return projectA.localeCompare(projectB);
    return getTaskTitle(a).localeCompare(getTaskTitle(b));
  });
}

export function getTaskEventsForDay(events: CrmCalendarEvent[]): CrmCalendarEvent[] {
  return sortCalendarEventsForDay(events.filter(isTaskCalendarEvent));
}

export function getMeetingEventsForDay(events: CrmCalendarEvent[]): CrmCalendarEvent[] {
  return sortCalendarEventsForDay(events.filter(isMeetingCalendarEvent));
}
