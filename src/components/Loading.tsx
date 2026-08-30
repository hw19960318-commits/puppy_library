/** 加载指示：三个依次跳动的暖色圆点 + 奥奥文案 */
export function Loading({ text = "奥奥正在翻找…" }: { text?: string }) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="loading-dot h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-400"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-sm text-stone-400">{text}</p>
    </div>
  );
}
