'use client';

import WorkScheduleEditor from '@/components/WorkScheduleEditor';
import TeamWorkScheduleOverview from '@/components/TeamWorkScheduleOverview';
import { useAuthStore } from '@/lib/store';
import { canViewTeamWorkSchedule } from '@/lib/permissions';

export default function WorkSchedulePage() {
    const role = useAuthStore((s) => s.user?.role);
    const showTeamOverview = canViewTeamWorkSchedule(role);

    return (
        <div className="mx-auto max-w-5xl space-y-10 px-0">
            <header className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-widest text-primary-600 dark:text-primary-400">
                    Availability
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                    Work schedule
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Choose your weekend days and add your working time blocks. These hours will apply to all active working days.
                </p>
            </header>

            <section className="space-y-4">
                {/* <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Your schedule
                    </h2>
                    {showTeamOverview && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Edits here update your row in the team overview below
                        </p>
                    )}
                </div> */}
                <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/40 sm:p-8">
                    <WorkScheduleEditor refetchTeamAfterMineSave={showTeamOverview} />
                </div>
            </section>

            {showTeamOverview && (
                <section className="space-y-4">
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Team overview
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Overview of everyone&apos;s schedules
                        </p>
                    </div>
                    <TeamWorkScheduleOverview />
                </section>
            )}
        </div>
    );
}
