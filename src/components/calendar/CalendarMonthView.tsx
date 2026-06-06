'use client';

import {
  getEventsForDay,
  getMonthGridDays,
  isSameDay,
  isSameMonth,
  isToday,
  WEEKDAY_LABELS,
} from '@/lib/calendar/calendarGrid';
import type { CrmCalendarEvent } from '@/lib/calendar/calendarTypes';
import CalendarEventChip from './CalendarEventChip';

const MAX_VISIBLE_EVENTS = 3;

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CrmCalendarEvent[];
  selectedDay: Date | null;
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: CrmCalendarEvent) => void;
}

export default function CalendarMonthView({
  currentDate,
  events,
  selectedDay,
  onSelectDay,
  onSelectEvent,
}: CalendarMonthViewProps) {
  const days = getMonthGridDays(currentDate);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 bg-white dark:bg-gray-900">
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const selected = selectedDay ? isSameDay(day, selectedDay) : false;
          const dayEvents = getEventsForDay(events, day);
          const visible = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const hiddenCount = dayEvents.length - visible.length;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`min-h-[7.5rem] border-b border-r border-gray-100 p-2 text-left transition-colors last:border-r-0 dark:border-gray-800 sm:min-h-[8.5rem] ${
                inMonth
                  ? 'bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/60'
                  : 'bg-gray-50/80 hover:bg-gray-100 dark:bg-gray-950/40 dark:hover:bg-gray-900/60'
              } ${selected ? 'ring-2 ring-inset ring-primary-500 dark:ring-primary-400' : ''} ${
                today ? 'bg-primary-50/60 dark:bg-primary-950/20' : ''
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-1">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    today
                      ? 'bg-primary-600 text-white'
                      : inMonth
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {visible.map((event) => (
                  <CalendarEventChip
                    key={event.id}
                    event={event}
                    onClick={onSelectEvent}
                    compact
                  />
                ))}
                {hiddenCount > 0 && (
                  <span className="block px-1 text-[10px] font-medium text-primary-600 dark:text-primary-400">
                    +{hiddenCount} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
