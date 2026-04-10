'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { GET_PROJECT, GET_PROJECTS, GET_TASKS, GET_TASK_LISTS, DELETE_PROJECT } from '@/lib/graphql/queries';
import { useToast } from '@/components/ToastProvider';
import {
    ArrowLeftIcon,
    FolderIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    UserCircleIcon,
    ClipboardDocumentListIcon,
    Squares2X2Icon,
    PencilIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import EditProjectModal from '@/components/EditProjectModal';

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

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const { data, loading, error, refetch } = useQuery(GET_PROJECT, {
        variables: { id: projectId },
        skip: !projectId,
    });
    const { data: tasksData } = useQuery(GET_TASKS, {
        variables: { filters: { projectId } },
        skip: !projectId,
    });
    const { data: listsData } = useQuery(GET_TASK_LISTS, {
        variables: { projectId },
        skip: !projectId,
    });
    const [deleteProject] = useMutation(DELETE_PROJECT);

    const project = data?.project;
    const tasks = tasksData?.tasks ?? [];
    const taskLists = listsData?.taskLists ?? [];
    const openTaskCount = tasks.filter((t: any) => t.status !== 'COMPLETED').length;

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
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {project.description}
                            </p>
                        </div>
                    )}

                    {project.note && (
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <PencilIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                                Note
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {project.note}
                            </p>
                        </div>
                    )}

                    <div className="card">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Squares2X2Icon className="h-4 w-4" />
                            Tasks
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {tasks.length} total · {openTaskCount} open
                        </p>
                        <Link
                            href={`/dashboard/tasks?projectId=${projectId}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                        >
                            View tasks
                        </Link>
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

                    {taskLists.length > 0 && (
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <ClipboardDocumentListIcon className="h-4 w-4" />
                                Folders
                            </h2>
                            <ul className="space-y-1">
                                {taskLists.map((list: any) => (
                                    <li key={list.id} className="text-sm text-gray-700 dark:text-gray-300">
                                        {list.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <EditProjectModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onProjectUpdated={() => refetch()}
                project={project}
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
