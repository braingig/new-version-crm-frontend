'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_PROJECTS, CREATE_PROJECT, DELETE_PROJECT } from '@/lib/graphql/queries';
import { 
    FolderIcon, 
    PlusIcon, 
    PencilIcon, 
    TrashIcon, 
    CalendarIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    ClockIcon
} from '@heroicons/react/24/outline';
import AddProjectModal from '@/components/AddProjectModal';
import EditProjectModal from '@/components/EditProjectModal';

export default function ProjectsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; projectId: string; projectName: string }>({
        show: false,
        projectId: '',
        projectName: ''
    });
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const { data, loading, refetch } = useQuery(GET_PROJECTS, {
        variables: statusFilter !== 'all' ? { filters: { status: statusFilter } } : {}
    });
    const [deleteProject] = useMutation(DELETE_PROJECT);

    const projects = data?.projects || [];

    const handleProjectAdded = () => {
        refetch();
    };

    const handleProjectUpdated = () => {
        refetch();
    };

    const openEditModal = (project: any) => {
        setSelectedProject(project);
        setIsEditModalOpen(true);
    };

    const openDeleteConfirm = (project: any) => {
        setDeleteConfirm({
            show: true,
            projectId: project.id,
            projectName: project.name
        });
    };

    const handleDelete = async () => {
        try {
            await deleteProject({
                variables: { id: deleteConfirm.projectId }
            });
            refetch();
            setDeleteConfirm({ show: false, projectId: '', projectName: '' });
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const cancelDelete = () => {
        setDeleteConfirm({ show: false, projectId: '', projectName: '' });
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
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-colors ${
                            viewMode === 'grid'
                                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        <FolderIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded-lg transition-colors ${
                            viewMode === 'table'
                                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        <ClockIcon className="h-5 w-5" />
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
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project: any) => (
                        <div key={project.id} className="card hover:shadow-lg transition-shadow">
                            <div className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                            {project.name}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                                            {project.description}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                                        {project.status}
                                    </span>
                                </div>
                                
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                        <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                                        {formatCurrency(project.budget)}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                        <UserGroupIcon className="h-4 w-4 mr-2" />
                                        {project.clientName}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                        <CalendarIcon className="h-4 w-4 mr-2" />
                                        {formatDate(project.startDate)} - {formatDate(project.endDate)}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Created {formatDate(project.createdAt)}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(project)}
                                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                        >
                                            <PencilIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => openDeleteConfirm(project)}
                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Project
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Client
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Budget
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Timeline
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {projects.map((project: any) => (
                                    <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {project.name}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                                                    {project.description}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                            {project.clientName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                            {formatCurrency(project.budget)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(project.status)}`}>
                                                {project.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                            {formatDate(project.startDate)} - {formatDate(project.endDate)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                                                onClick={() => openEditModal(project)}
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                onClick={() => openDeleteConfirm(project)}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <AddProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onProjectAdded={handleProjectAdded}
            />
            <EditProjectModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onProjectUpdated={handleProjectUpdated}
                project={selectedProject}
            />

            {/* Delete Confirmation Modal */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black opacity-30" onClick={cancelDelete}></div>
                        
                        <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                            <div className="text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                                    <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                                    Delete Project
                                </h3>
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    Are you sure you want to delete <strong>{deleteConfirm.projectName}</strong>? This action cannot be undone.
                                </div>
                            </div>
                            <div className="mt-6 flex justify-center space-x-3">
                                <button
                                    type="button"
                                    onClick={cancelDelete}
                                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
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