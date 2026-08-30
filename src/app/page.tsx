"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { StatusBadge } from "@/components/StatusBadge";
import { Loading } from "@/components/Loading";

type Book = {
  id: string;
  title: string;
  author: string;
  coverPath: string | null;
  description: string | null;
  status: string;
  doubanRating: number | null;
};

export default function HomePage() {
  const [book, setBook] = useState<Book | null>(null);
  const [dateKey, setDateKey] = useState("");
  const [poolSize, setPoolSize] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (exclude?: string) => {
    setLoading(true);
    try {
      const url = exclude
        ? `/api/recommend?exclude=${exclude}`
        : "/api/recommend";
      const res = await fetch(url);
      const data = await res.json();
      setBook(data.book);
      setDateKey(data.dateKey);
      setPoolSize(data.poolSize);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <Mascot
          size="lg"
          message={
            loading
              ? "奥奥正在挑书…"
              : book
                ? "今天奥奥为你叼来了这本书～"
                : "想读和未读书架空空的，去录入几本吧！"
          }
        />
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-amber-950">
            今日推荐
          </h1>
          {dateKey && (
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs text-stone-500 ring-1 ring-amber-900/8">
                {dateKey}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs text-stone-500 ring-1 ring-amber-900/8">
                候选池 {poolSize} 本（想读 / 未读）
              </span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <Loading text="奥奥正在挑书…" />
      ) : !book ? (
        <div className="card flex flex-col items-center gap-5 border-dashed bg-white/70 p-10 text-center">
          <Mascot message="书架还空着呢，奥奥想帮你叼书回来！" />
          <Link href="/add" className="btn-primary">
            录入第一本
          </Link>
        </div>
      ) : (
        <article className="card relative overflow-hidden rounded-3xl p-6 shadow-warm sm:p-9">
          {/* 顶部渐变发丝线 */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300"
          />
          {/* 角落大爪印装饰 */}
          <svg
            aria-hidden
            viewBox="0 0 48 48"
            className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rotate-12 text-amber-600 opacity-[0.06]"
            fill="currentColor"
          >
            <ellipse cx="24" cy="29" rx="6.4" ry="5.1" />
            <circle cx="14.9" cy="21.2" r="2.7" />
            <circle cx="21" cy="16.9" r="2.7" />
            <circle cx="27.4" cy="16.9" r="2.7" />
            <circle cx="33.5" cy="21.2" r="2.7" />
          </svg>

          <div className="relative">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={book.status} />
            </div>
            <h2 className="text-2xl font-bold leading-snug tracking-tight text-amber-950 sm:text-4xl">
              {book.title}
            </h2>
            <p className="mt-2.5 text-sm font-medium text-stone-500 sm:text-base">
              {book.author || "未知作者"}
            </p>
            {book.description && (
              <p className="mt-5 line-clamp-3 border-l-2 border-amber-200 pl-4 text-sm leading-loose text-stone-600 sm:line-clamp-4 sm:text-[15px]">
                {book.description.trim()}
              </p>
            )}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={`/books/${book.id}`} className="btn-primary">
                查看详情
              </Link>
              <button
                type="button"
                onClick={() => load(book.id)}
                className="btn-secondary"
              >
                换一本
              </button>
              <Link href="/library" className="btn-ghost">
                去书架逛逛 →
              </Link>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
