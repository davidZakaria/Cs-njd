import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import "./env";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: [
        "cs-njd.duckdns.org",
        "https://cs-njd.duckdns.org",
        "localhost:3000",
        "localhost:3001",
      ],
    },
  },
};

export default withNextIntl(nextConfig);
