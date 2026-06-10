'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { format, parseISO } from 'date-fns';
import {
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  CREATE_MEETING,
  DELETE_MEETING,
  GET_GOOGLE_CALENDAR_STATUS,
  GET_USERS,
  UPDATE_MEETING,
} from '@/lib/graphql/queries';
import { useToast } from '@/components/ToastProvider';
import { isHttpUrl } from '@/lib/isHttpUrl';

export interface MeetingFormData {
  id?: string;
  title: string;
  description: string;
  projectId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  assigneeIds: string[];
}

interface MeetingModalProps {
  isOpen: boolean;
  meeting: MeetingFormData | null;
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
  initialDate?: Date;
  onClose: () => void;
  onSaved: () => void;
}

function defaultFormValues(date: Date, projectId = ''): MeetingFormData {
  return {
    title: '',
    description: '',
    projectId,
    date: format(date, 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    location: '',
    assigneeIds: [],
  };
}

function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export default function MeetingModal({
  isOpen,
  meeting,
  projects,
  defaultProjectId = '',
  initialDate,
  onClose,
  onSaved,
}: MeetingModalProps) {
  const { showToast } = useToast();
  const isEditing = Boolean(meeting?.id);
  const [formData, setFormData] = useState<MeetingFormData>(() =>
    defaultFormValues(new Date(), defaultProjectId),
  );
  const [generateMeetLink, setGenerateMeetLink] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);

  const { data: googleStatusData } = useQuery(GET_GOOGLE_CALENDAR_STATUS, {
    skip: !isOpen,
    fetchPolicy: 'network-only',
  });

  const { data: usersData } = useQuery(GET_USERS, {
    skip: !isOpen,
  });

  const googleConnected = Boolean(googleStatusData?.googleCalendarStatus?.connected);
  const users = usersData?.users ?? [];

  const [createMeeting, { loading: creating }] = useMutation(CREATE_MEETING);
  const [updateMeeting, { loading: updating }] = useMutation(UPDATE_MEETING);
  const [deleteMeeting, { loading: deleting }] = useMutation(DELETE_MEETING);

  const loading = creating || updating || deleting;
  const hasMeetLink = isHttpUrl(formData.location);
  const showGenerateOption = !isEditing || !hasMeetLink;

  useEffect(() => {
    if (!isOpen) return;

    if (meeting) {
      setFormData(meeting);
      setGenerateMeetLink(false);
      setAssigneeDropdownOpen(false);
      return;
    }

    setFormData(defaultFormValues(initialDate ?? new Date(), defaultProjectId));
    setGenerateMeetLink(false);
    setAssigneeDropdownOpen(false);
  }, [isOpen, meeting, defaultProjectId, initialDate]);

  useEffect(() => {
    if (!isOpen || isEditing) return;
    if (googleConnected) {
      setGenerateMeetLink(true);
    }
  }, [isOpen, isEditing, googleConnected]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showToast({ variant: 'warning', message: 'Meeting title is required.' });
      return;
    }

    if (generateMeetLink && !googleConnected) {
      showToast({
        variant: 'warning',
        message: 'Connect Google Calendar in Settings before generating a Meet link.',
      });
      return;
    }

    const startTime = combineDateAndTime(formData.date, formData.startTime);
    const endTime = combineDateAndTime(formData.date, formData.endTime);

    if (endTime.getTime() <= startTime.getTime()) {
      showToast({ variant: 'warning', message: 'End time must be after start time.' });
      return;
    }

    try {
      const input = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        projectId: formData.projectId || undefined,
        startTime,
        endTime,
        location: generateMeetLink ? undefined : formData.location.trim() || undefined,
        generateMeetLink: generateMeetLink || undefined,
        assigneeIds: formData.assigneeIds,
      };

      if (isEditing && formData.id) {
        await updateMeeting({
          variables: { id: formData.id, input },
        });
        showToast({ variant: 'success', message: 'Meeting updated.' });
      } else {
        await createMeeting({
          variables: { input },
        });
        showToast({
          variant: 'success',
          message: generateMeetLink ? 'Meeting created with Google Meet link.' : 'Meeting created.',
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      showToast({
        variant: 'error',
        message: (err as Error)?.message || 'Failed to save meeting.',
      });
    }
  };

  const handleDelete = async () => {
    if (!formData.id) return;
    if (!window.confirm('Delete this meeting?')) return;

    try {
      await deleteMeeting({ variables: { id: formData.id } });
      showToast({ variant: 'success', message: 'Meeting deleted.' });
      onSaved();
      onClose();
    } catch (err) {
      showToast({
        variant: 'error',
        message: (err as Error)?.message || 'Failed to delete meeting.',
      });
    }
  };

  if (!isOpen) return null;

  const submitLabel = loading
    ? 'Saving…'
    : isEditing
      ? generateMeetLink
        ? 'Save + generate Meet link'
        : 'Save changes'
      : generateMeetLink
        ? 'Create meeting + Meet link'
        : 'Create meeting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-50 via-transparent to-primary-100/40 dark:from-primary-900/20 dark:via-transparent dark:to-primary-800/10" />

        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit meeting' : 'Add meeting'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label htmlFor="meeting-title" className="label">
              Title
            </label>
            <input
              id="meeting-title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="input"
              placeholder="Team sync"
              required
            />
          </div>

          <div>
            <label htmlFor="meeting-project" className="label">
              Project
            </label>
            <select
              id="meeting-project"
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              className="input"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Assignees</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAssigneeDropdownOpen((prev) => !prev)}
                className="input flex w-full items-center justify-between text-left"
              >
                <span>
                  {formData.assigneeIds.length > 0
                    ? `${formData.assigneeIds.length} selected`
                    : 'Select assignees'}
                </span>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${
                    assigneeDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg transition-all duration-200 dark:border-gray-700 dark:bg-gray-800 ${
                  assigneeDropdownOpen
                    ? 'pointer-events-auto scale-100 opacity-100'
                    : 'pointer-events-none scale-95 opacity-0'
                }`}
              >
                {users.length === 0 ? (
                  <p className="px-2 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                    No users available
                  </p>
                ) : (
                  users.map((user: { id: string; name: string }) => {
                    const checked = formData.assigneeIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                          checked
                            ? 'bg-primary-50 dark:bg-primary-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextIds = e.target.checked
                              ? [...formData.assigneeIds, user.id]
                              : formData.assigneeIds.filter((id) => id !== user.id);
                            setFormData((prev) => ({ ...prev, assigneeIds: nextIds }));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
                        />
                        <span className="truncate text-sm text-gray-900 dark:text-white">
                          {user.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            {formData.assigneeIds.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Assignees will receive a notification when the meeting is saved.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="meeting-date" className="label">
                Date
              </label>
              <input
                id="meeting-date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="meeting-start" className="label">
                Start
              </label>
              <input
                id="meeting-start"
                name="startTime"
                type="time"
                value={formData.startTime}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="meeting-end" className="label">
                End
              </label>
              <input
                id="meeting-end"
                name="endTime"
                type="time"
                value={formData.endTime}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
          </div>

          {showGenerateOption && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <label
                className={`flex items-start gap-3 ${googleConnected ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
              >
                <input
                  type="checkbox"
                  checked={generateMeetLink}
                  onChange={(e) => setGenerateMeetLink(e.target.checked)}
                  disabled={!googleConnected}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900 dark:text-white">
                    Generate Google Meet link
                  </span>
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    When checked, the Meet link is created when you click{' '}
                    <strong className="font-medium text-gray-700 dark:text-gray-300">
                      Create meeting + Meet link
                    </strong>{' '}
                    below.
                  </span>
                </span>
              </label>

              {!googleConnected && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                  Connect Google Calendar in{' '}
                  <Link href="/dashboard/settings" className="font-semibold underline">
                    Settings
                  </Link>{' '}
                  to enable this.
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="meeting-location" className="label">
              Location / link
            </label>
            <input
              id="meeting-location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="input"
              placeholder={
                generateMeetLink
                  ? 'Meet link will be generated automatically'
                  : 'Zoom, office room, or paste a link'
              }
              disabled={generateMeetLink}
            />
            {hasMeetLink && (
              <a
                href={formData.location}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Join meeting
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            )}
          </div>

          <div>
            <label htmlFor="meeting-description" className="label">
              Description
            </label>
            <textarea
              id="meeting-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input min-h-[96px]"
              placeholder="Optional notes"
            />
          </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
              >
                Delete meeting
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function meetingToFormData(meeting: {
  id: string;
  title: string;
  description?: string | null;
  projectId?: string | null;
  startTime: string;
  endTime: string;
  location?: string | null;
  assignees?: { id: string }[] | null;
}): MeetingFormData {
  const start = parseISO(meeting.startTime);
  const end = parseISO(meeting.endTime);

  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description ?? '',
    projectId: meeting.projectId ?? '',
    date: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endTime: format(end, 'HH:mm'),
    location: meeting.location ?? '',
    assigneeIds: meeting.assignees?.map((a) => a.id) ?? [],
  };
}
