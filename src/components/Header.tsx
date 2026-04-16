'use client';

import { useState, useRef, useEffect } from 'react';
import { BellIcon, UserCircleIcon, ArrowRightOnRectangleIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import {
    LOGOUT_MUTATION,
    GET_NOTIFICATIONS,
    GET_NOTIFICATION_UNREAD_COUNT,
    MARK_NOTIFICATION_AS_READ,
    MARK_ALL_NOTIFICATIONS_AS_READ,
} from '@/lib/graphql/queries';
import { useNotificationSocket } from '@/lib/useNotificationSocket';

type Notification = {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    link?: string;
    createdAt: string;
};

export default function Header() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const router = useRouter();
    const [logoutMutation] = useMutation(LOGOUT_MUTATION);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { data: notificationsData, refetch: refetchNotifications } = useQuery(GET_NOTIFICATIONS, {
        skip: !user?.id,
        fetchPolicy: 'network-only', // always refetch so assignee sees their notifications after login
    });
    const { data: unreadData, refetch: refetchUnread } = useQuery(GET_NOTIFICATION_UNREAD_COUNT, {
        skip: !user?.id,
        fetchPolicy: 'network-only',
    });
    const [markAsRead] = useMutation(MARK_NOTIFICATION_AS_READ, {
        refetchQueries: [{ query: GET_NOTIFICATIONS }, { query: GET_NOTIFICATION_UNREAD_COUNT }],
    });
    const [markAllAsRead] = useMutation(MARK_ALL_NOTIFICATIONS_AS_READ, {
        refetchQueries: [{ query: GET_NOTIFICATIONS }, { query: GET_NOTIFICATION_UNREAD_COUNT }],
    });

    const refetch = () => {
        refetchNotifications();
        refetchUnread();
    };
    useNotificationSocket(user?.id ?? null, refetch);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        }
        if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const handleLogout = async () => {
        try {
            await logoutMutation();
        } catch (error) {
            console.error('Logout error:', error);
        }
        logout();
        router.push('/login');
    };

    const notifications: Notification[] = notificationsData?.notifications ?? [];
    const unreadCount = unreadData?.notificationUnreadCount ?? 0;
    const hasUnread = unreadCount > 0;
    const getNotificationHref = (link?: string) => {
        if (!link) return null;
        const trimmed = link.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
        }
        return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    };

    const handleNotificationClick = async (notification: Notification) => {
        const href = getNotificationHref(notification.link);
        if (!notification.isRead) {
            try {
                await markAsRead({ variables: { id: notification.id } });
            } catch (err) {
                console.error('Failed to mark notification as read:', err);
            }
        }
        setDropdownOpen(false);
        if (href) {
            router.push(href);
        }
    };

    return (
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <div className="flex flex-1 items-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Welcome back, {user?.name}!
                    </h2>
                </div>
                <div className="flex items-center gap-x-4 lg:gap-x-6">
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setDropdownOpen((o) => !o)}
                            className="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-500 focus:outline-none"
                            aria-label="View notifications"
                        >
                            <BellIcon className="h-6 w-6" aria-hidden="true" />
                            {hasUnread && (
                                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800" />
                            )}
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-1 w-80 max-h-[24rem] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-50 flex flex-col">
                                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                        Notifications
                                    </span>
                                    {hasUnread && (
                                        <button
                                            type="button"
                                            onClick={() => markAllAsRead()}
                                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-y-auto flex-1">
                                    {notifications.length === 0 ? (
                                        <p className="px-3 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                                            No notifications yet
                                        </p>
                                    ) : (
                                        <ul className="py-1">
                                            {notifications.map((n) => {
                                                const hasDestination = Boolean(getNotificationHref(n.link));
                                                return (
                                                <li key={n.id}>
                                                    <div
                                                        className={`px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex gap-2 ${!n.isRead ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''} ${hasDestination ? 'cursor-pointer' : ''}`}
                                                        role={hasDestination ? 'button' : undefined}
                                                        tabIndex={hasDestination ? 0 : -1}
                                                        onClick={() => {
                                                            if (!hasDestination) return;
                                                            handleNotificationClick(n);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (!hasDestination) return;
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                handleNotificationClick(n);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {n.title}
                                                            </p>
                                                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                                                                {n.message}
                                                            </p>
                                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                                {new Date(n.createdAt).toLocaleString()}
                                                            </p>
                                                        </div>
                                                        {!n.isRead && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    markAsRead({ variables: { id: n.id } });
                                                                }}
                                                                className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                                                                title="Mark as read"
                                                            >
                                                                <CheckIcon className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200 dark:lg:bg-gray-700" aria-hidden="true" />

                    <div className="flex items-center gap-x-4">
                        <span className="hidden lg:flex lg:flex-col lg:items-end">
                            <span className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">
                                {user?.name}
                            </span>
                            <span className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                                {user?.role}
                            </span>
                        </span>
                        <UserCircleIcon className="h-8 w-8 text-gray-400" />
                        <button
                            onClick={handleLogout}
                            className="text-gray-400 hover:text-gray-500 transition-colors"
                            title="Logout"
                        >
                            <ArrowRightOnRectangleIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
