'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { GET_PROJECTS, GET_USERS } from '@/lib/graphql/queries';
import { 
    FolderIcon, 
    PlusIcon, 
    CalendarIcon,
    CurrencyDollarIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';
import AddProjectModal from '@/components/AddProjectModal';
import { RichTextContent } from '@/components/RichTextContent';
import { htmlToPlainText } from '@/lib/richText';

export default function ProjectsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    const { data, loading, refetch } = useQuery(GET_PROJECTS, {
        variables: statusFilter !== 'all' ? { filters: { status: statusFilter } } : {}
    });
    const { data: usersData } = useQuery(GET_USERS);
    const projects = data?.projects || [];
    const mentionUsers = usersData?.users || [];
    const selectedProject = projects.find((project: any) => project.id === selectedProjectId) || projects[0];

    useEffect(() => {
        if (projects.length === 0) {
            setSelectedProjectId('');
            return;
        }

        const selectedStillExists = projects.some((project: any) => project.id === selectedProjectId);
        if (!selectedStillExists) {
            setSelectedProjectId(projects[0].id);
        }
    }, [projects, selectedProjectId]);

    const handleProjectAdded = () => {
        refetch();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
            case 'COMPLETED':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
            case 'ON_HOLD':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
            case 'CANCELLED':
                return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const descriptionPreview = selectedProject?.description
        ? htmlToPlainText(selectedProject.description)
        : '';
    const isDescriptionLong = descriptionPreview.length > 280;

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Manage your tech agency projects and track their progress
                    </p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="btn-primary"
                >
                    <PlusIcon className="h-5 w-5 mr-2 inline" />
                    New Project
                </button>
            </div>

            {/* Filters and View Options */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            statusFilter === 'all'
                                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                        All Projects
                    </button>
                    <button
                        onClick={() => setStatusFilter('ACTIVE')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            statusFilter === 'ACTIVE'
                                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setStatusFilter('COMPLETED')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            statusFilter === 'COMPLETED'
                                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                        Completed
                    </button>
                    <button
                        onClick={() => setStatusFilter('ON_HOLD')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            statusFilter === 'ON_HOLD'
                                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                        On Hold
                    </button>
                </div>
            </div>

            {projects.length === 0 ? (
                <div className="text-center py-12">
                    <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No projects</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Get started by creating a new project.
                    </p>
                    <div className="mt-6">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="btn-primary"
                        >
                            <PlusIcon className="h-5 w-5 mr-2 inline" />
                            New Project
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4">
                    <div className="card overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Projects</h3>
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto">
                            {projects.map((project: any) => {
                                const isActive = selectedProject?.id === project.id;
                                return (
                                    <button
                                        key={project.id}
                                        type="button"
                                        onClick={() => setSelectedProjectId(project.id)}
                                        className={`w-full border-b border-gray-100 dark:border-gray-700 px-4 py-3 text-left transition-colors ${
                                            isActive
                                                ? 'bg-primary-50 dark:bg-primary-900/20'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                                        }`}
                                    >
                                        <p className={`text-sm font-medium ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                                            {project.name}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {project.clientName}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {selectedProject ? (
                        <div className="card">
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/dashboard/projects/${selectedProject.id}`}
                                                className="text-xl font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                                            >
                                                {selectedProject.name}
                                            </Link>
                                            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedProject.status)}`}>
                                                {selectedProject.status}
                                            </span>
                                        </div>
                                        <div className="mt-3">
                                            {isDescriptionLong ? (
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {descriptionPreview.slice(0, 280).trim()}...
                                                    <Link
                                                        href={`/dashboard/projects/${selectedProject.id}`}
                                                        className="ml-1 font-medium text-primary-600 dark:text-primary-400 hover:underline"
                                                    >
                                                        See more
                                                    </Link>
                                                </p>
                                            ) : (
                                                <RichTextContent
                                                    htmlOrText={selectedProject.description}
                                                    className="text-sm text-gray-600 dark:text-gray-400"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <Link
                                        href={`/dashboard/projects/${selectedProject.id}`}
                                        className="inline-flex shrink-0 items-center rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                                    >
                                        Open Details
                                    </Link>
                                </div>

                                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                            <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                                            Budget
                                        </div>
                                        <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                                            {formatCurrency(selectedProject.budget)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                            <UserGroupIcon className="h-4 w-4 mr-2" />
                                            Client
                                        </div>
                                        <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                                            {selectedProject.clientName}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
                                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                            <CalendarIcon className="h-4 w-4 mr-2" />
                                            Timeline
                                        </div>
                                        <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                                            {formatDate(selectedProject.startDate)} - {formatDate(selectedProject.endDate)}
                                        </p>
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            Created {formatDate(selectedProject.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            )}

            <AddProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onProjectAdded={handleProjectAdded}
                mentionUsers={mentionUsers}
            />
        </div>
    );
}