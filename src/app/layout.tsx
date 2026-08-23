import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand/variant";
import DevServiceWorkerCleanup from "@/components/system/DevServiceWorkerCleanup";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor:   BRAND.colors.background,
  viewportFit:  "cover",  // enables safe-area-inset on iPhone notch / Dynamic Island
};

export const metadata: Metadata = {
  title: {
    default:  BRAND.name,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  other: {
    google: "notranslate",
  },
  // PWA manifest is served at /manifest.json by src/app/manifest.json/route.ts
  // (a Route Handler on a path that bypasses the frozen auth middleware).
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: BRAND.favicon.ico32, sizes: "32x32", type: "image/png" },
      { url: BRAND.favicon.ico16, sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: BRAND.favicon.apple180, sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" translate="no">
      <body className={`${geist.variable} notranslate antialiased bg-[#080d1a] text-slate-100`}>
        <DevServiceWorkerCleanup />
        {children}
      </body>
    </html>
  );
}
