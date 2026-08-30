import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import {
  extractTitleCandidates,
  mergeTitleCandidates,
} from "@/lib/ocr";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILES = 8;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

type OcrImageResult = {
  fileName: string;
  text: string;
  titles: string[];
};

/** 适度缩小 + 灰度，避免过度锐化把书脊笔画打散 */
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({
        width: 1600,
        height: 2200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
  } catch {
    return buffer;
  }
}

/**
 * POST /api/ocr — 书架/书脊照片批量 OCR
 * 仅识别书名候选，不保存图片、不用作封面
 */
export async function POST(req: NextRequest) {
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  try {
    const form = await req.formData();
    const files = form
      .getAll("images")
      .concat(form.getAll("files"), form.getAll("file"))
      .filter((v): v is File => v instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "请至少上传一张书架/书脊照片" },
        { status: 400 },
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `一次最多上传 ${MAX_FILES} 张图片` },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `不支持的文件类型：${file.name || file.type}` },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `图片过大（上限 12MB）：${file.name}` },
          { status: 400 },
        );
      }
    }

    worker = await createWorker("chi_sim", 1, {
      logger: () => undefined,
    });

    // 整排书架：自动版面；单本竖脊偶发用稀疏文本补漏
    const modes = [PSM.AUTO, PSM.SPARSE_TEXT] as const;

    const perImage: OcrImageResult[] = [];
    const titleGroups: string[][] = [];

    for (const file of files) {
      const original = Buffer.from(await file.arrayBuffer());
      const buffer = await preprocessImage(original);
      const texts: string[] = [];
      const groups: string[][] = [];

      for (const mode of modes) {
        await worker.setParameters({ tessedit_pageseg_mode: mode });
        const { data } = await worker.recognize(buffer);
        const text = data.text ?? "";
        texts.push(text);
        groups.push(extractTitleCandidates(text));
      }

      const titles = mergeTitleCandidates(groups);
      titleGroups.push(titles);
      perImage.push({
        fileName: file.name || "image",
        text: texts.join("\n---\n"),
        titles,
      });
    }

    const titles = mergeTitleCandidates(titleGroups);

    return NextResponse.json({
      titles,
      images: perImage,
      note: "OCR 结果仅作候选书名，请核对改名后再入库；照片不会保存为封面",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR 识别失败";
    console.error("[ocr]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore
      }
    }
  }
}
