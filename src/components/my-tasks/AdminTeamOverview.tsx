'use client';

import { useMemo, useState, useRef, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import {
    MagnifyingGlassIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    FlagIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import { GET_TASKS, GET_USERS, UPDATE_TASK } from '@/lib/graphql/queries';
import { useToast } from '@/components/ToastProvider';
import {
    type MyTaskItem,
    collectAllTaskNodes,
    assigneeIdsForTask,
    taskLocationLabel,
    formatDueDate,
    priorityFlagClass,
    isOpenTask,
    isTaskOverdue,
    isTaskDueWithinDays,
    TEAM_NEEDS_ATTENTION_DUE_DAYS,
    sortByDueDate,
    normalizeTaskStatus,
    deriveAssignedProjects,
    STATUS_LABELS,
    STATUS_OPTIONS,
    STATUS_GROUP_HEADER,
    matchesTeamTaskSearch,
    sortTasksByDueDate,
} from '@/lib/myTasks';
import { latestAssignedRecentEntries } from '@/lib/recentTasks';
import AssignedProjectsCard from '@/components/my-tasks/AssignedProjectsCard';
import RecentsCard from '@/components/my-tasks/RecentsCard';

type AdminTeamOverviewProps = {
    onOpenTask: (task: MyTaskItem) => void;
};

function assigneeLabel(task: MyTaskItem, usersById: Map<string, { name: string }>): string {
    const ids = assigneeIdsForTask(task);
    if (ids.length === 0) return 'Unassigned';
    return ids.map((id) => usersById.get(id)?.name).filter(Boolean).join(', ') || '—';
}

function StatusCircle({
    status,
    onSelect,
    disabled,
}: {
    status: string;
    onSelect: (status: string) => void;
    disabled?: boolean;
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
                className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${meta.dot} ${disabled ? 'opacity-50' : ''}`}
            >
                {status === 'COMPLETED' && <CheckIcon className="w-2.5 h-2.5 text-white" />}
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    {STATUS_OPTIONS.map((s) => (
                        <button
                            key={s}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
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

function TeamTaskRow({
    task,
    usersById,
    onOpen,
    onStatusChange,
    updating,
    showComplete,
    onComplete,
}: {
    task: MyTaskItem;
    usersById: Map<string, { name: string }>;
    onOpen: (task: MyTaskItem) => void;
    onStatusChange: (id: string, status: string) => void;
    updating: boolean;
    showComplete?: boolean;
    onComplete?: (id: string) => void;
}) {
    const due = formatDueDate(task.dueDate, task.status);
    const assignees = assigneeLabel(task, usersById);

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
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
        >
            <StatusCircle
                status={task.status}
                disabled={updating}
                onSelect={(s) => onStatusChange(task.id, s)}
            />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {assignees} · {task.project?.name ?? 'Project'}
                </p>
            </div>
            <span
                className={`text-xs shrink-0 w-24 text-right tabular-nums ${
                    due.overdue
                        ? 'text-red-600 dark:text-red-400 font-medium'
                        : 'text-gray-500 dark:text-gray-400'
                }`}
            >
                {due.text === 'No due date' ? '—' : due.text}
            </span>
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                {showComplete && onComplete && (
                    <button
                        type="button"
                        onClick={() => onComplete(task.id)}
                        className="text-xs font-medium px-2 py-0.5 rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    >
                        Complete
                    </button>
                )}
                <FlagIcon className={`h-4 w-4 ${priorityFlagClass(task.priority)}`} title={task.priority} />
            </div>
        </div>
    );
}

function AttentionSection({
    id,
    label,
    count,
    expanded,
    onToggle,
    emptyText,
    children,
}: {
    id: string;
    label: string;
    count: number;
    expanded: boolean;
    onToggle: () => void;
    emptyText: string;
    children: ReactNode;
}) {
    return (
        <div className="mb-1">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
            >
                {expanded ? (
                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                ) : (
                    <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                )}
                <span>
                    {label}{' '}
                    <span className="text-gray-400 font-normal">({count})</span>
                </span>
            </button>
            {expanded && (
                <div className="pb-2">
                    {count === 0 ? (
                        <p className="text-xs text-gray-400 px-3 py-2">{emptyText}</p>
                    ) : (
                        children
                    )}
                </div>
            )}
        </div>
    );
}

export default function AdminTeamOverview({ onOpenTask }: AdminTeamOverviewProps) {
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const [assigneeFilter, setAssigneeFilter] = useState('');
    const [expandedAttention, setExpandedAttention] = useState<Set<string>>(() => new Set());

    const { data: tasksData, loading, refetch } = useQuery(GET_TASKS, {
        fetchPolicy: 'cache-and-network',
    });
    const { data: usersData } = useQuery(GET_USERS);
    const [updateTask] = useMutation(UPDATE_TASK, {
        refetchQueries: [{ query: GET_TASKS }],
        awaitRefetchQueries: true,
    });
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [hiddenTaskIds, setHiddenTaskIds] = useState<Set<string>>(() => new Set());

    const users = usersData?.users ?? [];
    const usersById = useMemo(
        () => new Map<string, { name: string }>(users.map((u: { id: string; name: string }) => [u.id, u])),
        [users],
    );

    const allFlat = useMemo(
        () => collectAllTaskNodes((tasksData?.tasks ?? []) as MyTaskItem[]),
        [tasksData?.tasks],
    );

    useEffect(() => {
        setHiddenTaskIds((prev) => {
            if (prev.size === 0) return prev;
            const next = new Set<string>();
            for (const id of prev) {
                const task = allFlat.find((t) => t.id === id);
                if (task && isOpenTask(task.status)) next.add(id);
            }
            return next.size === prev.size ? prev : next;
        });
    }, [allFlat]);

    const visibleFlat = useMemo(
        () =>
            allFlat.filter(
                (t) => isOpenTask(t.status) && !hiddenTaskIds.has(t.id),
            ),
        [allFlat, hiddenTaskIds],
    );

    const openFlat = visibleFlat;

    const overdueTasks = useMemo(
        () =>
            visibleFlat
                .filter(
                    (t) =>
                        normalizeTaskStatus(t.status) !== 'COMPLETED' &&
                        isTaskOverdue(t.dueDate, t.status),
                )
                .sort(sortByDueDate),
        [visibleFlat],
    );

    const dueSoonTasks = useMemo(
        () =>
            visibleFlat
                .filter(
                    (t) =>
                        normalizeTaskStatus(t.status) !== 'COMPLETED' &&
                        isTaskDueWithinDays(
                            t.dueDate,
                            t.status,
                            TEAM_NEEDS_ATTENTION_DUE_DAYS,
                        ),
                )
                .sort(sortByDueDate),
        [visibleFlat],
    );

    const teamFiltered = useMemo(() => {
        let list = openFlat;
        if (assigneeFilter) {
            list = list.filter((t) => assigneeIdsForTask(t).includes(assigneeFilter));
        }
        if (search.trim()) {
            list = list.filter((t) => matchesTeamTaskSearch(t, search, usersById));
        }
        return list;
    }, [openFlat, assigneeFilter, search, usersById]);

    const teamTasksSorted = useMemo(
        () => sortTasksByDueDate(teamFiltered),
        [teamFiltered],
    );

    const teamProjects = useMemo(
        () => deriveAssignedProjects(openFlat),
        [openFlat],
    );

    const teamRecents = useMemo(
        () => latestAssignedRecentEntries(allFlat),
        [allFlat],
    );

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        setUpdatingId(taskId);
        if (normalizeTaskStatus(newStatus) === 'COMPLETED') {
            setHiddenTaskIds((prev) => new Set(prev).add(taskId));
        }
        try {
            await updateTask({ variables: { id: taskId, input: { status: newStatus } } });
            await refetch();
            showToast({ variant: 'success', message: 'Status updated.' });
        } catch (error: unknown) {
            if (normalizeTaskStatus(newStatus) === 'COMPLETED') {
                setHiddenTaskIds((prev) => {
                    const next = new Set(prev);
                    next.delete(taskId);
                    return next;
                });
            }
            const msg =
                (error as { graphQLErrors?: { message: string }[] })?.graphQLErrors?.[0]?.message ||
                (error instanceof Error ? error.message : 'Failed to update status.');
            showToast({ variant: 'error', message: msg });
        } finally {
            setUpdatingId(null);
        }
    };

    const toggleAttention = (key: string) => {
        setExpandedAttention((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    if (loading && !tasksData) {
        return <p className="text-sm text-gray-500 py-20 text-center">Loading team tasks…</p>;
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                <RecentsCard
                    items={teamRecents}
                    onOpen={onOpenTask}
                    emptyHint="No team tasks yet."
                />
                <AssignedProjectsCard
                    projects={teamProjects}
                    title="Projects"
                    emptyHint="Projects with open team tasks will appear here."
                />
            </div>

            {/* Two columns — fixed height so long task lists scroll inside each panel */}
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(300px,380px)_1fr] gap-4 xl:items-stretch xl:h-[min(560px,65vh)]">
                {/* Left — Needs attention */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col min-h-0 max-h-[min(420px,50vh)] xl:max-h-none xl:h-full">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Needs attention
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Overdue and due in the next {TEAM_NEEDS_ATTENTION_DUE_DAYS} days
                        </p>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
                        {overdueTasks.length === 0 && dueSoonTasks.length === 0 ? (
                            <p className="text-xs text-gray-400 px-3 py-6 text-center">
                                Nothing urgent — no overdue or upcoming due dates.
                            </p>
                        ) : (
                            <>
                                <AttentionSection
                                    id="overdue"
                                    label="Overdue"
                                    count={overdueTasks.length}
                                    expanded={expandedAttention.has('overdue')}
                                    onToggle={() => toggleAttention('overdue')}
                                    emptyText="No overdue tasks."
                                >
                                    {overdueTasks
                                        .filter((task) => isOpenTask(task.status))
                                        .map((task) => (
                                            <TeamTaskRow
                                                key={task.id}
                                                task={task}
                                                usersById={usersById}
                                                onOpen={onOpenTask}
                                                onStatusChange={handleStatusChange}
                                                updating={updatingId === task.id}
                                            />
                                        ))}
                                </AttentionSection>
                                <AttentionSection
                                    id="dueSoon"
                                    label={`Due within ${TEAM_NEEDS_ATTENTION_DUE_DAYS} days`}
                                    count={dueSoonTasks.length}
                                    expanded={expandedAttention.has('dueSoon')}
                                    onToggle={() => toggleAttention('dueSoon')}
                                    emptyText="No tasks due in the next week."
                                >
                                    {dueSoonTasks
                                        .filter((task) => isOpenTask(task.status))
                                        .map((task) => (
                                            <TeamTaskRow
                                                key={task.id}
                                                task={task}
                                                usersById={usersById}
                                                onOpen={onOpenTask}
                                                onStatusChange={handleStatusChange}
                                                updating={updatingId === task.id}
                                            />
                                        ))}
                                </AttentionSection>
                            </>
                        )}
                    </div>
                </div>

                {/* Right — All team tasks (like Assigned to me) */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col min-h-0 max-h-[min(420px,50vh)] xl:max-h-none xl:h-full">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                Team tasks
                            </h2>
                            <Link
                                href="/dashboard/tasks"
                                className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                            >
                                Tasks board →
                            </Link>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="search"
                                    placeholder="Search tasks…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="input pl-8 text-sm py-1.5 w-full"
                                />
                            </div>
                            <select
                                value={assigneeFilter}
                                onChange={(e) => setAssigneeFilter(e.target.value)}
                                className="input text-sm py-1.5 sm:w-44"
                            >
                                <option value="">All assignees</option>
                                {users.map((u: { id: string; name: string }) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {openFlat.length === 0 ? (
                            <p className="text-sm text-gray-500 px-4 py-12 text-center">
                                No open team tasks.
                            </p>
                        ) : teamTasksSorted.length === 0 ? (
                            <p className="text-sm text-gray-500 px-4 py-12 text-center">
                                No team tasks match your search or assignee filter.
                            </p>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
                                    <span className="w-[18px]" />
                                    <span className="flex-1">Name</span>
                                    <span className="w-24 text-right shrink-0">Due</span>
                                </div>
                                {teamTasksSorted.map((task) => (
                                    <TeamTaskRow
                                        key={task.id}
                                        task={task}
                                        usersById={usersById}
                                        onOpen={onOpenTask}
                                        onStatusChange={handleStatusChange}
                                        updating={updatingId === task.id}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
