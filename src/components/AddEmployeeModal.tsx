'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { REGISTER_MUTATION } from '@/lib/graphql/queries';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ToastProvider';
import ModalDropdown from '@/components/ModalDropdown';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmployeeAdded: () => void;
}

interface FormData {
  email: string;
  password: string;
  name: string;
  role: string;
  phone: string;
  department: string;
  skills: string;
  salaryType: string;
  salaryAmount: string;
  joiningDate: string;
}

export default function AddEmployeeModal({ isOpen, onClose, onEmployeeAdded }: AddEmployeeModalProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    name: '',
    role: 'DEVELOPER',
    phone: '',
    department: '',
    skills: '',
    salaryType: 'FIXED',
    salaryAmount: '',
    joiningDate: new Date().toISOString().split('T')[0],
  });

  const [registerMutation, { loading, error }] = useMutation(REGISTER_MUTATION);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await registerMutation({
        variables: {
          input: {
            ...formData,
            skills: formData.skills ? formData.skills.split(',').map(skill => skill.trim()) : [],
            salaryType: formData.salaryType || undefined,
            salaryAmount: formData.salaryAmount ? parseFloat(formData.salaryAmount) : undefined,
            joiningDate: new Date(formData.joiningDate),
          },
        },
      });

      // Reset form
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'DEVELOPER',
        phone: '',
        department: '',
        skills: '',
        salaryType: 'FIXED',
        salaryAmount: '',
        joiningDate: new Date().toISOString().split('T')[0],
      });

      onEmployeeAdded();
      showToast({ variant: 'success', message: 'Employee added successfully.' });
      onClose();
    } catch (err) {
      showToast({
        variant: 'error',
        message: (err as any)?.message || 'Failed to add employee.',
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 max-h-[90vh]">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-50 via-transparent to-primary-100/40 dark:from-primary-900/20 dark:via-transparent dark:to-primary-800/10" />
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add New Employee
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">
              {error.message}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-6 py-5 max-h-[calc(90vh-72px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role *
              </label>
              <ModalDropdown
                value={formData.role}
                onChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                options={[
                  { value: 'ADMIN', label: 'Admin' },
                  { value: 'HR', label: 'HR' },
                  { value: 'TEAM_LEAD', label: 'Team Lead' },
                  { value: 'DEVELOPER', label: 'Developer' },
                  { value: 'SALES', label: 'Sales' },
                  { value: 'SEO_EXPERT', label: 'SEO Expert' },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Department
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Salary Type
              </label>
              <ModalDropdown
                value={formData.salaryType}
                onChange={(value) => setFormData(prev => ({ ...prev, salaryType: value }))}
                options={[
                  { value: 'FIXED', label: 'Fixed' },
                  { value: 'HOURLY', label: 'Hourly' },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Salary Amount
              </label>
              <input
                type="number"
                name="salaryAmount"
                value={formData.salaryAmount}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Joining Date *
              </label>
              <input
                type="date"
                name="joiningDate"
                value={formData.joiningDate}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skills (comma-separated)
              </label>
              <input
                type="text"
                name="skills"
                value={formData.skills}
                onChange={handleChange}
                placeholder="React, TypeScript, Node.js"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
