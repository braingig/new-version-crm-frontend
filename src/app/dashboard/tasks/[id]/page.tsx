'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import {
    GET_TASK_DETAILS,
    GET_TIME_ENTRIES,
    GET_PROJECTS,
    GET_USERS,
    GET_TASK_LISTS,
    UPDATE_TASK,
    DELETE_TASK,
    ADD_COMMENT,
    GET_ACTIVE_TIME_ENTRY,
    START_TIME_ENTRY,
    STOP_TIME_ENTRY,
    ADMIN_CREATE_MANUAL_TIME_ENTRY,
    ADMIN_UPDATE_TIME_ENTRY,
    ADMIN_DELETE_TIME_ENTRY,
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
import { useState, useEffect, useMemo } from 'react';
import TaskModal from '@/components/TaskModal';
import { MentionFormattedText } from '@/components/MentionFormattedText';
import { RichTextContent } from '@/components/RichTextContent';
import { MentionTextarea } from '@/components/MentionTextarea';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ToastProvider';

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
    const currentUser = useAuthStore((state) => state.user);
    const currentUserId = currentUser?.id;
    const { showToast } = useToast();

    const [newComment, setNewComment] = useState('');
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showTimeEntryModal, setShowTimeEntryModal] = useState(false);
    const [editingTimeEntry, setEditingTimeEntry] = useState<any | null>(null);
    const [timeEntryForm, setTimeEntryForm] = useState({
        employeeId: '',
        startTime: '',
        endTime: '',
        description: '',
    });
    const [timeEntriesFilter, setTimeEntriesFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
    const [totalsRange, setTotalsRange] = useState<'week' | 'month'>('week');
    const [totalsMonth, setTotalsMonth] = useState(() => format(new Date(), 'yyyy-MM'));
    const [showDayEntriesModal, setShowDayEntriesModal] = useState(false);
    const [dayEntriesModalTitle, setDayEntriesModalTitle] = useState('');
    const [dayEntries, setDayEntries] = useState<any[]>([]);

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
    const { data: listsData } = useQuery(GET_TASK_LISTS, {
        variables: { projectId: task?.projectId ?? '' },
        skip: !task?.projectId,
    });
    const projects = projectsData?.projects ?? [];
    const users = usersData?.users ?? [];
    const taskLists = listsData?.taskLists ?? [];

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
    const [adminCreateManualTimeEntry, { loading: savingManualEntry }] = useMutation(
        ADMIN_CREATE_MANUAL_TIME_ENTRY,
    );
    const [adminUpdateTimeEntry] = useMutation(ADMIN_UPDATE_TIME_ENTRY);
    const [adminDeleteTimeEntry] = useMutation(ADMIN_DELETE_TIME_ENTRY);

    const isAdmin = currentUser?.role === 'ADMIN';

    const handleStatusChange = (newStatus: string) => {
        setStatusDropdownOpen(false);
        updateTask({ variables: { id: taskId, input: { status: newStatus } } })
            .then(() => showToast({ variant: 'success', message: 'Task status updated.' }))
            .catch((e: any) => {
                const msg =
                    e?.graphQLErrors?.[0]?.message ||
                    e?.networkError?.result?.errors?.[0]?.message ||
                    e?.message ||
                    'Failed to update task status.';
                showToast({ variant: 'error', message: msg });
            });
    };

    const handleAddComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        addComment({ variables: { taskId, content: newComment.trim() } })
            .then(() => showToast({ variant: 'success', message: 'Comment added.' }))
            .catch((e: any) =>
                showToast({ variant: 'error', message: e?.message || 'Failed to add comment.' }),
            );
    };

    const handleDelete = () => {
        deleteTask({ variables: { id: taskId } })
            .then(() => showToast({ variant: 'success', message: 'Task deleted successfully.' }))
            .catch((e: any) =>
                showToast({ variant: 'error', message: e?.message || 'Failed to delete task.' }),
            );
        setDeleteConfirm(false);
    };

    const handleEditSave = async (submitData: any) => {
        try {
            // Exclude projectId and listId from update (UpdateTaskInput does not include them)
            const { projectId, listId, ...updateData } = submitData;
            await updateTask({
                variables: { id: taskId, input: updateData },
            });
            showToast({ variant: 'success', message: 'Task updated successfully.' });
            setShowEditModal(false);
        } catch (err: any) {
            showToast({ variant: 'error', message: err?.message || 'Failed to update task.' });
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

    // Saved duration only (for DETAILS sidebar and time entries table). Live timer only in Time tracking card.
    const getEntryDuration = (entry: any) => formatDuration(entry.duration ?? 0);

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

    // Sum of today's entry durations in seconds (so right sidebar matches left)
    const sumTodaySeconds = (entries: any[]) =>
        entries.reduce((sum: number, entry: any) => {
            const start = entry.startTime ? new Date(entry.startTime) : null;
            if (!start || start < todayStart || start >= todayEnd) return sum;
            return sum + (entry.duration ?? 0);
        }, 0);

    const useSubtaskTimeSum = !!task?.subTasks?.length;
    // Use time-entry totals so right sidebar matches left (not task.timeSpent from backend)
    // Sidebar shows saved totals only (no live timer) – updates after timer stop
    const todaySecondsForSidebar = useSubtaskTimeSum
        ? sumTodaySeconds(subtaskTimeEntries)
        : sumTodaySeconds(timeEntries);
    const totalSecondsForSidebar = useSubtaskTimeSum
        ? subtaskTimeEntries.reduce((s: number, e: any) => s + (e.duration ?? 0), 0)
        : totalSecondsCompleted;

    // Daily totals (seconds) for current week/month, with assignee-wise breakdown per day
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
                byAssignee: Array<{ employeeId: string; name: string; email?: string; totalSeconds: number }>;
                entries: any[];
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

            const employeeId = entry.employeeId || 'unknown';
            const name = entry.employee?.name ?? users.find((u: any) => u.id === entry.employeeId)?.name ?? 'Unknown';
            const email = entry.employee?.email ?? users.find((u: any) => u.id === entry.employeeId)?.email;

            if (!byDay.has(key)) {
                byDay.set(key, {
                    date: startOfDay(start),
                    totalSeconds: 0,
                    count: 0,
                    byAssignee: [],
                    entries: [],
                });
            }
            const bucket = byDay.get(key)!;
            bucket.totalSeconds += durationSeconds;
            bucket.count += 1;
            bucket.entries.push(entry);

            const existing = bucket.byAssignee.find((a) => a.employeeId === employeeId);
            if (existing) {
                existing.totalSeconds += durationSeconds;
            } else {
                bucket.byAssignee.push({ employeeId, name, email, totalSeconds: durationSeconds });
            }
        });

        return Array.from(byDay.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    };

    const dailyTotals = buildDailyTotals();

    // Only users assigned to the task should be able to control the timer
    const isAssignedToTask = useMemo(() => {
        if (!currentUserId || !task) return false;
        const explicitAssignees: string[] =
            task.assignees?.map((a: any) => a.id) ?? [];
        if (task.assignedToId && !explicitAssignees.includes(task.assignedToId)) {
            explicitAssignees.push(task.assignedToId);
        }
        return explicitAssignees.includes(currentUserId);
    }, [currentUserId, task]);

    // Who worked on this task and total time per person (from time entries; duration in seconds)
    const timeByPerson = useMemo(() => {
        const byEmployee = new Map<string, { name: string; email?: string; totalSeconds: number }>();
        timeEntries.forEach((entry: any) => {
            const id = entry.employeeId || 'unknown';
            const name = entry.employee?.name ?? users.find((u: any) => u.id === entry.employeeId)?.name ?? 'Unknown';
            const email = entry.employee?.email ?? users.find((u: any) => u.id === entry.employeeId)?.email;
            const sec = typeof entry.duration === 'number' ? entry.duration : 0;
            const prev = byEmployee.get(id);
            byEmployee.set(id, {
                name,
                email,
                totalSeconds: (prev?.totalSeconds ?? 0) + sec,
            });
        });
        return Array.from(byEmployee.entries())
            .map(([employeeId, v]) => ({ employeeId, ...v }))
            .sort((a, b) => b.totalSeconds - a.totalSeconds);
    }, [timeEntries, users]);

    const taskAssignees = useMemo(() => {
        const out = new Map<string, { id: string; name: string; email?: string }>();
        (task?.assignees ?? []).forEach((u: any) => {
            if (u?.id) out.set(u.id, { id: u.id, name: u.name, email: u.email });
        });
        if (task?.assignedTo?.id) {
            out.set(task.assignedTo.id, {
                id: task.assignedTo.id,
                name: task.assignedTo.name,
                email: task.assignedTo.email,
            });
        }
        return [...out.values()];
    }, [task]);

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

    const toDateTimeLocal = (dateLike?: string | Date | null) => {
        if (!dateLike) return '';
        const d = new Date(dateLike);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const openCreateTimeEntryModal = () => {
        setEditingTimeEntry(null);
        setTimeEntryForm({
            employeeId: users[0]?.id ?? '',
            startTime: toDateTimeLocal(new Date()),
            endTime: toDateTimeLocal(new Date()),
            description: '',
        });
        setShowTimeEntryModal(true);
    };

    const openEditTimeEntryModal = (entry: any) => {
        // Ensure edit modal is never hidden behind day-entries modal.
        setShowDayEntriesModal(false);
        setEditingTimeEntry(entry);
        setTimeEntryForm({
            employeeId: entry.employeeId ?? '',
            startTime: toDateTimeLocal(entry.startTime),
            endTime: toDateTimeLocal(entry.endTime),
            description: entry.description ?? '',
        });
        setShowTimeEntryModal(true);
    };

    const handleSaveTimeEntry = async () => {
        try {
            if (!isAdmin) return;
            if (!timeEntryForm.employeeId || !timeEntryForm.startTime || !timeEntryForm.endTime) {
                showToast({ variant: 'error', message: 'Employee, start time and end time are required.' });
                return;
            }
            if (new Date(timeEntryForm.endTime) <= new Date(timeEntryForm.startTime)) {
                showToast({ variant: 'error', message: 'End time must be after start time.' });
                return;
            }

            const baseInput = {
                employeeId: timeEntryForm.employeeId,
                taskId,
                startTime: new Date(timeEntryForm.startTime).toISOString(),
                endTime: new Date(timeEntryForm.endTime).toISOString(),
                description: timeEntryForm.description?.trim() || undefined,
            };

            if (editingTimeEntry?.id) {
                await adminUpdateTimeEntry({
                    variables: {
                        id: editingTimeEntry.id,
                        input: baseInput,
                    },
                });
                showToast({ variant: 'success', message: 'Time entry updated.' });
            } else {
                await adminCreateManualTimeEntry({
                    variables: { input: baseInput },
                });
                showToast({ variant: 'success', message: 'Manual time entry added.' });
            }
            setShowTimeEntryModal(false);
            await Promise.all([refetchTimeEntries(), refetch()]);
        } catch (e: any) {
            showToast({ variant: 'error', message: e?.message || 'Failed to save time entry.' });
        }
    };

    const handleDeleteTimeEntry = async (entryId: string) => {
        if (!isAdmin) return;
        if (!window.confirm('Delete this time entry?')) return;
        try {
            await adminDeleteTimeEntry({ variables: { id: entryId } });
            showToast({ variant: 'success', message: 'Time entry deleted.' });
            await Promise.all([refetchTimeEntries(), refetch()]);
        } catch (e: any) {
            showToast({ variant: 'error', message: e?.message || 'Failed to delete time entry.' });
        }
    };

    const openDayEntries = (day: { date: Date; entries: any[] }) => {
        const sorted = [...(day.entries ?? [])].sort(
            (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
        );
        setDayEntries(sorted);
        setDayEntriesModalTitle(format(day.date, 'MMM d, yyyy'));
        setShowDayEntriesModal(true);
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

    if (!task) {
        return (
            <div className="card text-center py-12">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                    This task is no longer available. It may have been deleted.
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

    if (error) {
        return (
            <div className="card text-center py-12">
                <p className="text-red-600 dark:text-red-400 mb-4">
                    Could not load this task right now.
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

    const projectName = task.project?.name;
    const projectId = task.project?.id ?? task.projectId;
    const projectTasksUrl = projectId
        ? `/dashboard/tasks?projectId=${projectId}`
        : '/dashboard/tasks';

    const listName = task.listId
        ? taskLists.find((l: any) => l.id === task.listId)?.name ?? 'Folder'
        : 'No folder (unassigned)';

    const listUrl =
        task.listId
            ? projectId
                ? `/dashboard/tasks?projectId=${projectId}&listId=${task.listId}`
                : `/dashboard/tasks?listId=${task.listId}`
            : projectId
                ? `/dashboard/tasks?projectId=${projectId}&listId=unassigned`
                : '/dashboard/tasks?listId=unassigned';

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
            {/* Hierarchy-aware breadcrumb: Tasks -> Project -> Folder -> (Parent) -> Task */}
            <div className="mb-6 flex flex-col gap-2">
                <nav
                    className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                    aria-label="Breadcrumb"
                >
                    <Link
                        href={projectTasksUrl}
                        className="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        <span>Tasks</span>
                    </Link>

                    {listName && (
                        <>
                            <span aria-hidden="true">/</span>
                            <Link
                                href={listUrl}
                                className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                            >
                                {listName}
                            </Link>
                        </>
                    )}

                    {hasParent && (
                        <>
                            <span aria-hidden="true">/</span>
                            <Link
                                href={`/dashboard/tasks/${task.parentTask!.id}`}
                                className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium"
                            >
                                {task.parentTask!.title}
                            </Link>
                        </>
                    )}

                    <span aria-hidden="true">/</span>
                    <span className="text-gray-900 dark:text-white font-medium" aria-current="page">
                        {task.title}
                    </span>
                </nav>
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
                                className={`inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[task.status] || statusColors.TODO}`}
                            >
                                {task.status.replace(/_/g, ' ')}
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
                        <div className="flex flex-col items-end gap-0.5">
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                    className="btn-secondary inline-flex items-center gap-2 text-sm whitespace-nowrap"
                                >
                                    <CheckCircleIcon className="h-4 w-4 shrink-0" />
                                    {task.status.replace(/_/g, ' ')}
                                </button>
                                {statusDropdownOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            aria-hidden="true"
                                            onClick={() => setStatusDropdownOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-1 w-44 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1">
                                            {(
                                                [
                                                    'TODO',
                                                    'IN_PROGRESS',
                                                    'REVIEW',
                                                    ...(isAdmin ? (['COMPLETED'] as const) : []),
                                                ] as const
                                            ).map(
                                                (s) =>
                                                    s !== task.status && (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            onClick={() => handleStatusChange(s)}
                                                            className="block w-full text-left px-4 py-2 text-sm whitespace-nowrap text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                        >
                                                            {s.replace(/_/g, ' ')}
                                                        </button>
                                                    ),
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                            {!isAdmin && (
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-[14rem] text-right leading-tight">
                                    Use Review when finished. Only an admin can mark Complete.
                                </p>
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
                            <RichTextContent
                                htmlOrText={task.description}
                                className="text-gray-600 dark:text-gray-300"
                            />
                        </div>
                    )}
                    {task.note && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <PencilIcon className="h-5 w-5 text-primary-600" />
                                Note
                            </h2>
                            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                <MentionFormattedText text={task.note} />
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
                                                    className={`inline-flex shrink-0 items-center whitespace-nowrap text-xs px-2 py-0.5 rounded ${statusColors[st.status] || ''}`}
                                                >
                                                    {st.status?.replace(/_/g, ' ')}
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

                    {/* Time tracking controls – only visible to assigned users */}
                    {isAssignedToTask && (
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
                    )}

                    {/* Who's working on this task + time by person */}
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                            <UserCircleIcon className="h-5 w-5 text-primary-600" />
                            Who&apos;s working on this task
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Assignee and everyone who has logged time. Total time per person.
                        </p>
                        {timeByPerson.length > 0 ? (
                            <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Person
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Total time
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
                                        {timeByPerson.map((row: any) => (
                                            <tr key={row.employeeId}>
                                                <td className="px-4 py-2">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {row.name}
                                                    </div>
                                                    {row.email && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {row.email}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                    {formatDuration(row.totalSeconds)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
                                No time logged yet. Assignee{taskAssignees.length > 1 ? 's' : ''}:{' '}
                                {taskAssignees.length > 0 ? (
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {taskAssignees.map((u) => u.name).join(', ')}
                                    </span>
                                ) : (
                                    <span>Not assigned</span>
                                )}
                            </p>
                        )}
                    </div>

                    {/* Today's time entries */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <ClockIcon className="h-5 w-5 text-primary-600" />
                                Today&apos;s time entries ({todayEntries.length})
                            </h2>
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={openCreateTimeEntryModal}
                                    className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                                >
                                    Add manual entry
                                </button>
                            )}
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
                                                Person
                                            </th>
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
                                            {isAdmin && (
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                    Actions
                                                </th>
                                            )}
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
                                                    {entry.employee?.name ?? users.find((u: any) => u.id === entry.employeeId)?.name ?? '—'}
                                                </td>
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
                                                {isAdmin && (
                                                    <td className="px-4 py-2 text-right">
                                                        <div className="inline-flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditTimeEntryModal(entry)}
                                                                className="text-xs font-medium text-primary-600 hover:text-primary-700"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTimeEntry(entry.id)}
                                                                className="text-xs font-medium text-red-600 hover:text-red-700"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
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
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                By assignee
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
                                                    {isAdmin ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openDayEntries(day as any)}
                                                            className="rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 dark:border-primary-800/60 dark:bg-primary-900/20 dark:text-primary-300 dark:hover:bg-primary-900/35"
                                                            title="View entries for this day"
                                                        >
                                                            {day.count} {day.count === 1 ? 'entry' : 'entries'}
                                                        </button>
                                                    ) : (
                                                        day.count
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                                                    {day.byAssignee.length > 0 ? (
                                                        <ul className="space-y-0.5">
                                                            {day.byAssignee
                                                                .sort((a, b) => b.totalSeconds - a.totalSeconds)
                                                                .map((a) => (
                                                                    <li key={a.employeeId} className="flex items-center justify-between gap-2">
                                                                        <span className="font-medium text-gray-900 dark:text-white truncate" title={a.email}>
                                                                            {a.name}
                                                                        </span>
                                                                        <span className="text-gray-600 dark:text-gray-400 shrink-0">
                                                                            {formatDuration(a.totalSeconds)}
                                                                        </span>
                                                                    </li>
                                                                ))}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-gray-400 dark:text-gray-500">—</span>
                                                    )}
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
                            <div className="flex gap-2 items-end">
                                <MentionTextarea
                                    wrapperClassName="flex-1 min-w-0"
                                    users={users}
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment… Type @ for suggestions."
                                    rows={2}
                                    className="input min-h-[2.75rem] w-full resize-y"
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
                                            <MentionFormattedText text={comment.content} />
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
                            {(task.assignees?.length || task.assignedTo) && (
                                <div className="flex items-center gap-2">
                                    <UserCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">
                                            {task.assignees?.length > 1 ? 'Assignees' : 'Assignee'}
                                        </dt>
                                        {(task.assignees?.length ? task.assignees : task.assignedTo ? [task.assignedTo] : []).map((u: any) => (
                                            <dd key={u.id} className="text-sm font-medium text-gray-900 dark:text-white">
                                                {u.name}
                                                {u.email && (
                                                    <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                                                        {u.email}
                                                    </span>
                                                )}
                                            </dd>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {task.createdBy && (task.assignees?.length || task.assignedTo) && (
                                <div className="flex items-center gap-2">
                                    <UserCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    <div>
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">
                                            Assigned by
                                        </dt>
                                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                                            {task.createdBy.name}
                                        </dd>
                                        {task.createdBy.email && (
                                            <dd className="text-xs text-gray-500 dark:text-gray-400">
                                                {task.createdBy.email}
                                            </dd>
                                        )}
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
                                        <div>Today: {formatDuration(todaySecondsForSidebar)}</div>
                                        <div>
                                            Total: {formatDuration(totalSecondsForSidebar)}
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

            {showTimeEntryModal && isAdmin && (
                <div className="fixed inset-0 z-[70] overflow-y-auto">
                    <div className="flex min-h-screen items-end justify-center p-4 sm:items-center">
                        <div
                            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
                            onClick={() => setShowTimeEntryModal(false)}
                            aria-hidden="true"
                        />
                        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10">
                            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                                <div className="min-w-0">
                                    <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                                        {editingTimeEntry ? 'Edit time entry' : 'Add manual time entry'}
                                    </h3>
                                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                        Admin action for task timer records.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowTimeEntryModal(false)}
                                    className="rounded-lg px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                    aria-label="Close"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="label">Employee</label>
                                        <select
                                            value={timeEntryForm.employeeId}
                                            onChange={(e) =>
                                                setTimeEntryForm((prev) => ({
                                                    ...prev,
                                                    employeeId: e.target.value,
                                                }))
                                            }
                                            className="input"
                                        >
                                            <option value="">Select employee</option>
                                            {users.map((u: any) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="label">Start</label>
                                            <input
                                                type="datetime-local"
                                                value={timeEntryForm.startTime}
                                                onChange={(e) =>
                                                    setTimeEntryForm((prev) => ({
                                                        ...prev,
                                                        startTime: e.target.value,
                                                    }))
                                                }
                                                className="input"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">End</label>
                                            <input
                                                type="datetime-local"
                                                value={timeEntryForm.endTime}
                                                onChange={(e) =>
                                                    setTimeEntryForm((prev) => ({
                                                        ...prev,
                                                        endTime: e.target.value,
                                                    }))
                                                }
                                                className="input"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label">Description</label>
                                        <textarea
                                            rows={3}
                                            value={timeEntryForm.description}
                                            onChange={(e) =>
                                                setTimeEntryForm((prev) => ({
                                                    ...prev,
                                                    description: e.target.value,
                                                }))
                                            }
                                            className="input"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-white/80 px-5 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
                                <button
                                    type="button"
                                    onClick={() => setShowTimeEntryModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveTimeEntry}
                                    disabled={savingManualEntry}
                                    className="btn-primary"
                                >
                                    {savingManualEntry ? 'Saving...' : editingTimeEntry ? 'Update entry' : 'Add entry'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Daily total -> entries modal (admin) */}
            {showDayEntriesModal && isAdmin && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-[2px] sm:items-center">
                    <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-gray-800 dark:bg-gray-900 dark:ring-white/10">
                        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                            <div className="min-w-0">
                                <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                                    Time entries for {dayEntriesModalTitle}
                                </h3>
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                    Admin can edit or delete any entry in this day.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDayEntriesModal(false)}
                                className="rounded-lg px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur dark:bg-gray-800/95">
                                    <tr>
                                        {hasSubtasks && (
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Task
                                            </th>
                                        )}
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                            Person
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                            Start
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                            End
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                            Duration
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                                    {dayEntries.map((entry: any) => (
                                        <tr key={entry.id}>
                                            {hasSubtasks && (
                                                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                                                    {entry.taskId === taskId
                                                        ? task.title
                                                        : task.subTasks?.find((st: any) => st.id === entry.taskId)?.title ?? '-'}
                                                </td>
                                            )}
                                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                {entry.employee?.name ??
                                                    users.find((u: any) => u.id === entry.employeeId)?.name ??
                                                    '—'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                {entry.startTime ? format(new Date(entry.startTime), 'h:mm a') : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                {entry.endTime ? format(new Date(entry.endTime), 'h:mm a') : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                {getEntryDuration(entry)}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditTimeEntryModal(entry)}
                                                        className="text-xs font-medium text-primary-600 hover:text-primary-700"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteTimeEntry(entry.id)}
                                                        className="text-xs font-medium text-red-600 hover:text-red-700"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {dayEntries.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={hasSubtasks ? 6 : 5}
                                                className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                                            >
                                                No entries found for this day.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
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
                lists={taskLists}
            />
        </div>
    );
}
