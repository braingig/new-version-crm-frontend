'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_USER, CHANGE_USER_PASSWORD } from '@/lib/graphql/queries';
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
    password: string;
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
        password: '',
    });

    const [updateMutation, { loading, error }] = useMutation(UPDATE_USER);
    const [changePasswordMutation, { loading: changingPassword }] = useMutation(CHANGE_USER_PASSWORD);

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
                password: '',
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

        const trimmedSalary = formData.salaryAmount.toString().trim();

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
                        salaryType: trimmedSalary ? formData.salaryType : undefined,
                        salaryAmount: trimmedSalary ? parseFloat(trimmedSalary) : undefined,
                        status: formData.status,
                    },
                },
            });

            if (formData.password) {
                await changePasswordMutation({
                    variables: {
                        id: employee.id,
                        newPassword: formData.password,
                    },
                });
            }

            onEmployeeUpdated();
            onClose();
        } catch (err) {
            // Error handled by error state
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-50 via-transparent to-primary-100/40 dark:from-primary-900/20 dark:via-transparent dark:to-primary-800/10" />

                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                            Employee Profile
                        </p>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Edit Employee
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>

                {error && (
                    <div className="mx-6 mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                        {error.message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-5 pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Password
                                <span className="ml-1 text-[11px] font-normal lowercase text-gray-400 dark:text-gray-500">
                                    (leave blank to keep current)
                                </span>
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                autoComplete="new-password"
                                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Phone
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Department
                            </label>
                            <input
                                type="text"
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Status
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Salary Type
                            </label>
                            <select
                                name="salaryType"
                                value={formData.salaryType}
                                onChange={handleChange}
                                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
                            >
                                <option value="FIXED">Fixed</option>
                                <option value="HOURLY">Hourly</option>
                                <option value="CONTRACT">Contract</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Salary Amount
                            </label>
                            <input
                                type="number"
                                name="salaryAmount"
                                value={formData.salaryAmount}
                                onChange={handleChange}
                                step="0.01"
                                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Skills
                            <span className="ml-1 text-[11px] font-normal lowercase text-gray-400 dark:text-gray-500">
                                (comma-separated)
                            </span>
                        </label>
                        <textarea
                            name="skills"
                            value={formData.skills}
                            onChange={handleChange}
                            rows={3}
                            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-900/40"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || changingPassword}
                            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
                        >
                            {loading || changingPassword ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}