'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { AtSymbolIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { GET_MY_TASK_COMMENTS, GET_MY_TASK_MENTIONS } from '@/lib/graphql/queries';
import { MentionFormattedText } from '@/components/MentionFormattedText';
import { useAuthStore } from '@/lib/store';
import {
    mentionContextLabel,
    taskLinkWithMentionFocus,
} from '@/lib/mentionContext';

type TabId = 'all' | 'mentions' | 'comments';

function parseTaskTitleFromMessage(message: string): string | null {
    const m = message.match(/"([^"]+)"/);
    return m?.[1] ?? null;
}

function parseAuthorFromMessage(message: string): string {
    const idx = message.indexOf(' mentioned');
    if (idx > 0) return message.slice(0, idx).trim();
    return 'Someone';
}

type FeedItem =
    | {
          kind: 'mention';
          id: string;
          at: number;
          taskId: string;
          taskTitle: string;
          authorName: string;
          isUnread: boolean;
          contextType: string;
          excerpt: string;
          focusHash: string;
      }
    | {
          kind: 'comment';
          id: string;
          at: number;
          taskId: string;
          taskTitle: string;
          projectName: string;
          authorName: string;
          content: string;
      };

/** Read-only inbox: @mentions for this assignee + comments on their assigned tasks. */
export default function CommentsAndMentionsPanel() {
    const [tab, setTab] = useState<TabId>('all');
    const currentUserId = useAuthStore((s) => s.user?.id);
    const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

    const {
        data: commentsData,
        loading: commentsLoading,
        error: commentsError,
    } = useQuery(GET_MY_TASK_COMMENTS, {
        fetchPolicy: 'cache-and-network',
        errorPolicy: 'all',
    });

    const {
        data: mentionsData,
        loading: mentionsLoading,
        error: mentionsError,
    } = useQuery(GET_MY_TASK_MENTIONS, {
        fetchPolicy: 'cache-and-network',
        errorPolicy: 'all',
    });

    const mentionItems = useMemo(() => {
        const list = mentionsData?.myTaskMentions ?? [];
        return list.map(
            (n: {
                id: string;
                message: string;
                taskId: string;
                taskTitle: string;
                createdAt: string;
                isRead: boolean;
                contextType: string;
                excerpt: string;
                focusHash: string;
            }) => ({
                kind: 'mention' as const,
                id: `m-${n.id}`,
                at: new Date(n.createdAt).getTime(),
                taskId: n.taskId,
                taskTitle: n.taskTitle || parseTaskTitleFromMessage(n.message) || 'Task',
                authorName: parseAuthorFromMessage(n.message),
                isUnread: !n.isRead,
                contextType: n.contextType ?? 'description',
                excerpt: n.excerpt ?? '',
                focusHash: n.focusHash ?? 'task-description',
            }),
        );
    }, [mentionsData?.myTaskMentions]);

    const commentItems = useMemo(() => {
        const list = commentsData?.myTaskComments ?? [];
        return list.map(
            (c: {
                id: string;
                taskId: string;
                taskTitle: string;
                projectName: string;
                content: string;
                createdAt: string;
                user?: { id?: string; name?: string };
            }) => ({
                kind: 'comment' as const,
                id: `c-${c.id}`,
                at: new Date(c.createdAt).getTime(),
                taskId: c.taskId,
                taskTitle: c.taskTitle,
                projectName: c.projectName,
                authorName:
                    c.user?.id === currentUserId
                        ? 'You'
                        : (c.user?.name ?? 'Someone'),
                content: c.content,
            }),
        );
    }, [commentsData?.myTaskComments, currentUserId]);

    const allItems = useMemo((): FeedItem[] => {
        return [...mentionItems, ...commentItems].sort((a, b) => b.at - a.at);
    }, [mentionItems, commentItems]);

    const filtered = useMemo(() => {
        if (tab === 'mentions') return mentionItems;
        if (tab === 'comments') return commentItems;
        return allItems;
    }, [tab, mentionItems, commentItems, allItems]);

    const loading = commentsLoading || mentionsLoading;
    const tabLoading =
        tab === 'comments'
            ? commentsLoading
            : tab === 'mentions'
              ? mentionsLoading
              : loading;
    const queryError = commentsError?.message || mentionsError?.message;

    const tabs: { id: TabId; label: string; count: number }[] = [
        { id: 'all', label: 'All', count: allItems.length },
        { id: 'mentions', label: 'Mentions', count: mentionItems.length },
        { id: 'comments', label: 'Comments', count: commentItems.length },
    ];

    return (
        <section className="rounded-xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/30">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Comments &amp; Mentions
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {isAdmin
                        ? 'Comments on your tasks and comments you leave on team tasks'
                        : 'When someone comments on a task assigned to you'}
                </p>
            </div>

            <div className="flex gap-4 px-4 border-b border-gray-100 dark:border-gray-800">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            tab === t.id
                                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                    >
                        {t.label}{' '}
                        <span className="text-gray-400 font-normal">({t.count})</span>
                    </button>
                ))}
            </div>

            <div className="min-h-[160px] max-h-[min(360px,45vh)] overflow-y-auto">
                {queryError && (
                    <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400 text-center">
                        Could not load. Restart the API server, then refresh this page.
                    </p>
                )}
                {!queryError && tabLoading && filtered.length === 0 && (
                    <p className="px-4 py-10 text-sm text-gray-500 text-center">Loading…</p>
                )}
                {!queryError && !tabLoading && filtered.length === 0 && (
                    <p className="px-4 py-10 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
                        {tab === 'mentions'
                            ? 'No @mentions for you yet.'
                            : tab === 'comments'
                              ? isAdmin
                                ? 'No team comments yet.'
                                : 'No comments on your assigned tasks yet.'
                              : 'Nothing here yet.'}
                    </p>
                )}
                {!queryError && filtered.length > 0 && (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filtered.map((item) => {
                            const href =
                                item.kind === 'mention'
                                    ? taskLinkWithMentionFocus(item.taskId, item.focusHash)
                                    : `/dashboard/tasks/${item.taskId}#task-comments`;
                            const Icon =
                                item.kind === 'mention' ? AtSymbolIcon : ChatBubbleLeftIcon;
                            const meta =
                                item.kind === 'mention'
                                    ? `${mentionContextLabel(item.contextType)} · ${item.taskTitle}`
                                    : `${item.taskTitle} · in ${item.projectName}`;
                            const body = (
                                <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <Icon
                                        className={`h-5 w-5 shrink-0 mt-0.5 ${
                                            item.kind === 'mention'
                                                ? 'text-primary-500'
                                                : 'text-gray-400'
                                        }`}
                                        aria-hidden
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={`text-sm text-gray-800 dark:text-gray-200 ${
                                                item.kind === 'mention' && item.isUnread
                                                    ? 'font-semibold'
                                                    : ''
                                            }`}
                                        >
                                            {item.kind === 'mention' ? (
                                                <>
                                                    <span className="text-gray-900 dark:text-white">
                                                        {item.authorName}
                                                    </span>{' '}
                                                    mentioned you
                                                    {item.excerpt ? (
                                                        <span className="block font-normal text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                                                            <MentionFormattedText
                                                                text={item.excerpt}
                                                            />
                                                        </span>
                                                    ) : null}
                                                </>
                                            ) : (
                                                <span className="line-clamp-3 block text-sm">
                                                    <MentionFormattedText text={item.content} />
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {item.kind === 'comment' && (
                                                <span>{item.authorName} · </span>
                                            )}
                                            {meta}
                                        </p>
                                    </div>
                                </div>
                            );
                            return (
                                <li key={item.id}>
                                    <Link href={href} className="block">
                                        {body}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}
