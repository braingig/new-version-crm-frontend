'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation } from '@apollo/client';
import { GET_TASK_DETAILS, GET_ACTIVE_TIME_ENTRY, GET_TIME_ENTRIES, START_TIME_ENTRY, STOP_TIME_ENTRY } from '@/lib/graphql/queries';
import { useToast } from '@/components/ToastProvider';

interface TaskDetailsModalProps {
    taskId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function TaskDetailsModal({ taskId, isOpen, onClose }: TaskDetailsModalProps) {
    const { showToast } = useToast();
    const { data, loading, error } = useQuery(GET_TASK_DETAILS, {
        variables: { id: taskId as string },
        skip: !taskId || !isOpen,
    });

    const { data: activeData, refetch: refetchActive } = useQuery(GET_ACTIVE_TIME_ENTRY, {
        skip: !isOpen,
        fetchPolicy: 'network-only',
    });

    const { data: timeEntriesData, refetch: refetchTimeEntries } = useQuery(GET_TIME_ENTRIES, {
        variables: { taskId },
        skip: !taskId || !isOpen,
        fetchPolicy: 'network-only',
    });

    const [startTimeEntry, { loading: starting }] = useMutation(START_TIME_ENTRY);
    const [stopTimeEntry, { loading: stopping }] = useMutation(STOP_TIME_ENTRY);

    const [liveTotalSeconds, setLiveTotalSeconds] = useState<number | null>(null);

    const task = data?.task;
    const activeEntry = activeData?.activeTimeEntry;
    const isActiveForThisTask = !!activeEntry && activeEntry.taskId === taskId;
    const timeEntries = timeEntriesData?.timeEntries || [];

    // duration is stored in SECONDS (see time-tracker)
    const totalSecondsCompleted = timeEntries.reduce(
        (sum: number, entry: any) => sum + (entry.duration || 0),
        0
    );

    const totalSeconds = liveTotalSeconds ?? totalSecondsCompleted;

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
        return `${s}s`;
    };

    // Live updating timer while this task's entry is active
    useEffect(() => {
        if (!isActiveForThisTask || !activeEntry) {
            setLiveTotalSeconds(null);
            return;
        }

        const startMs = new Date(activeEntry.startTime).getTime();

        const update = () => {
            const now = Date.now();
            const runningSeconds = Math.floor((now - startMs) / 1000);
            setLiveTotalSeconds(totalSecondsCompleted + runningSeconds);
        };

        update();
        const id = window.setInterval(update, 1000);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActiveForThisTask, activeEntry, totalSecondsCompleted]);

    if (!isOpen || !taskId) return null;

    const handleStartTimer = async () => {
        if (!taskId) return;
        try {
            await startTimeEntry({
                variables: {
                    input: {
                        taskId,
                        description: `Work on task ${task?.title || ''}`.trim(),
                    },
                },
            });
            await Promise.all([refetchActive(), refetchTimeEntries()]);
            showToast({ variant: 'success', message: 'Timer started.' });
        } catch (e) {
            console.error('Failed to start timer', e);
            showToast({ variant: 'error', message: (e as any)?.message || 'Failed to start timer.' });
        }
    };

    const handleStopTimer = async () => {
        try {
            await stopTimeEntry();
            await Promise.all([refetchActive(), refetchTimeEntries()]);
            showToast({ variant: 'success', message: 'Timer stopped.' });
        } catch (e) {
            console.error('Failed to stop timer', e);
            showToast({ variant: 'error', message: (e as any)?.message || 'Failed to stop timer.' });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {task?.title || 'Task details'}
                        </h2>
                        {task?.project?.name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Project: {task.project.name}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {loading && (
                        <div className="py-6 text-center text-gray-500 text-sm">
                            Loading task details...
                        </div>
                    )}
                    {error && (
                        <div className="py-6 text-center text-red-500 text-sm">
                            Failed to load task details.
                        </div>
                    )}
                    {task && !loading && !error && (
                        <>
                            {task.description && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                        Description
                                    </h3>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {task.description}
                                    </p>
                                </div>
                            )}
                            {task.note && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                        Note
                                    </h3>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {task.note}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Status: </span>
                                        <span className="text-gray-800 dark:text-gray-100">{task.status}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Priority: </span>
                                        <span className="text-gray-800 dark:text-gray-100">{task.priority}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Assignee: </span>
                                        <span className="text-gray-800 dark:text-gray-100">
                                            {task.assignedTo?.name || 'Unassigned'}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Start date: </span>
                                        <span className="text-gray-800 dark:text-gray-100">
                                            {task.startDate ? new Date(task.startDate).toLocaleDateString() : '—'}
                                        </span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Due date: </span>
                                        <span className="text-gray-800 dark:text-gray-100">
                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                                        </span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Time spent: </span>
                                        <span className="text-gray-800 dark:text-gray-100">
                                            {formatDuration(totalSecondsCompleted)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Time tracking controls */}
                            <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Time tracking
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-200">
                                        Total logged: {formatDuration(totalSeconds)}
                                    </p>
                                    {isActiveForThisTask && activeEntry && (
                                        <p className="text-xs text-green-600 mt-1">
                                            Timer running for this task…
                                        </p>
                                    )}
                                    {activeEntry && !isActiveForThisTask && (
                                        <p className="text-xs text-amber-600 mt-1">
                                            Another task is currently running.
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isActiveForThisTask ? (
                                        <button
                                            onClick={handleStopTimer}
                                            disabled={stopping}
                                            className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-60"
                                        >
                                            {stopping ? 'Stopping…' : 'Stop'}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleStartTimer}
                                            disabled={starting || (!!activeEntry && !isActiveForThisTask)}
                                            className="px-3 py-1.5 rounded-md bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 disabled:opacity-60"
                                        >
                                            {starting ? 'Starting…' : 'Start timer'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Activity log of tracked time entries */}
                            {timeEntries.length > 0 && (
                                <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-3">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                        Activity
                                    </p>
                                    <ul className="space-y-1 max-h-48 overflow-y-auto text-sm">
                                        {timeEntries.map((entry: any) => {
                                            const when = new Date(
                                                entry.endTime || entry.startTime
                                            ).toLocaleString();
                                            const who = entry.employee?.name || 'You';
                                            const durSeconds = entry.duration ?? 0;
                                            return (
                                                <li
                                                    key={entry.id}
                                                    className="flex items-center justify-between text-gray-700 dark:text-gray-200"
                                                >
                                                    <span>
                                                        {who} tracked{' '}
                                                        {formatDuration(durSeconds)}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                                        {when}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {task.subTasks && task.subTasks.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                                        Subtasks
                                    </h3>
                                    <ul className="space-y-1 text-sm">
                                        {task.subTasks.map((st: any) => (
                                            <li
                                                key={st.id}
                                                className="flex items-center justify-between rounded-md bg-gray-50 dark:bg-gray-800/60 px-3 py-2"
                                            >
                                                <span className="text-gray-800 dark:text-gray-100">
                                                    {st.title}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {st.status} • {st.priority}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {task.comments && task.comments.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                                        Comments
                                    </h3>
                                    <div className="space-y-3">
                                        {task.comments.map((c: any) => (
                                            <div
                                                key={c.id}
                                                className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
                                            >
                                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    <span>{c.user?.name || 'Unknown'}</span>
                                                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-800 dark:text-gray-100">
                                                    {c.content}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

