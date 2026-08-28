import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Native / runtime-bound packages must stay out of the webpack bundle.
  serverExternalPackages: ["sharp", "argon2", "@prisma/client", "pdfkit", "nodemailer"],
  // Images are pre-processed to WebP/AVIF and served from our own /api/media
  // endpoint (see docs/ARCHITECTURE.md), so next/image optimization is off.
  images: { unoptimized: true },
  experimental: {
    // Server actions use the same origin; keep the default 250 kB limit.
  },
};

export default nextConfig;
