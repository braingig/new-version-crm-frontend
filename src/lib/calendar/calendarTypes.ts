export type CalendarEventKind =
  | 'PROJECT_SPAN'
  | 'PROJECT_START'
  | 'PROJECT_END'
  | 'TASK_DUE'
  | 'TASK_START'
  | 'TASK_STATUS'
  | 'MEETING';

export interface CalendarTaskLike {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  projectId?: string | null;
  assignedToId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  parentTaskId?: string | null;
  project?: { id: string; name: string } | null;
  assignees?: { id: string; name: string }[] | null;
  subTasks?: CalendarTaskLike[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  statusHistory?: CalendarStatusHistoryLike[] | null;
}

export interface CalendarStatusHistoryLike {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
}

export interface CalendarProjectLike {
  id: string;
  name: string;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CalendarMeetingLike {
  id: string;
  title: string;
  description?: string | null;
  projectId?: string | null;
  startTime: string;
  endTime: string;
  location?: string | null;
  project?: { id: string; name: string } | null;
}

export interface CalendarEventMeta {
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
  parentTitle?: string;
  dueDate?: string;
  startDate?: string;
}

export interface CrmCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: CalendarEventMeta;
}

export interface CalendarFilterOptions {
  projectId?: string | null;
  assigneeId?: string | null;
  status?: string | null;
  showTaskStatus?: boolean;
  showTaskDue?: boolean;
  showTaskStart?: boolean;
  rangeStart: Date;
  rangeEnd: Date;
}
