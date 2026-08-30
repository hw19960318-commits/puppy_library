"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";

type ChecklistItem = {
  id: string;
  title: string;
  selected: boolean;
};

const OCR_STEPS = ["选择照片", "OCR 识别", "核对入库"];

export default function AddBookPage() {
  const router = useRouter();
  const fileInputId = useId();

  const [photos, setPhotos] = useState<File[]>([]);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [message, setMessage] = useState("");

  function onPickPhotos(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    setPhotos((prev) => [...prev, ...next].slice(0, 8));
    setMessage("");
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function runOcr() {
    if (photos.length === 0) {
      setMessage("请先选择书架或书脊照片");
      return;
    }
    setOcrRunning(true);
    setMessage("正在识别书名…（首次会下载中文语言包，可能需要几十秒）");
    try {
      const form = new FormData();
      for (const file of photos) {
        form.append("images", file);
      }
      const res = await fetch("/api/ocr", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "识别失败");
        return;
      }
      const titles = (data.titles as string[]) ?? [];
      if (titles.length === 0) {
        setChecklist([]);
        setMessage("未识别到可用书名，请换更清晰的书脊特写后再试，或点「手填书名」");
        return;
      }
      setChecklist(
        titles.map((title, i) => ({
          id: `ocr-${i}-${title}`,
          title,
          selected: true,
        })),
      );
      setMessage(
        `识别到 ${titles.length} 个候选书名（照片不会用作封面）。请勾选确认后批量入库。`,
      );
    } catch {
      setMessage("识别请求失败，请稍后重试");
    } finally {
      setOcrRunning(false);
    }
  }

  function updateTitle(id: string, title: string) {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title } : item)),
    );
  }

  function toggleItem(id: string) {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function selectAll(selected: boolean) {
    setChecklist((prev) => prev.map((item) => ({ ...item, selected })));
  }

  function addBlankRow() {
    setChecklist((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        title: "",
        selected: true,
      },
    ]);
  }

  async function confirmBatchImport() {
    const books = checklist
      .filter((item) => item.selected && item.title.trim())
      .map((item) => ({
        title: item.title.trim(),
        status: "unread" as const,
      }));

    if (books.length === 0) {
      setMessage("请至少勾选一本有效书名");
      return;
    }

    setImporting(true);
    setMessage("正在批量入库…");
    try {
      const res = await fetch("/api/books/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "批量导入失败");
        return;
      }
      const created = data.created ?? 0;
      const skipped = data.skipped ?? 0;
      setMessage(
        `完成：新建 ${created} 本，跳过重名 ${skipped} 本。默认状态为未读。`,
      );
      if (created > 0) {
        setTimeout(() => router.push("/library"), 800);
      }
    } catch {
      setMessage("批量导入请求失败");
    } finally {
      setImporting(false);
    }
  }

  // 当前所处步骤：0 选照片 → 1 识别 → 2 核对入库
  const currentStep = checklist.length > 0 ? 2 : photos.length > 0 ? 1 : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-amber-950">
            录入新书
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
            拍整排书架/书脊 → 自动识别候选书名 → 核对勾选后批量入库
          </p>
        </div>
        <Mascot size="sm" />
      </div>

      {/* 主流程：书架照片 OCR */}
      <section className="card space-y-5 p-5 sm:p-6">
        {/* 步骤指示 */}
        <ol className="flex items-center gap-2">
          {OCR_STEPS.map((label, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    done
                      ? "bg-emerald-100 text-emerald-700"
                      : active
                        ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm"
                        : "bg-stone-100 text-stone-400"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`text-xs whitespace-nowrap ${
                    active ? "font-medium text-amber-900" : "text-stone-400"
                  }`}
                >
                  {label}
                </span>
                {i < OCR_STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={`h-px flex-1 ${done ? "bg-emerald-200" : "bg-stone-200"}`}
                  />
                )}
              </li>
            );
          })}
        </ol>

        <div>
          <h2 className="text-base font-semibold text-amber-950">
            书架/书脊照片识别
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            支持一次最多 8 张；书脊尽量正对、光线均匀。识别结果请务必核对改名（竖排细字容易误识）。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={fileInputId}
            className="cursor-pointer rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 transition-all hover:border-amber-400 hover:bg-amber-100/70 active:scale-[0.98]"
          >
            📷 选择照片（可多选）
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                onPickPhotos(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={runOcr}
            disabled={ocrRunning || photos.length === 0}
            className="btn-primary"
          >
            {ocrRunning ? "识别中…" : "开始 OCR 识别"}
          </button>
          <button
            type="button"
            onClick={addBlankRow}
            className="btn-ghost"
          >
            手填书名
          </button>
        </div>

        {photos.length > 0 && (
          <ul className="space-y-1.5 text-sm text-stone-600">
            {photos.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/70 px-3.5 py-2 ring-1 ring-amber-100/60"
              >
                <span className="truncate">
                  {file.name}
                  <span className="ml-2 text-xs text-stone-400">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}

        {checklist.length > 0 && (
          <div className="space-y-3.5 border-t border-amber-900/8 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-amber-950">
                候选书名（默认可编辑，状态=未读）
              </h3>
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => selectAll(true)}
                  className="text-sky-700 transition-colors hover:text-sky-900"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => selectAll(false)}
                  className="text-sky-700 transition-colors hover:text-sky-900"
                >
                  全不选
                </button>
                <button
                  type="button"
                  onClick={addBlankRow}
                  className="text-sky-700 transition-colors hover:text-sky-900"
                >
                  加一行
                </button>
              </div>
            </div>

            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {checklist.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-2.5 rounded-xl p-1.5 transition-colors ${
                    item.selected ? "bg-amber-50/50" : "opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleItem(item.id)}
                    className="h-5 w-5 shrink-0 accent-amber-500"
                    aria-label={`选择 ${item.title || "空书名"}`}
                  />
                  <input
                    value={item.title}
                    onChange={(e) => updateTitle(item.id, e.target.value)}
                    placeholder="书名"
                    className="input flex-1"
                  />
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={confirmBatchImport}
              disabled={importing}
              className="btn-primary w-full py-3"
            >
              {importing ? "导入中…" : "确认批量入库"}
            </button>
          </div>
        )}

        {message && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-100">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
