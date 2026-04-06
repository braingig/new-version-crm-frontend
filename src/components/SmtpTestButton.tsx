'use client';

import { useSmtpTest, type UseSmtpTestOptions } from '@/lib/useSmtpTest';

export interface SmtpTestButtonProps extends UseSmtpTestOptions {
    /** Classes on the outer wrapper (e.g. sidebar footer spacing). */
    className?: string;
    /** Classes on the `<button>`. */
    buttonClassName?: string;
    /** Visible label when idle. */
    label?: string;
    /** Visible label while loading. */
    loadingLabel?: string;
    /** Show a top border above the control (sidebar style). */
    bordered?: boolean;
}

const defaultButtonClass =
    'w-full rounded-md bg-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600';

/**
 * Triggers `POST /api/mail/test` and shows success or error text. Use anywhere in the app;
 * for custom UI only, use {@link useSmtpTest} instead.
 */
export function SmtpTestButton({
    className,
    buttonClassName = defaultButtonClass,
    label = 'Test email (SMTP)',
    loadingLabel = 'Testing email…',
    bordered = false,
    getAccessToken,
}: SmtpTestButtonProps) {
    const { status, detail, runTest } = useSmtpTest({ getAccessToken });

    return (
        <div
            className={`${bordered ? 'border-t border-gray-200 pt-4 dark:border-gray-600' : ''} ${className ?? ''}`.trim()}
        >
            <button
                type="button"
                onClick={() => void runTest()}
                disabled={status === 'loading'}
                className={buttonClassName}
            >
                {status === 'loading' ? loadingLabel : label}
            </button>
            {status === 'ok' && detail && (
                <p className="mt-2 text-xs font-medium text-green-600 dark:text-green-400">
                    {detail}
                </p>
            )}
            {status === 'error' && detail && (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                    {detail}
                </p>
            )}
        </div>
    );
}
