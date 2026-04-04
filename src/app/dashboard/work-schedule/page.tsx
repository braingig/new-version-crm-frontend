'use client';

import WorkScheduleEditor from '@/components/WorkScheduleEditor';
import TeamWorkScheduleOverview from '@/components/TeamWorkScheduleOverview';
import { useAuthStore } from '@/lib/store';
import { canViewTeamWorkSchedule } from '@/lib/permissions';

export default function WorkSchedulePage() {
    const role = useAuthStore((s) => s.user?.role);
    const showTeamOverview = canViewTeamWorkSchedule(role);

    return (
        <div className={showTeamOverview ? 'max-w-6xl space-y-10' : 'max-w-3xl'}>
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Work schedule</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {showTeamOverview
                        ? 'Review everyone’s weekend and working hours. Use Edit to change a user’s schedule, or adjust your own below.'
                        : 'Set your weekend days and your recurring working hours once. They apply every week the same way.'}
                </p>
            </div>

            {showTeamOverview && (
                <section>
                    <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                        Team schedules
                    </h2>
                    <TeamWorkScheduleOverview />
                </section>
            )}

            <section>
                {showTeamOverview && (
                    <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                        Your schedule
                    </h2>
                )}
                <div className="card p-6">
                    <WorkScheduleEditor refetchTeamAfterMineSave={showTeamOverview} />
                </div>
            </section>
        </div>
    );
}
