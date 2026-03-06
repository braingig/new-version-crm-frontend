/**
 * Decode JWT payload without verification (client-side only, for reading exp).
 * Returns expiry timestamp in milliseconds, or null if invalid/missing.
 */
function base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    return atob(base64);
}

export function getJwtExpiryMs(token: string): number | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3 || !parts[1]) return null;
        const json = base64UrlDecode(parts[1]);
        const decoded = JSON.parse(json) as { exp?: number };
        if (typeof decoded.exp !== 'number') return null;
        return decoded.exp * 1000;
    } catch {
        return null;
    }
}
