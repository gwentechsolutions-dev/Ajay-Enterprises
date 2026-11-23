import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/slips/delivery-notes/:id",
        destination: "/api/v1/delivery-notes/:id/print",
      },
      {
        source: "/slips/return-notes/:id",
        destination: "/api/v1/return-notes/:id/print",
      },
      {
        source: "/slips/invoices/:id",
        destination: "/api/v1/invoices/:id/print",
      },
      {
        source: "/slips/bills/:id",
        destination: "/api/v1/purchases/bills/:id/print",
      },
      {
        source: "/slips/agreements/:id",
        destination: "/api/v1/rentals/agreements/:id/print",
      },
      {
        source: "/slips/direct-transfers/:id",
        destination: "/api/v1/direct-transfers/:id/print",
      },
      {
        source: "/slips/stock-transfers/:id",
        destination: "/api/v1/stock-transfers/:id/print",
      },
      {
        source: "/slips/statements/:id",
        destination: "/api/v1/rentals/statements/:id/print",
      },
      {
        source: "/slips/ewaybills/:id",
        destination: "/api/v1/ewaybills/:id/print",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/slips/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "all, index, follow, max-image-preview:large",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/api/v1/:path*/print",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "all, index, follow, max-image-preview:large",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/images/og/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "all, index, follow, max-image-preview:large",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/api/og",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "all, index, follow, max-image-preview:large",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

