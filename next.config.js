/** @type {import('next').NextConfig} */
const allowedOrigins = process.env.SERVER_ACTIONS_ALLOWED_ORIGINS
    ? process.env.SERVER_ACTIONS_ALLOWED_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
    : undefined

const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    experimental: {
        serverActions: {
            ...(allowedOrigins?.length ? { allowedOrigins } : {}),
            // Default is 1mb; truncated multipart bodies sometimes surface as "Unexpected end of form"
            bodySizeLimit: '2mb',
        },
    },

    async headers() {
        return [
            // Cache Next.js build assets aggressively (safe + avoids 404s from stale HTML).
            {
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            // Default: don't cache HTML/app routes (prevents Cloudflare serving old HTML that references missing chunks).
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store',
                    },
                ],
            },
        ];
      },
}

module.exports = nextConfig
