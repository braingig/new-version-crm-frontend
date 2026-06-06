import type { CalendarEventKind } from './calendarTypes';

/** Inline colors for react-big-calendar (matches Tailwind theme). */
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
const taskStartColor = { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e' };
const meetingColor = { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };

export function getCalendarEventColors(
  kind: CalendarEventKind,
  status?: string,
  priority?: string,
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

  if (priority === 'URGENT') {
    return { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' };
  }

  if (status && taskStatusColors[status]) {
    return taskStatusColors[status];
  }

  return taskStatusColors.TODO;
}
