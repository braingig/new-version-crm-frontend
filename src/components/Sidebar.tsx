'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    HomeIcon,
    UserGroupIcon,
    FolderIcon,
    ClockIcon,
    BanknotesIcon,
    ChartBarIcon,
    DocumentChartBarIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { getAllowedRoutes } from '@/lib/permissions';

const allNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Employees', href: '/dashboard/employees', icon: UserGroupIcon },
    { name: 'Projects', href: '/dashboard/projects', icon: FolderIcon },
    { name: 'Tasks', href: '/dashboard/tasks', icon: ClockIcon },
    // Time Tracker – commented out for now
    // { name: 'Time Tracker', href: '/dashboard/time-tracker', icon: ClockIcon },
    { name: 'Payroll', href: '/dashboard/payroll', icon: BanknotesIcon },
    { name: 'Sales', href: '/dashboard/sales', icon: ChartBarIcon },
    { name: 'Reports', href: '/dashboard/reports', icon: DocumentChartBarIcon },
];

export default function Sidebar() {
    const pathname = usePathname();
    const role = useAuthStore((state) => state.user?.role);
    const allowedPaths = getAllowedRoutes(role);
    const navigation = allNavigation.filter((item) => allowedPaths.includes(item.href));

    return (
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
            <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 px-6 pb-4">
                <div className="flex h-16 shrink-0 items-center">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                        RemoteTeam
                    </h1>
                </div>
                <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                        <li>
                            <ul role="list" className="-mx-2 space-y-1">
                                {navigation.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <li key={item.name}>
                                            <Link
                                                href={item.href}
                                                className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors ${isActive
                                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                                        : 'text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                                {item.name}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
    );
}
