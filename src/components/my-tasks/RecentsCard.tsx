'use client';

import { ListBulletIcon } from '@heroicons/react/24/outline';
import { type MyTaskItem } from '@/lib/myTasks';
import { type RecentTaskEntry, recentLocationLabel } from '@/lib/recentTasks';

function entryToTaskStub(entry: RecentTaskEntry): MyTaskItem {
    return {
        id: entry.id,
        title: entry.title,
        status: entry.status,
        priority: 'MEDIUM',
        projectId: entry.projectId,
        project: { id: entry.projectId, name: entry.projectName },
        list: entry.listName ? { id: '', name: entry.listName } : null,
    };
}

type RecentsCardProps = {
    items: RecentTaskEntry[];
    onOpen: (task: MyTaskItem) => void;
    emptyHint?: string;
};

/** ClickUp-style recents: one compact row per item — icon, title, muted “in …” location. */
export default function RecentsCard({
    items,
    onOpen,
    emptyHint = 'Open a task to see it here.',
}: RecentsCardProps) {
    return (
        <div className="flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-800/80">
                <h2 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Recents</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                {items.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[13px] text-gray-400 dark:text-gray-500">
                        {emptyHint}
                    </p>
                ) : (
                    <ul className="py-0.5">
                        {items.map((entry) => (
                            <li key={entry.id}>
                                <button
                                    type="button"
                                    onClick={() => onOpen(entryToTaskStub(entry))}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                    <ListBulletIcon
                                        className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
                                        aria-hidden
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-gray-900 dark:text-gray-100">
                                        <span className="font-normal">{entry.title}</span>
                                        <span className="text-gray-400 dark:text-gray-500">
                                            {' '}
                                            &middot; in {recentLocationLabel(entry)}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
