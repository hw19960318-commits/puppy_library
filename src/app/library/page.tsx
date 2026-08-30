"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookListItem } from "@/components/BookListItem";
import { Mascot } from "@/components/Mascot";
import { Loading } from "@/components/Loading";
import { STATUS_LABELS } from "@/lib/constants";

type Book = {
  id: string;
  title: string;
  author: string;
  status: string;
  doubanRating: number | null;
  tags: string;
  category: string | null;
};

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "wantToRead", label: STATUS_LABELS.wantToRead },
  { key: "reading", label: STATUS_LABELS.reading },
  { key: "read", label: STATUS_LABELS.read },
  { key: "unread", label: STATUS_LABELS.unread },
];

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [smart, setSmart] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (smart) {
        params.set("smart", "staleUnread");
      } else if (status !== "all") {
        params.set("status", status);
      }
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/books?${params}`);
      const data = await res.json();
      setBooks(data.books ?? []);
    } finally {
      setLoading(false);
    }
  }, [status, q, smart]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-amber-950">
            书架
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {loading ? "加载中…" : `共 ${books.length} 本`}
          </p>
        </div>
        <Link href="/add" className="btn-primary">
          + 录入新书
        </Link>
      </div>

      {/* 筛选与搜索 */}
      <div className="card flex flex-col gap-3.5 p-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setSmart(false);
                setStatus(f.key);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-all duration-200 active:scale-95 ${
                !smart && status === f.key
                  ? "bg-gradient-to-br from-amber-400 to-orange-500 font-medium text-white shadow-[0_2px_8px_-2px_rgba(217,119,6,0.5)]"
                  : "bg-white text-amber-900 ring-1 ring-amber-200 hover:bg-amber-50"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSmart((v) => !v)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-all duration-200 active:scale-95 ${
              smart
                ? "bg-gradient-to-br from-orange-400 to-rose-400 font-medium text-white shadow-[0_2px_8px_-2px_rgba(234,88,12,0.5)]"
                : "bg-white text-orange-800 ring-1 ring-orange-200 hover:bg-orange-50"
            }`}
            title="买入或入库超过一年仍未读"
          >
            ⏳ 沉睡超一年
          </button>
        </div>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-stone-400"
          >
            🔍
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索书名、作者、ISBN…"
            className="input pl-9"
          />
        </div>
      </div>

      {loading ? (
        <Loading text="奥奥正在找书…" />
      ) : books.length === 0 ? (
        <div className="card flex flex-col items-center gap-5 border-dashed bg-white/70 p-10">
          <Mascot message="书架还是空的，去录入第一本书吧！" />
          <Link href="/add" className="btn-primary">
            去录入
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {books.map((book) => (
            <BookListItem key={book.id} {...book} />
          ))}
        </div>
      )}
    </div>
  );
}
