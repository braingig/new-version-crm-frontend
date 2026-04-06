'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useAuthStore } from '@/lib/store';

export type MentionUser = { id: string; name: string; email: string };

export type MentionTextareaProps = Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    'onChange'
> & {
    users: MentionUser[];
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    /** Applied to the outer wrapper (e.g. `flex-1 min-w-0` in flex rows). */
    wrapperClassName?: string;
};

/**
 * Textarea with @-triggered user suggestions. Inserts @Full Name (server resolves by catalog + email tokens).
 */
export function MentionTextarea({
    users,
    value,
    onChange,
    className = '',
    onKeyDown,
    onSelect,
    onClick,
    onBlur,
    onFocus,
    disabled,
    wrapperClassName,
    ...rest
}: MentionTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [caret, setCaret] = useState(0);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [focused, setFocused] = useState(false);
    const currentUserId = useAuthStore((s) => s.user?.id);

    const mentionState = useMemo(() => {
        const v = String(value ?? '');
        const textBefore = v.slice(0, caret);
        const lastAt = textBefore.lastIndexOf('@');
        if (lastAt < 0) return null;
        const afterAt = textBefore.slice(lastAt + 1);
        if (/\n/.test(afterAt)) return null;
        if (/\s{2,}/.test(afterAt)) return null;
        return { start: lastAt, query: afterAt };
    }, [value, caret]);

    const candidates = useMemo(() => {
        if (!mentionState) return [];
        const q = mentionState.query.toLowerCase();
        const pool = users.filter((u) => u.id !== currentUserId);
        const filtered = !q
            ? pool
            : pool.filter(
                  (u) =>
                      u.name.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q),
              );
        return filtered.slice(0, 8);
    }, [mentionState, users, currentUserId]);

    const showMenu =
        focused && !!mentionState && !disabled && candidates.length > 0;

    useEffect(() => {
        setHighlightIndex(0);
    }, [mentionState?.query]);

    useEffect(() => {
        setHighlightIndex((i) =>
            candidates.length === 0
                ? 0
                : Math.min(i, Math.max(0, candidates.length - 1)),
        );
    }, [candidates.length]);

    const syncCaret = useCallback(() => {
        const el = textareaRef.current;
        if (el) setCaret(el.selectionStart ?? 0);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e);
        setCaret(e.target.selectionStart ?? 0);
    };

    const insertMention = useCallback(
        (user: MentionUser) => {
            const el = textareaRef.current;
            if (!mentionState || !el) return;
            const v = String(value ?? '');
            const start = mentionState.start;
            const end = caret;
            const before = v.slice(0, start);
            const after = v.slice(end);
            const label = (user.name || '').trim() || user.email;
            const insertion = `@${label} `;
            const newVal = before + insertion + after;
            const pos = start + insertion.length;

            onChange({
                target: { value: newVal } as HTMLTextAreaElement,
                currentTarget: el,
            } as React.ChangeEvent<HTMLTextAreaElement>);

            requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(pos, pos);
                setCaret(pos);
            });
        },
        [mentionState, caret, value, onChange],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const menuActive =
            focused && !!mentionState && !disabled && candidates.length > 0;

        if (menuActive) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightIndex((i) =>
                    Math.min(i + 1, candidates.length - 1),
                );
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightIndex((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                insertMention(candidates[highlightIndex]);
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                insertMention(candidates[highlightIndex]);
                return;
            }
        }

        onKeyDown?.(e);
    };

    return (
        <div className={`relative w-full ${wrapperClassName ?? ''}`}>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                disabled={disabled}
                className={className}
                onKeyDown={handleKeyDown}
                onSelect={(e) => {
                    syncCaret();
                    onSelect?.(e);
                }}
                onClick={(e) => {
                    syncCaret();
                    onClick?.(e);
                }}
                onKeyUp={(e) => {
                    syncCaret();
                }}
                onFocus={(e) => {
                    setFocused(true);
                    syncCaret();
                    onFocus?.(e);
                }}
                onBlur={(e) => {
                    window.setTimeout(() => setFocused(false), 150);
                    onBlur?.(e);
                }}
                {...rest}
            />
            {showMenu && (
                <ul
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
                    role="listbox"
                >
                    {candidates.map((u, idx) => (
                        <li key={u.id} role="option" aria-selected={idx === highlightIndex}>
                            <button
                                type="button"
                                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-primary-50 dark:hover:bg-gray-700 ${
                                    idx === highlightIndex
                                        ? 'bg-primary-50 dark:bg-gray-700'
                                        : ''
                                }`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    insertMention(u);
                                }}
                                onMouseEnter={() => setHighlightIndex(idx)}
                            >
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {u.name}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {u.email}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {focused &&
                !!mentionState &&
                !disabled &&
                candidates.length === 0 &&
                mentionState.query.length > 0 &&
                users.some((u) => u.id !== currentUserId) && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        No matching people. Keep typing a name or email.
                    </div>
                )}
        </div>
    );
}
