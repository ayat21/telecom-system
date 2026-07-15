import type { NextConfig } from "next";


/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/cron/sales-report/route": ["./node_modules/@sparticuz/chromium/**"],
      "/api/cron/collection-report/route": ["./node_modules/@sparticuz/chromium/**"],
    },
  },
};

module.exports = nextConfig;

export default nextConfig;
