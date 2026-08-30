"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";

const links = [
  { href: "/", label: "今日推荐" },
  { href: "/library", label: "书架" },
  { href: "/add", label: "录入" },
  { href: "/stats", label: "统计" },
];

/** 顶部导航栏 */
export function Nav() {
  const pathname = usePathname();
  // 避免 usePathname 首屏水合不一致
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <header
      className="sticky top-0 z-40 border-b border-amber-900/8 bg-[#fff8f0]/85 backdrop-blur-xl"
      suppressHydrationWarning
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 font-bold text-amber-950"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascot/aoao.png"
            alt="奥奥"
            width={34}
            height={34}
            className="rounded-full object-cover shadow-sm ring-2 ring-white transition-transform duration-300 group-hover:-rotate-8"
          />
          <span className="text-lg tracking-wide">{APP_NAME}</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => {
            const active =
              ready &&
              (link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-sm transition-all duration-200 active:scale-95 ${
                  active
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 font-medium text-white shadow-[0_2px_8px_-2px_rgba(217,119,6,0.5)]"
                    : "text-amber-900/65 hover:bg-amber-100/80 hover:text-amber-950"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
