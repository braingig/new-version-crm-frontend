'use client';

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { getCalendarEventColors } from '@/lib/calendar/calendarColors';
import {
  getCalendarDayPanelDisplay,
  isMeetingCalendarEvent,
} from '@/lib/calendar/calendarDisplay';
import type { CrmCalendarEvent } from '@/lib/calendar/calendarTypes';
import { isHttpUrl } from '@/lib/isHttpUrl';

interface CalendarDayEventCardProps {
  event: CrmCalendarEvent;
  onClick: (event: CrmCalendarEvent) => void;
}

export default function CalendarDayEventCard({ event, onClick }: CalendarDayEventCardProps) {
  const colors = getCalendarEventColors(
    event.resource.kind,
    event.resource.status,
    event.resource.priority,
  );
  const display = getCalendarDayPanelDisplay(event);
  const joinUrl =
    isMeetingCalendarEvent(event) && isHttpUrl(event.resource.location)
      ? event.resource.location
      : null;

  return (
    <div
      className="w-full rounded-xl border p-3 text-left transition-opacity hover:opacity-90"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
    >
      <button
        type="button"
        onClick={() => onClick(event)}
        title={display.tooltip ?? [display.primary, display.subtitle].filter(Boolean).join(' · ')}
        className="w-full text-left"
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide dark:bg-black/20">
            {display.badge}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-white">
              {display.primary}
            </p>
            {display.subtitle && (
              <p className="mt-1 text-xs leading-snug opacity-90">{display.subtitle}</p>
            )}
            {display.meta && (
              <p className="mt-1.5 text-[11px] leading-snug opacity-70">{display.meta}</p>
            )}
          </div>
        </div>
      </button>

      {joinUrl && (
        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold text-gray-900 transition hover:bg-white dark:bg-black/20 dark:text-white dark:hover:bg-black/30"
        >
          Join meeting
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
