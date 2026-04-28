'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import type { MentionUser } from '@/components/MentionTextarea';
import RichTextEditor from '@/components/RichTextEditor';
import ModalDropdown from '@/components/ModalDropdown';
import DescriptionRichTextField from '@/components/DescriptionRichTextField';
import { isEmptyRichTextHtml } from '@/lib/richText';
import {
    deleteTaskAttachment,
    openInNewTabWithAuth,
    taskAttachmentDownloadUrl,
    uploadTaskAttachment,
} from '@/lib/attachments';

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
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [draftKey] = useState(() => {
        // Stable per-modal session so uploads during create can be finalized after createTask.
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    });
    const [attachments, setAttachments] = useState<any[]>([]);
    const removeAttachmentLinkFromDescription = (attachmentId: string) => {
        setFormData((prev) => ({
            ...prev,
            description: (prev.description || '').replace(
                new RegExp(
                    `<p>\\s*<a[^>]*data-attachment-id=["']${attachmentId}["'][^>]*>[\\s\\S]*?<\\/a>\\s*<\\/p>`,
                    'gi',
                ),
                '',
            ),
        }));
    };
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
            setAttachments(task.attachments ?? []);
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
            setAttachments([]);
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
            setAttachments([]);
        }
    }, [task, parentTask, isOpen]);

    const attachmentOwner = useMemo(() => {
        if (task?.id) return { taskId: task.id as string };
        return { draftKey };
    }, [task?.id, draftKey]);

    const insertAttachmentLink = (name: string, url: string, id: string) => {
        const safeName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<p><a href="${url}" data-attachment-id="${id}" target="_blank" rel="noopener noreferrer">📎 ${safeName}</a></p>`;
        setFormData((prev) => ({
            ...prev,
            description: prev.description && !isEmptyRichTextHtml(prev.description)
                ? `${prev.description}${html}`
                : html,
        }));
    };

    const handlePickFile = () => fileInputRef.current?.click();

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
            setUploading(true);
            const { attachment, url } = await uploadTaskAttachment({
                file: f,
                taskId: (attachmentOwner as any).taskId,
                draftKey: (attachmentOwner as any).draftKey,
            });
            setAttachments((prev) => [attachment, ...prev]);
            insertAttachmentLink(attachment.originalName, url, attachment.id);
        } catch (err: any) {
            alert(err?.message || 'Failed to upload attachment');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAttachment = async (id: string) => {
        if (!window.confirm('Remove this attachment?')) return;
        try {
            await deleteTaskAttachment(id);
            setAttachments((prev) => prev.filter((a) => a.id !== id));
            removeAttachmentLinkFromDescription(id);
        } catch (err: any) {
            alert(err?.message || 'Failed to delete attachment');
        }
    };

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
            description: !isEmptyRichTextHtml(formData.description)
                ? formData.description
                : undefined,
            note: !isEmptyRichTextHtml(formData.note) ? formData.note : undefined,
            priority: formData.priority,
            projectId: formData.projectId || parentTask?.projectId,
            estimatedTime: formData.estimatedTime ? Math.round(parseFloat(formData.estimatedTime) * 60) : undefined,
        };
        if (!task?.id) {
            // Used to finalize draft uploads after the task is created.
            submitData.attachmentDraftKey = draftKey;
        }
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Description
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Rich text: headings, lists, links, colors, and more. Type{' '}
                            <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-700">@</kbd> in this
                            description or in the note below to mention someone.
                        </p>
                        <RichTextEditor
                            key={task?.id ? `edit-${task.id}` : parentTask ? `sub-${parentTask.id}` : 'create'}
                            value={formData.description}
                            onChange={(html) => setFormData({ ...formData, description: html })}
                            placeholder="Describe the task in detail…"
                            minHeightClassName="min-h-[220px]"
                            mentionUsers={users as MentionUser[]}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileSelected}
                            />
                            <button
                                type="button"
                                onClick={handlePickFile}
                                disabled={uploading}
                                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                {uploading ? 'Uploading…' : 'Attach file'}
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Files are stored securely and linked in this description.
                            </span>
                        </div>
                        {attachments.length > 0 && (
                            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                                <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                                    Attachments ({attachments.length})
                                </div>
                                <ul className="space-y-1.5">
                                    {attachments.map((a: any) => (
                                        <li key={a.id} className="flex items-center justify-between gap-3">
                                            <a
                                                href={taskAttachmentDownloadUrl(a.id)}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    openInNewTabWithAuth({ url: taskAttachmentDownloadUrl(a.id) }).catch(() => {
                                                        window.open(taskAttachmentDownloadUrl(a.id), '_blank', 'noopener,noreferrer');
                                                    });
                                                }}
                                                className="truncate text-xs font-medium text-primary-700 hover:underline dark:text-primary-300"
                                                title={a.originalName}
                                            >
                                                {a.originalName}
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteAttachment(a.id)}
                                                className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <div>
                        <DescriptionRichTextField
                            label="Note"
                            value={formData.note}
                            onChange={(html) => setFormData({ ...formData, note: html })}
                            placeholder="Quick note… Type @ to mention someone."
                            minHeightClassName="min-h-[120px]"
                            mentionUsers={users as MentionUser[]}
                            helperText={
                                <>
                                    Type <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-700">@</kbd> to mention someone.
                                </>
                            }
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
