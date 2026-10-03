import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // 90 is used for the large illustrations (sign-in hero) so the pencil texture stays sharp.
  images: { qualities: [75, 90] },
  // The seed reads data/*.csv at runtime; ship them with the reset route (needed on Vercel).
  outputFileTracingIncludes: {
    "/api/admin/reset": ["./data/**/*.csv"],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
