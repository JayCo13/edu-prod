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
    default: "Edura — Quản lý trung tâm và trường học",
    template: "%s | Edura",
  },
  description:
    "Một nền tảng cho trung tâm dạy thêm (tính lương theo buổi, xuất Excel) và trường học (xếp thời khoá biểu cả khối trong một bảng).",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Edura",
    images: [
      {
        url: "/edura-logo.png",
        width: 578,
        height: 431,
        alt: "Edura logo",
      },
    ],
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
