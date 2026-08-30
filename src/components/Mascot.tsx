/** 奥奥吉祥物组件：使用卡通化形象 /mascot/aoao.png */
export function Mascot({
  size = "md",
  message,
}: {
  size?: "sm" | "md" | "lg";
  message?: string;
}) {
  const px = size === "sm" ? 56 : size === "lg" ? 120 : 80;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mascot/aoao.png"
        alt="比熊奥奥"
        width={px}
        height={px}
        className="select-none rounded-full object-cover shadow-warm ring-2 ring-white motion-safe:animate-float"
        style={{ width: px, height: px }}
        title="奥奥"
      />
      {message && (
        <p className="bubble max-w-xs rounded-2xl bg-white/90 px-4 py-2.5 text-sm leading-relaxed text-amber-900 shadow-warm-sm">
          {message}
        </p>
      )}
    </div>
  );
}
