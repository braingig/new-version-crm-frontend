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

function statusLabel(status?: string): string | undefined {
  if (!status) return undefined;
  return STATUS_LABELS[status] ?? status;
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
    const metaParts = [timeRange, location].filter(Boolean);

    return {
      badge: format(event.start, 'h:mm a'),
      primary: projectName,
      tooltip: [`Meeting: ${meetingTitle}`, projectName, ...metaParts].filter(Boolean).join(' · '),
    };
  }

  if (kind === 'TASK_DUE' || kind === 'TASK_START') {
    const taskTitle = getTaskTitle(event);
    const projectName = getProjectLabel(event);
    const badge = kind === 'TASK_DUE' ? 'Due' : 'Start';
    const metaParts = [statusLabel(status), priority, assigneeNames?.join(', ')].filter(Boolean);

    return {
      badge,
      primary: projectName,
      tooltip: [`Task: ${taskTitle}`, projectName, badge, ...metaParts].filter(Boolean).join(' · '),
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
    const meta = [timeRange, location].filter(Boolean).join(' · ');

    return {
      badge: 'Meeting',
      primary: projectName,
      subtitle: meetingTitle,
      meta: meta || undefined,
      tooltip: [projectName, meetingTitle, timeRange].join(' · '),
    };
  }

  if (kind === 'TASK_DUE' || kind === 'TASK_START') {
    const taskTitle = getTaskTitle(event);
    const projectName = getProjectLabel(event);
    const badge = kind === 'TASK_DUE' ? 'Due' : 'Start';
    const meta = [statusLabel(status), priority, assigneeNames?.join(', ')].filter(Boolean).join(' · ');

    return {
      badge,
      primary: projectName,
      subtitle: `Task: ${taskTitle}`,
      meta: meta || undefined,
      tooltip: [projectName, taskTitle, badge].join(' · '),
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
  return event.resource.kind === 'TASK_DUE' || event.resource.kind === 'TASK_START';
}

export function isMeetingCalendarEvent(event: CrmCalendarEvent): boolean {
  return event.resource.kind === 'MEETING';
}

export function sortCalendarEventsForDay(events: CrmCalendarEvent[]): CrmCalendarEvent[] {
  const order: Record<CalendarEventKind, number> = {
    MEETING: 0,
    TASK_DUE: 1,
    TASK_START: 2,
    PROJECT_END: 3,
    PROJECT_START: 4,
    PROJECT_SPAN: 5,
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
