import type { NextConfig } from "next";
import { homeportAllowedDevOrigins } from "./src/homeport/dev-origin-config";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: homeportAllowedDevOrigins(),
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        // SQLite mutations are runtime data, not source changes. Watching an
        // isolated test database triggers HMR mid-journey, particularly in
        // WebKit, and can replace a protected navigation with its prior page.
        ignored: /node_modules|[\\/]prisma[\\/][^\\/]+\.db(?:[-.][^\\/]*)?$/u,
      };
    }
    return config;
  },
};

export default nextConfig;
