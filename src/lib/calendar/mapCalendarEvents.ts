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
  CalendarProjectLike,
  CalendarTaskLike,
  CrmCalendarEvent,
} from './calendarTypes';

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  if (!isValid(d)) {
    const fallback = new Date(value);
    return isValid(fallback) ? fallback : null;
  }
  return d;
}

function toDayStart(value: string | null | undefined): Date | null {
  const d = parseDate(value);
  return d ? startOfDay(d) : null;
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
    },
  });
}

export function mapCalendarEvents(
  projects: CalendarProjectLike[],
  tasks: CalendarTaskLike[],
  options: CalendarFilterOptions,
): CrmCalendarEvent[] {
  const {
    projectId,
    assigneeId,
    status,
    showProjectDates = true,
    showTaskDue = true,
    showTaskStart = true,
    rangeStart,
    rangeEnd,
  } = options;

  const events: CrmCalendarEvent[] = [];
  const filteredProjects = (projects ?? []).filter((p) =>
    projectId ? p.id === projectId : true,
  );

  if (showProjectDates) {
    for (const project of filteredProjects) {
      const start = toDayStart(project.startDate);
      const end = toDayStart(project.endDate);

      if (start && end && end.getTime() >= start.getTime()) {
        pushEvent(
          events,
          {
            id: `project-span-${project.id}`,
            title: project.name,
            start,
            end: addDays(end, 1),
            allDay: true,
            kind: 'PROJECT_SPAN',
            projectId: project.id,
            projectName: project.name,
            status: project.status ?? undefined,
          },
          rangeStart,
          rangeEnd,
        );
      } else {
        if (start) {
          pushEvent(
            events,
            {
              id: `project-start-${project.id}`,
              title: `Start: ${project.name}`,
              start,
              end: addDays(start, 1),
              allDay: true,
              kind: 'PROJECT_START',
              projectId: project.id,
              projectName: project.name,
              status: project.status ?? undefined,
            },
            rangeStart,
            rangeEnd,
          );
        }
        if (end) {
          pushEvent(
            events,
            {
              id: `project-end-${project.id}`,
              title: `Deadline: ${project.name}`,
              start: end,
              end: addDays(end, 1),
              allDay: true,
              kind: 'PROJECT_END',
              projectId: project.id,
              projectName: project.name,
              status: project.status ?? undefined,
            },
            rangeStart,
            rangeEnd,
          );
        }
      }
    }
  }

  const flatTasks = flattenCalendarTasks(tasks ?? []).filter((task) => {
    if (projectId && task.projectId !== projectId) return false;
    if (status && task.status !== status) return false;
    if (!matchesAssignee(task, assigneeId)) return false;
    return true;
  });

  for (const task of flatTasks) {
    const assigneeNames = (task.assignees ?? []).map((a) => a.name);
    const projectName = task.project?.name;
    const due = toDayStart(task.dueDate);
    const start = toDayStart(task.startDate);

    if (showTaskDue && due) {
      pushEvent(
        events,
        {
          id: `task-due-${task.id}`,
          title: task.title,
          start: due,
          end: addDays(due, 1),
          allDay: true,
          kind: 'TASK_DUE',
          projectId: task.projectId ?? undefined,
          taskId: task.id,
          projectName,
          taskTitle: task.title,
          status: task.status ?? undefined,
          priority: task.priority ?? undefined,
          assigneeNames,
        },
        rangeStart,
        rangeEnd,
      );
    }

    if (showTaskStart && start && (!due || start.getTime() !== due.getTime())) {
      pushEvent(
        events,
        {
          id: `task-start-${task.id}`,
          title: task.title,
          start,
          end: addDays(start, 1),
          allDay: true,
          kind: 'TASK_START',
          projectId: task.projectId ?? undefined,
          taskId: task.id,
          projectName,
          taskTitle: task.title,
          status: task.status ?? undefined,
          priority: task.priority ?? undefined,
          assigneeNames,
        },
        rangeStart,
        rangeEnd,
      );
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
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

    const start = parseDate(meeting.startTime);
    const end = parseDate(meeting.endTime);
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
