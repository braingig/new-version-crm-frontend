'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
    ChevronDownIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { GET_MY_TASKS, UPDATE_TASK } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ToastProvider';
import TaskDetailsModal from '@/components/TaskDetailsModal';
import {
    type MyTaskItem,
    type MyTaskBucket,
    STATUS_LABELS,
    STATUS_OPTIONS,
    groupTasksByBucket,
    sortByDueDate,
    taskLocationLabel,
    priorityFlagClass,
    STATUS_GROUP_HEADER,
    assigneeIdsForTask,
    deriveAssignedProjects,
} from '@/lib/myTasks';
import AdminTeamOverview from '@/components/my-tasks/AdminTeamOverview';
import AssignedProjectsCard from '@/components/my-tasks/AssignedProjectsCard';
import RecentsCard from '@/components/my-tasks/RecentsCard';
import CommentsAndMentionsPanel from '@/components/my-tasks/CommentsAndMentionsPanel';
import { latestAssignedRecentEntries } from '@/lib/recentTasks';

type WorkTab = 'todo' | 'done' | 'delegated';
type PageScope = 'team' | 'mine';

const SCOPE_STORAGE_KEY = 'my-tasks:scope';

const BUCKET_SECTIONS: { id: MyTaskBucket; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'next', label: 'Next' },
    { id: 'unscheduled', label: 'Unscheduled' },
];

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

function MyWorkTaskRow({ task, onOpen }: { task: MyTaskItem; onOpen: (task: MyTaskItem) => void }) {
    return (
        <button
            type="button"
            onClick={() => onOpen(task)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/80 flex items-start gap-2"
        >
            <span
                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    task.priority === 'URGENT'
                        ? 'bg-red-500'
                        : task.priority === 'HIGH'
                          ? 'bg-orange-400'
                          : 'bg-gray-300 dark:bg-gray-600'
                }`}
            />
            <span className="min-w-0">
                <span className="text-sm text-gray-900 dark:text-white line-clamp-2">{task.title}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                    {taskLocationLabel(task)}
                </span>
            </span>
        </button>
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
    const [workTab, setWorkTab] = useState<WorkTab>('todo');
    const [expandedBuckets, setExpandedBuckets] = useState<Set<MyTaskBucket>>(() => new Set());
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

    const doneTasks = useMemo(
        () => allTasks.filter((t) => t.status === 'COMPLETED'),
        [allTasks],
    );

    const buckets = useMemo(() => groupTasksByBucket(openTasks, false), [openTasks]);

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

    const toggleBucket = (id: MyTaskBucket) => {
        setExpandedBuckets((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
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
                        {/* ——— My Work card ——— */}
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col min-h-0 max-h-[min(420px,50vh)] xl:max-h-none xl:h-full">
                            <div className="px-4 pt-4 pb-0 border-b border-gray-100 dark:border-gray-800">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                    My Work
                                </h2>
                                <div className="flex gap-6 border-b border-transparent">
                                    {(
                                        [
                                            { id: 'todo' as WorkTab, label: 'To Do' },
                                            { id: 'done' as WorkTab, label: 'Done' },
                                            { id: 'delegated' as WorkTab, label: 'Delegated' },
                                        ] as const
                                    ).map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setWorkTab(tab.id)}
                                            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                                                workTab === tab.id
                                                    ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
                                {workTab === 'delegated' ? (
                                    delegatedTasks.length === 0 ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-8 text-center">
                                            Tasks you created and assigned to others will appear here.
                                        </p>
                                    ) : (
                                        delegatedTasks.map((task) => (
                                            <MyWorkTaskRow
                                                key={task.id}
                                                task={task}
                                                onOpen={openTask}
                                            />
                                        ))
                                    )
                                ) : workTab === 'done' ? (
                                    doneTasks.length === 0 ? (
                                        <p className="text-sm text-gray-500 px-3 py-8 text-center">
                                            No completed tasks yet.
                                        </p>
                                    ) : (
                                        doneTasks.map((task) => (
                                            <MyWorkTaskRow
                                                key={task.id}
                                                task={task}
                                                onOpen={openTask}
                                            />
                                        ))
                                    )
                                ) : (
                                    BUCKET_SECTIONS.map((section) => {
                                        const tasks = buckets[section.id];
                                        const expanded = expandedBuckets.has(section.id);
                                        return (
                                            <div key={section.id} className="mb-1">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBucket(section.id)}
                                                    className="w-full flex items-center gap-2 px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
                                                >
                                                    {expanded ? (
                                                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                                                    ) : (
                                                        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                                                    )}
                                                    <span>
                                                        {section.label}{' '}
                                                        <span className="text-gray-400 font-normal">
                                                            ({tasks.length})
                                                        </span>
                                                    </span>
                                                </button>
                                                {expanded && (
                                                    <div className="pl-2 pb-2">
                                                        {tasks.length === 0 ? (
                                                            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2 leading-relaxed">
                                                                {section.id === 'today'
                                                                    ? 'Tasks and reminders assigned to you will show here.'
                                                                    : 'No tasks in this group.'}
                                                            </p>
                                                        ) : (
                                                            tasks.map((task) => (
                                                                <MyWorkTaskRow
                                                                    key={task.id}
                                                                    task={task}
                                                                    onOpen={openTask}
                                                                />
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
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
