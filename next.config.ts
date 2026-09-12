import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Catalog assets are already compressed WebP files. Keeping them unoptimized
  // also makes independent Cloudflare Workers deployments work without an
  // additional Cloudflare Images binding.
  images: { unoptimized: true },
};

export default nextConfig;
