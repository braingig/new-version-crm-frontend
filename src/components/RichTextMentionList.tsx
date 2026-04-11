'use client';

import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useState,
} from 'react';
import type { SuggestionKeyDownProps } from '@tiptap/suggestion';

export type RichTextMentionItem = {
    id: string;
    label: string;
    email: string;
};

export type RichTextMentionListProps = {
    items: RichTextMentionItem[];
    command: (item: RichTextMentionItem) => void;
};

/** Same surface pattern as ModalDropdown: border-gray-300, rounded-md, shadow-lg */
const panelClass =
    'min-w-[220px] max-w-[min(100vw-1.5rem,280px)] overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700';

/**
 * Dropdown list for @mentions in TipTap; ref exposes keyboard handling for the suggestion plugin.
 */
export const RichTextMentionList = forwardRef<
    { onKeyDown: (props: SuggestionKeyDownProps) => boolean },
    RichTextMentionListProps
>(({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);

    useEffect(() => {
        setSelected(0);
    }, [items]);

    useImperativeHandle(
        ref,
        () => ({
            onKeyDown: ({ event }) => {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setSelected((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
                    return true;
                }
                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSelected((i) => Math.max(i - 1, 0));
                    return true;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    const item = items[selected];
                    if (item) command(item);
                    return true;
                }
                if (event.key === 'Tab') {
                    event.preventDefault();
                    const item = items[selected];
                    if (item) command(item);
                    return true;
                }
                return false;
            },
        }),
        [items, selected, command],
    );

    if (items.length === 0) {
        return (
            <div className={panelClass}>
                <p className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                    No matching people
                </p>
            </div>
        );
    }

    return (
        <div className={`${panelClass} max-h-56 overflow-y-auto py-1`}>
            <ul role="listbox">
                {items.map((item, idx) => {
                    const active = idx === selected;
                    return (
                        <li key={item.id} role="option" aria-selected={active}>
                            <button
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                    active
                                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                                        : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600/60'
                                }`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => command(item)}
                                onMouseEnter={() => setSelected(idx)}
                            >
                                <span className="block truncate font-medium">{item.label}</span>
                                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                    {item.email}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
});

RichTextMentionList.displayName = 'RichTextMentionList';
