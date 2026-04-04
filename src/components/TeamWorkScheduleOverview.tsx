'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_TEAM_WORK_SCHEDULES } from '@/lib/graphql/queries';
import WorkScheduleEditor from '@/components/WorkScheduleEditor';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

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
            <p className="text-sm text-red-600 dark:text-red-400">
                Could not load team schedules.
            </p>
        );
    }

    return (
        <>
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Name
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Weekend
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Working hours
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Edit
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900/40">
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
                                    <tr key={row.user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                            {row.user.name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                            {row.user.email}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                                            {formatWeekendDays(row.schedule.weekendDays)}
                                        </td>
                                        <td className="max-w-md px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                                            {formatIntervals(row.schedule.intervals)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEditUser({ id: row.user.id, name: row.user.name })
                                                }
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
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
            </div>

            {editUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4">
                        <div
                            className="fixed inset-0 bg-black/40"
                            onClick={() => setEditUser(null)}
                            aria-hidden
                        />
                        <div className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Edit schedule — {editUser.name}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setEditUser(null)}
                                    className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                                >
                                    Close
                                </button>
                            </div>
                            <WorkScheduleEditor
                                targetUserId={editUser.id}
                                targetName={editUser.name}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
