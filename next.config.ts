import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // heic-convert (+ its libheif-js WASM) and sharp are native/WASM-backed and must
  // run un-bundled on the server so the vehicle-registration OCR image pipeline can
  // decode HEIC/HEIF → JPEG before the sharp enhancement step.
  serverExternalPackages: ['@react-pdf/renderer', 'sharp', 'heic-convert', 'libheif-js'],
  // Bundle the local Japanese PDF fonts (M PLUS 1p, OFL) into the serverless functions
  // that render PDFs, so registerPdfFonts() can read them from disk at runtime.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/pdf/fonts/*.ttf"],
  },
  experimental: {
    serverActions: {
      // iPhone 12MP photos average 6-8 MB. Allow up to 20 MB to handle
      // uncompressed HEIC-converted JPEGs while client-side compression
      // reduces typical payloads to well under 1 MB before they leave the device.
      bodySizeLimit: '20mb',
    },
  },
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
