import type { NextConfig } from "next";


/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/cron/sales-report": ["./node_modules/@sparticuz/chromium/**"],
    "/api/cron/collection-report": ["./node_modules/@sparticuz/chromium/**"],
  },
};

module.exports = nextConfig;

export default nextConfig;
