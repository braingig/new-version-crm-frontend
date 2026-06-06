import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import type { CrmCalendarEvent } from './calendarTypes';
import { sortCalendarEventsForDay } from './calendarDisplay';

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type CalendarViewMode = 'month' | 'week';

export function getMonthGridDays(referenceDate: Date): Date[] {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function getWeekDays(referenceDate: Date): Date[] {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  return eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
  });
}

export function getEventsForDay(events: CrmCalendarEvent[], day: Date): CrmCalendarEvent[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const matched = events.filter((event) => {
    if (event.allDay) {
      const eventStart = startOfDay(event.start);
      const eventEnd = startOfDay(event.end);
      return eventStart <= dayStart && eventEnd > dayStart;
    }
    return event.start <= dayEnd && event.end > dayStart;
  });
  return sortCalendarEventsForDay(matched);
}

export function formatCalendarTitle(date: Date, view: CalendarViewMode): string {
  if (view === 'week') {
    const days = getWeekDays(date);
    const first = days[0];
    const last = days[days.length - 1];
    if (first.getFullYear() === last.getFullYear()) {
      if (first.getMonth() === last.getMonth()) {
        return `${format(first, 'MMM d')} – ${format(last, 'd, yyyy')}`;
      }
      return `${format(first, 'MMM d')} – ${format(last, 'MMM d, yyyy')}`;
    }
    return `${format(first, 'MMM d, yyyy')} – ${format(last, 'MMM d, yyyy')}`;
  }
  return format(date, 'MMMM yyyy');
}

export function shiftCalendarDate(date: Date, view: CalendarViewMode, direction: -1 | 1): Date {
  if (view === 'week') {
    const days = getWeekDays(date);
    const delta = direction * 7;
    return new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate() + delta);
  }
  return direction === 1 ? addMonths(date, 1) : subMonths(date, 1);
}

export { isSameDay, isSameMonth, isToday };
