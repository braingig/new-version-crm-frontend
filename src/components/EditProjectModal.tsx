'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_PROJECT } from '@/lib/graphql/queries';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ToastProvider';
import ModalDropdown from '@/components/ModalDropdown';
import DescriptionRichTextField from '@/components/DescriptionRichTextField';
import { isEmptyRichTextHtml } from '@/lib/richText';
import type { MentionUser } from '@/components/MentionTextarea';
import {
  deleteProjectAttachment,
  openInNewTabWithAuth,
  projectAttachmentDownloadUrl,
  uploadProjectAttachment,
} from '@/lib/attachments';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: () => void;
  project: any;
  mentionUsers?: MentionUser[];
}

interface FormData {
  name: string;
  description: string;
  note: string;
  budget: string;
  hourlyRate: string;
  status: string;
  startDate: string;
  endDate: string;
  clientName: string;
 }

export default function EditProjectModal({ isOpen, onClose, onProjectUpdated, project, mentionUsers = [] }: EditProjectModalProps) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    note: '',
    budget: '',
    hourlyRate: '',
    status: 'PLANNING',
    startDate: '',
    endDate: '',
    clientName: '',
  });

  const [updateProject, { loading, error }] = useMutation(UPDATE_PROJECT);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        note: project.note || '',
        budget: project.budget?.toString() || '',
        hourlyRate: project.hourlyRate?.toString() || '',
        status: project.status || 'PLANNING',
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
        clientName: project.clientName || '',
      });
      setAttachments(project.attachments ?? []);
    }
  }, [project]);

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
    const selected = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (selected.length === 0 || !project?.id) return;
    try {
      setUploading(true);
      const uploaded = await uploadProjectAttachment({
        files: selected,
        projectId: project.id,
      });
      setAttachments((prev) => [
        ...uploaded.map((item) => item.attachment),
        ...prev,
      ]);
      for (const item of uploaded) {
        insertAttachmentLink(item.attachment.originalName, item.url, item.attachment.id);
      }
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || 'Failed to upload attachment.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    if (!window.confirm('Remove this attachment?')) return;
    try {
      await deleteProjectAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      removeAttachmentLinkFromDescription(id);
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || 'Failed to delete attachment.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!project) return;
    if (isEmptyRichTextHtml(formData.description)) {
      showToast({ variant: 'warning', message: 'Project description is required.' });
      return;
    }
    
    try {
      await updateProject({
        variables: {
          id: project.id,
          input: {
            name: formData.name,
            description: formData.description,
            note: formData.note || undefined,
            budget: parseFloat(formData.budget),
            hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : undefined,
            status: formData.status,
            startDate: new Date(formData.startDate),
            endDate: formData.endDate ? new Date(formData.endDate) : undefined,
            clientName: formData.clientName,
          },
        },
      });

      onProjectUpdated();
      showToast({ variant: 'success', message: 'Project updated successfully.' });
      onClose();
    } catch (err) {
      showToast({
        variant: 'error',
        message: (err as any)?.message || 'Failed to update project.',
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 max-h-[90vh]">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-50 via-transparent to-primary-100/40 dark:from-primary-900/20 dark:via-transparent dark:to-primary-800/10" />
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Project
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
                Project Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., E-commerce Website Redesign"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Budget ($) *
              </label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                placeholder="50000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status *
              </label>
              <ModalDropdown
                value={formData.status}
                onChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                options={[
                  { value: 'PLANNING', label: 'Planning' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'ON_HOLD', label: 'On Hold' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client Name
              </label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                placeholder="Acme Corporation"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hourly Rate ($)
              </label>
              <input
                type="number"
                name="hourlyRate"
                value={formData.hourlyRate}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="75"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                min={formData.startDate}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <DescriptionRichTextField
                label="Description"
                required
                value={formData.description}
                onChange={(html) => setFormData((prev) => ({ ...prev, description: html }))}
                placeholder="Describe the project scope, objectives, and deliverables..."
                minHeightClassName="min-h-[160px]"
                mentionUsers={mentionUsers}
                helperText={
                  <>
                    Type <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-700">@</kbd> to mention someone.
                  </>
                }
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <button
                  type="button"
                  onClick={handlePickFile}
                  disabled={uploading}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {uploading ? 'Uploading…' : 'Attach files'}
                </button>
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
                          href={projectAttachmentDownloadUrl(a.id)}
                          onClick={(e) => {
                            e.preventDefault();
                            openInNewTabWithAuth({ url: projectAttachmentDownloadUrl(a.id) }).catch(() => {
                              window.open(projectAttachmentDownloadUrl(a.id), '_blank', 'noopener,noreferrer');
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

            <div className="md:col-span-2">
              <DescriptionRichTextField
                label="Note"
                value={formData.note}
                onChange={(html) => setFormData((prev) => ({ ...prev, note: html }))}
                placeholder="Add any extra context for this project..."
                minHeightClassName="min-h-[120px]"
                mentionUsers={mentionUsers}
                helperText={
                  <>
                    Type <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-700">@</kbd> to mention someone.
                  </>
                }
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
              {loading ? 'Updating...' : 'Update Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
