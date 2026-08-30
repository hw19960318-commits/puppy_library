import { STATUS_COLORS, STATUS_DOTS, STATUS_LABELS } from "@/lib/constants";

/** 阅读状态徽章：小色点 + 柔和底色细环 */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_COLORS[status] ?? "bg-stone-100 text-stone-600 ring-1 ring-stone-200"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status] ?? "bg-stone-400"}`}
      />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
