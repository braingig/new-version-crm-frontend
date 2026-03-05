'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import {
    GET_TASK_DETAILS,
    GET_TIME_ENTRIES,
    GET_PROJECTS,
    GET_USERS,
    UPDATE_TASK,
    DELETE_TASK,
    ADD_COMMENT,
    GET_ACTIVE_TIME_ENTRY,
    START_TIME_ENTRY,
    STOP_TIME_ENTRY,
} from '@/lib/graphql/queries';
import {
    ArrowLeftIcon,
    CalendarIcon,
    ClockIcon,
    UserCircleIcon,
    FolderIcon,
    ChatBubbleLeftRightIcon,
    PencilIcon,
    TrashIcon,
    CheckCircleIcon,
    DocumentTextIcon,
    Squares2X2Icon,
    PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import {
    format,
    differenceInDays,
    startOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
} from 'date-fns';
import { useState, useEffect } from 'react';
import TaskModal from '@/components/TaskModal';

const priorityColors: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    LOW: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
};

const statusColors: Record<string, string> = {
    TODO: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    REVIEW: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
};

export default function TaskDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params?.id as string;

    const [newComment, setNewComment] = useState('');
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [timeEntriesFilter, setTimeEntriesFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
    const [totalsRange, setTotalsRange] = useState<'week' | 'month'>('week');
    const [totalsMonth, setTotalsMonth] = useState(() => format(new Date(), 'yyyy-MM'));

    const { data, loading, error, refetch } = useQuery(GET_TASK_DETAILS, {
        variables: { id: taskId },
        skip: !taskId,
    });

    const { data: timeEntriesData, refetch: refetchTimeEntries } = useQuery(GET_TIME_ENTRIES, {
        variables: { taskId },
        skip: !taskId,
        fetchPolicy: 'network-only',
    });

    const task = data?.task;
    const hasSubtasks = !!(task?.subTasks?.length);
    const subtaskIds = hasSubtasks ? task!.subTasks!.map((st: any) => st.id) : [];

    const { data: subtaskTimeEntriesData } = useQuery(GET_TIME_ENTRIES, {
        variables: { taskIds: subtaskIds },
        skip: !hasSubtasks || subtaskIds.length === 0,
    });

    const { data: projectsData } = useQuery(GET_PROJECTS);
    const { data: usersData } = useQuery(GET_USERS);
    const projects = projectsData?.projects ?? [];
    const users = usersData?.users ?? [];

    const { data: activeData, refetch: refetchActive } = useQuery(GET_ACTIVE_TIME_ENTRY, {
        fetchPolicy: 'network-only',
    });

    const [updateTask] = useMutation(UPDATE_TASK, {
        onCompleted: () => refetch(),
    });
    const [deleteTask] = useMutation(DELETE_TASK, {
        onCompleted: () => router.push('/dashboard/tasks'),
    });
    const [addComment, { loading: addingComment }] = useMutation(ADD_COMMENT, {
        onCompleted: () => {
            setNewComment('');
            refetch();
        },
    });

    const [startTimeEntry, { loading: starting }] = useMutation(START_TIME_ENTRY);
    const [stopTimeEntry, { loading: stopping }] = useMutation(STOP_TIME_ENTRY);

    const handleStatusChange = (newStatus: string) => {
        setStatusDropdownOpen(false);
        updateTask({
            variables: { id: taskId, input: { status: newStatus } },
        });
    };

    const handleAddComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        addComment({
            variables: { taskId, content: newComment.trim() },
        });
    };

    const handleDelete = () => {
        deleteTask({ variables: { id: taskId } });
        setDeleteConfirm(false);
    };

    const handleEditSave = async (submitData: any) => {
        try {
            // Exclude projectId from update (backend may not allow changing it)
            const { projectId, ...updateData } = submitData;
            await updateTask({
                variables: { id: taskId, input: updateData },
            });
            setShowEditModal(false);
        } catch (err: any) {
            alert(err?.message || 'Failed to update task');
        }
    };

    const formatMinutes = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const getEntryDuration = (entry: any) => {
        if (entry.duration != null && entry.endTime) return formatDuration(entry.duration);
        const start = new Date(entry.startTime);
        const end = entry.endTime ? new Date(entry.endTime) : new Date();
        return formatDuration(Math.floor((end.getTime() - start.getTime()) / 1000));
    };

    const timeEntries = timeEntriesData?.timeEntries ?? [];
    const subtaskTimeEntries = subtaskTimeEntriesData?.timeEntries ?? [];
    const allTimeEntries = [...timeEntries, ...subtaskTimeEntries].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    const activeEntry = activeData?.activeTimeEntry;
    const isActiveForThisTask = !!activeEntry && activeEntry.taskId === taskId;

    const [liveTotalSeconds, setLiveTotalSeconds] = useState<number | null>(null);

    // Total duration in SECONDS for this task's own entries
    const totalSecondsCompleted = timeEntries.reduce(
        (sum: number, entry: any) => sum + (entry.duration || 0),
        0
    );

    const totalSeconds = liveTotalSeconds ?? totalSecondsCompleted;

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
    }, [isActiveForThisTask, activeEntry, totalSecondsCompleted]);

    const filteredTimeEntries = allTimeEntries.filter((entry: any) => {
        const start = entry.startTime ? new Date(entry.startTime) : null;
        if (!start) return false;
        if (timeEntriesFilter === 'today') {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(todayStart);
            todayEnd.setDate(todayEnd.getDate() + 1);
            return start >= todayStart && start < todayEnd;
        }
        if (timeEntriesFilter === 'week') {
            const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
            const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
            return start >= weekStart && start <= weekEnd;
        }
        if (timeEntriesFilter === 'month') {
            const [y, m] = selectedMonth.split('-').map(Number);
            const monthStart = startOfMonth(new Date(y, m - 1, 1));
            const monthEnd = endOfMonth(new Date(y, m - 1, 1));
            return start >= monthStart && start <= monthEnd;
        }
        return true;
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayEntries = allTimeEntries.filter((entry: any) => {
        const start = entry.startTime ? new Date(entry.startTime) : null;
        if (!start) return false;
        return start >= todayStart && start < todayEnd;
    });

    const sumTodayMinutes = (entries: any[]) =>
        entries.reduce((sum: number, entry: any) => {
            const start = entry.startTime ? new Date(entry.startTime) : null;
            if (!start || start < todayStart || start >= todayEnd) return sum;
            const d = entry.duration ?? 0;
            return sum + (d >= 60 ? Math.floor(d / 60) : d);
        }, 0);

    const useSubtaskTimeSum = !!task?.subTasks?.length;
    const effectiveTotalMinutes = useSubtaskTimeSum
        ? (task?.subTasks ?? []).reduce((s: number, st: any) => s + (st.timeSpent ?? 0), 0)
        : (task?.timeSpent ?? 0);
    const todayMinutes = useSubtaskTimeSum
        ? sumTodayMinutes(subtaskTimeEntries)
        : sumTodayMinutes(timeEntries);

    // Daily totals (seconds) for current week/month
    const buildDailyTotals = () => {
        if (allTimeEntries.length === 0) return [];

        let rangeStart: Date;
        let rangeEnd: Date;

        if (totalsRange === 'week') {
            rangeStart = startOfWeek(new Date(), { weekStartsOn: 1 });
            rangeEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
        } else {
            const [y, m] = totalsMonth.split('-').map(Number);
            rangeStart = startOfMonth(new Date(y, m - 1, 1));
            rangeEnd = endOfMonth(new Date(y, m - 1, 1));
        }

        const byDay = new Map<
            string,
            {
                date: Date;
                totalSeconds: number;
                count: number;
            }
        >();

        allTimeEntries.forEach((entry: any) => {
            const start = entry.startTime ? new Date(entry.startTime) : null;
            if (!start || start < rangeStart || start > rangeEnd) return;

            const key = format(start, 'yyyy-MM-dd');
            const durationSeconds =
                typeof entry.duration === 'number' && entry.duration >= 0
                    ? entry.duration
                    : Math.floor(
                          ((entry.endTime ? new Date(entry.endTime) : new Date()).getTime() - start.getTime()) / 1000
                      );

            if (!byDay.has(key)) {
                byDay.set(key, {
                    date: startOfDay(start),
                    totalSeconds: 0,
                    count: 0,
                });
            }
            const bucket = byDay.get(key)!;
            bucket.totalSeconds += durationSeconds;
            bucket.count += 1;
        });

        return Array.from(byDay.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    };

    const dailyTotals = buildDailyTotals();

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
        } catch (e) {
            console.error('Failed to start timer', e);
        }
    };

    const handleStopTimer = async () => {
        try {
            await stopTimeEntry();
            await Promise.all([refetchActive(), refetchTimeEntries()]);
        } catch (e) {
            console.error('Failed to stop timer', e);
        }
    };

    if (!taskId) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-gray-500 dark:text-gray-400">Invalid task</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="card text-center py-12">
                <p className="text-red-600 dark:text-red-400 mb-4">
                    {error?.message || 'Task not found'}
                </p>
                <Link
                    href="/dashboard/tasks"
                    className="btn-primary inline-flex items-center gap-2"
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                    Back to Tasks
                </Link>
            </div>
        );
    }

    const hasParent = task.parentTask != null;

    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const todayStartOfDay = startOfDay(new Date());
    const isOverdue =
        dueDate &&
        startOfDay(dueDate) < todayStartOfDay &&
        task.status !== 'COMPLETED';
    const daysOverdue = isOverdue
        ? differenceInDays(todayStartOfDay, startOfDay(dueDate!))
        : 0;

    return (
        <div className="">
            {/* Hierarchy-aware navigation */}
            <div className="mb-6 flex flex-col gap-2">
                {hasParent ? (
                    /* Breadcrumb only: Tasks > Parent > Current – click any segment to go there */
                    <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400" aria-label="Breadcrumb">
                        <Link
                            href="/dashboard/tasks"
                            className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                            Tasks
                        </Link>
                        <span aria-hidden="true">/</span>
                        <Link
                            href={`/dashboard/tasks/${task.parentTask!.id}`}
                            className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium"
                        >
                            {task.parentTask!.title}
                        </Link>
                        <span aria-hidden="true">/</span>
                        <span className="text-gray-900 dark:text-white font-medium" aria-current="page">
                            {task.title}
                        </span>
                    </nav>
                ) : (
                    <Link
                        href="/dashboard/tasks"
                        className="inline-flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4 mr-2" />
                        Back to Tasks
                    </Link>
                )}
            </div>

            {/* Header card */}
            <div className="card mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {task.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[task.status] || statusColors.TODO}`}
                            >
                                {task.status.replace('_', ' ')}
                            </span>
                            <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityColors[task.priority] || priorityColors.MEDIUM}`}
                            >
                                {task.priority}
                            </span>
                            {task.project && (
                                <span className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400">
                                    <FolderIcon className="h-4 w-4 mr-1" />
                                    {task.project.name}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                className="btn-secondary inline-flex items-center gap-2 text-sm"
                            >
                                <CheckCircleIcon className="h-4 w-4" />
                                {task.status.replace('_', ' ')}
                            </button>
                            {statusDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        aria-hidden="true"
                                        onClick={() => setStatusDropdownOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-1 w-44 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1">
                                        {['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map(
                                            (s) =>
                                                s !== task.status && (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() => handleStatusChange(s)}
                                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                    >
                                                        {s.replace('_', ' ')}
                                                    </button>
                                                )
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowEditModal(true)}
                            className="p-2 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="Edit task"
                        >
                            <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setDeleteConfirm(true)}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete task"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {task.description && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <DocumentTextIcon className="h-5 w-5 text-primary-600" />
                                Description
                            </h2>
                            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                {task.description}
                            </p>
                        </div>
                    )}

                    {/* Subtasks */}
                    {task.subTasks && task.subTasks.length > 0 && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Squares2X2Icon className="h-5 w-5 text-primary-600" />
                                Subtasks ({task.subTasks.length})
                            </h2>
                            <ul className="space-y-2">
                                {task.subTasks.map((st: any) => (
                                    <li
                                        key={st.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={`/dashboard/tasks/${st.id}`}
                                                className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 truncate block"
                                            >
                                                {st.title}
                                            </Link>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded ${statusColors[st.status] || ''}`}
                                                >
                                                    {st.status?.replace('_', ' ')}
                                                </span>
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded ${priorityColors[st.priority] || ''}`}
                                                >
                                                    {st.priority}
                                                </span>
                                            </div>
                                        </div>
                                        <Link
                                            href={`/dashboard/tasks/${st.id}`}
                                            className="ml-2 text-sm text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
                                        >
                                            View
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Time tracking controls */}
                    <div className="card">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <ClockIcon className="h-5 w-5 text-primary-600" />
                                    Time tracking
                                </h2>
                                <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                                    Total logged: {formatDuration(totalSeconds)}
                                </p>
                                {isActiveForThisTask && activeEntry && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                        Timer running for this task…
                                    </p>
                                )}
                                {activeEntry && !isActiveForThisTask && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                        Another task is currently running.
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {isActiveForThisTask ? (
                                    <button
                                        type="button"
                                        onClick={handleStopTimer}
                                        disabled={stopping}
                                        className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-60"
                                    >
                                        {stopping ? 'Stopping…' : 'Stop'}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleStartTimer}
                                        disabled={starting || (!!activeEntry && !isActiveForThisTask)}
                                        className="px-3 py-1.5 rounded-md bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 disabled:opacity-60"
                                    >
                                        {starting ? 'Starting…' : 'Start timer'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Today's time entries */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <ClockIcon className="h-5 w-5 text-primary-600" />
                                Today&apos;s time entries ({todayEntries.length})
                            </h2>
                        </div>
                        {todayEntries.length > 0 ? (
                            <div className="overflow-x-auto -mx-4 sm:mx-0 overflow-y-auto max-h-[320px] border border-gray-200 dark:border-gray-600 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/95 z-10">
                                        <tr>
                                            {hasSubtasks && (
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                    Task
                                                </th>
                                            )}
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Start
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                End
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Duration
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
                                        {todayEntries.map((entry: any) => (
                                            <tr key={entry.id}>
                                                {hasSubtasks && (
                                                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                                                        {entry.taskId === taskId
                                                            ? task.title
                                                            : task.subTasks?.find((st: any) => st.id === entry.taskId)?.title ??
                                                              '-'}
                                                    </td>
                                                )}
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                    {entry.startTime ? format(new Date(entry.startTime), 'h:mm a') : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                    {entry.endTime ? format(new Date(entry.endTime), 'h:mm a') : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                    {getEntryDuration(entry)}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span
                                                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                                            entry.endTime
                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                                                        }`}
                                                    >
                                                        {entry.endTime ? 'Completed' : 'Active'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                                No time entries have been logged for today yet.
                            </p>
                        )}
                    </div>

                    {/* Daily totals (week / month) */}
                    <div className="card">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <ClockIcon className="h-5 w-5 text-primary-600" />
                                Daily totals
                            </h2>
                            {allTimeEntries.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                                        {(['week', 'month'] as const).map((range) => (
                                            <button
                                                key={range}
                                                type="button"
                                                onClick={() => setTotalsRange(range)}
                                                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                                    totalsRange === range
                                                        ? 'bg-primary-600 text-white'
                                                        : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                {range === 'week' ? 'This week' : 'This month'}
                                            </button>
                                        ))}
                                    </div>
                                    {totalsRange === 'month' && (
                                        <input
                                            type="month"
                                            value={totalsMonth}
                                            onChange={(e) => setTotalsMonth(e.target.value)}
                                            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {dailyTotals.length > 0 ? (
                            <div className="overflow-x-auto -mx-4 sm:mx-0 border border-gray-200 dark:border-gray-600 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Date
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Day
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Total time
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Entries
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
                                        {dailyTotals.map((day) => (
                                            <tr key={day.date.toISOString()}>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                    {format(day.date, 'MMM d, yyyy')}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                                                    {format(day.date, 'EEE')}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                    {formatDuration(day.totalSeconds)}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                                                    {day.count}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                                No time has been logged for this {totalsRange === 'week' ? 'week' : 'month'}.
                            </p>
                        )}
                    </div>

                    {/* Comments */}
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary-600" />
                            Comments ({task.comments?.length ?? 0})
                        </h2>

                        <form onSubmit={handleAddComment} className="mb-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="input flex-1"
                                    disabled={addingComment}
                                />
                                <button
                                    type="submit"
                                    disabled={addingComment || !newComment.trim()}
                                    className="btn-primary inline-flex items-center gap-2 px-4"
                                >
                                    <PaperAirplaneIcon className="h-4 w-4" />
                                    {addingComment ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </form>

                        <div className="space-y-3">
                            {task.comments && task.comments.length > 0 ? (
                                task.comments.map((comment: any) => (
                                    <div
                                        key={comment.id}
                                        className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {comment.user?.name ?? 'Unknown'}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {comment.createdAt
                                                    ? format(
                                                          new Date(comment.createdAt),
                                                          'MMM d, yyyy · h:mm a'
                                                      )
                                                    : ''}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                            {comment.content}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                                    No comments yet. Be the first to comment.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="card">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                            Details
                        </h2>
                        <dl className="space-y-3">
                            {task.assignedTo && (
                                <div className="flex items-center gap-2">
                                    <UserCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    <div>
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">
                                            Assignee
                                        </dt>
                                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                                            {task.assignedTo.name}
                                        </dd>
                                        <dd className="text-xs text-gray-500 dark:text-gray-400">
                                            {task.assignedTo.email}
                                        </dd>
                                    </div>
                                </div>
                            )}
                            {task.dueDate && (
                                <div className="flex items-center gap-2">
                                    <CalendarIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">
                                            Due date
                                        </dt>
                                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                                            {format(new Date(task.dueDate), 'MMM d, yyyy')}
                                            {isOverdue && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                    Overdue
                                                </span>
                                            )}
                                        </dd>
                                        {isOverdue && daysOverdue > 0 && (
                                            <dd className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                                {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                                            </dd>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <ClockIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                <div>
                                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                                        Time
                                    </dt>
                                    <dd className="text-sm font-medium text-gray-900 dark:text-white space-y-0.5">
                                        <div>Today: {formatMinutes(todayMinutes)}</div>
                                        <div>
                                            Total: {formatMinutes(effectiveTotalMinutes)}
                                            {task.estimatedTime != null && (
                                                <span className="text-gray-500 dark:text-gray-400 font-normal">
                                                    {' '}
                                                    · Est: {formatMinutes(task.estimatedTime)}
                                                </span>
                                            )}
                                        </div>
                                    </dd>
                                </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                                Created {task.createdAt && format(new Date(task.createdAt), 'MMM d, yyyy')}
                                {task.updatedAt && task.updatedAt !== task.createdAt && (
                                    <> · Updated {format(new Date(task.updatedAt), 'MMM d, yyyy')}</>
                                )}
                            </div>
                        </dl>
                    </div>

                    {task.parentTask && (
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Parent task
                            </h2>
                            <Link
                                href={`/dashboard/tasks/${task.parentTask.id}`}
                                className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                            >
                                {task.parentTask.title}
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete confirmation modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4">
                        <div
                            className="fixed inset-0 bg-black/30"
                            onClick={() => setDeleteConfirm(false)}
                            aria-hidden="true"
                        />
                        <div className="relative bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl">
                            <div className="text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                                    <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                                    Delete task
                                </h3>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    Are you sure you want to delete this task? This action cannot be
                                    undone.
                                </p>
                            </div>
                            <div className="mt-6 flex justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDeleteConfirm(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit modal - stays on detail page */}
            <TaskModal
                task={task}
                parentTask={task?.parentTask ? { id: task.parentTask.id, projectId: task.parentTask.projectId ?? task.projectId ?? (task.project?.id ?? ''), title: task.parentTask.title } : null}
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSave={handleEditSave}
                projects={projects}
                users={users}
            />
        </div>
    );
}
