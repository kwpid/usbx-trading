import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'beta.untitled-sandbox.com',
      },
      {
        protocol: 'https',
        hostname: 'assets.unsbx.org',
      },
      {
        protocol: 'https',
        hostname: 'tr.rbxcdn.com',
      }
    ],
  },
};

export default nextConfig;
