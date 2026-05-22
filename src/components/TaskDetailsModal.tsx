'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { XMarkIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation } from '@apollo/client';
import {
    GET_TASK_DETAILS,
    GET_ACTIVE_TIME_ENTRY,
    GET_TIME_ENTRIES,
    GET_PROJECTS,
    GET_USERS,
    GET_TASK_LISTS,
    START_TIME_ENTRY,
    STOP_TIME_ENTRY,
    UPDATE_TASK,
} from '@/lib/graphql/queries';
import { useToast } from '@/components/ToastProvider';
import { MentionFormattedText } from '@/components/MentionFormattedText';
import { RichTextContent } from '@/components/RichTextContent';
import TaskModal from '@/components/TaskModal';

interface TaskDetailsModalProps {
    taskId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function TaskDetailsModal({ taskId, isOpen, onClose }: TaskDetailsModalProps) {
    const { showToast } = useToast();
    const [showEditModal, setShowEditModal] = useState(false);

    const { data, loading, error, refetch } = useQuery(GET_TASK_DETAILS, {
        variables: { id: taskId as string },
        skip: !taskId || !isOpen,
    });

    const { data: projectsData } = useQuery(GET_PROJECTS, { skip: !isOpen });
    const { data: usersData } = useQuery(GET_USERS, { skip: !isOpen });
    const task = data?.task;
    const { data: listsData } = useQuery(GET_TASK_LISTS, {
        variables: { projectId: task?.projectId ?? '' },
        skip: !isOpen || !task?.projectId,
    });

    const [updateTask] = useMutation(UPDATE_TASK);

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

    const handleEditSave = async (submitData: Record<string, unknown>) => {
        try {
            const { projectId: _p, listId: _l, ...updateData } = submitData;
            await updateTask({
                variables: { id: taskId, input: updateData },
            });
            await refetch();
            setShowEditModal(false);
            showToast({ variant: 'success', message: 'Task updated successfully.' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update task.';
            showToast({ variant: 'error', message: msg });
        }
    };

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 max-h-[90vh] flex flex-col">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-50 via-transparent to-primary-100/40 dark:from-primary-900/20 dark:via-transparent dark:to-primary-800/10" />
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
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
                    <div className="flex items-center gap-2">
                        {task && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(true)}
                                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                    title="Edit task"
                                >
                                    <PencilIcon className="h-4 w-4" />
                                    Edit
                                </button>
                                <Link
                                    href={`/dashboard/tasks/${task.id}#task-description`}
                                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                                    onClick={onClose}
                                >
                                    Open full page
                                </Link>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
                            <div id="task-description">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                    Description
                                </h3>
                                {task.description ? (
                                    <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                                        <RichTextContent htmlOrText={task.description} />
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        No description. Use Edit to add one.
                                    </p>
                                )}
                            </div>
                            {task.note && (
                                <div id="task-note">
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                        Note
                                    </h3>
                                    <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
                                        <p className="whitespace-pre-wrap">
                                            <MentionFormattedText text={task.note} />
                                        </p>
                                    </div>
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

                            {task.comments && task.comments.length > 0 && (
                                <div id="task-comments">
                                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                                        Comments ({task.comments.length})
                                    </h3>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {task.comments.map((c: { id: string; content: string; createdAt: string; user?: { name?: string } }) => (
                                            <div
                                                key={c.id}
                                                className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
                                            >
                                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                    <span>{c.user?.name ?? 'Someone'}</span>
                                                    <span>
                                                        {new Date(c.createdAt).toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                                                    <MentionFormattedText text={c.content} />
                                                </p>
                                            </div>
                                        ))}
                                    </div>
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

                        </>
                    )}
                </div>
            </div>

            {task && (
                <TaskModal
                    task={task}
                    parentTask={
                        task.parentTask
                            ? {
                                  id: task.parentTask.id,
                                  projectId: task.projectId ?? task.project?.id ?? '',
                                  title: task.parentTask.title,
                              }
                            : null
                    }
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSave={handleEditSave}
                    projects={projectsData?.projects ?? []}
                    users={usersData?.users ?? []}
                    lists={listsData?.taskLists ?? []}
                />
            )}
        </div>
    );
}

