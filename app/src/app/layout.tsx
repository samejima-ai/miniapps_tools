import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans_JP } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "工具管理 | カクマン工業",
  description: "現場職人向け 工具持出・返却管理ミニアプリ",
  manifest: "/manifest.webmanifest",
  applicationName: "工具管理",
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
  children: ReactNode;
}) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${jetBrainsMono.variable}`}>
      <body className="bg-background text-ink font-sans">
        <Providers>
          <div className="max-w-mobile mx-auto min-h-screen flex flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
