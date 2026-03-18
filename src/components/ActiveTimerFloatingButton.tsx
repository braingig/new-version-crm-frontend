'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { GET_ACTIVE_TIME_ENTRY } from '@/lib/graphql/queries';
import { ClockIcon } from '@heroicons/react/24/solid';

export default function ActiveTimerFloatingButton() {
    const router = useRouter();
    const { data } = useQuery(GET_ACTIVE_TIME_ENTRY, {
        fetchPolicy: 'network-only',
        pollInterval: 3000,
    });

    const activeEntry = data?.activeTimeEntry;
    const taskId = activeEntry?.taskId;

    if (!taskId) {
        return null;
    }

    const handleClick = () => {
        router.push(`/dashboard/tasks/${taskId}`);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary-600 px-4 py-3 text-white shadow-lg transition-all hover:bg-primary-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600"
            aria-label="Go to task being tracked"
            title="Go to task being tracked"
        >
            <ClockIcon className="h-6 w-6 animate-pulse" />
            <span className="text-sm font-medium">View tracked task</span>
        </button>
    );
}
