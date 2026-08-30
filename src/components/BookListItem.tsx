import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { parseTags } from "@/lib/types";

type BookListItemProps = {
  id: string;
  title: string;
  author: string;
  status: string;
  doubanRating: number | null;
  tags?: string;
  category?: string | null;
};

/** 暖色系书脊渐变：不依赖封面图，也能让列表有色彩节奏 */
const SPINE_COLORS = [
  "from-amber-300 to-orange-400",
  "from-orange-300 to-rose-300",
  "from-yellow-200 to-amber-400",
  "from-rose-200 to-orange-300",
  "from-stone-200 to-amber-300",
  "from-amber-200 to-yellow-400",
];

/** 用书籍 id 做确定性散列，同一本书永远是同一条书脊色 */
function spineColor(id: string): string {
  let hash = 0;
  for (const ch of id) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return SPINE_COLORS[hash % SPINE_COLORS.length];
}

/** 书架文字列表行（无封面图，左侧为渐变书脊条） */
export function BookListItem({
  id,
  title,
  author,
  status,
  tags,
  category,
}: BookListItemProps) {
  const tagList = parseTags(tags);

  return (
    <Link
      href={`/books/${id}`}
      className="group flex items-stretch gap-3.5 border-b border-amber-900/6 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-amber-50/70 active:bg-amber-100/60"
    >
      <span
        aria-hidden
        className={`w-1.5 shrink-0 self-stretch rounded-full bg-gradient-to-b ${spineColor(id)}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h3 className="truncate text-[15px] font-semibold text-stone-800 transition-colors group-hover:text-amber-950">
            {title}
          </h3>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 truncate text-xs text-stone-500">
          {author || "未知作者"}
          {category ? ` · ${category}` : ""}
        </p>
        {tagList.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tagList.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-100"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <span
        aria-hidden
        className="shrink-0 self-center text-stone-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-amber-400"
      >
        ›
      </span>
    </Link>
  );
}
