import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // parser libraries are required at runtime, not bundled — unzipper's
  // optional S3 support otherwise breaks the build, and pdf-parse ships a
  // worker file the bundler must not inline
  serverExternalPackages: ["unzipper", "pdf-parse", "mammoth", "xlsx", "postgres"],
};

export default nextConfig;
