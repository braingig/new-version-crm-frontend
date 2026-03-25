/** @type {import('next').NextConfig} */
const allowedOrigins = process.env.SERVER_ACTIONS_ALLOWED_ORIGINS
    ? process.env.SERVER_ACTIONS_ALLOWED_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
    : undefined

const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    generateBuildId: async () => {
        return `${Date.now()}`
    },
    experimental: {
        serverActions: {
            ...(allowedOrigins?.length ? { allowedOrigins } : {}),
            // Default is 1mb; truncated multipart bodies sometimes surface as "Unexpected end of form"
            bodySizeLimit: '2mb',
        },
    },

    async headers() {
        return [
          {
            source: "/:path*",
            headers: [
              {
                key: "Cache-Control",
                value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
              },
            ],
          },
        ];
      },
}

module.exports = nextConfig
