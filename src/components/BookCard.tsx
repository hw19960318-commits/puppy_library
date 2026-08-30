import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { parseTags } from "@/lib/types";

type BookCardProps = {
  id: string;
  title: string;
  author: string;
  coverPath: string | null;
  status: string;
  doubanRating: number | null;
  tags?: string;
};

/** 书架封面卡片 */
export function BookCard({
  id,
  title,
  author,
  coverPath,
  status,
  doubanRating,
  tags,
}: BookCardProps) {
  const tagList = parseTags(tags);

  return (
    <Link
      href={`/books/${id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100">
        {coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverPath}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-amber-800/60">
            <span className="text-4xl">📖</span>
            <span className="line-clamp-3 text-sm font-medium">{title}</span>
          </div>
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge status={status} />
        </div>
        {doubanRating != null && doubanRating > 0 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-amber-200">
            ★ {doubanRating.toFixed(1)}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-stone-800">{title}</h3>
        <p className="truncate text-xs text-stone-500">{author || "未知作者"}</p>
        {tagList.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tagList.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
