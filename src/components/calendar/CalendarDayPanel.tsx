'use client';

import { format } from 'date-fns';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getEventsForDay } from '@/lib/calendar/calendarGrid';
import {
  getMeetingEventsForDay,
  getTaskEventsForDay,
} from '@/lib/calendar/calendarDisplay';
import type { CrmCalendarEvent } from '@/lib/calendar/calendarTypes';
import CalendarDayEventCard from './CalendarDayEventCard';

interface CalendarDayPanelProps {
  day: Date;
  events: CrmCalendarEvent[];
  onClose: () => void;
  onSelectEvent: (event: CrmCalendarEvent) => void;
}

export default function CalendarDayPanel({
  day,
  events,
  onClose,
  onSelectEvent,
}: CalendarDayPanelProps) {
  const dayEvents = getEventsForDay(events, day);
  const tasks = getTaskEventsForDay(dayEvents);
  const meetings = getMeetingEventsForDay(dayEvents);
  const totalCount = tasks.length + meetings.length;

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary-600 dark:text-primary-400">
            Selected day
          </p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {format(day, 'EEEE, MMMM d, yyyy')}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {totalCount === 0
              ? 'Nothing scheduled on this day'
              : [
                  meetings.length > 0
                    ? `${meetings.length} meeting${meetings.length === 1 ? '' : 's'}`
                    : null,
                  tasks.length > 0
                    ? `${tasks.length} task${tasks.length === 1 ? '' : 's'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          aria-label="Close day panel"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {totalCount === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No tasks or meetings on this day.
        </p>
      ) : (
        <div className="space-y-5">
          {meetings.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Meetings
              </h4>
              <div className="space-y-2">
                {meetings.map((event) => (
                  <CalendarDayEventCard key={event.id} event={event} onClick={onSelectEvent} />
                ))}
              </div>
            </section>
          )}

          {tasks.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-400">
                Tasks
              </h4>
              <div className="space-y-2">
                {tasks.map((event) => (
                  <CalendarDayEventCard key={event.id} event={event} onClick={onSelectEvent} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
