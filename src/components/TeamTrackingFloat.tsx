'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { GET_ACTIVE_TEAM_TIMERS } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store';
import { canAccessRoute } from '@/lib/permissions';

type Row = {
    entryId: string;
    employeeId: string;
    employeeName: string;
    taskId?: string | null;
    startTime: string;
};

export default function TeamTrackingFloat() {
    const router = useRouter();
    const currentUserId = useAuthStore((s) => s.user?.id);
    const role = useAuthStore((s) => s.user?.role);
    const canOpenTasks = canAccessRoute(role, '/dashboard/tasks');

    const { data } = useQuery(GET_ACTIVE_TEAM_TIMERS, {
        fetchPolicy: 'network-only',
        pollInterval: 5000,
    });

    const rows: Row[] = data?.activeTeamTimers ?? [];
    if (rows.length === 0) {
        return null;
    }

    const onRowClick = (row: Row) => {
        if (row.taskId && canOpenTasks) {
            router.push(`/dashboard/tasks/${row.taskId}`);
        }
    };

    return (
        <div
            className="max-w-[min(21rem,calc(100vw-2.5rem))] rounded-2xl border border-gray-200/80 bg-white/95 px-3.5 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.12)] ring-1 ring-white/70 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-900/95 dark:ring-white/10"
            role="status"
            aria-live="polite"
            aria-label={`${rows.length} teammate${rows.length === 1 ? '' : 's'} active now`}
        >
            <div className="mb-2.5 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/55" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)]" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                    Active now
                </span>
                <span className="ml-auto rounded-full bg-gray-100/90 px-2 py-0.5 text-xs font-semibold text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                    {rows.length}
                </span>
            </div>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1 text-left [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {rows.map((row) => {
                    const isSelf = row.employeeId === currentUserId;
                    const clickable = Boolean(row.taskId && canOpenTasks);
                    return (
                        <li key={row.entryId}>
                            <button
                                type="button"
                                onClick={() => onRowClick(row)}
                                disabled={!clickable}
                                title={clickable ? 'Open task' : undefined}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all ${
                                    clickable
                                        ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/90'
                                        : 'cursor-default'
                                } ${!clickable ? 'opacity-95' : ''}`}
                            >
                                <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 dark:ring-emerald-400/25"
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={`block truncate text-sm ${
                                            isSelf
                                                ? 'font-semibold text-primary-600 dark:text-primary-400'
                                                : 'font-medium text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        {row.employeeName}
                                        {isSelf ? (
                                            <span className="ml-1.5 text-xs font-normal text-primary-500/90 dark:text-primary-400/90">
                                                (you)
                                            </span>
                                        ) : null}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
