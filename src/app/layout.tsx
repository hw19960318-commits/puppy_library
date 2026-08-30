import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import { Nav } from "@/components/Nav";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "以比熊奥奥为主题的实体书藏书管理与阅读追踪",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${notoSansSC.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 motion-safe:animate-fade-up sm:py-8">
          {children}
        </main>
        <footer className="border-t border-amber-900/8 py-5 text-center text-xs text-amber-800/50">
          奥奥图书馆 · 本地私密藏书 · 比熊护书中 🐾
        </footer>
      </body>
    </html>
  );
}
