'use client';

import { BellIcon, UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { LOGOUT_MUTATION } from '@/lib/graphql/queries';

export default function Header() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const router = useRouter();
    const [logoutMutation] = useMutation(LOGOUT_MUTATION);

    const handleLogout = async () => {
        try {
            // Call backend logout to stop any active timers
            await logoutMutation();
        } catch (error) {
            console.error('Logout error:', error);
            // Continue with local logout even if backend fails
        }
        
        // Clear local auth state
        logout();
        router.push('/login');
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
                    <button type="button" className="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-500">
                        <span className="sr-only">View notifications</span>
                        <BellIcon className="h-6 w-6" aria-hidden="true" />
                        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800" />
                    </button>

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
