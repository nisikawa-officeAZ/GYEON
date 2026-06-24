import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_SUBTITLE } from "@/lib/plans/plan-types";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor:   "#0f172a",
  viewportFit:  "cover",  // enables safe-area-inset on iPhone notch / Dynamic Island
};

export const metadata: Metadata = {
  title: {
    default:  APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_SUBTITLE,
  manifest:    "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geist.variable} antialiased bg-[#080d1a] text-slate-100`}>
        {children}
      </body>
    </html>
  );
}
