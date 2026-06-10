import {
  addDays,
  endOfDay,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';
import type {
  CalendarEventKind,
  CalendarFilterOptions,
  CalendarMeetingLike,
  CalendarTaskLike,
  CrmCalendarEvent,
} from './calendarTypes';
import {
  buildTaskStatusCalendarDays,
  getTaskStatusHistory,
  pushTaskStatusEvent,
} from './taskStatusCalendar';

/** Parse meeting start/end with full date+time (do not strip to midnight). */
function parseMeetingDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  if (isValid(d)) return d;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

function overlapsRange(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return start <= rangeEnd && end >= rangeStart;
}

export function flattenCalendarTasks(tasks: CalendarTaskLike[]): CalendarTaskLike[] {
  const out: CalendarTaskLike[] = [];

  function walk(task: CalendarTaskLike, parentTitle?: string) {
    out.push({ ...task, title: parentTitle ? `${parentTitle} › ${task.title}` : task.title });
    (task.subTasks ?? []).forEach((sub) => walk(sub, task.title));
  }

  (tasks ?? []).forEach((task) => walk(task));
  return out;
}

function taskAssigneeIds(task: CalendarTaskLike): string[] {
  const ids = new Set<string>();
  if (task.assignedToId) ids.add(task.assignedToId);
  (task.assignees ?? []).forEach((a) => ids.add(a.id));
  return Array.from(ids);
}

function matchesAssignee(task: CalendarTaskLike, assigneeId: string | null | undefined): boolean {
  if (!assigneeId) return true;
  return taskAssigneeIds(task).includes(assigneeId);
}

function pushEvent(
  events: CrmCalendarEvent[],
  params: {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    kind: CalendarEventKind;
    projectId?: string;
    taskId?: string;
    meetingId?: string;
    projectName?: string;
    taskTitle?: string;
    meetingTitle?: string;
    location?: string;
    status?: string;
    priority?: string;
    assigneeNames?: string[];
    dueDate?: string;
    startDate?: string;
  },
  rangeStart: Date,
  rangeEnd: Date,
) {
  if (!overlapsRange(params.start, params.end, rangeStart, rangeEnd)) return;

  events.push({
    id: params.id,
    title: params.title,
    start: params.start,
    end: params.end,
    allDay: params.allDay,
    resource: {
      kind: params.kind,
      projectId: params.projectId,
      taskId: params.taskId,
      meetingId: params.meetingId,
      projectName: params.projectName,
      taskTitle: params.taskTitle,
      meetingTitle: params.meetingTitle,
      location: params.location,
      status: params.status,
      priority: params.priority,
      assigneeNames: params.assigneeNames,
      dueDate: params.dueDate,
      startDate: params.startDate,
    },
  });
}

export function mapCalendarEvents(
  tasks: CalendarTaskLike[],
  options: CalendarFilterOptions,
): CrmCalendarEvent[] {
  const {
    projectId,
    assigneeId,
    status,
    showTaskStatus = true,
    rangeStart,
    rangeEnd,
  } = options;

  const events: CrmCalendarEvent[] = [];

  const flatTasks = flattenCalendarTasks(tasks ?? []).filter((task) => {
    if (projectId && task.projectId !== projectId) return false;
    if (status && task.status !== status) return false;
    if (!matchesAssignee(task, assigneeId)) return false;
    return true;
  });

  for (const task of flatTasks) {
    const assigneeNames = (task.assignees ?? []).map((a) => a.name);
    const projectName = task.project?.name;

    if (!showTaskStatus) continue;

    const history = getTaskStatusHistory(task);
    const statusDays = buildTaskStatusCalendarDays(history, rangeStart, rangeEnd);

    for (const { day, status, historyId } of statusDays) {
      pushTaskStatusEvent(events, {
        task,
        day,
        displayStatus: status,
        historyId,
        projectName,
        assigneeNames,
      });
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** @deprecated Use mapCalendarEvents — project milestones are no longer shown on the calendar. */
export function mapTaskCalendarEvents(
  tasks: CalendarTaskLike[],
  options: CalendarFilterOptions,
): CrmCalendarEvent[] {
  return mapCalendarEvents(tasks, options);
}

export function mapMeetingsToCalendarEvents(
  meetings: CalendarMeetingLike[],
  options: {
    projectId?: string | null;
    rangeStart: Date;
    rangeEnd: Date;
  },
): CrmCalendarEvent[] {
  const { projectId, rangeStart, rangeEnd } = options;
  const events: CrmCalendarEvent[] = [];

  for (const meeting of meetings ?? []) {
    if (projectId && meeting.projectId !== projectId) continue;

    const start = parseMeetingDateTime(meeting.startTime);
    const end = parseMeetingDateTime(meeting.endTime);
    if (!start || !end) continue;

    pushEvent(
      events,
      {
        id: `meeting-${meeting.id}`,
        title: meeting.title,
        start,
        end,
        allDay: false,
        kind: 'MEETING',
        projectId: meeting.projectId ?? undefined,
        meetingId: meeting.id,
        projectName: meeting.project?.name,
        meetingTitle: meeting.title,
        location: meeting.location ?? undefined,
        assigneeNames: meeting.assignees?.map((a) => a.name),
      },
      rangeStart,
      rangeEnd,
    );
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Visible range for calendar month/week grids. */
export function getVisibleRange(date: Date, view: 'month' | 'week'): { start: Date; end: Date } {
  const d = startOfDay(date);

  if (view === 'week') {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = addDays(d, diff);
    const weekEnd = endOfDay(addDays(weekStart, 6));
    return { start: weekStart, end: weekEnd };
  }

  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const gridStart = addDays(monthStart, monthStart.getDay() === 0 ? -6 : 1 - monthStart.getDay());
  const gridEnd = endOfDay(addDays(monthEnd, monthEnd.getDay() === 0 ? 0 : 7 - monthEnd.getDay()));
  return { start: gridStart, end: gridEnd };
}
