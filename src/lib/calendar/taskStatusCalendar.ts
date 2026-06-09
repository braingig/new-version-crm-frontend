import { addDays, isValid, startOfDay } from 'date-fns';
import type { CalendarTaskLike, CrmCalendarEvent } from './calendarTypes';

export interface TaskStatusHistoryEntry {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
}

function parseStatusHistoryDay(value: string): Date {
  const d = new Date(value);
  return isValid(d) ? startOfDay(d) : startOfDay(new Date());
}

function eachDayFromTo(start: Date, endInclusive: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(start);
  const last = startOfDay(endInclusive);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * Days a task was IN_PROGRESS during this history segment.
 * Active (open) segments grow one day at a time: start → today only (not future dates).
 */
function inProgressDays(
  startedAt: Date,
  endedAt: Date | null | undefined,
  today: Date,
): Date[] {
  const start = startOfDay(startedAt);
  const todayStart = startOfDay(today);

  if (endedAt) {
    const endExclusive = startOfDay(endedAt);
    const last = addDays(endExclusive, -1);
    if (last.getTime() < start.getTime()) return [];
    const cappedLast = last.getTime() > todayStart.getTime() ? todayStart : last;
    return eachDayFromTo(start, cappedLast);
  }

  if (start.getTime() > todayStart.getTime()) return [];
  return eachDayFromTo(start, todayStart);
}

export function buildTaskStatusCalendarDays(
  history: TaskStatusHistoryEntry[],
  rangeStart: Date,
  rangeEnd: Date,
  today: Date = new Date(),
): Array<{ day: Date; status: string; historyId: string }> {
  const out: Array<{ day: Date; status: string; historyId: string }> = [];
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = startOfDay(rangeEnd);

  for (const entry of history) {
    const startedAt = parseStatusHistoryDay(entry.startedAt);
    const endedAt = entry.endedAt ? parseStatusHistoryDay(entry.endedAt) : null;

    const days =
      entry.status === 'IN_PROGRESS'
        ? inProgressDays(startedAt, endedAt, today)
        : [startedAt];

    for (const day of days) {
      if (day < rangeStartDay || day > rangeEndDay) continue;
      out.push({ day, status: entry.status, historyId: entry.id });
    }
  }

  return out;
}

export function fallbackTaskStatusHistory(task: CalendarTaskLike): TaskStatusHistoryEntry[] {
  const status = task.status ?? 'TODO';
  const startedAt =
    status === 'TODO'
      ? (task.createdAt ?? new Date().toISOString())
      : (task.updatedAt ?? task.createdAt ?? new Date().toISOString());

  return [
    {
      id: `fallback-${task.id}`,
      status,
      startedAt,
      endedAt: null,
    },
  ];
}

export function getTaskStatusHistory(task: CalendarTaskLike): TaskStatusHistoryEntry[] {
  const history = task.statusHistory ?? [];
  return history.length > 0 ? history : fallbackTaskStatusHistory(task);
}

export function pushTaskStatusEvent(
  events: CrmCalendarEvent[],
  params: {
    task: CalendarTaskLike;
    day: Date;
    displayStatus: string;
    historyId: string;
    projectName?: string;
    assigneeNames?: string[];
  },
) {
  const { task, day, displayStatus, historyId, projectName, assigneeNames } = params;
  const dayStart = startOfDay(day);

  events.push({
    id: `task-status-${task.id}-${historyId}-${dayStart.toISOString().slice(0, 10)}`,
    title: task.title,
    start: dayStart,
    end: addDays(dayStart, 1),
    allDay: true,
    resource: {
      kind: 'TASK_STATUS',
      projectId: task.projectId ?? undefined,
      taskId: task.id,
      projectName,
      taskTitle: task.title,
      status: displayStatus,
      priority: task.priority ?? undefined,
      assigneeNames,
      dueDate: task.dueDate ?? undefined,
      startDate: task.startDate ?? undefined,
    },
  });
}
