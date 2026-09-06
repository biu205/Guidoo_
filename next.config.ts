import type { NextConfig } from "next";

// The real backend is deployed separately and sends no CORS headers, so the
// browser can't call it directly. Proxy it through this app instead: the
// client hits same-origin `/be/*`, Next forwards it to the backend server-side.
const BACKEND_API_URL =
  process.env.BACKEND_API_URL ?? "https://guidoo-be.vercel.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/be/:path*",
        destination: `${BACKEND_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
