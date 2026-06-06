'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  DISCONNECT_GOOGLE_CALENDAR,
  GET_GOOGLE_CALENDAR_STATUS,
} from '@/lib/graphql/queries';
import { getGoogleConnectUrl } from '@/lib/api-base';
import { useToast } from '@/components/ToastProvider';

export default function GoogleCalendarSettings() {
  const { showToast } = useToast();
  const [connecting, setConnecting] = useState(false);

  const { data, loading, refetch } = useQuery(GET_GOOGLE_CALENDAR_STATUS, {
    fetchPolicy: 'network-only',
  });

  const [disconnectGoogle, { loading: disconnecting }] = useMutation(
    DISCONNECT_GOOGLE_CALENDAR,
    {
      onCompleted: () => {
        showToast({ variant: 'success', message: 'Google Calendar disconnected.' });
        refetch();
      },
      onError: (err) => {
        showToast({ variant: 'error', message: err.message || 'Failed to disconnect.' });
      },
    },
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    const message = params.get('message');

    if (google === 'connected') {
      showToast({ variant: 'success', message: 'Google Calendar connected successfully.' });
      refetch();
    } else if (google === 'error') {
      showToast({
        variant: 'error',
        message: message || 'Failed to connect Google Calendar.',
      });
    }

    if (google) {
      params.delete('google');
      params.delete('message');
      const next = params.toString();
      const url = `${window.location.pathname}${next ? `?${next}` : ''}`;
      window.history.replaceState({}, '', url);
    }
  }, [refetch, showToast]);

  const status = data?.googleCalendarStatus;
  const connected = Boolean(status?.connected);

  const handleConnect = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      showToast({ variant: 'error', message: 'You must be logged in to connect Google.' });
      return;
    }
    setConnecting(true);
    window.location.href = getGoogleConnectUrl(token);
  };

  const handleDisconnect = () => {
    if (!window.confirm('Disconnect Google Calendar from your account?')) return;
    disconnectGoogle();
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Google Calendar
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connect once to auto-generate Google Meet links when you create meetings in the
            calendar.
          </p>
        </div>

        {loading ? (
          <span className="text-sm text-gray-400">Loading…</span>
        ) : connected ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            Not connected
          </span>
        )}
      </div>

      {connected && status?.googleEmail && (
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
          Connected as <strong>{status.googleEmail}</strong>
          {status.connectedAt && (
            <span className="text-gray-500 dark:text-gray-400">
              {' '}
              · since {new Date(status.connectedAt).toLocaleDateString()}
            </span>
          )}
        </p>
      )}

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        If Meet link creation fails with a scopes error, click <strong>Disconnect</strong>, remove
        this app from your{' '}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary-600 underline dark:text-primary-400"
        >
          Google account permissions
        </a>
        , then connect again.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {!connected ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="btn-primary"
          >
            {connecting ? 'Redirecting…' : 'Connect Google Calendar'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="btn-secondary"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        You will be redirected to Google to approve calendar access. Make sure your Google Cloud
        OAuth redirect URI is set to{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">
          …/api/auth/google/callback
        </code>
        .
      </p>
    </div>
  );
}
