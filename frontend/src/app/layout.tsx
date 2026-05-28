import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, IBM_Plex_Mono, Be_Vietnam_Pro } from "next/font/google";
import { QueryProvider } from "@/lib/query-provider";
import { RouteProgress } from "@/components/ui/route-progress";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "VLearning — White-label EdTech Platform",
    template: "%s | VLearning",
  },
  description:
    "B2B SaaS White-label EdTech Platform — Build your own branded online learning experience.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "VLearning",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${monoFont.variable} ${beVietnamPro.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
