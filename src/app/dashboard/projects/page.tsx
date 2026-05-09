'use client';

import { useState } from 'react';
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

export default function ProjectsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const { data, loading, refetch } = useQuery(GET_PROJECTS, {
        variables: statusFilter !== 'all' ? { filters: { status: statusFilter } } : {}
    });
    const { data: usersData } = useQuery(GET_USERS);
    const projects = data?.projects || [];
    const mentionUsers = usersData?.users || [];

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
                <>
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All projects</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {projects.map((project: any) => {
                            return (
                                <Link
                                    key={project.id}
                                    href={`/dashboard/projects/${project.id}`}
                                    className="group card hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                <FolderIcon className="h-5 w-5" />
                                            </span>
                                            <div className="min-w-0">
                                                <h4 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                                                    {project.name}
                                                </h4>
                                            </div>
                                        </div>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(project.status)}`}>
                                            {project.status?.replace(/_/g, ' ')}
                                        </span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-2 border-t border-gray-200 dark:border-gray-700 pt-3 text-xs">
                                        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                            <UserGroupIcon className="h-4 w-4" />
                                            <span className="truncate">{project.clientName || 'No client'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                            <CurrencyDollarIcon className="h-4 w-4" />
                                            <span>{formatCurrency(project.budget)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                            <CalendarIcon className="h-4 w-4" />
                                            <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </>
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