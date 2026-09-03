import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Google Cloud Storage hosting — no Node server at
  // runtime, so every page is client-rendered and all data comes from the
  // kapzo-backend REST API + Socket.IO.
  output: "export",
  // GCS serves `<route>/index.html`; trailing slashes make folder-style
  // object keys line up with client-side routes.
  trailingSlash: true,
  images: {
    // next/image optimization needs a server — serve originals instead.
    unoptimized: true,
  },
};

export default nextConfig;
