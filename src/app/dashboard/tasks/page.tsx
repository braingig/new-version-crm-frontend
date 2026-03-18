'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import {
    PlusIcon,
    FunnelIcon,
    EllipsisHorizontalIcon,
    CalendarIcon,
    ClockIcon,
    PencilIcon,
    TrashIcon,
    Squares2X2Icon,
    XMarkIcon,
    FolderIcon,
} from '@heroicons/react/24/outline';
import {
    ChevronDownIcon,
    ChevronUpIcon,
    UserCircleIcon,
} from '@heroicons/react/24/solid';
import {
    GET_TASKS,
    GET_PROJECTS,
    GET_USERS,
    GET_ME,
    CREATE_TASK,
    UPDATE_TASK,
    DELETE_TASK,
    GET_TASK_LISTS,
    CREATE_TASK_LIST,
    UPDATE_TASK_LIST,
    DELETE_TASK_LIST,
} from '@/lib/graphql/queries';
import { useDraggable, useDroppable } from '@dnd-kit/core';

const priorityColors: { [key: string]: string } = {
    URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    LOW: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const statusLabels: { [key: string]: string } = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    REVIEW: 'Review',
    COMPLETED: 'Complete',
};

const statusBadgeColors: { [key: string]: string } = {
    TODO: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    REVIEW: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
};

/** Flattens parent and nested subTasks into one array; adds _parentTitle for subtasks. */
function flattenTasks(tasks: any[]): any[] {
    const out: any[] = [];
    function go(t: any, parentTitle?: string) {
        out.push({ ...t, _parentTitle: parentTitle });
        (t.subTasks || []).forEach((st: any) => go(st, t.title));
    }
    (tasks || []).forEach((t: any) => go(t));
    return out;
}

const DraggableTaskCard = ({ task, onEdit, onDelete, onStatusChange, onAddSubtask, onNavigateToDetails, users, isSubtask = false, indentLevel = 0, hasSubtasks = false, expanded, onToggleExpand, parentTitle }: {
    task: any;
    onEdit: (task: any) => void;
    onDelete: (task: any) => void;
    onStatusChange: (taskId: string, newStatus: string) => void;
    onAddSubtask?: (parent: any) => void;
    onNavigateToDetails?: (taskId: string) => void;
    users: any[];
    isSubtask?: boolean;
    indentLevel?: number;
    hasSubtasks?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
    parentTitle?: string;
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging,
    } = useDraggable({
        id: task.id,
    });

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition: isDragging ? 'none' : 'transform 250ms ease',
        opacity: isDragging ? 0.5 : 1,
    };

    const handleStatusChange = (newStatus: string) => {
        onStatusChange(task.id, newStatus);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={
                isSubtask
                    ? 'relative rounded-lg border border-l-[3px] border-l-primary-500 bg-gray-50/80 dark:bg-gray-800/60 border-gray-200/80 dark:border-gray-600/50 px-3 py-2 mb-1.5 cursor-grab active:cursor-grabbing hover:border-primary-400/50 dark:hover:border-primary-500/50 transition-colors'
                    : 'relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing'
            }
            {...attributes}
            {...listeners}
        >
            {/* Card menu - EXCLUDED from drag */}
            <div
                className={`absolute ${isSubtask ? 'top-2 right-2' : 'top-3 right-3'}`}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowMenu(!showMenu);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="text-gray-400 hover:text-gray-600"
                >
                    <EllipsisHorizontalIcon className="h-4 w-4" />
                </button>
                {showMenu && (
                    <div
                        className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="py-1">
                            {!task.parentTaskId && onAddSubtask && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddSubtask(task);
                                        setShowMenu(false);
                                    }}
                                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                                >
                                    <Squares2X2Icon className="h-4 w-4 mr-2" />
                                    Add Subtask
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(task);
                                    setShowMenu(false);
                                }}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                            >
                                <PencilIcon className="h-4 w-4 mr-2" />
                                Edit
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(task);
                                    setShowMenu(false);
                                }}
                                className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                            >
                                <TrashIcon className="h-4 w-4 mr-2" />
                                Delete
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Header with chevron and title */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-8">
                    {hasSubtasks && !isSubtask && onToggleExpand && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleExpand(); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                        >
                            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`} />
                        </button>
                    )}
                    <div
                        className="flex-1 min-w-0 cursor-pointer group"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onNavigateToDetails?.(task.id); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToDetails?.(task.id); } }}
                    >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <h3 className={`font-semibold text-gray-900 dark:text-white line-clamp-2 px-1 py-0.5 rounded pr-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:underline ${isSubtask ? 'text-xs' : 'text-sm'}`}>
                                {task.title}
                            </h3>
                            {isSubtask && (
                                <span className="inline-flex items-center rounded-full bg-white/70 dark:bg-gray-800/60 text-xs text-primary-700 dark:text-primary-300 px-2 py-0.5 border border-primary-200/80 dark:border-primary-700/40">
                                    Subtask
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isSubtask ? (
                <div className="mt-2 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${statusBadgeColors[task.status] || statusBadgeColors.TODO}`}>
                        {statusLabels[task.status] || task.status}
                    </span>
                </div>
            ) : (
                <>
                    {task.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                            {task.description}
                        </p>
                    )}
                    <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priorityColors[task.priority] || priorityColors.MEDIUM}`}>
                            {task.priority}
                        </span>
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            {task.estimatedTime != null
                                ? (() => {
                                    const m = task.estimatedTime;
                                    const h = Math.floor(m / 60);
                                    const min = m % 60;
                                    return h > 0 ? `${h}h ${min}m` : `${min}m`;
                                })()
                                : 'No estimate'}
                        </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                        </div>
                        {task.assignedToId && (
                            <div className="flex items-center">
                                <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                    <UserCircleIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                </div>
                                <span className="ml-1 text-xs text-gray-600 dark:text-gray-300">
                                    {users.find((u: any) => u.id === task.assignedToId)?.name || 'Unassigned'}
                                </span>
                            </div>
                        )}
                    </div>
                    {task.project && (
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{task.project.name}</span>
                        </div>
                    )}
                    <div
                        className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-1 flex-wrap"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {task.status !== 'TODO' && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleStatusChange('TODO'); }}
                                className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                                To Do
                            </button>
                        )}
                        {task.status !== 'IN_PROGRESS' && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleStatusChange('IN_PROGRESS'); }}
                                className="text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30">
                                In Progress
                            </button>
                        )}
                        {task.status !== 'REVIEW' && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleStatusChange('REVIEW'); }}
                                className="text-xs px-2 py-1 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30">
                                Review
                            </button>
                        )}
                        {task.status !== 'COMPLETED' && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleStatusChange('COMPLETED'); }}
                                className="text-xs px-2 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30">
                                Complete
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// Parent Task with Subtasks Component
const ParentTaskWithSubtasks = ({ 
    task, 
    expanded, 
    onToggleExpand,
    onEdit, 
    onDelete, 
    onStatusChange, 
    onAddSubtask, 
    onNavigateToDetails,
    users 
}: {
    task: any;
    expanded: boolean;
    onToggleExpand: () => void;
    onEdit: (task: any) => void;
    onDelete: (task: any) => void;
    onStatusChange: (taskId: string, newStatus: string) => void;
    onAddSubtask?: (parent: any) => void;
    onNavigateToDetails?: (taskId: string) => void;
    users: any[];
}) => {
    const hasSubtasks = task.subTasks && task.subTasks.length > 0;
    const subtasks = task.subTasks || [];
    
    return (
        <div>
            <DraggableTaskCard
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onAddSubtask={onAddSubtask}
                onNavigateToDetails={onNavigateToDetails}
                users={users}
                isSubtask={false}
                hasSubtasks={hasSubtasks}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
            />
            {hasSubtasks && (
                <div
                    className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                    style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                >
                    <div className="min-h-0 overflow-hidden">
                        <div className="ml-2 mt-2 mb-4 space-y-2">
                            {subtasks.map((subtask: any) => (
                                <DraggableTaskCard
                                    key={subtask.id}
                                    task={subtask}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onStatusChange={onStatusChange}
                                    onAddSubtask={onAddSubtask}
                                    onNavigateToDetails={onNavigateToDetails}
                                    users={users}
                                    isSubtask={true}
                                    indentLevel={1}
                                    parentTitle={task.title}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Droppable List Column (ClickUp-style list within a project)
const DroppableListColumn = ({
    list,
    tasks,
    onEditTask,
    onDeleteTask,
    onStatusChange,
    onAddSubtask,
    onNavigateToDetails,
    users,
    expandedTasks,
    onToggleExpand,
    onAddTaskToList,
    onEditList,
    onDeleteList,
}: {
    list: any;
    tasks: any[];
    onEditTask: (task: any) => void;
    onDeleteTask: (task: any) => void;
    onStatusChange: (taskId: string, newStatus: string) => void;
    onAddSubtask?: (parent: any) => void;
    onNavigateToDetails?: (taskId: string) => void;
    users: any[];
    expandedTasks: Set<string>;
    onToggleExpand: (taskId: string) => void;
    onAddTaskToList: (listId: string) => void;
    onEditList: (list: any) => void;
    onDeleteList: (list: any) => void;
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: list.id,
    });

    return (
        <div className="w-full">
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border bg-gray-50 border-gray-200 ${isOver ? 'ring-2 ring-primary-400' : ''}`}>
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{list.name}</h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                        {tasks.length} tasks
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onAddTaskToList(list.id)}
                        className="inline-flex items-center rounded-md bg-primary-600 text-white px-2 py-1 text-xs hover:bg-primary-700"
                    >
                        <PlusIcon className="h-3 w-3 mr-1" />
                        Task
                    </button>
                    <button
                        type="button"
                        onClick={() => onEditList(list)}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDeleteList(list)}
                        className="text-gray-400 hover:text-red-600"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <div
                ref={setNodeRef}
                className={`bg-white rounded-b-lg space-y-3 border border-t-0 border-gray-200 p-3 min-h-[260px] ${isOver ? 'bg-primary-50' : ''}`}
            >
                {tasks.map((task) => (
                    <ParentTaskWithSubtasks
                        key={task.id}
                        task={task}
                        expanded={expandedTasks.has(task.id)}
                        onToggleExpand={() => onToggleExpand(task.id)}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                        onStatusChange={onStatusChange}
                        onAddSubtask={onAddSubtask}
                        onNavigateToDetails={onNavigateToDetails}
                        users={users}
                    />
                ))}
                {tasks.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        <div className="text-sm">No tasks in this list</div>
                    </div>
                )}
            </div>
        </div>
    );
};

// TaskCard for drag overlay - full for parent, minimal for subtask
const TaskCard = ({ task }: { task: any }) => {
    const isSubtask = !!task.parentTaskId;
    if (isSubtask) {
        return (
            <div className="rounded-lg shadow-lg border-2 border-primary-400 border-l-4 border-l-primary-500 bg-white dark:bg-gray-800 p-3 opacity-95">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</h3>
                <span className={`inline-flex mt-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${statusBadgeColors[task.status] || statusBadgeColors.TODO}`}>
                    {statusLabels[task.status] || task.status}
                </span>
            </div>
        );
    }
    return (
        <div className="rounded-lg shadow-lg border-2 border-primary-400 bg-white dark:bg-gray-800 p-4 opacity-95">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-2">{task.title}</h3>
            {task.description && <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">{task.description}</p>}
            <div className="flex items-center justify-between">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${priorityColors[task.priority] || priorityColors.MEDIUM}`}>{task.priority}</span>
                {task.dueDate && (
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {new Date(task.dueDate).toLocaleDateString()}
                    </div>
                )}
            </div>
        </div>
    );
};

import TaskModal from '@/components/TaskModal';
import TaskDetailsModal from '@/components/TaskDetailsModal';

export default function TasksPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showFilters, setShowFilters] = useState(false);
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const projectDropdownRef = useRef<HTMLDivElement>(null);
    const [showListModal, setShowListModal] = useState(false);
    const [editingList, setEditingList] = useState<any | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState<any | null>(null);
    const [parentTaskForModal, setParentTaskForModal] = useState<{ id: string; projectId: string; title: string } | null>(null);
    const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        assignedToId: '',
        priority: '',
    });

    // Prepare filters for GraphQL query - only include non-empty values
    const prepareFilters = () => {
        const activeFilters: any = {};
        if (selectedProjectId) activeFilters.projectId = selectedProjectId;
        if (filters.assignedToId) activeFilters.assignedToId = filters.assignedToId;
        if (filters.priority) activeFilters.priority = filters.priority;
        return Object.keys(activeFilters).length > 0 ? activeFilters : undefined;
    };

    const { data: tasksData, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useQuery(GET_TASKS, {
        variables: { filters: prepareFilters() },
        skip: !selectedProjectId,
        fetchPolicy: 'network-only',
        nextFetchPolicy: 'cache-first',
    });

    const { data: projectsData } = useQuery(GET_PROJECTS);

    const { data: listsData, refetch: refetchLists } = useQuery(GET_TASK_LISTS, {
        variables: { projectId: selectedProjectId },
        skip: !selectedProjectId,
    });
    const { data: usersData } = useQuery(GET_USERS);
    const { data: userData } = useQuery(GET_ME);

    const [createTask] = useMutation(CREATE_TASK);
    const [updateTask] = useMutation(UPDATE_TASK);
    const [deleteTask] = useMutation(DELETE_TASK);

    const tasks = tasksData?.tasks || [];
    const projects = projectsData?.projects || [];
    const users = usersData?.users || [];
    const taskLists = listsData?.taskLists || [];

    // Initialize selected project / list from URL (?projectId=, ?listId=) or fallbacks.
    // IMPORTANT: This should only run when there is no existing user selection,
    // so we don't override manual changes from the UI.
    const projectIdFromUrl = searchParams.get('projectId');
    const listIdFromUrl = searchParams.get('listId');

    useEffect(() => {
        // If user has already chosen a project, don't override it from the URL.
        if (selectedProjectId) return;

        if (projectIdFromUrl && projects.some((p: any) => p.id === projectIdFromUrl)) {
            setSelectedProjectId(projectIdFromUrl);
        } else if (projects.length > 0) {
            setSelectedProjectId(projects[0].id);
        }
    }, [projects, projectIdFromUrl, selectedProjectId]);

    // When lists are loaded for the selected project, honor ?listId= from URL if valid.
    // Again, don't override if the user has already picked a list.
    useEffect(() => {
        if (!selectedProjectId) return;
        if (!listIdFromUrl) return;
        if (selectedListId) return;

        if (listIdFromUrl === 'unassigned') {
            setSelectedListId('unassigned');
            return;
        }

        if (taskLists.length > 0 && taskLists.some((l: any) => l.id === listIdFromUrl)) {
            setSelectedListId(listIdFromUrl);
        }
    }, [selectedProjectId, taskLists, listIdFromUrl, selectedListId]);

    // When project has no lists or selected list is not in current project, clear selection so "Add Task" is never shown
    // Keep 'unassigned' selected if user is viewing tasks with no list
    useEffect(() => {
        if (selectedListId === 'unassigned') return;
        if (selectedListId && taskLists.length > 0 && !taskLists.some((l: any) => l.id === selectedListId)) {
            setSelectedListId(null);
        }
        if (taskLists.length === 0 && selectedListId) {
            setSelectedListId(null);
        }
    }, [selectedProjectId, taskLists, selectedListId]);

    // Close project dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
                setProjectDropdownOpen(false);
            }
        };
        if (projectDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [projectDropdownOpen]);

    const allTasksFlattened = useMemo(() => flattenTasks(tasks), [tasks]);

    // Open edit modal when navigating from task details with ?edit=id
    useEffect(() => {
        const editId = searchParams.get('edit');
        if (!editId || tasks.length === 0) return;
        const taskToEdit = allTasksFlattened.find((t: any) => t.id === editId);
        if (taskToEdit) {
            setParentTaskForModal(null);
            setEditingTask(taskToEdit);
            setShowModal(true);
            router.replace('/dashboard/tasks', { scroll: false });
        }
    }, [searchParams, tasks.length, allTasksFlattened, router]);
    
    // Track expanded parent tasks - start with all expanded by default
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
        const expanded = new Set<string>();
        tasks.forEach((t: any) => {
            if (t.subTasks && t.subTasks.length > 0) {
                expanded.add(t.id);
            }
        });
        return expanded;
    });

    // Update expanded set when tasks change (ensure new tasks with subtasks are expanded)
    useEffect(() => {
        setExpandedTasks(prev => {
            let changed = false;
            const next = new Set(prev);
            tasks.forEach((t: any) => {
                if (t.subTasks && t.subTasks.length > 0 && !next.has(t.id)) {
                    next.add(t.id);
                    changed = true;
                }
            });
            // Avoid infinite update loop: only return a new Set when something actually changed
            return changed ? next : prev;
        });
    }, [tasks]);

    const toggleExpand = (taskId: string) => {
        setExpandedTasks(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    // Group tasks by listId for list view
    const tasksByListId = useMemo(() => {
        const map = new Map<string | 'unassigned', any[]>();
        (tasks || []).forEach((t: any) => {
            const key = (t.listId as string) || 'unassigned';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(t);
        });
        return map;
    }, [tasks]);

    const handleCreateTask = () => {
        if (projects.length === 0) {
            alert('No projects available. Please create a project first.');
            return;
        }
        setParentTaskForModal(null);
        setEditingTask(null);
        setShowModal(true);
    };

    const handleEditTask = (task: any) => {
        setParentTaskForModal(null);
        setEditingTask(task);
        setShowModal(true);
    };

    const handleAddTaskToList = (listId: string) => {
        if (projects.length === 0 || !selectedProjectId) return;
        setParentTaskForModal(null);
        setEditingTask({
            projectId: selectedProjectId,
            listId,
        });
        setShowModal(true);
    };

    const handleAddSubtask = (parent: any) => {
        if (projects.length === 0) return;
        setParentTaskForModal({ id: parent.id, projectId: parent.projectId, title: parent.title });
        setEditingTask(null);
        setShowModal(true);
    };

    const handleSaveTask = async (data: any) => {
        try {
            if (editingTask && editingTask.id) {
                // For updates, exclude projectId and listId (not in UpdateTaskInput)
                const { projectId, listId, ...updateData } = data;
                const result = await updateTask({
                    variables: {
                        id: editingTask.id,
                        input: updateData,
                    },
                });
            } else {
                // If creating a subtask, add parentTaskId and ensure projectId is set
                const createData = { ...data };
                if (parentTaskForModal) {
                    createData.parentTaskId = parentTaskForModal.id;
                    // Ensure projectId is set from parent if not already set
                    if (!createData.projectId && parentTaskForModal.projectId) {
                        createData.projectId = parentTaskForModal.projectId;
                    }
                }
                const result = await createTask({
                    variables: {
                        input: createData,
                    },
                });
            }
            setShowModal(false);
            setParentTaskForModal(null);
            const refetchResult = await refetchTasks();
        } catch (error: any) {
            console.error('Error saving task:', error);
            console.error('GraphQL errors:', error.graphQLErrors);
            console.error('Network error:', error.networkError);

            // More detailed error reporting
            if (error.graphQLErrors && error.graphQLErrors.length > 0) {
                const gqlError = error.graphQLErrors[0];
                console.error('GraphQL error details:', gqlError);
                alert(`GraphQL Error: ${gqlError.message}`);
            } else if (error.networkError) {
                console.error('Network error details:', error.networkError);
                console.error('Network error result:', (error.networkError as any)?.result);
                console.error('Network error status:', (error.networkError as any)?.statusCode);
                console.error('Network error text:', (error.networkError as any)?.statusText);

                // Try to extract more details from the response
                const result = (error.networkError as any)?.result;
                if (result && result.errors) {
                    alert(`Server Error: ${result.errors.map((e: any) => e.message).join(', ')}`);
                } else {
                    alert(`Network Error: ${error.networkError.message || 'Connection failed'}`);
                }
            } else {
                alert(`Error saving task: ${error.message || 'Unknown error'}`);
            }
        }
    };

    const handleDeleteTask = async (task: any) => {
        if (window.confirm('Are you sure you want to delete this task?')) {
            try {
                await deleteTask({
                    variables: { id: task.id },
                });
                await refetchTasks();
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        }
    };

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        try {
            await updateTask({
                variables: {
                    id: taskId,
                    input: { status: newStatus },
                },
            });
            refetchTasks();
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({
            assignedToId: '',
            priority: '',
        });
    };

    const [createTaskList] = useMutation(CREATE_TASK_LIST);
    const [updateTaskList] = useMutation(UPDATE_TASK_LIST);
    const [deleteTaskListMutation] = useMutation(DELETE_TASK_LIST);

    const handleCreateList = () => {
        if (!selectedProjectId) {
            alert('Select a project first');
            return;
        }
        setEditingList(null);
        setShowListModal(true);
    };

    const handleEditList = (list: any) => {
        setEditingList(list);
        setShowListModal(true);
    };

    const handleDeleteList = async (list: any) => {
        if (!window.confirm('Delete this list? Tasks will remain but without a list.')) return;
        try {
            await deleteTaskListMutation({
                variables: { id: list.id },
            });
            await Promise.all([refetchLists(), refetchTasks()]);
        } catch (error) {
            console.error('Error deleting list', error);
        }
    };

    const handleSaveList = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = (formData.get('name') as string)?.trim();
        const description = (formData.get('description') as string | null)?.trim() || undefined;
        if (!name) {
            alert('List name is required');
            return;
        }
        try {
            if (editingList) {
                await updateTaskList({
                    variables: {
                        id: editingList.id,
                        input: { name, description },
                    },
                });
            } else {
                await createTaskList({
                    variables: {
                        input: {
                            projectId: selectedProjectId,
                            name,
                            description,
                        },
                    },
                });
            }
            setShowListModal(false);
            setEditingList(null);
            await refetchLists();
        } catch (error) {
            console.error('Error saving list', error);
        }
    };

    // No drag-and-drop handlers in list view layout

    // Check if user is authenticated
    if (!userData?.me) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-red-500">Please log in to view tasks.</div>
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col gap-4 sm:gap-6">
                    {/* Title and description */}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Manage tasks by project and list. Create lists and move tasks between them.
                        </p>
                    </div>

                    {/* Toolbar: Project selector + Workspace + Filters + Add List */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Project (folder) selector - custom dropdown */}
                        <div className="relative min-w-0" ref={projectDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setProjectDropdownOpen((open) => !open)}
                                aria-haspopup="listbox"
                                aria-expanded={projectDropdownOpen}
                                aria-label="Select project folder"
                                className="inline-flex items-center w-full min-w-[180px] max-w-[280px] py-2.5 pl-3 pr-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:border-primary-400 transition-colors text-left"
                            >
                                <FolderIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden />
                                <span className="flex-1 min-w-0 truncate ml-2.5 text-sm font-medium text-gray-900 dark:text-white">
                                    {projects.length === 0 ? 'No projects' : (projects.find((p: any) => p.id === selectedProjectId)?.name ?? 'Select project')}
                                </span>
                                <ChevronDownIcon className={`h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 ml-1 transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} aria-hidden />
                            </button>
                            {projectDropdownOpen && (
                                <div
                                    role="listbox"
                                    className="absolute left-0 top-full mt-1.5 min-w-[220px] max-h-[280px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-50 py-1.5"
                                >
                                    {projects.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No projects</div>
                                    ) : (
                                        projects.map((project: any) => (
                                            <button
                                                key={project.id}
                                                type="button"
                                                role="option"
                                                aria-selected={selectedProjectId === project.id}
                                                onClick={() => {
                                                    setSelectedProjectId(project.id);
                                                    setProjectDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2.5 ${
                                                    selectedProjectId === project.id
                                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                                        : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                <FolderIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 opacity-70" />
                                                <span className="truncate">{project.name}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end sm:justify-start">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors"
                            >
                                <FunnelIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                                Filters
                                {(filters.assignedToId || filters.priority) && (
                                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-primary-600 text-white rounded-md">
                                        {[filters.assignedToId, filters.priority].filter(Boolean).length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={handleCreateList}
                                className="inline-flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors"
                            >
                                <PlusIcon className="h-4 w-4 mr-2" />
                                Add List
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Assignee
                                </label>
                                <select
                                    value={filters.assignedToId}
                                    onChange={(e) => handleFilterChange('assignedToId', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                    <option value="">All Members</option>
                                    {users.map((user: any) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Priority
                                </label>
                                <select
                                    value={filters.priority}
                                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm py-2 px-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                    <option value="">All Priorities</option>
                                    <option value="URGENT">Urgent</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={clearFilters}
                                    className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Lists and tasks board */}
            {!selectedProjectId ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Select a project</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Choose a project folder to view its lists and tasks.
                    </p>
                </div>
            ) : tasksLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">Loading tasks...</div>
                </div>
            ) : tasks.length === 0 && (filters.assignedToId || filters.priority) ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <FunnelIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks match your filters</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Try adjusting your filter criteria or clear all filters to see more tasks.
                    </p>
                    <button
                        onClick={clearFilters}
                        className="mt-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                        Clear Filters
                    </button>
                </div>
            ) : (
                <div className="space-y-6 pb-4">
                    {!selectedListId ? (
                        // Show only Lists table
                        <div className="card overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                                <h3 className="text-sm font-semibold text-gray-900">Lists</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Progress
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Tasks
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Owner
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {taskLists.map((list: any) => {
                                            const listTasks = tasksByListId.get(list.id) || [];
                                            const completed = listTasks.filter((t: any) => t.status === 'COMPLETED').length;
                                            const total = listTasks.length;
                                            return (
                                                <tr
                                                    key={list.id}
                                                    className="cursor-pointer hover:bg-gray-50"
                                                    onClick={() => setSelectedListId(list.id)}
                                                >
                                                    <td className="px-4 py-2 text-sm text-gray-900">
                                                        {list.name}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-600">
                                                        {completed}/{total || 0}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-600">
                                                        {total}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-400">
                                                        —{/* placeholder owner */}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(tasksByListId.get('unassigned')?.length ?? 0) > 0 && (
                                            <tr
                                                className="cursor-pointer hover:bg-amber-50/50 border-t border-amber-200/50"
                                                onClick={() => setSelectedListId('unassigned')}
                                            >
                                                <td className="px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
                                                    No list (unassigned)
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600">
                                                    {tasksByListId.get('unassigned')!.filter((t: any) => t.status === 'COMPLETED').length}/{tasksByListId.get('unassigned')!.length}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600">
                                                    {tasksByListId.get('unassigned')!.length}
                                                </td>
                                                <td className="px-4 py-2 text-xs text-amber-600 dark:text-amber-400">
                                                    Assign via Edit
                                                </td>
                                            </tr>
                                        )}
                                        {taskLists.length === 0 && (
                                            <tr>
                                                <td
                                                    className="px-4 py-6 text-center"
                                                    colSpan={4}
                                                >
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        No lists yet. Tasks can only be created inside a list.
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                                        Create a list using &quot;+ Add List&quot; above to add tasks.
                                                    </p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        // Show breadcrumb + tasks table for selected list
                        <>
                            <div className="flex items-center justify-between">
                                <nav className="text-xs text-gray-500">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedListId(null)}
                                        className="hover:underline"
                                    >
                                        Lists
                                    </button>
                                    <span className="mx-1">/</span>
                                    <span className="font-medium text-gray-700">
                                        {selectedListId === 'unassigned'
                                            ? 'No list (unassigned)'
                                            : taskLists.find((l: any) => l.id === selectedListId)?.name || 'Selected list'}
                                    </span>
                                </nav>
                            </div>

                            <div className="card overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900">
                                            Tasks in list
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            {selectedListId === 'unassigned'
                                                ? 'These tasks have no list. Open a task and set its List to move it into a list.'
                                                : 'Click a task name to see full details.'}
                                        </p>
                                    </div>
                                    {selectedListId !== 'unassigned' && (
                                        <button
                                            onClick={() => handleAddTaskToList(selectedListId)}
                                            className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary-600 text-white text-xs font-medium hover:bg-primary-700"
                                        >
                                            <PlusIcon className="h-4 w-4 mr-1" />
                                            Add Task
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Name
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Assignee
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Due date
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Priority
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {tasks
                                                .filter((t: any) => (t.listId || 'unassigned') === selectedListId)
                                                .map((task: any) => (
                                                <tr
                                                    key={task.id}
                                                    className="hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                                                >
                                                        <td className="px-4 py-2 text-xs">
                                                            <span
                                                                className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                                                    statusBadgeColors[task.status] ||
                                                                    statusBadgeColors.TODO
                                                                }`}
                                                            >
                                                                {statusLabels[task.status] || task.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-gray-900">
                                                            {task.title}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-gray-600">
                                                            {users.find((u: any) => u.id === task.assignedToId)?.name ||
                                                                'Unassigned'}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-gray-600">
                                                            {task.dueDate
                                                                ? new Date(task.dueDate).toLocaleDateString()
                                                                : '—'}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-gray-600">
                                                            {task.priority}
                                                        </td>
                                                    </tr>
                                                ))}
                                            {tasks.filter((t: any) => (t.listId || 'unassigned') === selectedListId)
                                                .length === 0 && (
                                                <tr>
                                                    <td
                                                        className="px-4 py-4 text-sm text-gray-400 text-center"
                                                        colSpan={5}
                                                    >
                                                        No tasks in this list yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Stats Bar */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-600">T</span>
                            </div>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">Total Tasks</p>
                            <p className="text-xs text-gray-500">{allTasksFlattened.length} active tasks</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-red-600">!</span>
                            </div>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">Urgent</p>
                            <p className="text-xs text-gray-500">
                                {allTasksFlattened.filter((t: any) => t.priority === 'URGENT').length} urgent tasks
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-blue-600">→</span>
                            </div>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">In Progress</p>
                            <p className="text-xs text-gray-500">
                                {allTasksFlattened.filter((t: any) => t.status === 'IN_PROGRESS').length} tasks
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-green-600">✓</span>
                            </div>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">Completed</p>
                            <p className="text-xs text-gray-500">
                                {allTasksFlattened.filter((t: any) => t.status === 'COMPLETED').length} tasks
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Task Modal */}
            <TaskModal
                task={editingTask}
                parentTask={parentTaskForModal}
                isOpen={showModal}
                onClose={() => { setShowModal(false); setParentTaskForModal(null); }}
                onSave={handleSaveTask}
                projects={projects}
                users={users}
                lists={taskLists}
            />

            {/* Task Details Modal */}
            <TaskDetailsModal
                taskId={detailTaskId}
                isOpen={!!detailTaskId}
                onClose={() => setDetailTaskId(null)}
            />

            {/* List Modal */}
            {showListModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingList ? 'Edit List' : 'Create List'}
                            </h2>
                            <button
                                onClick={() => { setShowListModal(false); setEditingList(null); }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveList} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Name *
                                </label>
                                <input
                                    name="name"
                                    type="text"
                                    defaultValue={editingList?.name || ''}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    defaultValue={editingList?.description || ''}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowListModal(false); setEditingList(null); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                                >
                                    {editingList ? 'Update List' : 'Create List'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}