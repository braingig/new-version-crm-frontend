'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import { MentionTextarea } from '@/components/MentionTextarea';
import ModalDropdown from '@/components/ModalDropdown';

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
    const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        note: '',
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
                note: task.note || '',
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
                note: '',
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
                note: '',
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
                alert('Folder is required');
                return;
            }
        }
        const submitData: any = {
            title: formData.title.trim(),
            description: formData.description.trim() || undefined,
            note: formData.note.trim() || undefined,
            priority: formData.priority,
            projectId: formData.projectId || parentTask?.projectId,
            estimatedTime: formData.estimatedTime ? Math.round(parseFloat(formData.estimatedTime) * 60) : undefined,
        };
        if (formData.listId) submitData.listId = formData.listId;
        if (formData.assignedToId) submitData.assignedToId = formData.assignedToId;
        if (task?.id) {
            // On edit, always send assigneeIds so [] can explicitly clear assignments.
            submitData.assigneeIds = formData.assigneeIds;
            if (formData.assigneeIds.length > 0 && !submitData.assignedToId) {
                submitData.assignedToId = formData.assigneeIds[0];
            }
        } else {
            // Create: always send assigneeIds when anyone is assigned so the API runs
            // taskAssignee rows + assignment notifications in one consistent path.
            const ids =
                formData.assigneeIds?.length > 0
                    ? formData.assigneeIds
                    : formData.assignedToId
                      ? [formData.assignedToId]
                      : [];
            if (ids.length > 0) {
                submitData.assigneeIds = ids;
                if (!submitData.assignedToId) {
                    submitData.assignedToId = ids[0];
                }
            }
        }
        if (formData.dueDate) {
            const dueDate = new Date(formData.dueDate);
            if (!isNaN(dueDate.getTime())) submitData.dueDate = dueDate;
        }
        onSave(submitData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 max-h-[90vh] flex flex-col">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-50 via-transparent to-primary-100/40 dark:from-primary-900/20 dark:via-transparent dark:to-primary-800/10" />
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {task?.id ? 'Edit Task' : parentTask ? 'Add Subtask' : 'Create New Task'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-6 py-5">
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
                        <MentionTextarea
                            users={users}
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            rows={3}
                            placeholder="Type @ for people — picks their name so they get notified."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
                        <MentionTextarea
                            users={users}
                            value={formData.note}
                            onChange={(e) =>
                                setFormData({ ...formData, note: e.target.value })
                            }
                            rows={2}
                            placeholder="Quick note… Type @ to mention someone."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                            <ModalDropdown
                                value={formData.priority}
                                onChange={(v) => setFormData({ ...formData, priority: v })}
                                options={[
                                    { value: 'LOW', label: 'Low' },
                                    { value: 'MEDIUM', label: 'Medium' },
                                    { value: 'HIGH', label: 'High' },
                                    { value: 'URGENT', label: 'Urgent' },
                                ]}
                            />
                        </div>
                        {parentTask ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent</label>
                                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300">
                                    {parentTask.title}
                                </div>
                            </div>
                        ) : task ? (
                            /* Edit or "add to folder": show Project and Folder read-only so fake filler cannot change them */
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder</label>
                                    <div
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm"
                                        aria-readonly="true"
                                    >
                                        {formData.listId
                                            ? lists.find((l: any) => l.id === formData.listId)?.name ?? '—'
                                            : 'No folder'}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project *</label>
                                    <ModalDropdown
                                        value={formData.projectId}
                                        onChange={(v) => setFormData({ ...formData, projectId: v, listId: '' })}
                                        placeholder="Select Project"
                                        options={projects.map((project: any) => ({
                                            value: project.id,
                                            label: project.name,
                                        }))}
                                    />
                                </div>
                                <div className="mt-3">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Folder *
                                    </label>
                                    <ModalDropdown
                                        value={formData.listId}
                                        onChange={(v) => setFormData({ ...formData, listId: v })}
                                        placeholder="Select Folder"
                                        options={lists
                                            .filter((list: any) => !formData.projectId || list.projectId === formData.projectId)
                                            .map((list: any) => ({
                                                value: list.id,
                                                label: list.name,
                                            }))}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Assignees
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setAssigneeDropdownOpen((prev) => !prev)}
                                    className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-left text-sm text-gray-900 dark:text-white"
                                >
                                    <span>
                                        {formData.assigneeIds.length > 0
                                            ? `${formData.assigneeIds.length} selected`
                                            : 'Select assignees'}
                                    </span>
                                    <ChevronDownIcon
                                        className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ease-out ${
                                            assigneeDropdownOpen ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                <div
                                    className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 grid grid-cols-1 sm:grid-cols-2 gap-2 border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700 shadow-lg max-h-56 overflow-y-auto origin-top transition-all duration-200 ease-out ${
                                        assigneeDropdownOpen
                                            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                                            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                                    }`}
                                >
                                    {users.map((user: any) => {
                                        const checked = formData.assigneeIds.includes(user.id);
                                        return (
                                            <label
                                                key={user.id}
                                                className={`flex items-center gap-2 cursor-pointer rounded-md px-2.5 py-2 border transition-colors ${
                                                    checked
                                                        ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                                                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/60'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        const nextIds = isChecked
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
                                                <span className="text-sm text-gray-900 dark:text-white truncate">{user.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
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
