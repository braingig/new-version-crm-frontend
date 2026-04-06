import { getRestApiBaseUrl } from '@/lib/api-base';

export type SmtpTestResult =
    | { ok: true; sentTo?: string }
    | { ok: false; message: string };

/**
 * Calls backend POST /api/mail/test (verify + send test message). Pass the same token you use for GraphQL.
 */
export async function runSmtpTest(accessToken: string | null): Promise<SmtpTestResult> {
    if (!accessToken?.trim()) {
        return { ok: false, message: 'Not signed in' };
    }

    try {
        const res = await fetch(`${getRestApiBaseUrl()}/api/mail/test`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            message?: string;
            sentTo?: string;
        };

        if (res.status === 401) {
            return { ok: false, message: 'Unauthorized' };
        }

        if (data.ok === true) {
            return { ok: true, sentTo: data.sentTo };
        }

        return {
            ok: false,
            message: data.message || res.statusText || 'Check failed',
        };
    } catch (e) {
        return {
            ok: false,
            message: e instanceof Error ? e.message : 'Network error',
        };
    }
}
