'use client';

import Link from 'next/link';
import { FolderIcon } from '@heroicons/react/24/outline';
import { type AssignedProjectSummary } from '@/lib/myTasks';

type AssignedProjectsCardProps = {
  projects: AssignedProjectSummary[];
  title?: string;
  emptyHint?: string;
};

/** Same visual weight as RecentsCard: compact vertical list, project + muted task count. */
export default function AssignedProjectsCard({
  projects,
  title = 'My projects',
  emptyHint = 'When you have tasks on a project, it will show up here.',
}: AssignedProjectsCardProps) {
  return (
    <div className="flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{title}</h2>
        {projects.length > 0 && (
          <Link
            href="/dashboard/projects"
            className="text-[12px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 shrink-0"
          >
            All
          </Link>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {projects.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-gray-400 dark:text-gray-500">
            {emptyHint}
          </p>
        ) : (
          <ul className="py-0.5">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <FolderIcon
                    className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-gray-900 dark:text-gray-100">
                    <span className="font-normal">{project.name}</span>
                    <span className="text-gray-400 dark:text-gray-500">
                      {' '}
                      &middot;{' '}
                      {project.openTaskCount}{' '}
                      {project.openTaskCount === 1 ? 'open task' : 'open tasks'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
