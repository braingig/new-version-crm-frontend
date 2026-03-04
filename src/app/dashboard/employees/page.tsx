'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USERS, DELETE_USER } from '@/lib/graphql/queries';
import { UserGroupIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import AddEmployeeModal from '@/components/AddEmployeeModal';
import EditEmployeeModal from '@/components/EditEmployeeModal';

export default function EmployeesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; employeeId: string; employeeName: string }>({
        show: false,
        employeeId: '',
        employeeName: ''
    });
    const { data, loading, refetch } = useQuery(GET_USERS);
    const [deleteUser] = useMutation(DELETE_USER);

    const users = data?.users || [];

    const handleEmployeeAdded = () => {
        refetch();
    };

    const handleEmployeeUpdated = () => {
        refetch();
    };

    const openEditModal = (employee: any) => {
        setSelectedEmployee(employee);
        setIsEditModalOpen(true);
    };

    const openDeleteConfirm = (employee: any) => {
        setDeleteConfirm({
            show: true,
            employeeId: employee.id,
            employeeName: employee.name
        });
    };

    const handleDelete = async () => {
        try {
            await deleteUser({
                variables: { id: deleteConfirm.employeeId }
            });
            refetch();
            setDeleteConfirm({ show: false, employeeId: '', employeeName: '' });
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const cancelDelete = () => {
        setDeleteConfirm({ show: false, employeeId: '', employeeName: '' });
    };

    return (
        <div>
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Employees</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Manage your team members and their information
                    </p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="btn-primary"
                >
                    <UserGroupIcon className="h-5 w-5 mr-2 inline" />
                    Add Employee
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Department
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {users.map((user: any) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {user.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                {user.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                            {user.department || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'ACTIVE'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                                    }`}
                                            >
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3"
                                                onClick={() => openEditModal(user)}
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                onClick={() => openDeleteConfirm(user)}
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

            <AddEmployeeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onEmployeeAdded={handleEmployeeAdded}
            />
            <EditEmployeeModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onEmployeeUpdated={handleEmployeeUpdated}
                employee={selectedEmployee}
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
                                    Delete Employee
                                </h3>
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    Are you sure you want to delete <strong>{deleteConfirm.employeeName}</strong>? This action cannot be undone.
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
