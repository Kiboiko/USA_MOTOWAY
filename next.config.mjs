import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: false,
  images: {
    unoptimized: true
  },
  async redirects() {
    return [];
  },
  async headers() {
    return [
      {
        source: "/admin/live-chat",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0"
          }
        ]
      },
      {
        source: "/api/live-chat/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0"
          }
        ]
      },
      {
        source: "/admin/inventory",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0"
          }
        ]
      },
      {
        source: "/admin/clients",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0"
          }
        ]
      },
      {
        source: "/api/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0"
          }
        ]
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
          },
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests"
          }
        ]
      }
    ];
  },
  turbopack: {
    root: projectRoot
  }
};

export default nextConfig;
