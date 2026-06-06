'use client';

import GoogleCalendarSettings from '@/components/settings/GoogleCalendarSettings';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-primary-600 dark:text-primary-400">
          Account
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage integrations for your account.
        </p>
      </div>

      <GoogleCalendarSettings />
    </div>
  );
}
