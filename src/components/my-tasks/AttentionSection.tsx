'use client';

import type { ReactNode } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

type Props = {
    id?: string;
    label: string;
    count: number;
    expanded: boolean;
    onToggle: () => void;
    emptyText: string;
    children: ReactNode;
};

export default function AttentionSection({
    label,
    count,
    expanded,
    onToggle,
    emptyText,
    children,
}: Props) {
    return (
        <div className="mb-1">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
            >
                {expanded ? (
                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                ) : (
                    <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                )}
                <span>
                    {label}{' '}
                    <span className="text-gray-400 font-normal">({count})</span>
                </span>
            </button>
            {expanded && (
                <div className="pb-2">
                    {count === 0 ? (
                        <p className="text-xs text-gray-400 px-3 py-2">{emptyText}</p>
                    ) : (
                        children
                    )}
                </div>
            )}
        </div>
    );
}
