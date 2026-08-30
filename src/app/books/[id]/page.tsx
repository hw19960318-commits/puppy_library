"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BookListItem } from "@/components/BookListItem";
import { StatusBadge } from "@/components/StatusBadge";
import { Loading } from "@/components/Loading";
import { STATUS_LABELS } from "@/lib/constants";
import { parseTags } from "@/lib/types";

type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  publishDate: string | null;
  coverPath: string | null;
  description: string | null;
  tags: string;
  category: string | null;
  doubanId: string | null;
  doubanRating: number | null;
  status: string;
  myRating: number | null;
  myNotes: string | null;
  purchasedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

const STATUSES = ["unread", "wantToRead", "reading", "read"] as const;

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [similar, setSimilar] = useState<Book[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg("");
      try {
        const res = await fetch(`/api/books/${id}`);
        if (!res.ok) {
          setBook(null);
          return;
        }
        const data = await res.json();
        const loaded = data.book as Book;
        setBook(loaded);

        const allRes = await fetch("/api/books");
        const allData = await allRes.json();
        const all = (allData.books ?? []) as Book[];
        setSimilar(rankSimilar(loaded, all).slice(0, 6));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function updateStatus(status: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setBook(data.book);
        setMsg(`已标记为「${STATUS_LABELS[status]}」`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeBook() {
    if (!confirm("确定从书架移除这本书吗？")) return;
    const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/library");
  }

  async function generateDescription() {
    if (!book) return;
    setGenerating(true);
    setMsg("");
    try {
      const res = await fetch("/api/descriptions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookIds: [book.id], onlyMissing: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "生成简介失败");
        return;
      }
      if (data.fail > 0) {
        setMsg(data.results?.[0]?.error || "生成简介失败");
        return;
      }
      const refreshed = await fetch(`/api/books/${id}`);
      const refreshedData = await refreshed.json();
      if (refreshed.ok) setBook(refreshedData.book);
      setMsg("已用 DeepSeek 生成简介");
    } catch {
      setMsg("生成简介失败，请稍后重试");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <Loading text="奥奥正在取书…" />;
  }
  if (!book) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-stone-500">未找到该书</p>
        <Link href="/library" className="btn-secondary">
          返回书架
        </Link>
      </div>
    );
  }

  const tags = parseTags(book.tags);
  const meta: { label: string; value: string }[] = [];
  if (book.publisher) meta.push({ label: "出版社", value: book.publisher });
  if (book.publishDate) meta.push({ label: "出版日期", value: book.publishDate });
  if (book.isbn) meta.push({ label: "ISBN", value: book.isbn });
  if (book.category) meta.push({ label: "分类", value: book.category });

  return (
    <div className="space-y-6">
      <Link
        href="/library"
        className="group inline-flex items-center gap-1 text-sm text-amber-700 transition-colors hover:text-amber-900"
      >
        <span
          aria-hidden
          className="transition-transform duration-200 group-hover:-translate-x-0.5"
        >
          ←
        </span>
        返回书架
      </Link>

      {/* 书籍主卡 */}
      <div className="card relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300"
        />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={book.status} />
        </div>
        <h1 className="text-2xl font-bold leading-snug tracking-tight text-amber-950 sm:text-3xl">
          {book.title}
        </h1>
        <p className="mt-2 text-sm font-medium text-stone-500 sm:text-base">
          {book.author || "未知作者"}
        </p>

        {meta.length > 0 && (
          <dl className="mt-5 grid gap-x-8 gap-y-2.5 border-t border-amber-900/6 pt-5 sm:grid-cols-2">
            {meta.map((item) => (
              <div key={item.label} className="flex gap-3 text-sm">
                <dt className="w-16 shrink-0 text-stone-400">{item.label}</dt>
                <dd className="min-w-0 break-all text-stone-700">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800 ring-1 ring-amber-100"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6">
          <p className="mb-2.5 text-sm font-medium text-stone-700">阅读状态</p>
          <div className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl bg-amber-50/80 p-1 ring-1 ring-amber-100">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={saving}
                onClick={() => updateStatus(s)}
                className={`rounded-xl px-3.5 py-2 text-sm transition-all duration-200 active:scale-95 disabled:opacity-60 ${
                  book.status === s
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 font-medium text-white shadow-[0_2px_8px_-2px_rgba(217,119,6,0.5)]"
                    : "text-stone-600 hover:bg-white/80 hover:text-amber-900"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-100">
            <span
              aria-hidden
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white"
            >
              ✓
            </span>
            {msg}
          </p>
        )}
      </div>

      {/* 简介 */}
      <section className="card p-6 sm:p-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-amber-950">
            <span
              aria-hidden
              className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-400"
            />
            简介
          </h2>
          <button
            type="button"
            disabled={generating}
            onClick={generateDescription}
            className="rounded-full bg-sky-50 px-3.5 py-1.5 text-sm text-sky-700 ring-1 ring-sky-200 transition-all hover:bg-sky-100 active:scale-95 disabled:opacity-60"
          >
            {generating ? "DeepSeek 生成中…" : "用 DeepSeek 重写简介"}
          </button>
        </div>
        {book.description ? (
          <p className="whitespace-pre-wrap text-sm leading-loose text-stone-600 sm:text-[15px]">
            {book.description}
          </p>
        ) : (
          <p className="rounded-xl bg-amber-50/60 px-4 py-3 text-sm text-stone-400">
            暂无简介。配置 DEEPSEEK_API_KEY 后可一键生成，或点上方按钮单独生成。
          </p>
        )}
      </section>

      {similar.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-950">
            <span
              aria-hidden
              className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-400"
            />
            相似推荐
          </h2>
          <div className="card overflow-hidden">
            {similar.map((b) => (
              <BookListItem key={b.id} {...b} />
            ))}
          </div>
        </section>
      )}

      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={removeBook}
          className="rounded-full px-4 py-2 text-sm text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          从书架移除
        </button>
      </div>
    </div>
  );
}

function rankSimilar(target: Book, candidates: Book[]): Book[] {
  const targetTags = new Set(parseTags(target.tags));
  return candidates
    .filter((b) => b.id !== target.id)
    .map((book) => {
      let score = 0;
      if (target.author && book.author && target.author.trim() === book.author.trim()) {
        score += 3;
      }
      for (const tag of parseTags(book.tags)) {
        if (targetTags.has(tag)) score += 2;
      }
      if (
        target.category &&
        book.category &&
        target.category.trim() === book.category.trim()
      ) {
        score += 1;
      }
      return { book, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.book);
}
