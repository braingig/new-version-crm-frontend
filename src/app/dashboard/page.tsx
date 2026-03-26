'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { GET_PROJECTS, GET_TASKS, GET_USERS } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store';
import {
    UserGroupIcon,
    FolderIcon,
    ClockIcon,
    CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

type StatChangeType = 'positive' | 'negative' | 'neutral';

interface StatItem {
    name: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    change: string;
    changeType: StatChangeType;
    hint?: string;
}

type DashboardViewMode = 'mine' | 'all';
const DASHBOARD_VIEW_MODE_KEY = 'dashboard:viewMode';

function countOpenTasks(tasks: any[]): number {
    return tasks.reduce(
        (sum, t) =>
            sum +
            (t.status !== 'COMPLETED' ? 1 : 0) +
            (t.subTasks?.length ? countOpenTasks(t.subTasks) : 0),
        0
    );
}

export default function DashboardPage() {
    const user = useAuthStore((state) => state.user);
    const role = user?.role;
    const userId = user?.id;
    const isAdmin = role?.toUpperCase() === 'ADMIN';
    const [viewMode, setViewMode] = useState<DashboardViewMode>('mine');

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(DASHBOARD_VIEW_MODE_KEY);
            if (saved === 'mine' || saved === 'all') {
                setViewMode(saved);
            }
        } catch {
            // Ignore storage access issues (private mode / blocked storage).
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(DASHBOARD_VIEW_MODE_KEY, viewMode);
        } catch {
            // Ignore storage access issues (private mode / blocked storage).
        }
    }, [viewMode]);

    const { data: usersData } = useQuery(GET_USERS);
    const { data: projectsData } = useQuery(GET_PROJECTS);
    const { data: tasksData } = useQuery(GET_TASKS);
    const { data: myTasksData } = useQuery(GET_TASKS, {
        variables: { filters: { assignedToId: userId ?? '' } },
        skip: !userId,
    });

    const allProjects = projectsData?.projects ?? [];
    const allTasks = tasksData?.tasks ?? [];
    const myTasks = myTasksData?.tasks ?? [];

    const myProjectIds = useMemo(() => {
        return new Set(
            (myTasks ?? [])
                .map((task: any) => task.projectId || task.project?.id)
                .filter(Boolean)
        );
    }, [myTasks]);

    const visibleProjects = useMemo(() => {
        if (viewMode === 'all') return allProjects;
        return allProjects.filter((project: any) => myProjectIds.has(project.id));
    }, [viewMode, allProjects, myProjectIds]);

    const visibleTasks = viewMode === 'all' ? allTasks : myTasks;
    const hasNoAssignedItems = viewMode === 'mine' && visibleProjects.length === 0 && visibleTasks.length === 0;

    const stats = useMemo(() => {
        const totalEmployees = usersData?.users?.length ?? 0;
        const activeProjects = visibleProjects.filter((p: any) => p.status === 'ACTIVE').length;
        const openTasks = countOpenTasks(visibleTasks);

        const baseStats: StatItem[] = [];

        if (isAdmin) {
            baseStats.push({
                name: 'Total Employees',
                value: String(totalEmployees),
                icon: UserGroupIcon,
                change: '—',
                changeType: 'neutral',
            });
        } else {
            baseStats.push({
                name: viewMode === 'mine' ? 'Assigned to me' : 'Open tasks',
                value: String(openTasks),
                icon: UserGroupIcon,
                change: '—',
                changeType: 'neutral',
                hint: viewMode === 'mine' ? 'Tasks currently assigned to you' : undefined,
            });
        }

        baseStats.push({
            name: 'Active Projects',
            value: String(activeProjects),
            icon: FolderIcon,
            change: '—',
            changeType: 'neutral',
        });

        if (isAdmin) {
            baseStats.push({
                name: 'Open Tasks',
                value: String(openTasks),
                icon: ClockIcon,
                change: '—',
                changeType: 'neutral',
                hint: 'To do, In progress, Review',
            });
        } else {
            baseStats.push({
                name: 'Projects in scope',
                value: String(visibleProjects.length),
                icon: ClockIcon,
                change: '—',
                changeType: 'neutral',
                hint: viewMode === 'mine' ? 'Projects with your assigned tasks' : 'All visible projects',
            });
        }

        if (isAdmin) {
            baseStats.push({
                name: 'Monthly Revenue',
                value: '—',
                icon: CurrencyDollarIcon,
                change: '—',
                changeType: 'neutral',
            });
        }

        return baseStats;
    }, [isAdmin, usersData?.users?.length, visibleProjects, visibleTasks, viewMode]);

    const recentProjects = visibleProjects.slice(0, 5);
    const recentTasks = visibleTasks.slice(0, 5);

    return (
        <div>
            <div className="mb-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            Overview of your projects and tasks
                        </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('mine')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                viewMode === 'mine'
                                    ? 'bg-primary-600 text-white'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            Assigned to me
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('all')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                viewMode === 'all'
                                    ? 'bg-primary-600 text-white'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            Team view
                        </button>
                    </div>
                </div>
            </div>

            {hasNoAssignedItems && (
                <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200">
                    No tasks or projects are currently assigned to you. Switch to <span className="font-semibold">Team view</span> to view everything.
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {stats.map((stat) => (
                    <div key={stat.name} className="card overflow-hidden">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="rounded-lg bg-primary-100 dark:bg-primary-900/20 p-3">
                                    <stat.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                                </div>
                            </div>
                            <div className="ml-4 flex-1">
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {stat.name}
                                </p>
                                {stat.hint && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                        {stat.hint}
                                    </p>
                                )}
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {stat.value}
                                </p>
                            </div>
                        </div>
                        {stat.change !== '—' && (
                            <div className="mt-4">
                                <div
                                    className={`inline-flex items-baseline rounded-full px-2.5 py-0.5 text-sm font-medium ${
                                        stat.changeType === 'positive'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                            : stat.changeType === 'negative'
                                                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    {stat.change}
                                </div>
                                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                                    from last month
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Projects */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {viewMode === 'mine' ? 'My Projects' : 'Recent Projects'}
                    </h2>
                    <div className="space-y-3">
                        {recentProjects.length > 0 ? (
                            recentProjects.map((project: any) => (
                                <Link
                                    key={project.id}
                                    href={`/dashboard/projects/${project.id}`}
                                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                >
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 dark:text-white">
                                            {project.name}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {project.clientName || 'Internal'}
                                        </p>
                                    </div>
                                    <span
                                        className={`flex-shrink-0 px-2 py-1 text-xs rounded-full ${project.status === 'ACTIVE'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                            }`}
                                    >
                                        {project.status}
                                    </span>
                                </Link>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                                {viewMode === 'mine' ? 'No projects assigned to you' : 'No projects yet'}
                            </p>
                        )}
                    </div>
                </div>

                {/* Recent Tasks */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {viewMode === 'mine' ? 'My Tasks' : 'Recent Tasks'}
                    </h2>
                    <div className="space-y-3">
                        {recentTasks.length > 0 ? (
                            recentTasks.map((task: any) => (
                                <Link
                                    key={task.id}
                                    href={`/dashboard/tasks/${task.id}`}
                                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                >
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 dark:text-white">
                                            {task.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Priority: {task.priority}
                                        </p>
                                    </div>
                                    <span
                                        className={`flex-shrink-0 px-2 py-1 text-xs rounded-full ${task.status === 'COMPLETED'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                : task.status === 'IN_PROGRESS'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                            }`}
                                    >
                                        {task.status.replace('_', ' ')}
                                    </span>
                                </Link>
                            ))
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                                {viewMode === 'mine' ? 'No tasks assigned to you' : 'No tasks yet'}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
