'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { CheckIcon } from '@heroicons/react/24/solid';
import { GET_MY_TASKS, UPDATE_TASK } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ToastProvider';
import TaskDetailsModal from '@/components/TaskDetailsModal';
import {
    type MyTaskItem,
    STATUS_LABELS,
    STATUS_OPTIONS,
    sortByDueDate,
    taskLocationLabel,
    STATUS_GROUP_HEADER,
    assigneeIdsForTask,
    deriveAssignedProjects,
    isTaskOverdue,
    isTaskDueWithinDays,
    normalizeTaskStatus,
    TEAM_NEEDS_ATTENTION_DUE_DAYS,
} from '@/lib/myTasks';
import AdminTeamOverview from '@/components/my-tasks/AdminTeamOverview';
import AssignedProjectsCard from '@/components/my-tasks/AssignedProjectsCard';
import RecentsCard from '@/components/my-tasks/RecentsCard';
import CommentsAndMentionsPanel from '@/components/my-tasks/CommentsAndMentionsPanel';
import AttentionSection from '@/components/my-tasks/AttentionSection';
import { latestAssignedRecentEntries } from '@/lib/recentTasks';

type PageScope = 'team' | 'mine';

const SCOPE_STORAGE_KEY = 'my-tasks:scope';

function StatusCircle({
    status,
    onSelect,
    disabled,
    isAdmin,
}: {
    status: string;
    onSelect: (status: string) => void;
    disabled?: boolean;
    isAdmin?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const meta = STATUS_GROUP_HEADER[status] ?? STATUS_GROUP_HEADER.TODO;

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    return (
        <div ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-transform ${meta.dot} ${disabled ? 'opacity-50' : 'hover:scale-110'}`}
                aria-label={`Status: ${STATUS_LABELS[status] ?? status}`}
            >
                {status === 'COMPLETED' && <CheckIcon className="w-2.5 h-2.5 text-white" />}
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    {STATUS_OPTIONS.filter((s) => isAdmin || s !== 'COMPLETED').map((s) => (
                        <button
                            key={s}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => {
                                onSelect(s);
                                setOpen(false);
                            }}
                        >
                            {STATUS_LABELS[s]}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function AssignedTaskRow({
    task,
    isAdmin,
    onOpen,
    onStatusChange,
    updating,
}: {
    task: MyTaskItem;
    isAdmin: boolean;
    onOpen: (task: MyTaskItem) => void;
    onStatusChange: (id: string, status: string) => void;
    updating: boolean;
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(task)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(task);
                }
            }}
            className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
        >
            <StatusCircle
                status={task.status}
                isAdmin={isAdmin}
                disabled={updating}
                onSelect={(s) => onStatusChange(task.id, s)}
            />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{taskLocationLabel(task)}</p>
            </div>
        </div>
    );
}

export default function MyTasksPage() {
    const { showToast } = useToast();
    const user = useAuthStore((s) => s.user);
    const userId = user?.id;
    const role = user?.role?.toUpperCase();
    const isAdmin = role === 'ADMIN';
    const canManageTeam = role === 'ADMIN' || role === 'TEAM_LEAD';

    const [pageScope, setPageScope] = useState<PageScope>('team');
    const [expandedWorkAttention, setExpandedWorkAttention] = useState<Set<string>>(() => new Set());
    const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const { data, loading, refetch } = useQuery(GET_MY_TASKS, {
        variables: { filters: { assigneeId: userId ?? '' } },
        skip: !userId,
        fetchPolicy: 'cache-and-network',
    });

    const [updateTask] = useMutation(UPDATE_TASK);

    const allTasks: MyTaskItem[] = data?.tasks ?? [];

    const openTasks = useMemo(
        () => allTasks.filter((t) => t.status !== 'COMPLETED'),
        [allTasks],
    );

    const overdueWorkTasks = useMemo(
        () =>
            openTasks
                .filter((t) =>
                    isTaskOverdue(t.dueDate, normalizeTaskStatus(t.status)),
                )
                .sort(sortByDueDate),
        [openTasks],
    );

    const dueSoonWorkTasks = useMemo(
        () =>
            openTasks
                .filter((t) =>
                    isTaskDueWithinDays(
                        t.dueDate,
                        normalizeTaskStatus(t.status),
                        TEAM_NEEDS_ATTENTION_DUE_DAYS,
                    ),
                )
                .sort(sortByDueDate),
        [openTasks],
    );

    const assignedList = useMemo(
        () => [...openTasks].sort(sortByDueDate),
        [openTasks],
    );

    useEffect(() => {
        if (!canManageTeam) return;
        try {
            const saved = window.localStorage.getItem(SCOPE_STORAGE_KEY);
            if (saved === 'mine' || saved === 'team') setPageScope(saved);
        } catch {
            // ignore
        }
    }, [canManageTeam]);

    useEffect(() => {
        if (!canManageTeam) return;
        try {
            window.localStorage.setItem(SCOPE_STORAGE_KEY, pageScope);
        } catch {
            // ignore
        }
    }, [canManageTeam, pageScope]);

    const delegatedTasks = useMemo(() => {
        if (!userId) return [];
        return openTasks.filter((task) => {
            const creatorId = task.createdBy?.id;
            if (creatorId !== userId) return false;
            const assignees = assigneeIdsForTask(task);
            if (assignees.length === 0) return true;
            return assignees.some((id) => id !== userId);
        });
    }, [openTasks, userId]);

    const employeeRecents = useMemo(
        () => latestAssignedRecentEntries(allTasks),
        [allTasks],
    );

    /** Projects with at least one open task assigned to this employee. */
    const employeeProjects = useMemo(
        () => deriveAssignedProjects(allTasks),
        [allTasks],
    );

    const openTask = (task: MyTaskItem) => {
        const full = allTasks.find((t) => t.id === task.id) ?? task;
        setDetailTaskId(full.id);
    };

    const openTeamTask = (task: MyTaskItem) => {
        setDetailTaskId(task.id);
    };

    const toggleWorkAttention = (key: string) => {
        setExpandedWorkAttention((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        setUpdatingId(taskId);
        try {
            await updateTask({
                variables: { id: taskId, input: { status: newStatus } },
            });
            await refetch();
            showToast({ variant: 'success', message: 'Status updated.' });
        } catch (error: unknown) {
            const msg =
                (error as { graphQLErrors?: { message: string }[] })?.graphQLErrors?.[0]?.message ||
                (error instanceof Error ? error.message : 'Failed to update status.');
            showToast({ variant: 'error', message: msg });
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="min-h-full bg-[#f6f7fb] dark:bg-gray-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
            <div className="max-w-[1400px] mx-auto">
                {/* Page title */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">My Tasks</h1>
                    {canManageTeam && (
                        <div className="flex gap-1 p-1 rounded-xl bg-gray-200/70 dark:bg-gray-800/70 w-fit">
                            <button
                                type="button"
                                onClick={() => setPageScope('team')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    pageScope === 'team'
                                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                Team overview
                            </button>
                            <button
                                type="button"
                                onClick={() => setPageScope('mine')}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    pageScope === 'mine'
                                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                            >
                                My work
                            </button>
                        </div>
                    )}
                </div>

                {loading && !data ? (
                    <p className="text-sm text-gray-500 py-20 text-center">Loading your tasks…</p>
                ) : (
                    <div className="space-y-4">
                    {canManageTeam && pageScope === 'team' ? (
                        <AdminTeamOverview onOpenTask={openTeamTask} />
                    ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                        <RecentsCard
                            items={employeeRecents}
                            onOpen={openTask}
                            emptyHint="No assigned tasks yet."
                        />
                        <AssignedProjectsCard
                            projects={employeeProjects}
                            emptyHint="Projects with open assigned tasks will appear here."
                        />
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(300px,380px)_1fr] gap-4 xl:items-stretch xl:h-[min(560px,65vh)]">
                        {/* ——— My Work: needs attention (employee + admin “My work”) ——— */}
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col min-h-0 max-h-[min(420px,50vh)] xl:max-h-none xl:h-full">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Needs attention
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Overdue, due in the next {TEAM_NEEDS_ATTENTION_DUE_DAYS} days, and
                                    tasks you delegated
                                </p>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
                                {overdueWorkTasks.length === 0 &&
                                dueSoonWorkTasks.length === 0 &&
                                delegatedTasks.length === 0 ? (
                                    <p className="text-xs text-gray-400 px-3 py-6 text-center">
                                        Nothing urgent — no overdue, upcoming due dates, or delegated
                                        tasks.
                                    </p>
                                ) : (
                                    <>
                                        <AttentionSection
                                            id="overdue"
                                            label="Overdue"
                                            count={overdueWorkTasks.length}
                                            expanded={expandedWorkAttention.has('overdue')}
                                            onToggle={() => toggleWorkAttention('overdue')}
                                            emptyText="No overdue tasks."
                                        >
                                            {overdueWorkTasks.map((task) => (
                                                <AssignedTaskRow
                                                    key={task.id}
                                                    task={task}
                                                    isAdmin={isAdmin}
                                                    onOpen={openTask}
                                                    onStatusChange={handleStatusChange}
                                                    updating={updatingId === task.id}
                                                />
                                            ))}
                                        </AttentionSection>
                                        <AttentionSection
                                            id="dueSoon"
                                            label={`Due within ${TEAM_NEEDS_ATTENTION_DUE_DAYS} days`}
                                            count={dueSoonWorkTasks.length}
                                            expanded={expandedWorkAttention.has('dueSoon')}
                                            onToggle={() => toggleWorkAttention('dueSoon')}
                                            emptyText={`No tasks due in the next ${TEAM_NEEDS_ATTENTION_DUE_DAYS} days.`}
                                        >
                                            {dueSoonWorkTasks.map((task) => (
                                                <AssignedTaskRow
                                                    key={task.id}
                                                    task={task}
                                                    isAdmin={isAdmin}
                                                    onOpen={openTask}
                                                    onStatusChange={handleStatusChange}
                                                    updating={updatingId === task.id}
                                                />
                                            ))}
                                        </AttentionSection>
                                        <AttentionSection
                                            id="delegated"
                                            label="Delegated"
                                            count={delegatedTasks.length}
                                            expanded={expandedWorkAttention.has('delegated')}
                                            onToggle={() => toggleWorkAttention('delegated')}
                                            emptyText="No tasks you assigned to others."
                                        >
                                            {[...delegatedTasks]
                                                .sort(sortByDueDate)
                                                .map((task) => (
                                                    <AssignedTaskRow
                                                        key={task.id}
                                                        task={task}
                                                        isAdmin={isAdmin}
                                                        onOpen={openTask}
                                                        onStatusChange={handleStatusChange}
                                                        updating={updatingId === task.id}
                                                    />
                                                ))}
                                        </AttentionSection>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ——— Assigned to me card ——— */}
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col min-h-0 max-h-[min(420px,50vh)] xl:max-h-none xl:h-full">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Assigned to me
                                </h2>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto">
                                {openTasks.length === 0 ? (
                                    <p className="text-sm text-gray-500 px-4 py-12 text-center">
                                        No open tasks assigned to you.
                                    </p>
                                ) : (
                                    assignedList.map((task) => (
                                        <AssignedTaskRow
                                            key={task.id}
                                            task={task}
                                            isAdmin={isAdmin}
                                            onOpen={openTask}
                                            onStatusChange={handleStatusChange}
                                            updating={updatingId === task.id}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                    <CommentsAndMentionsPanel />
                    </div>
                )}
            </div>

            <TaskDetailsModal
                taskId={detailTaskId}
                isOpen={!!detailTaskId}
                onClose={() => {
                    setDetailTaskId(null);
                    refetch();
                }}
            />
        </div>
    );
}
