/** 书脊/书架 OCR 文本清洗与候选书名提取 */

/** 过滤明显不是书名的行 */
const NOISE_PATTERNS = [
  /^[\d\s.\-_/\\|:：·•]+$/,
  /^第?\d+[页章卷回部册集]$/,
  /^(isbn|issn|cip|定价|出版社|著|译|编|版权所有)$/i,
  /^[a-zA-Z]{1,2}$/,
  /出\s*版\s*社$/,
];

/** 去掉行首行尾杂质，并合并汉字之间被 OCR 拆开的空格 */
export function cleanOcrLine(raw: string): string {
  let s = raw.replace(/[\u0000-\u001f]/g, "");
  // 「中 国 科 学」→「中国科学」
  s = s.replace(/(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, "");
  s = s
    .replace(/^[|｜\s\-—_·•.、，,;；:：'"“”‘’【】\[\]()（）<>《》]+/, "")
    .replace(/[|｜\s\-—_·•.、，,;；:：'"“”‘’【】\[\]()（）<>《》]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  // 去掉常见出版社尾巴，保留书名主体
  s = s.replace(/[\u4e00-\u9fff]{0,8}出版社$/g, (m) =>
    m.length <= 4 ? "" : m.replace(/出版社$/, ""),
  );
  return s.trim();
}

function isLikelyTitle(line: string): boolean {
  if (line.length < 2 || line.length > 40) return false;
  if (NOISE_PATTERNS.some((re) => re.test(line))) return false;
  const hasHan = /[\u4e00-\u9fff]/.test(line);
  const hasLatinWord = /[a-zA-Z]{3,}/.test(line);
  if (!hasHan && !hasLatinWord) return false;
  // 噪声：过多拉丁乱码夹汉字
  const latin = (line.match(/[A-Za-z]/g) || []).length;
  const han = (line.match(/[\u4e00-\u9fff]/g) || []).length;
  if (han >= 2 && latin > han * 2) return false;
  const meaningful = line.replace(/[\d\s\-_/\\|.:：·•]/g, "");
  if (meaningful.length < 2) return false;
  return true;
}

/** 把连续的单字行拼成可能的竖排书名 */
function coalesceVerticalFragments(lines: string[]): string[] {
  const out: string[] = [];
  let buf = "";
  for (const line of lines) {
    if (/^[\u4e00-\u9fff]$/.test(line)) {
      buf += line;
      continue;
    }
    if (buf.length >= 2) out.push(buf);
    buf = "";
    out.push(line);
  }
  if (buf.length >= 2) out.push(buf);
  return out;
}

/** 从 OCR 全文提取候选书名行（去重保序） */
export function extractTitleCandidates(ocrText: string): string[] {
  const rawLines = ocrText
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter(Boolean);

  const lines = coalesceVerticalFragments(rawLines);
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const line of lines) {
    if (!isLikelyTitle(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    titles.push(line);
  }

  return titles;
}

/** 合并多次 OCR 结果并去重 */
export function mergeTitleCandidates(groups: string[][]): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const group of groups) {
    for (const title of group) {
      const cleaned = cleanOcrLine(title);
      if (!cleaned || !isLikelyTitle(cleaned)) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      titles.push(cleaned);
    }
  }
  return titles;
}
