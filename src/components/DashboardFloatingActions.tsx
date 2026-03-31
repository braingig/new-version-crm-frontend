'use client';

import TeamTrackingFloat from '@/components/TeamTrackingFloat';
import ActiveTimerFloatingButton from '@/components/ActiveTimerFloatingButton';

export default function DashboardFloatingActions() {
    return (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3">
            <div className="pointer-events-auto">
                <TeamTrackingFloat />
            </div>
            <div className="pointer-events-auto">
                <ActiveTimerFloatingButton />
            </div>
        </div>
    );
}
