import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow larger JSON bodies locally (Vercel still caps ~4.5MB; media uses signed uploads).
    serverActions: {
      bodySizeLimit: "20mb",
    },
    middlewareClientMaxBodySize: "20mb",
  },
  async redirects() {
    return [
      {
        source: "/store",
        destination: "/work-bench",
        permanent: true,
      },
      {
        source: "/store/:path*",
        destination: "/projects/:path*",
        permanent: true,
      },
      {
        source: "/projects",
        destination: "/work-bench",
        permanent: false,
      },
      {
        source: "/work-bench/login",
        destination: "/work-bench",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
