'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

function getSocketUrl(): string {
    if (typeof window === 'undefined') return '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    try {
        return new URL(apiUrl).origin;
    } catch {
        return 'http://localhost:4000';
    }
}

/**
 * Connects to the notification WebSocket when userId is set.
 * Emits 'register' with { userId } and calls onNotification when a new notification is pushed.
 */
export function useNotificationSocket(
    userId: string | null,
    onNotification?: () => void,
) {
    const socketRef = useRef<Socket | null>(null);
    const onNotificationRef = useRef(onNotification);
    onNotificationRef.current = onNotification;

    useEffect(() => {
        if (!userId) return;

        const url = getSocketUrl();
        if (!url) return;

        const socket = io(url, {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.emit('register', { userId });

        socket.on('notification', () => {
            onNotificationRef.current?.();
        });

        return () => {
            socket.off('notification');
            socket.disconnect();
            socketRef.current = null;
        };
    }, [userId]);

    return socketRef.current;
}
