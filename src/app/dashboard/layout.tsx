'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { useAuth } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DashboardFloatingActions from '@/components/DashboardFloatingActions';
import { canAccessRoute } from '@/lib/permissions';
import { GET_ACTIVE_TIME_ENTRY } from '@/lib/graphql/queries';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, hasHydrated, user } = useAuth();
    const { data: activeData } = useQuery(GET_ACTIVE_TIME_ENTRY, {
        skip: !isAuthenticated,
        fetchPolicy: 'network-only',
        pollInterval: 5000,
    });
    const activeEntry = activeData?.activeTimeEntry;

    useEffect(() => {
        if (hasHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, hasHydrated, router]);

    useEffect(() => {
        if (hasHydrated && isAuthenticated && user?.role && pathname) {
            if (!canAccessRoute(user.role, pathname)) {
                router.replace('/dashboard');
            }
        }
    }, [hasHydrated, isAuthenticated, user?.role, pathname, router]);

    useEffect(() => {
        if (!activeEntry?.id) return;

        let stopSent = false;
        const graphqlEndpoint = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';

        const stopRunningTimer = () => {
            if (stopSent) return;
            const token = localStorage.getItem('accessToken');
            if (!token) return;
            stopSent = true;

            // Fire-and-forget stop so a confirmed tab close persists timer state.
            const body = JSON.stringify({
                query: `
                    mutation StopTimeEntryOnClose {
                        stopTimeEntry {
                            id
                        }
                    }
                `,
            });
            fetch(graphqlEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: `Bearer ${token}`,
                },
                body,
                keepalive: true,
            }).catch(() => {
                // Ignore network failures during page unload.
            });
        };

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };

        const handlePageHide = () => {
            stopRunningTimer();
        };

        const handleUnload = () => {
            stopRunningTimer();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('unload', handleUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('unload', handleUnload);
        };
    }, [activeEntry?.id]);

    if (!hasHydrated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <div className="lg:pl-20">
                <Header />
                <main className="p-6">{children}</main>
            </div>
            <DashboardFloatingActions />
        </div>
    );
}
