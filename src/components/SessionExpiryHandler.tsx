'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { getJwtExpiryMs } from '@/lib/jwt';

const FALLBACK_EXPIRY_MS = 10080 * 60 * 1000; // 2 min if JWT exp can't be read

/**
 * Schedules auto-logout when the access token expires.
 * Runs when authenticated; clears session and redirects to /login at expiry.
 */
export default function SessionExpiryHandler() {
    const router = useRouter();
    const accessToken = useAuthStore((s) => s.accessToken);
    const logout = useAuthStore((s) => s.logout);
    const _hasHydrated = useAuthStore((s) => s._hasHydrated);
    const user = useAuthStore((s) => s.user);
    const refreshToken = useAuthStore((s) => s.refreshToken);
    const isAuthenticated = !!(user && accessToken && refreshToken);
    const hasHydrated = _hasHydrated;
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!hasHydrated || !isAuthenticated || !accessToken) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            return;
        }

        const expiryMs = getJwtExpiryMs(accessToken);
        const now = Date.now();
        const delay =
            expiryMs != null
                ? Math.max(0, expiryMs - now)
                : FALLBACK_EXPIRY_MS;

        if (expiryMs != null && expiryMs <= now) {
            logout();
            router.replace('/login');
            return;
        }

        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            logout();
            router.replace('/login');
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [hasHydrated, isAuthenticated, accessToken, logout, router]);

    return null;
}
