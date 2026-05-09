'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@apollo/client';
import { useEffect, useMemo, useState } from 'react';
import { GET_PROJECT, GET_PROJECTS, GET_TASKS, GET_TASK_LISTS, CREATE_TASK, CREATE_TASK_LIST, DELETE_PROJECT, GET_USERS } from '@/lib/graphql/queries';
import { useToast } from '@/components/ToastProvider';
import {
    ArrowLeftIcon,
    FolderIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    UserCircleIcon,
    Squares2X2Icon,
    PencilIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import EditProjectModal from '@/components/EditProjectModal';
import TaskModal from '@/components/TaskModal';
import DescriptionRichTextField from '@/components/DescriptionRichTextField';
import { RichTextContent } from '@/components/RichTextContent';
import { useAuthStore } from '@/lib/store';
import { htmlToPlainText } from '@/lib/richText';
import {
    deleteProjectAttachment,
    downloadWithAuth,
    finalizeTaskDraft,
    getPreviewObjectUrlWithAuth,
    openInNewTabWithAuth,
    projectAttachmentDownloadUrl,
} from '@/lib/attachments';

const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    ON_HOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    PLANNING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};

export default function ProjectDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { showToast } = useToast();
    const projectId = params?.id as string;
    const currentUser = useAuthStore((state) => state.user);
    const isAdmin = currentUser?.role === 'ADMIN';

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
    const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({});
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [showListModal, setShowListModal] = useState(false);
    const [listDescription, setListDescription] = useState('');
    const [taskModal, setTaskModal] = useState<{
        open: boolean;
        template: { projectId: string; listId: string } | null;
        folderOptional: boolean;
    }>({ open: false, template: null, folderOptional: false });

    const { data, loading, error, refetch } = useQuery(GET_PROJECT, {
        variables: { id: projectId },
        skip: !projectId,
    });
    const { data: tasksData, refetch: refetchTasks } = useQuery(GET_TASKS, {
        variables: { filters: { projectId } },
        skip: !projectId,
    });
    const { data: listsData, refetch: refetchTaskLists } = useQuery(GET_TASK_LISTS, {
        variables: { projectId },
        skip: !projectId,
    });
    const { data: usersData } = useQuery(GET_USERS);
    const [deleteProject] = useMutation(DELETE_PROJECT);
    const [createTask] = useMutation(CREATE_TASK);
    const [createTaskList] = useMutation(CREATE_TASK_LIST);

    const project = data?.project;
    const tasks = tasksData?.tasks ?? [];
    const taskLists = listsData?.taskLists ?? [];
    const mentionUsers = usersData?.users ?? [];
    const openTaskCount = tasks.filter((t: any) => t.status !== 'COMPLETED').length;
    const ungroupedTasks = tasks.filter((task: any) => !task.listId);
    const descriptionPlainText = project?.description ? htmlToPlainText(project.description).trim() : '';
    const isLongDescription = descriptionPlainText.length > 450;

    const taskModalCreatePrefill = useMemo(() => {
        if (taskModal.open && !taskModal.template && projectId) return { projectId };
        return undefined;
    }, [taskModal.open, taskModal.template, projectId]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

    const handleDeleteProject = async () => {
        if (!projectId) return;
        try {
            await deleteProject({
                variables: { id: projectId },
                refetchQueries: [{ query: GET_PROJECTS }],
                awaitRefetchQueries: true,
            });
            showToast({ variant: 'success', message: 'Project deleted successfully.' });
            router.push('/dashboard/projects');
        } catch (err) {
            showToast({
                variant: 'error',
                message: (err as any)?.message || 'Failed to delete project.',
            });
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleRemoveAttachment = async (id: string) => {
        if (!isAdmin) return;
        if (!window.confirm('Remove this attachment?')) return;
        try {
            setDeletingAttachmentId(id);
            await deleteProjectAttachment(id);
            await refetch();
            showToast({ variant: 'success', message: 'Attachment removed.' });
        } catch (e: any) {
            showToast({ variant: 'error', message: e?.message || 'Failed to remove attachment.' });
        } finally {
            setDeletingAttachmentId(null);
        }
    };

    const handleSaveList = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = (formData.get('name') as string)?.trim();
        const description = listDescription?.trim() || undefined;
        if (!name) {
            showToast({ variant: 'warning', message: 'Folder name is required.' });
            return;
        }
        if (!projectId) return;
        try {
            await createTaskList({
                variables: {
                    input: {
                        projectId,
                        name,
                        description,
                    },
                },
            });
            showToast({ variant: 'success', message: 'Folder created successfully.' });
            setShowListModal(false);
            setListDescription('');
            await refetchTaskLists();
        } catch (error: any) {
            showToast({ variant: 'error', message: error?.message || 'Failed to save folder.' });
        }
    };

    const handleSaveTask = async (data: any) => {
        try {
            const createData = { ...data };
            const draftKey: string | undefined = createData.attachmentDraftKey;
            delete createData.attachmentDraftKey;
            const result = await createTask({
                variables: { input: createData },
            });
            const newId = result?.data?.createTask?.id as string | undefined;
            if (draftKey && newId) {
                try {
                    await finalizeTaskDraft(draftKey, newId);
                } catch (e) {
                    console.warn('Failed to finalize draft attachments', e);
                }
            }
            showToast({ variant: 'success', message: 'Task created successfully.' });
            setTaskModal({ open: false, template: null, folderOptional: false });
            await refetchTasks();
        } catch (error: any) {
            console.error('Error saving task:', error);
            if (error.graphQLErrors?.length > 0) {
                showToast({
                    variant: 'error',
                    message: error.graphQLErrors[0].message || 'Failed to save task.',
                });
            } else if (error.networkError) {
                const result = (error.networkError as any)?.result;
                if (result?.errors) {
                    showToast({
                        variant: 'error',
                        message: result.errors.map((err: any) => err.message).join(', ') || 'Server error.',
                    });
                } else {
                    showToast({
                        variant: 'error',
                        message: error.networkError.message || 'Connection failed.',
                    });
                }
            } else {
                showToast({ variant: 'error', message: error?.message || 'Unknown error.' });
            }
        }
    };

    const openTaskModalForFolder = (listId: string) => {
        if (!projectId) return;
        setTaskModal({ open: true, template: { projectId, listId }, folderOptional: false });
    };

    const openTaskModalFree = () => {
        if (!projectId) return;
        setTaskModal({ open: true, template: null, folderOptional: true });
    };

    useEffect(() => {
        const attachments: any[] = project?.attachments ?? [];
        let cancelled = false;
        const previous = imagePreviewUrls;

        const load = async () => {
            const imageItems = attachments.filter((a) =>
                String(a?.mimeType || '').toLowerCase().startsWith('image/'),
            );
            const next: Record<string, string> = {};
            for (const a of imageItems) {
                try {
                    const objectUrl = await getPreviewObjectUrlWithAuth(
                        projectAttachmentDownloadUrl(a.id),
                    );
                    next[a.id] = objectUrl;
                } catch {}
            }
            if (cancelled) {
                Object.values(next).forEach((u) => URL.revokeObjectURL(u));
                return;
            }
            setImagePreviewUrls(next);
            Object.values(previous).forEach((u) => {
                if (!Object.values(next).includes(u)) URL.revokeObjectURL(u);
            });
        };

        void load();
        return () => {
            cancelled = true;
            Object.values(previous).forEach((u) => URL.revokeObjectURL(u));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project?.id, project?.attachments]);

    useEffect(() => {
        setIsDescriptionExpanded(false);
    }, [project?.id]);

    if (!projectId) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-gray-500 dark:text-gray-400">Invalid project</p>
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

    if (error || !project) {
        return (
            <div className="card text-center py-12">
                <p className="text-red-600 dark:text-red-400 mb-4">
                    {error?.message || 'Project not found'}
                </p>
                <Link
                    href="/dashboard/projects"
                    className="btn-primary inline-flex items-center gap-2"
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                    Back to Projects
                </Link>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6">
                <Link
                    href="/dashboard/projects"
                    className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
                >
                    <ArrowLeftIcon className="h-4 w-4 mr-1" />
                    Back to Projects
                </Link>
            </div>

            <div className="mb-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-primary-100 dark:bg-primary-900/20">
                            <FolderIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {project.name}
                            </h1>
                            <span
                                className={`inline-flex mt-2 px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColors[project.status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
                            >
                                {project.status}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(true)}
                            className="p-2 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="Edit project"
                        >
                            <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete project"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {project.description && (
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                Description
                            </h2>
                            <div className={!isDescriptionExpanded && isLongDescription ? 'relative' : ''}>
                                <div className={!isDescriptionExpanded && isLongDescription ? 'max-h-40 overflow-hidden' : ''}>
                                    <RichTextContent
                                        htmlOrText={project.description}
                                        className="text-gray-700 dark:text-gray-300"
                                    />
                                </div>
                                {!isDescriptionExpanded && isLongDescription && (
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent dark:from-gray-800" />
                                )}
                            </div>
                            {isLongDescription && (
                                <button
                                    type="button"
                                    onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                                    className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                                >
                                    {isDescriptionExpanded ? 'See less' : 'See more'}
                                </button>
                            )}
                        </div>
                    )}

                    {project.attachments && project.attachments.length > 0 && (
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                Attachments ({project.attachments.length})
                            </h2>
                            <ul className="space-y-2">
                                {project.attachments.map((a: any) => (
                                    <li
                                        key={a.id}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2"
                                    >
                                        <div className="min-w-0 flex flex-1 items-center gap-3">
                                            {String(a?.mimeType || '').toLowerCase().startsWith('image/') &&
                                                imagePreviewUrls[a.id] && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openInNewTabWithAuth({
                                                                url: projectAttachmentDownloadUrl(a.id),
                                                            }).catch(() => {
                                                                window.open(
                                                                    projectAttachmentDownloadUrl(a.id),
                                                                    '_blank',
                                                                    'noopener,noreferrer',
                                                                );
                                                            })
                                                        }
                                                        className="shrink-0 overflow-hidden rounded border border-gray-200 dark:border-gray-700"
                                                        title="Open image"
                                                    >
                                                        <img
                                                            src={imagePreviewUrls[a.id]}
                                                            alt={a.originalName}
                                                            className="h-10 w-10 object-cover"
                                                        />
                                                    </button>
                                                )}
                                            <a
                                                href={projectAttachmentDownloadUrl(a.id)}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    openInNewTabWithAuth({
                                                        url: projectAttachmentDownloadUrl(a.id),
                                                    }).catch(() => {
                                                        window.open(
                                                            projectAttachmentDownloadUrl(a.id),
                                                            '_blank',
                                                            'noopener,noreferrer',
                                                        );
                                                    });
                                                }}
                                                className="min-w-0 flex-1 truncate text-sm font-medium text-primary-700 hover:underline dark:text-primary-300"
                                                title={a.originalName}
                                            >
                                                {a.originalName}
                                            </a>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                downloadWithAuth({
                                                    url: projectAttachmentDownloadUrl(a.id),
                                                    filename: a.originalName,
                                                }).catch(() => {
                                                    window.open(projectAttachmentDownloadUrl(a.id), '_blank', 'noopener,noreferrer');
                                                })
                                            }
                                            className="text-xs font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                        >
                                            Download
                                        </button>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAttachment(a.id)}
                                                disabled={deletingAttachmentId === a.id}
                                                className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                {deletingAttachmentId === a.id ? 'Removing…' : 'Remove'}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="card">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Squares2X2Icon className="h-4 w-4" />
                                Folders & Tasks
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setListDescription('');
                                    setShowListModal(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:hover:bg-primary-500"
                            >
                                <PlusIcon className="h-3.5 w-3.5" />
                                Folder
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {tasks.length} total · {openTaskCount} open
                        </p>
                        {tasks.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {taskLists.length === 0
                                    ? 'Create a folder first, then you can add tasks to this project.'
                                    : 'No tasks found for this project.'}
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {taskLists.map((list: any) => {
                                    const folderTasks = tasks.filter((task: any) => task.listId === list.id);

                                    return (
                                        <div
                                            key={list.id}
                                            className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
                                        >
                                            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {list.name}
                                                    </h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => openTaskModalForFolder(list.id)}
                                                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-600 px-2 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 dark:hover:bg-primary-500"
                                                    >
                                                        <PlusIcon className="h-3.5 w-3.5" />
                                                        Task
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-2 space-y-2">
                                                {folderTasks.length === 0 ? (
                                                    <p className="px-1 py-1 text-sm text-gray-500 dark:text-gray-400">
                                                        No tasks in this folder.
                                                    </p>
                                                ) : (
                                                    folderTasks.map((task: any) => (
                                                        <Link
                                                            key={task.id}
                                                            href={`/dashboard/tasks/${task.id}`}
                                                            className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                                        >
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate pr-3">
                                                                {task.title}
                                                            </span>
                                                            <span
                                                                className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                                                                    task.status === 'COMPLETED'
                                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                                        : task.status === 'IN_PROGRESS'
                                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                                                            : task.status === 'REVIEW'
                                                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                                                                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                                }`}
                                                            >
                                                                {task.status?.replace(/_/g, ' ')}
                                                            </span>
                                                        </Link>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {ungroupedTasks.length > 0 && (
                                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                                        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    Without folder
                                                </h3>
                                                {taskLists.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={openTaskModalFree}
                                                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-600 px-2 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 dark:hover:bg-primary-500"
                                                    >
                                                        <PlusIcon className="h-3.5 w-3.5" />
                                                        Task
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-2 space-y-2">
                                            {ungroupedTasks.map((task: any) => (
                                                <Link
                                                    key={task.id}
                                                    href={`/dashboard/tasks/${task.id}`}
                                                    className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                                >
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate pr-3">
                                                        {task.title}
                                                    </span>
                                                    <span
                                                        className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                                                            task.status === 'COMPLETED'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                                : task.status === 'IN_PROGRESS'
                                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                                                    : task.status === 'REVIEW'
                                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                                                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                        }`}
                                                    >
                                                        {task.status?.replace(/_/g, ' ')}
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="card">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                            Details
                        </h2>
                        <dl className="space-y-3">
                            <div className="flex items-center gap-2">
                                <CurrencyDollarIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                <div>
                                    <dt className="text-xs text-gray-500 dark:text-gray-400">Budget</dt>
                                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(project.budget)}
                                    </dd>
                                </div>
                            </div>
                            {project.hourlyRate != null && (
                                <div className="flex items-center gap-2">
                                    <CurrencyDollarIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    <div>
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">Hourly rate</dt>
                                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(project.hourlyRate)}/hr
                                        </dd>
                                    </div>
                                </div>
                            )}
                            {project.clientName && (
                                <div className="flex items-center gap-2">
                                    <UserGroupIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    <div>
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">Client</dt>
                                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                                            {project.clientName}
                                        </dd>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                <div>
                                    <dt className="text-xs text-gray-500 dark:text-gray-400">Timeline</dt>
                                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatDate(project.startDate)}
                                        {project.endDate ? ` – ${formatDate(project.endDate)}` : ''}
                                    </dd>
                                </div>
                            </div>
                            {project.createdBy && (
                                <div className="flex items-center gap-2">
                                    <UserCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                    <div>
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">Created by</dt>
                                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                                            {project.createdBy.name}
                                        </dd>
                                        {project.createdBy.email && (
                                            <dd className="text-xs text-gray-500 dark:text-gray-400">
                                                {project.createdBy.email}
                                            </dd>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">
                                Created {project.createdAt && formatDate(project.createdAt)}
                            </div>
                        </dl>
                    </div>

                    {project.note && (
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <PencilIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                                Note
                            </h2>
                            <RichTextContent
                                htmlOrText={project.note}
                                className="text-gray-700 dark:text-gray-300"
                            />
                        </div>
                    )}
                </div>
            </div>

            <TaskModal
                task={
                    taskModal.open && taskModal.template
                        ? {
                              projectId: taskModal.template.projectId,
                              listId: taskModal.template.listId,
                          }
                        : null
                }
                parentTask={null}
                isOpen={taskModal.open}
                onClose={() => setTaskModal({ open: false, template: null, folderOptional: false })}
                onSave={handleSaveTask}
                projects={project ? [{ id: project.id, name: project.name }] : []}
                users={mentionUsers}
                lists={taskLists}
                createPrefill={taskModalCreatePrefill}
                folderOptional={taskModal.folderOptional}
            />

            {showListModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Create Folder
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowListModal(false);
                                    setListDescription('');
                                }}
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
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <DescriptionRichTextField
                                    label="Description"
                                    value={listDescription}
                                    onChange={setListDescription}
                                    placeholder="Add folder description..."
                                    minHeightClassName="min-h-[120px]"
                                    mentionUsers={mentionUsers}
                                    helperText={
                                        <>
                                            Type{' '}
                                            <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-700">@</kbd> to
                                            mention someone.
                                        </>
                                    }
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowListModal(false);
                                        setListDescription('');
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                                >
                                    Create Folder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <EditProjectModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onProjectUpdated={() => refetch()}
                project={project}
                mentionUsers={mentionUsers}
            />

            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4">
                        <div
                            className="fixed inset-0 bg-black opacity-30"
                            onClick={() => setShowDeleteConfirm(false)}
                        />
                        <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                            <div className="text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                                    <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                                    Delete Project
                                </h3>
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be undone.
                                </div>
                            </div>
                            <div className="mt-6 flex justify-center space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteProject}
                                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
