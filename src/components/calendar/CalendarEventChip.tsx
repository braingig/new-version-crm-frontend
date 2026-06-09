'use client';

import { getCalendarEventColors } from '@/lib/calendar/calendarColors';
import { getCalendarGridDisplay } from '@/lib/calendar/calendarDisplay';
import type { CrmCalendarEvent } from '@/lib/calendar/calendarTypes';

interface CalendarEventChipProps {
  event: CrmCalendarEvent;
  onClick: (event: CrmCalendarEvent) => void;
  compact?: boolean;
}

export default function CalendarEventChip({ event, onClick, compact = false }: CalendarEventChipProps) {
  const colors = getCalendarEventColors(
    event.resource.kind,
    event.resource.status,
    event.resource.priority,
    event.resource.dueDate,
  );
  const display = getCalendarGridDisplay(event);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      title={display.tooltip ?? display.primary}
      className={`w-full rounded-md border text-left transition-opacity hover:opacity-90 ${
        compact ? 'px-1.5 py-1' : 'px-2.5 py-2'
      }`}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
    >
      <div className={`flex items-start ${display.badge ? 'gap-1' : ''}`}>
        {display.badge ? (
          <span
            className={`shrink-0 rounded px-1 py-0.5 font-bold uppercase ${
              compact ? 'text-[8px]' : 'text-[9px]'
            }`}
          >
            {display.badge}
          </span>
        ) : null}
        <span
          className={`min-w-0 flex-1 truncate font-semibold leading-tight ${
            compact ? 'text-[10px]' : 'text-xs'
          }`}
        >
          {display.primary}
        </span>
      </div>
    </button>
  );
}
