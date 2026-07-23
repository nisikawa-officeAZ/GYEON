import { BRAND } from "@/lib/brand/variant";

// Served at the public URL /manifest.json — a Route Handler (not the Next metadata
// manifest route) because /manifest.json bypasses the frozen auth middleware, whereas
// /manifest.webmanifest and /brand/*/manifest.json are intercepted (R85H-D1).
// Statically generated; no cookies/headers/auth/tenant/database state.
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.description,
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: BRAND.colors.background,
    theme_color: BRAND.colors.background,
    icons: [
      { src: BRAND.favicon.android192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: BRAND.favicon.android512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: BRAND.favicon.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
