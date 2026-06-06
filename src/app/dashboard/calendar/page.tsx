'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProjectCalendar from '@/components/calendar/ProjectCalendar';

function CalendarPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary-600 dark:text-primary-400">
          Planning
        </p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">Calendar</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
          Task due dates on the calendar, labeled by project. Select a day to see the project and task names.
        </p>
      </div>

      <ProjectCalendar initialProjectId={projectId} />
    </div>
  );
}

function CalendarLoading() {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-9 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-gray-200/80 bg-white/90 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarPageContent />
    </Suspense>
  );
}
