import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["knex", "oracledb"],
  devIndicators: false,
};

export default nextConfig;
