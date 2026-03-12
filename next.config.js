/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    generateBuildId: async () => {
        return `${Date.now()}`
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
