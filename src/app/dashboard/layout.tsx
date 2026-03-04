'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { canAccessRoute } from '@/lib/permissions';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, hasHydrated, user } = useAuth();

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
            <div className="lg:pl-64">
                <Header />
                <main className="p-6">{children}</main>
            </div>
        </div>
    );
}
