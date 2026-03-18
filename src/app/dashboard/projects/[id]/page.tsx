'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { GET_PROJECT, GET_TASKS, GET_TASK_LISTS } from '@/lib/graphql/queries';
import {
    ArrowLeftIcon,
    FolderIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    UserCircleIcon,
    ClipboardDocumentListIcon,
    Squares2X2Icon,
} from '@heroicons/react/24/outline';

const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    ON_HOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    PLANNING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};

export default function ProjectDetailsPage() {
    const params = useParams();
    const projectId = params?.id as string;

    const { data, loading, error } = useQuery(GET_PROJECT, {
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
                                Lists
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
        </div>
    );
}
