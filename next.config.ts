import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the 0G storage SDK as a runtime Node dependency instead of bundling it.
  serverExternalPackages: ["@0gfoundation/0g-storage-ts-sdk", "open-jsonrpc-provider"],
  poweredByHeader: false,
};

export default nextConfig;
