import { isValid, startOfDay } from 'date-fns';
import type { CalendarEventKind } from './calendarTypes';

const projectStatusColors: Record<string, { bg: string; border: string; text: string }> = {
  ACTIVE: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  COMPLETED: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  ON_HOLD: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  PLANNING: { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' },
  CANCELLED: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
};

const taskStatusColors: Record<string, { bg: string; border: string; text: string }> = {
  TODO: { bg: '#eef2ff', border: '#6366f1', text: '#4338ca' },
  IN_PROGRESS: { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  REVIEW: { bg: '#f3e8ff', border: '#a855f7', text: '#7e22ce' },
  COMPLETED: { bg: '#dcfce7', border: '#22c55e', text: '#15803d' },
};

const projectSpanColor = { bg: '#e0e7ff', border: '#4f46e5', text: '#3730a3' };
const taskOverdueColor = { bg: '#ffe4e6', border: '#f43f5e', text: '#be123c' };
const taskStartColor = { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e' };
const meetingColor = { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };

function parseDueDay(iso?: string): Date | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split('-').map(Number);
    const local = new Date(year, month - 1, day);
    return isValid(local) ? startOfDay(local) : null;
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

/** Red only when due date has passed and the task is not completed. */
export function isTaskDueOverdue(dueDate?: string, status?: string): boolean {
  if (!dueDate || status === 'COMPLETED') return false;
  const due = parseDueDay(dueDate);
  if (!due) return false;
  return due.getTime() < startOfDay(new Date()).getTime();
}

function taskColorForStatus(status?: string): { bg: string; border: string; text: string } {
  if (status && taskStatusColors[status]) return taskStatusColors[status];
  return taskStatusColors.TODO;
}

export function getCalendarEventColors(
  kind: CalendarEventKind,
  status?: string,
  priority?: string,
  dueDate?: string,
): { bg: string; border: string; text: string } {
  if (kind === 'MEETING') {
    return meetingColor;
  }

  if (kind === 'PROJECT_SPAN' || kind === 'PROJECT_START' || kind === 'PROJECT_END') {
    if (status && projectStatusColors[status]) return projectStatusColors[status];
    return projectSpanColor;
  }

  if (kind === 'TASK_START') {
    return taskStartColor;
  }

  const isTaskLike =
    kind === 'TASK_STATUS' || kind === 'TASK_DUE' || kind === 'TASK_START';

  if (isTaskLike) {
    if (status === 'COMPLETED') {
      return taskStatusColors.COMPLETED;
    }
    if (isTaskDueOverdue(dueDate, status)) {
      return taskOverdueColor;
    }
    if (priority === 'URGENT' && status !== 'COMPLETED') {
      return { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' };
    }
    return taskColorForStatus(status);
  }

  return taskStatusColors.TODO;
}
