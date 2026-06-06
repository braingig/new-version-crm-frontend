'use client';

import { format } from 'date-fns';
import {
  getEventsForDay,
  getWeekDays,
  isSameDay,
  isToday,
  WEEKDAY_LABELS,
} from '@/lib/calendar/calendarGrid';
import type { CrmCalendarEvent } from '@/lib/calendar/calendarTypes';
import CalendarEventChip from './CalendarEventChip';

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CrmCalendarEvent[];
  selectedDay: Date | null;
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: CrmCalendarEvent) => void;
}

export default function CalendarWeekView({
  currentDate,
  events,
  selectedDay,
  onSelectDay,
  onSelectEvent,
}: CalendarWeekViewProps) {
  const days = getWeekDays(currentDate);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80">
        {days.map((day, index) => {
          const today = isToday(day);
          const selected = selectedDay ? isSameDay(day, selectedDay) : false;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`border-r px-2 py-3 text-center last:border-r-0 dark:border-gray-700 ${
                selected ? 'bg-primary-50 dark:bg-primary-950/30' : ''
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {WEEKDAY_LABELS[index]}
              </div>
              <div
                className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                  today
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {day.getDate()}
              </div>
              <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                {format(day, 'MMM')}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid min-h-[28rem] grid-cols-7 bg-white dark:bg-gray-900">
        {days.map((day) => {
          const dayEvents = getEventsForDay(events, day);
          const selected = selectedDay ? isSameDay(day, selectedDay) : false;

          return (
            <div
              key={`col-${day.toISOString()}`}
              className={`space-y-1.5 border-r p-2 last:border-r-0 dark:border-gray-800 ${
                selected ? 'bg-primary-50/40 dark:bg-primary-950/10' : ''
              }`}
            >
              {dayEvents.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  No events
                </p>
              ) : (
                dayEvents.map((event) => (
                  <CalendarEventChip key={event.id} event={event} onClick={onSelectEvent} />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
