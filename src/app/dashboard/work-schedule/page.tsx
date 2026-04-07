'use client';

import WorkScheduleEditor from '@/components/WorkScheduleEditor';
import TeamWorkScheduleOverview from '@/components/TeamWorkScheduleOverview';
import { useAuthStore } from '@/lib/store';
import { canViewTeamWorkSchedule } from '@/lib/permissions';

export default function WorkSchedulePage() {
    const role = useAuthStore((s) => s.user?.role);
    const showTeamOverview = canViewTeamWorkSchedule(role);

    return (
        <div className={showTeamOverview ? 'max-w-6xl space-y-6' : 'max-w-3xl space-y-6'}>
            <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Work schedule</h1>
            </div>

            {showTeamOverview && (
                <section>
                    <h2 className="mb-3 text-lg font-medium text-gray-900 dark:text-white">Team</h2>
                    <TeamWorkScheduleOverview />
                </section>
            )}

            <section>
                {showTeamOverview && (
                    <h2 className="mb-3 text-lg font-medium text-gray-900 dark:text-white">You</h2>
                )}
                <div className="card p-6">
                    <WorkScheduleEditor refetchTeamAfterMineSave={showTeamOverview} />
                </div>
            </section>
        </div>
    );
}
