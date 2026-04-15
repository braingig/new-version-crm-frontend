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
    CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { getAllowedRoutes } from '@/lib/permissions';
import Image from 'next/image';
// import logo from '../../public/images/logos/logosquare.png'
const allNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Employees', href: '/dashboard/employees', icon: UserGroupIcon },
    { name: 'Projects', href: '/dashboard/projects', icon: FolderIcon },
    { name: 'Tasks', href: '/dashboard/tasks', icon: ClockIcon },
    { name: 'Work schedule', href: '/dashboard/work-schedule', icon: CalendarDaysIcon },
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
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-20 lg:flex-col">
            <div className="flex grow flex-col gap-y-4 overflow-y-auto bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 px-3 py-4">
                <div className="flex h-14 shrink-0 items-center justify-center">
                    <Link
                        href="/dashboard"
                        className="h-10 w-10"
                        aria-label="Dashboard Home"
                    >
                        <Image
                            width="150"
                            height="96"
                            priority
                            src={"/images/logos/logosquare.png"}
                            alt="Logo"
                        />
                    </Link>
                </div>

                <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-5">
                        <li>
                            <ul role="list" className="space-y-1">
                                {navigation.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <li key={item.name}>
                                            <Link
                                                href={item.href}
                                                title={item.name}
                                                aria-label={item.name}
                                                className={`group flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isActive
                                                    ? 'bg-primary-600 text-white'
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400'
                                                    }`}
                                            >
                                                <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
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
