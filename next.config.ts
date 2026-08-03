import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
