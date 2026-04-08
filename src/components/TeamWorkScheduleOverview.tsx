'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_TEAM_WORK_SCHEDULES } from '@/lib/graphql/queries';
import WorkScheduleEditor from '@/components/WorkScheduleEditor';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

const ISO_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatWeekendDays(days: number[]): string {
    if (!days?.length) return '—';
    return [...days]
        .sort((a, b) => a - b)
        .map((d) => ISO_SHORT[d] ?? String(d))
        .join(', ');
}

function formatMinutesLabel(m: number): string {
    const h = Math.floor(m / 60);
    const mi = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    if (mi === 0) return `${h12} ${ap}`;
    return `${h12}:${String(mi).padStart(2, '0')} ${ap}`;
}

function formatIntervals(
    intervals: { startMinutes: number; endMinutes: number }[] | undefined,
): string {
    if (!intervals?.length) return '—';
    return intervals
        .map(
            (i) =>
                `${formatMinutesLabel(i.startMinutes)} – ${formatMinutesLabel(i.endMinutes)}`,
        )
        .join('; ');
}

export default function TeamWorkScheduleOverview() {
    const { data, loading, error } = useQuery(GET_TEAM_WORK_SCHEDULES, {
        fetchPolicy: 'cache-and-network',
    });

    const [editUser, setEditUser] = useState<{ id: string; name: string } | null>(null);

    const rows = data?.teamWorkSchedules ?? [];

    if (loading && !rows.length) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            </div>
        );
    }

    if (error) {
        return (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                Could not load team schedules.
            </p>
        );
    }

    return (
        <>
            <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/40">
                {rows.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                        No team schedules to show.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-800">
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-gray-500 dark:text-gray-400">
                                        Name
                                    </th>
                                    <th className="min-w-[12rem] px-5 py-3.5 font-medium text-gray-500 dark:text-gray-400">
                                        Email
                                    </th>
                                    <th className="whitespace-nowrap px-5 py-3.5 font-medium text-gray-500 dark:text-gray-400">
                                        Weekend
                                    </th>
                                    <th className="min-w-[14rem] px-5 py-3.5 font-medium text-gray-500 dark:text-gray-400">
                                        Hours
                                    </th>
                                    <th className="w-px whitespace-nowrap px-5 py-3.5 text-right font-medium text-gray-500 dark:text-gray-400">
                                        {/* edit */}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {rows.map(
                                    (row: {
                                        user: { id: string; name: string; email: string };
                                        schedule: {
                                            weekendDays: number[];
                                            intervals: {
                                                startMinutes: number;
                                                endMinutes: number;
                                            }[];
                                        };
                                    }) => (
                                        <tr
                                            key={row.user.id}
                                            className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                                        >
                                            <td className="whitespace-nowrap px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                                                {row.user.name}
                                            </td>
                                            <td className="max-w-[220px] truncate px-5 py-3.5 text-gray-600 dark:text-gray-300">
                                                {row.user.email}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-gray-700 dark:text-gray-200">
                                                {formatWeekendDays(row.schedule.weekendDays)}
                                            </td>
                                            <td className="max-w-md px-5 py-3.5 text-gray-700 dark:text-gray-200">
                                                {formatIntervals(row.schedule.intervals)}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setEditUser({
                                                            id: row.user.id,
                                                            name: row.user.name,
                                                        })
                                                    }
                                                    className="inline-flex rounded-full p-2 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-950/50 dark:hover:text-primary-300"
                                                    title="Edit schedule"
                                                >
                                                    <PencilSquareIcon className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ),
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
                        <div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                            onClick={() => setEditUser(null)}
                            aria-hidden
                        />
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="work-schedule-edit-title"
                            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200/80 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
                        >
                            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-widest text-primary-600 dark:text-primary-400">
                                        Edit schedule
                                    </p>
                                    <h3
                                        id="work-schedule-edit-title"
                                        className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white"
                                    >
                                        {editUser.name}
                                    </h3>
                                    <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                                        Choose weekend days and add working time blocks. These hours apply to all active working days.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditUser(null)}
                                    className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                    aria-label="Close"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 sm:p-8">
                                <WorkScheduleEditor
                                    targetUserId={editUser.id}
                                    targetName={editUser.name}
                                    showTargetBanner={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
