import { BookStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/constants";
import { Mascot } from "@/components/Mascot";

export const dynamic = "force-dynamic";

/** 各状态统计卡的渐变底色与文字配色 */
const STATUS_CARD_STYLES: Record<string, { card: string; bar: string }> = {
  unread: {
    card: "from-stone-50 to-stone-100/70 ring-stone-200/70",
    bar: "bg-stone-400",
  },
  wantToRead: {
    card: "from-amber-50 to-amber-100/70 ring-amber-200/70",
    bar: "bg-amber-400",
  },
  reading: {
    card: "from-sky-50 to-sky-100/70 ring-sky-200/70",
    bar: "bg-sky-400",
  },
  read: {
    card: "from-emerald-50 to-emerald-100/70 ring-emerald-200/70",
    bar: "bg-emerald-400",
  },
};

export default async function StatsPage() {
  const books = await prisma.book.findMany();
  const total = books.length;

  const byStatus: Record<string, number> = {
    unread: 0,
    wantToRead: 0,
    reading: 0,
    read: 0,
  };
  for (const b of books) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
  }

  const now = new Date();
  const year = now.getFullYear();
  const finishedThisYear = books.filter(
    (b) =>
      b.status === BookStatus.read &&
      b.finishedAt &&
      b.finishedAt.getFullYear() === year
  );

  // 月度读完
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: 0,
  }));
  for (const b of finishedThisYear) {
    if (b.finishedAt) {
      monthly[b.finishedAt.getMonth()].count += 1;
    }
  }

  // 分类构成
  const categoryMap = new Map<string, number>();
  for (const b of books) {
    const cat = b.category?.trim() || "未分类";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  }
  const categories = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]);

  const maxMonthly = Math.max(1, ...monthly.map((m) => m.count));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-amber-950">
            阅读统计
          </h1>
          <p className="mt-1 text-sm text-stone-500">藏书 {total} 本</p>
        </div>
        <Mascot size="sm" message="奥奥帮你数尾巴～" />
      </div>

      {/* 状态分布 */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-amber-950">
          <span
            aria-hidden
            className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-400"
          />
          状态分布
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(byStatus).map(([status, count]) => {
            const style = STATUS_CARD_STYLES[status] ?? STATUS_CARD_STYLES.unread;
            return (
              <div
                key={status}
                className={`rounded-2xl bg-gradient-to-b px-4 py-4 text-center ring-1 ${style.card}`}
              >
                <div className="text-3xl font-bold tabular-nums text-stone-800">
                  {count}
                </div>
                <div className="mt-0.5 text-xs text-stone-500">
                  {STATUS_LABELS[status] ?? status}
                </div>
                {total > 0 && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 年度读完 */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-amber-950">
          <span
            aria-hidden
            className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-400"
          />
          {year} 年读完
        </h2>
        <p className="mb-5 text-sm text-stone-500">
          共 {finishedThisYear.length} 本
        </p>
        <div className="flex h-52 items-stretch gap-1.5 sm:gap-2.5">
          {monthly.map((m) => {
            const pct = m.count <= 0 ? 0 : (m.count / maxMonthly) * 100;
            return (
              <div
                key={m.month}
                className="group flex min-w-0 flex-1 flex-col gap-1.5"
                title={`${m.month}月: ${m.count}本`}
              >
                {/* 相对定位轨道：柱子用绝对定位 + 像素无关的百分比，避免 flex 百分比塌缩 */}
                <div className="relative min-h-0 w-full flex-1">
                  {m.count > 0 && (
                    <span
                      className="absolute left-1/2 z-10 -translate-x-1/2 text-[10px] tabular-nums text-stone-500 transition-colors group-hover:text-amber-700"
                      style={{ bottom: `calc(${pct}% + 4px)` }}
                    >
                      {m.count}
                    </span>
                  )}
                  <div
                    className={`absolute inset-x-0 bottom-0 rounded-t-md transition-all duration-300 ${
                      m.count > 0
                        ? "bg-gradient-to-t from-amber-500 to-amber-300 group-hover:from-orange-500 group-hover:to-amber-400"
                        : "bg-amber-100/80"
                    }`}
                    style={{
                      height: m.count > 0 ? `${Math.max(pct, 6)}%` : "3px",
                    }}
                  />
                </div>
                <span className="shrink-0 text-center text-[10px] text-stone-400">
                  {m.month}月
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 藏书构成 */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-amber-950">
          <span
            aria-hidden
            className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-400"
          />
          藏书构成（按分类）
        </h2>
        {categories.length === 0 ? (
          <p className="text-sm text-stone-400">暂无数据</p>
        ) : (
          <ul className="space-y-3">
            {categories.map(([cat, count]) => (
              <li key={cat} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 truncate text-stone-600 sm:w-28">
                  {cat}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-amber-50 ring-1 ring-amber-100/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-300 to-amber-400 transition-all duration-500"
                    style={{
                      width: `${total ? (count / total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-stone-500">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
