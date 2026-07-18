import type { NextConfig } from "next";

function companionCspSources() {
  const fallback = "http://127.0.0.1:32179";
  try {
    const endpoint = new URL(process.env.NEXT_PUBLIC_COMPANION_URL || fallback);
    if (!["127.0.0.1", "localhost"].includes(endpoint.hostname) || !["http:", "https:"].includes(endpoint.protocol))
      return { http: fallback, socket: "ws://127.0.0.1:32179" };
    return {
      http: endpoint.origin,
      socket: `${endpoint.protocol === "https:" ? "wss:" : "ws:"}//${endpoint.host}`,
    };
  } catch {
    return { http: fallback, socket: "ws://127.0.0.1:32179" };
  }
}

const companionSources = companionCspSources();

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), serial=()" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: ${companionSources.http}; connect-src 'self' ${companionSources.http} ${companionSources.socket}; worker-src 'self' blob:; manifest-src 'self'`,
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, private, max-age=0" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
