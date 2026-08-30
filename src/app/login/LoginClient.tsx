"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mascot } from "@/components/Mascot";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "访问码错误");
        return;
      }
      const from = searchParams.get("from") || "/";
      router.replace(from);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-7">
      <Mascot size="lg" message="汪！请输入访问码才能进图书馆哦～" />
      <form
        onSubmit={onSubmit}
        className="card relative w-full max-w-sm overflow-hidden rounded-3xl p-7"
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300"
        />
        <label className="mb-2 block text-sm font-medium text-stone-700">
          访问码
        </label>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="input mb-3 py-3"
          placeholder="请输入访问码"
          autoFocus
        />
        {error && (
          <p className="mb-3 flex items-center gap-1.5 text-sm text-red-500">
            <span aria-hidden>⚠️</span>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !code}
          className="btn-primary w-full py-3"
        >
          {loading ? "验证中…" : "进入奥奥图书馆"}
        </button>
      </form>
    </div>
  );
}
