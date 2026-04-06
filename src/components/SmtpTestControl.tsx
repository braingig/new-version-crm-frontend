'use client';

import { useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { runSmtpTest } from '@/lib/smtp-test';

type MailTestStatus = 'idle' | 'loading' | 'ok' | 'error';

export type SmtpTestControlProps = {
    /** Applied to the outer wrapper (e.g. spacing, border). */
    className?: string;
    /** Applied to the button element. */
    buttonClassName?: string;
    labelIdle?: string;
    labelLoading?: string;
    /**
     * If set, this token is used instead of the access token from auth store
     * (e.g. scripts or parent-held token).
     */
    accessTokenOverride?: string | null;
};

export function SmtpTestControl({
    className,
    buttonClassName,
    labelIdle = 'Test email (SMTP)',
    labelLoading = 'Testing email…',
    accessTokenOverride,
}: SmtpTestControlProps) {
    const storeToken = useAuthStore((s) => s.accessToken);
    const token = accessTokenOverride !== undefined ? accessTokenOverride : storeToken;

    const [mailStatus, setMailStatus] = useState<MailTestStatus>('idle');
    const [mailDetail, setMailDetail] = useState<string | null>(null);

    const testMailConnection = useCallback(async () => {
        setMailStatus('loading');
        setMailDetail(null);

        const effectiveToken =
            (accessTokenOverride !== undefined ? accessTokenOverride : token)?.trim() ||
            (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

        const result = await runSmtpTest(effectiveToken);

        if (result.ok) {
            setMailStatus('ok');
            setMailDetail(
                result.sentTo
                    ? `Test email sent (${result.sentTo}). Check your Mailtrap inbox.`
                    : 'Test email sent. Check your Mailtrap inbox.',
            );
        } else {
            setMailStatus('error');
            setMailDetail(result.message);
        }
    }, [accessTokenOverride, token]);

    const defaultButtonClass =
        'w-full rounded-md bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600';

    return (
        <div className={className}>
            <button
                type="button"
                onClick={testMailConnection}
                disabled={mailStatus === 'loading'}
                className={buttonClassName ?? defaultButtonClass}
            >
                {mailStatus === 'loading' ? labelLoading : labelIdle}
            </button>
            {mailStatus === 'ok' && (
                <p className="mt-2 text-xs font-medium text-green-600 dark:text-green-400">
                    {mailDetail}
                </p>
            )}
            {mailStatus === 'error' && (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                    {mailDetail}
                </p>
            )}
        </div>
    );
}
