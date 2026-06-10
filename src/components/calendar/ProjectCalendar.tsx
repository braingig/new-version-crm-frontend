'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { startOfDay } from 'date-fns';
import { GET_MEETINGS, GET_PROJECTS, GET_TASKS, GET_USERS } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store';
import { canAccessRoute } from '@/lib/permissions';
import {
  mapCalendarEvents,
  mapMeetingsToCalendarEvents,
  getVisibleRange,
} from '@/lib/calendar/mapCalendarEvents';
import {
  formatCalendarTitle,
  shiftCalendarDate,
  type CalendarViewMode,
} from '@/lib/calendar/calendarGrid';
import type { CrmCalendarEvent } from '@/lib/calendar/calendarTypes';
import {
  isMeetingCalendarEvent,
} from '@/lib/calendar/calendarDisplay';
import CalendarMonthView from './CalendarMonthView';
import CalendarWeekView from './CalendarWeekView';
import CalendarDayPanel from './CalendarDayPanel';
import MeetingModal, { meetingToFormData, type MeetingFormData } from './MeetingModal';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'COMPLETED', label: 'Complete' },
];

export interface ProjectCalendarProps {
  initialProjectId?: string | null;
}

export default function ProjectCalendar({ initialProjectId = null }: ProjectCalendarProps) {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const canOpenTasks = canAccessRoute(role, '/dashboard/tasks');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedDay, setSelectedDay] = useState<Date | null>(startOfDay(new Date()));
  const [projectFilter, setProjectFilter] = useState(initialProjectId ?? 'all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [showTaskStatus, setShowTaskStatus] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingFormData | null>(null);

  const taskFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (projectFilter !== 'all') f.projectId = projectFilter;
    return Object.keys(f).length ? f : undefined;
  }, [projectFilter]);

  const visibleRange = useMemo(
    () => getVisibleRange(currentDate, viewMode),
    [currentDate, viewMode],
  );

  const { data: projectsData, loading: projectsLoading } = useQuery(GET_PROJECTS);
  const { data: tasksData, loading: tasksLoading } = useQuery(GET_TASKS, {
    variables: { filters: taskFilters },
  });
  const { data: usersData } = useQuery(GET_USERS);
  const {
    data: meetingsData,
    loading: meetingsLoading,
    refetch: refetchMeetings,
  } = useQuery(GET_MEETINGS, {
    variables: {
      filters: {
        from: visibleRange.start,
        to: visibleRange.end,
        projectId: projectFilter === 'all' ? undefined : projectFilter,
      },
    },
  });

  const projects = projectsData?.projects ?? [];
  const tasks = tasksData?.tasks ?? [];
  const users = usersData?.users ?? [];
  const meetings = meetingsData?.meetings ?? [];

  const effectiveAssigneeId =
    myTasksOnly && userId ? userId : assigneeFilter === 'all' ? null : assigneeFilter;

  const taskEvents = useMemo(
    () =>
      mapCalendarEvents(tasks, {
        projectId: projectFilter === 'all' ? null : projectFilter,
        assigneeId: effectiveAssigneeId,
        status: statusFilter || null,
        showTaskStatus,
        rangeStart: visibleRange.start,
        rangeEnd: visibleRange.end,
      }),
    [tasks, projectFilter, effectiveAssigneeId, statusFilter, showTaskStatus, visibleRange],
  );

  const meetingEvents = useMemo(
    () =>
      showMeetings
        ? mapMeetingsToCalendarEvents(meetings, {
            projectId: projectFilter === 'all' ? null : projectFilter,
            rangeStart: visibleRange.start,
            rangeEnd: visibleRange.end,
          })
        : [],
    [meetings, projectFilter, showMeetings, visibleRange],
  );

  const calendarEvents = useMemo(
    () =>
      [...taskEvents, ...meetingEvents].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [taskEvents, meetingEvents],
  );

  const loading = projectsLoading || tasksLoading || meetingsLoading;

  const openCreateMeeting = useCallback(() => {
    setEditingMeeting(null);
    setMeetingModalOpen(true);
  }, []);

  const openEditMeeting = useCallback(
    (meetingId: string) => {
      const meeting = meetings.find((m: { id: string }) => m.id === meetingId);
      if (!meeting) return;
      setEditingMeeting(meetingToFormData(meeting));
      setMeetingModalOpen(true);
    },
    [meetings],
  );

  const handleSelectEvent = useCallback(
    (event: CrmCalendarEvent) => {
      if (isMeetingCalendarEvent(event) && event.resource.meetingId) {
        openEditMeeting(event.resource.meetingId);
        return;
      }

      const { taskId, projectId } = event.resource;
      if (taskId && canOpenTasks) {
        router.push(`/dashboard/tasks/${taskId}`);
        return;
      }
      if (projectId) {
        router.push(`/dashboard/projects/${projectId}`);
      }
    },
    [router, canOpenTasks, openEditMeeting],
  );

  const goToday = () => {
    const today = startOfDay(new Date());
    setCurrentDate(today);
    setSelectedDay(today);
  };

  const goPrev = () => setCurrentDate((d) => shiftCalendarDate(d, viewMode, -1));
  const goNext = () => setCurrentDate((d) => shiftCalendarDate(d, viewMode, 1));

  const viewToggleClass = (active: boolean) =>
    `rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-primary-600 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
    }`;

  const defaultMeetingProjectId = projectFilter === 'all' ? '' : projectFilter;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="calendar-project" className="label">
            Project
          </label>
          <select
            id="calendar-project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="input"
          >
            <option value="all">All projects</option>
            {projects.map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="calendar-assignee" className="label">
            Assignee
          </label>
          <select
            id="calendar-assignee"
            value={assigneeFilter}
            onChange={(e) => {
              setAssigneeFilter(e.target.value);
              setMyTasksOnly(false);
            }}
            disabled={myTasksOnly}
            className="input disabled:opacity-60"
          >
            <option value="all">All assignees</option>
            {users.map((u: { id: string; name: string }) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="calendar-status" className="label">
            Task status
          </label>
          <select
            id="calendar-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col justify-end gap-2">
          {userId && canOpenTasks && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={myTasksOnly}
                onChange={(e) => setMyTasksOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
              />
              My tasks only
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showTaskStatus}
              onChange={(e) => setShowTaskStatus(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
            />
            Tasks (by status timeline)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showMeetings}
              onChange={(e) => setShowMeetings(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
            />
            Meetings
          </label>
        </div>
      </div>

      {/* Calendar toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={goPrev} className="btn-secondary !px-2.5 !py-2" aria-label="Previous">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button type="button" onClick={goNext} className="btn-secondary !px-2.5 !py-2" aria-label="Next">
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <button type="button" onClick={goToday} className="btn-secondary">
            Today
          </button>
          <h2 className="ml-1 text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
            {formatCalendarTitle(currentDate, viewMode)}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openCreateMeeting} className="btn-primary inline-flex items-center gap-1.5">
            <PlusIcon className="h-4 w-4" />
            Add meeting
          </button>
          <button
            type="button"
            className={viewToggleClass(viewMode === 'month')}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
          <button
            type="button"
            className={viewToggleClass(viewMode === 'week')}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-indigo-500 bg-indigo-100" />
          To Do
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-blue-500 bg-blue-100" />
          In Progress (each day from start through today)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-purple-500 bg-purple-100" />
          Review (status set day)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-green-500 bg-green-100" />
          Complete
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-rose-500 bg-rose-100" />
          Overdue (past due, not complete)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-amber-500 bg-amber-100" />
          Meeting
        </span>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-gray-200/80 bg-white/90 dark:border-gray-800 dark:bg-gray-900/40">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px] xl:items-stretch">
          <div className="min-w-0">
            {viewMode === 'month' ? (
              <CalendarMonthView
                currentDate={currentDate}
                events={calendarEvents}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onSelectEvent={handleSelectEvent}
              />
            ) : (
              <CalendarWeekView
                currentDate={currentDate}
                events={calendarEvents}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onSelectEvent={handleSelectEvent}
              />
            )}
          </div>

          {selectedDay && (
            <div className="flex max-h-[28rem] min-h-0 flex-col xl:h-full xl:max-h-none">
              <CalendarDayPanel
                day={selectedDay}
                events={calendarEvents}
                onClose={() => setSelectedDay(null)}
                onSelectEvent={handleSelectEvent}
              />
            </div>
          )}
        </div>
      )}

      <MeetingModal
        isOpen={meetingModalOpen}
        meeting={editingMeeting}
        projects={projects}
        defaultProjectId={defaultMeetingProjectId}
        initialDate={selectedDay ?? startOfDay(new Date())}
        onClose={() => {
          setMeetingModalOpen(false);
          setEditingMeeting(null);
        }}
        onSaved={() => {
          refetchMeetings();
        }}
      />
    </div>
  );
}
