import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "工具管理 | カクマン工業",
  description: "現場職人向け 工具持出・返却管理ミニアプリ",
  manifest: "/manifest.webmanifest",
  applicationName: "工具管理",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0066b3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-background text-ink font-sans">
        <div className="max-w-mobile mx-auto min-h-screen flex flex-col">{children}</div>
      </body>
    </html>
  );
}
