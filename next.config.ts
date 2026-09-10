import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import "./env";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
      allowedOrigins: [
        "njd-crm.com",
        "www.njd-crm.com",
        "app.njd-crm.com",
        "https://njd-crm.com",
        "https://www.njd-crm.com",
        "https://app.njd-crm.com",
        "cs-njd.duckdns.org",
        "https://cs-njd.duckdns.org",
        "localhost:3000",
        "localhost:3001",
      ],
    },
  },
};

export default withNextIntl(nextConfig);
