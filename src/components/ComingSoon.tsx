'use client';

import { ClockIcon } from '@heroicons/react/24/outline';

interface ComingSoonProps {
  title?: string;
  description?: string;
}

export default function ComingSoon({
  title = 'Coming Soon',
  description = 'This section is under development. Check back later for updates.',
}: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-6">
          <ClockIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
}
