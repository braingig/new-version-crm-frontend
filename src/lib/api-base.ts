/** REST API base URL (without /graphql). */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
  return url.replace(/\/graphql\/?$/, '');
}

export function getGoogleConnectUrl(accessToken: string): string {
  const base = getApiBaseUrl();
  return `${base}/api/auth/google/connect?access_token=${encodeURIComponent(accessToken)}`;
}
