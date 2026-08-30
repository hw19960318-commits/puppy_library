"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import type { DoubanBookInfo } from "@/lib/types";

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
  const [manualOpen, setManualOpen] = useState(false);

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
        setMessage("未识别到可用书名，请换更清晰的书脊特写后再试，或改用下方手动录入");
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
            拍整排书架/书脊 → 自动识别候选书名 → 核对勾选后批量入库（照片不当封面）
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

      {/* 次要：单本手动录入 */}
      <section className="card overflow-hidden bg-white/85">
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-stone-700 transition-colors hover:bg-amber-50/50"
        >
          <span>单本手动录入 / ISBN 豆瓣补全</span>
          <span
            aria-hidden
            className={`text-stone-400 transition-transform duration-200 ${
              manualOpen ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </button>
        {manualOpen && (
          <div className="border-t border-amber-900/8 px-5 pb-5">
            <ManualSingleEntry />
          </div>
        )}
      </section>
    </div>
  );
}

/** 折叠区内的原有单本录入（含 ISBN / 可选封面） */
function ManualSingleEntry() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [coverPath, setCoverPath] = useState("");
  const [doubanId, setDoubanId] = useState("");
  const [doubanRating, setDoubanRating] = useState<number | undefined>();
  const [status, setStatus] = useState("unread");
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [doubanUrl, setDoubanUrl] = useState("");

  async function fetchDouban() {
    const clean = isbn.replace(/[-\s]/g, "");
    if (!/^\d{10,13}$/.test(clean)) {
      setMessage("请输入有效的 10/13 位 ISBN");
      return;
    }
    setFetching(true);
    setMessage("正在向豆瓣查询…（可能需要几秒）");
    try {
      const res = await fetch(`/api/douban?isbn=${encodeURIComponent(clean)}`);
      const data = await res.json();
      const info = data.info as DoubanBookInfo;
      if (info.degraded) {
        setMessage(info.error || "豆瓣暂不可用，请手动填写");
        if (info.url) setDoubanUrl(info.url);
        return;
      }
      if (info.title) setTitle(info.title);
      if (info.author) setAuthor(info.author);
      if (info.publisher) setPublisher(info.publisher);
      if (info.publishDate) setPublishDate(info.publishDate);
      if (info.description) setDescription(info.description);
      if (info.tags?.length) setTags(info.tags.join(", "));
      if (info.subjectId) setDoubanId(info.subjectId);
      if (info.rating != null) setDoubanRating(info.rating);
      if (info.isbn) setIsbn(info.isbn);
      if (info.url) setDoubanUrl(info.url);
      if (info.coverUrl && !coverPath) {
        setCoverPath(info.coverUrl);
      }
      setMessage("已从豆瓣补全信息，请确认后保存");
    } catch {
      setMessage("查询失败，请手动填写");
    } finally {
      setFetching(false);
    }
  }

  async function onUpload(file: File) {
    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "上传失败");
        return;
      }
      setCoverPath(data.coverPath);
      setMessage("封面上传成功");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setMessage("书名不能为空");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          isbn,
          publisher,
          publishDate,
          description,
          tags: tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
          category: category || undefined,
          coverPath: coverPath || undefined,
          doubanId: doubanId || undefined,
          doubanRating,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "保存失败");
        return;
      }
      router.push(`/books/${data.book.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-stone-700">
          ISBN
        </label>
        <div className="flex gap-2">
          <input
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            placeholder="9787xxxxxxxxx"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={fetchDouban}
            disabled={fetching}
            className="shrink-0 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-sky-600 active:scale-95 disabled:opacity-50"
          >
            {fetching ? "查询中…" : "豆瓣补全"}
          </button>
        </div>
        {doubanUrl && (
          <a
            href={doubanUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block text-xs text-sky-600 underline"
          >
            打开豆瓣条目
          </a>
        )}
      </div>

      <Field label="书名 *" value={title} onChange={setTitle} required />
      <Field label="作者" value={author} onChange={setAuthor} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="出版社" value={publisher} onChange={setPublisher} />
        <Field label="出版日期" value={publishDate} onChange={setPublishDate} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-stone-700">
          简介
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="input"
        />
      </div>
      <Field
        label="标签（逗号分隔）"
        value={tags}
        onChange={setTags}
        placeholder="小说, 科幻"
      />
      <Field label="分类" value={category} onChange={setCategory} placeholder="文学" />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-stone-700">
          初始状态
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input"
        >
          <option value="unread">未读</option>
          <option value="wantToRead">想读</option>
          <option value="reading">在读</option>
          <option value="read">读过</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-stone-700">
          封面（可选，非书架照）
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="cursor-pointer rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 transition-all hover:border-amber-400 hover:bg-amber-100/70 active:scale-[0.98]">
            {uploading ? "上传中…" : "选择封面图"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
          {coverPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPath}
              alt="封面预览"
              className="h-28 rounded-lg object-cover shadow-warm-sm ring-1 ring-amber-900/8"
            />
          )}
        </div>
      </div>

      {message && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-100">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-stone-700 py-3 font-medium text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存单本到书架"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}
