'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_USER } from '@/lib/graphql/queries';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface EditEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEmployeeUpdated: () => void;
    employee: any;
}

interface FormData {
    name: string;
    email: string;
    phone: string;
    department: string;
    skills: string;
    salaryType: string;
    salaryAmount: string;
    status: string;
}

export default function EditEmployeeModal({ isOpen, onClose, onEmployeeUpdated, employee }: EditEmployeeModalProps) {
    const [formData, setFormData] = useState<FormData>({
        name: '',
        email: '',
        phone: '',
        department: '',
        skills: '',
        salaryType: 'FIXED',
        salaryAmount: '',
        status: 'ACTIVE',
    });

    const [updateMutation, { loading, error }] = useMutation(UPDATE_USER);

    useEffect(() => {
        if (employee) {
            setFormData({
                name: employee.name || '',
                email: employee.email || '',
                phone: employee.phone || '',
                department: employee.department || '',
                skills: employee.skills ? employee.skills.join(', ') : '',
                salaryType: employee.salaryType || 'FIXED',
                salaryAmount: employee.salaryAmount?.toString() || '',
                status: employee.status || 'ACTIVE',
            });
        }
    }, [employee]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            await updateMutation({
                variables: {
                    id: employee.id,
                    input: {
                        name: formData.name,
                        email: formData.email || undefined,
                        phone: formData.phone || undefined,
                        department: formData.department || undefined,
                        skills: formData.skills ? formData.skills.split(',').map(skill => skill.trim()) : undefined,
                        salaryType: formData.salaryType,
                        salaryAmount: parseFloat(formData.salaryAmount),
                        status: formData.status,
                    },
                },
            });

            onEmployeeUpdated();
            onClose();
        } catch (err) {
            // Error handled by error state
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black opacity-30" onClick={onClose}></div>
                
                <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>

                    <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
                        Edit Employee
                    </h2>

                    {error && (
                        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                            {error.message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Phone
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Department
                            </label>
                            <input
                                type="text"
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Skills (comma-separated)
                            </label>
                            <textarea
                                name="skills"
                                value={formData.skills}
                                onChange={handleChange}
                                rows={3}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Salary Type
                            </label>
                            <select
                                name="salaryType"
                                value={formData.salaryType}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="FIXED">Fixed</option>
                                <option value="HOURLY">Hourly</option>
                                <option value="CONTRACT">Contract</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Salary Amount
                            </label>
                            <input
                                type="number"
                                name="salaryAmount"
                                value={formData.salaryAmount}
                                onChange={handleChange}
                                required
                                step="0.01"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Status
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary"
                            >
                                {loading ? 'Updating...' : 'Update Employee'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}