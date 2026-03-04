'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import {
    PlusIcon,
    FunnelIcon,
    EllipsisHorizontalIcon,
    CalendarIcon,
    ClockIcon,
    PencilIcon,
    TrashIcon,
    Squares2X2Icon,
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
} from '@/lib/graphql/queries';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    useDraggable,
} from '@dnd-kit/core';
import {
    useDroppable,
} from '@dnd-kit/core';

const priorityColors: { [key: string]: string } = {
    URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    LOW: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const columnColors: { [key: string]: string } = {
    TODO: 'bg-gray-50 border-gray-200',
    IN_PROGRESS: 'bg-blue-50 border-blue-200',
    REVIEW: 'bg-purple-50 border-purple-200',
    COMPLETED: 'bg-green-50 border-green-200',
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
    
    // Debug: Log subtask info
    if (hasSubtasks) {
        console.log(`Parent task "${task.title}" has ${subtasks.length} subtasks, expanded: ${expanded}`, subtasks);
    }

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

// Droppable Kanban Column
const DroppableKanbanColumn = ({
    title,
    tasks,
    status,
    count,
    onEditTask,
    onDeleteTask,
    onStatusChange,
    onAddSubtask,
    onNavigateToDetails,
    users,
    expandedTasks,
    onToggleExpand
}: {
    title: string;
    tasks: any[];
    status: string;
    count: number;
    onEditTask: (task: any) => void;
    onDeleteTask: (task: any) => void;
    onStatusChange: (taskId: string, newStatus: string) => void;
    onAddSubtask?: (parent: any) => void;
    onNavigateToDetails?: (taskId: string) => void;
    users: any[];
    expandedTasks: Set<string>;
    onToggleExpand: (taskId: string) => void;
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: status,
    });

    return (
        <div className="flex-1 min-w-0">
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${columnColors[status as keyof typeof columnColors]} ${isOver ? 'ring-2 ring-blue-400' : ''}`}>
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded-full">
                    {count}
                </span>
            </div>
            <div
                ref={setNodeRef}
                className={`bg-gray-50 rounded-b-lg space-y-3 border border-t-0 border-gray-200 p-3 min-h-[400px] ${isOver ? 'bg-blue-50' : ''}`}
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
                        <div className="text-sm">No tasks in {title.toLowerCase()}</div>
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

export default function TasksPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showFilters, setShowFilters] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState<any | null>(null);
    const [parentTaskForModal, setParentTaskForModal] = useState<{ id: string; projectId: string; title: string } | null>(null);
    const [filters, setFilters] = useState({
        projectId: '',
        assignedToId: '',
        priority: '',
    });

    // Prepare filters for GraphQL query - only include non-empty values
    const prepareFilters = () => {
        const activeFilters: any = {};
        if (filters.projectId) activeFilters.projectId = filters.projectId;
        if (filters.assignedToId) activeFilters.assignedToId = filters.assignedToId;
        if (filters.priority) activeFilters.priority = filters.priority;
        return Object.keys(activeFilters).length > 0 ? activeFilters : undefined;
    };

    const { data: tasksData, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useQuery(GET_TASKS, {
        variables: { filters: prepareFilters() },
    });

    // Refetch tasks when filters change
    useEffect(() => {
        refetchTasks();
    }, [filters, refetchTasks]);

    // Debug: Log query state
    console.log('Tasks query state:', {
        loading: tasksLoading,
        error: tasksError,
        data: tasksData,
        filters: filters,
    });

    const { data: projectsData } = useQuery(GET_PROJECTS);
    const { data: usersData } = useQuery(GET_USERS);
    const { data: userData } = useQuery(GET_ME);

    const [createTask] = useMutation(CREATE_TASK);
    const [updateTask] = useMutation(UPDATE_TASK);
    const [deleteTask] = useMutation(DELETE_TASK);

    const tasks = tasksData?.tasks || [];
    const projects = projectsData?.projects || [];
    const users = usersData?.users || [];

    // Debug: Log current tasks and their subtasks
    console.log('Current tasks loaded:', tasks);
    tasks.forEach((t: any) => {
        if (t.subTasks && t.subTasks.length > 0) {
            console.log(`Task "${t.title}" (${t.id}) has ${t.subTasks.length} subtasks:`, t.subTasks.map((st: any) => `${st.title} (${st.id}, parentTaskId: ${st.parentTaskId})`));
        }
    });
    console.log('Tasks by status:', {
        TODO: tasks.filter((t: any) => t.status === 'TODO').length,
        IN_PROGRESS: tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
        REVIEW: tasks.filter((t: any) => t.status === 'REVIEW').length,
        COMPLETED: tasks.filter((t: any) => t.status === 'COMPLETED').length,
    });

    const columns = [
        { key: 'TODO', title: 'To Do' },
        { key: 'IN_PROGRESS', title: 'In Progress' },
        { key: 'REVIEW', title: 'Review' },
        { key: 'COMPLETED', title: 'Completed' },
    ];

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

    // Update expanded set when tasks change (new tasks with subtasks should be expanded)
    useEffect(() => {
        setExpandedTasks(prev => {
            const next = new Set(prev);
            tasks.forEach((t: any) => {
                if (t.subTasks && t.subTasks.length > 0 && !next.has(t.id)) {
                    next.add(t.id);
                }
            });
            return next;
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

    // Get parent tasks by status (for display - subtasks shown nested under parent)
    const getTasksByStatus = (status: string) => {
        return tasks.filter((t: any) => t.status === status);
    };

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

    const handleAddSubtask = (parent: any) => {
        if (projects.length === 0) return;
        setParentTaskForModal({ id: parent.id, projectId: parent.projectId, title: parent.title });
        setEditingTask(null);
        setShowModal(true);
    };

    const handleSaveTask = async (data: any) => {
        try {
            console.log('Current user:', userData?.me);
            console.log('Sending data:', data);
            console.log('Parent task for modal:', parentTaskForModal);

            if (editingTask) {
                // For updates, exclude projectId as it's not allowed in UpdateTaskInput
                const { projectId, ...updateData } = data;
                console.log('Update data (without projectId):', updateData);

                const result = await updateTask({
                    variables: {
                        id: editingTask.id,
                        input: updateData,
                    },
                });
                console.log('Update result:', result);
            } else {
                // If creating a subtask, add parentTaskId and ensure projectId is set
                const createData = { ...data };
                if (parentTaskForModal) {
                    createData.parentTaskId = parentTaskForModal.id;
                    // Ensure projectId is set from parent if not already set
                    if (!createData.projectId && parentTaskForModal.projectId) {
                        createData.projectId = parentTaskForModal.projectId;
                    }
                    console.log('Creating subtask with parentTaskId:', createData.parentTaskId);
                }
                console.log('Create data:', createData);

                const result = await createTask({
                    variables: {
                        input: createData,
                    },
                });
                console.log('Create result:', result);
            }
            setShowModal(false);
            setParentTaskForModal(null);
            const refetchResult = await refetchTasks();
            console.log('Refetch result:', refetchResult);
            console.log('All tasks after refetch:', refetchResult?.data?.tasks);
            
            // Debug: Log parent tasks and their subtasks
            if (refetchResult?.data?.tasks) {
                refetchResult.data.tasks.forEach((t: any) => {
                    if (t.subTasks && t.subTasks.length > 0) {
                        console.log(`Parent task "${t.title}" has ${t.subTasks.length} subtasks:`, t.subTasks.map((st: any) => st.title));
                    }
                });
            }
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
                refetchTasks();
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
            projectId: '',
            assignedToId: '',
            priority: '',
        });
    };

    // Drag and drop handlers
    const [activeTask, setActiveTask] = useState<any | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor)
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const task = allTasksFlattened.find((t: any) => t.id === active.id);
        setActiveTask(task);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) {
            setActiveTask(null);
            return;
        }

        const activeTask = allTasksFlattened.find((t: any) => t.id === active.id);

        if (!activeTask) {
            setActiveTask(null);
            return;
        }

        // Find which column the task was dropped on
        const columnElement = over.id as string;
        const newStatus = columns.find(col => col.key === columnElement)?.key;

        if (newStatus && newStatus !== activeTask.status) {
            try {
                // Clear active task BEFORE updating to prevent animation conflicts
                setActiveTask(null);

                await updateTask({
                    variables: {
                        id: activeTask.id,
                        input: { status: newStatus },
                    },
                });

                // Refetch after a short delay to ensure the UI updates smoothly
                setTimeout(() => {
                    refetchTasks();
                }, 50);
            } catch (error) {
                console.error('Error updating task status via drag and drop:', error);
                setActiveTask(null);
                refetchTasks();
            }
        } else {
            // Clear active task if no status change needed
            setActiveTask(null);
        }
    };

    if (tasksLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading tasks...</div>
            </div>
        );
    }

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
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Manage and track your team's tasks
                        </p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            <FunnelIcon className="h-4 w-4 mr-2" />
                            Filters
                            {(filters.projectId || filters.assignedToId || filters.priority) && (
                                <span className="ml-2 px-2 py-0.5 text-xs bg-primary-600 text-white rounded-full">
                                    {[filters.projectId, filters.assignedToId, filters.priority].filter(Boolean).length}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={handleCreateTask}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                        >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Add Task
                        </button>
                    </div>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Project
                                </label>
                                <select
                                    value={filters.projectId}
                                    onChange={(e) => handleFilterChange('projectId', e.target.value)}
                                    className="w-full rounded-md border-gray-300 text-sm"
                                >
                                    <option value="">All Projects</option>
                                    {projects.map((project: any) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assignee
                                </label>
                                <select
                                    value={filters.assignedToId}
                                    onChange={(e) => handleFilterChange('assignedToId', e.target.value)}
                                    className="w-full rounded-md border-gray-300 text-sm"
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Priority
                                </label>
                                <select
                                    value={filters.priority}
                                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                                    className="w-full rounded-md border-gray-300 text-sm"
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
                                    className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Kanban Board */}
            {tasks.length === 0 && (filters.projectId || filters.assignedToId || filters.priority) ? (
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
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex space-x-4 overflow-x-auto pb-4">
                        {columns.map((column) => {
                            const parentTasks = getTasksByStatus(column.key);
                            // Count includes subtasks for the badge
                            const totalCount = allTasksFlattened.filter((t: any) => t.status === column.key).length;
                            return (
                                <DroppableKanbanColumn
                                    key={column.key}
                                    title={column.title}
                                    tasks={parentTasks}
                                    status={column.key}
                                    count={totalCount}
                                    onEditTask={handleEditTask}
                                    onDeleteTask={handleDeleteTask}
                                    onStatusChange={handleStatusChange}
                                    onAddSubtask={handleAddSubtask}
                                    onNavigateToDetails={(id) => router.push(`/dashboard/tasks/${id}`)}
                                    users={users}
                                    expandedTasks={expandedTasks}
                                    onToggleExpand={toggleExpand}
                                />
                            );
                        })}
                    </div>
                    <DragOverlay dropAnimation={null}>
                        {activeTask ? (
                            <div className="bg-white rounded-lg shadow-2xl border-2 border-blue-400 p-4 transform rotate-1 cursor-grabbing">
                                <TaskCard task={activeTask} />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
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
                                {getTasksByStatus('IN_PROGRESS').length} tasks
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
                                {getTasksByStatus('COMPLETED').length} tasks
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
            />
        </div>
    );
}