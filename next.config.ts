import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/adapter-mariadb", "mariadb", "pino", "pino-pretty", "exceljs", "nodemailer", "ioredis"],
  experimental: {
    serverActions: { bodySizeLimit: "32mb" },
    // Shared hosts (Hostinger) often hit thread/process limits during parallel builds.
    cpus: 1,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
