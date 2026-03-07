'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function TaskModal({
    task,
    parentTask,
    isOpen,
    onClose,
    onSave,
    projects,
    users,
    lists,
}: {
    task: any | null;
    parentTask: { id: string; projectId: string; title: string } | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    projects: any[];
    users: any[];
    lists: any[];
}) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        projectId: '',
        listId: '',
        assignedToId: '',
        assigneeIds: [] as string[],
        dueDate: '',
        estimatedTime: '',
    });

    useEffect(() => {
        if (task) {
            const ids = task.assignees?.length
                ? task.assignees.map((a: any) => a.id)
                : task.assignedToId
                    ? [task.assignedToId]
                    : [];
            setFormData({
                title: task.title || '',
                description: task.description || '',
                priority: task.priority || 'MEDIUM',
                projectId: task.projectId || (task.project?.id ?? ''),
                listId: task.listId || '',
                assignedToId: task.assignedToId || '',
                assigneeIds: ids,
                dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
                estimatedTime: task.estimatedTime != null ? parseFloat((task.estimatedTime / 60).toFixed(2)).toString() : '',
            });
        } else if (parentTask) {
            setFormData({
                title: '',
                description: '',
                priority: 'MEDIUM',
                projectId: parentTask.projectId,
                listId: '',
                assignedToId: '',
                assigneeIds: [],
                dueDate: '',
                estimatedTime: '',
            });
        } else {
            setFormData({
                title: '',
                description: '',
                priority: 'MEDIUM',
                projectId: '',
                listId: '',
                assignedToId: '',
                assigneeIds: [],
                dueDate: '',
                estimatedTime: '',
            });
        }
    }, [task, parentTask, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            alert('Title is required');
            return;
        }
        if (!parentTask) {
            if (!formData.projectId) {
                alert('Project is required');
                return;
            }
            if (!formData.listId) {
                alert('List is required');
                return;
            }
        }
        const submitData: any = {
            title: formData.title.trim(),
            description: formData.description.trim() || undefined,
            priority: formData.priority,
            projectId: formData.projectId || parentTask?.projectId,
            estimatedTime: formData.estimatedTime ? Math.round(parseFloat(formData.estimatedTime) * 60) : undefined,
        };
        if (formData.listId) submitData.listId = formData.listId;
        if (formData.assignedToId) submitData.assignedToId = formData.assignedToId;
        if (formData.assigneeIds?.length) {
            submitData.assigneeIds = formData.assigneeIds;
            if (!submitData.assignedToId) submitData.assignedToId = formData.assigneeIds[0];
        }
        if (formData.dueDate) {
            const dueDate = new Date(formData.dueDate);
            if (!isNaN(dueDate.getTime())) submitData.dueDate = dueDate;
        }
        onSave(submitData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {task?.id ? 'Edit Task' : parentTask ? 'Add Subtask' : 'Create New Task'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                        {parentTask ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent</label>
                                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300">
                                    {parentTask.title}
                                </div>
                            </div>
                        ) : task ? (
                            /* Edit or "add to list": show Project and List read-only so fake filler cannot change them */
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project</label>
                                    <div
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm"
                                        aria-readonly="true"
                                    >
                                        {projects.find((p: any) => p.id === formData.projectId)?.name ?? '—'}
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">List</label>
                                    <div
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm"
                                        aria-readonly="true"
                                    >
                                        {formData.listId
                                            ? lists.find((l: any) => l.id === formData.listId)?.name ?? '—'
                                            : 'No list'}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project *</label>
                                    <select
                                        required
                                        value={formData.projectId}
                                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value, listId: '' })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        autoComplete="off"
                                        data-form-type="other"
                                    >
                                        <option value="">Select Project</option>
                                        {projects.map((project: any) => (
                                            <option key={project.id} value={project.id}>{project.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mt-3">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        List *
                                    </label>
                                    <select
                                        required
                                        value={formData.listId}
                                        onChange={(e) => setFormData({ ...formData, listId: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        autoComplete="off"
                                        data-form-type="other"
                                    >
                                        <option value="">Select List</option>
                                        {lists
                                            .filter((list: any) => !formData.projectId || list.projectId === formData.projectId)
                                            .map((list: any) => (
                                                <option key={list.id} value={list.id}>{list.name}</option>
                                            ))}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Assignees
                            </label>
                            <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 space-y-2">
                                {users.map((user: any) => (
                                    <label
                                        key={user.id}
                                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600/50 rounded px-2 py-1 -mx-2"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.assigneeIds.includes(user.id)}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                const nextIds = checked
                                                    ? [...formData.assigneeIds, user.id]
                                                    : formData.assigneeIds.filter((id) => id !== user.id);
                                                setFormData({
                                                    ...formData,
                                                    assigneeIds: nextIds,
                                                    assignedToId: nextIds[0] || '',
                                                });
                                            }}
                                            className="rounded border-gray-300 dark:border-gray-500 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span className="text-sm text-gray-900 dark:text-white">{user.name}</span>
                                    </label>
                                ))}
                            </div>
                            {formData.assigneeIds.length > 0 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {formData.assigneeIds.length} selected
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Time (hours)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="e.g. 1.5 for 1h 30m"
                            value={formData.estimatedTime}
                            onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700">
                            {task?.id ? 'Update' : parentTask ? 'Add Subtask' : 'Create'} Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
