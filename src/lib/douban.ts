import * as cheerio from "cheerio";
import { prisma } from "@/lib/db";
import {
  DOUBAN_CACHE_TTL_MS,
  DOUBAN_MIN_INTERVAL_MS,
} from "@/lib/constants";
import type { DoubanBookInfo, DoubanComment } from "@/lib/types";

/** cheerio.load 返回值类型（兼容 cheerio v1 与 @types/cheerio） */
type CheerioRoot = ReturnType<typeof cheerio.load>;

/** 全进程共享的限速时间戳 */
let lastRequestAt = 0;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** 等待至距上次请求至少间隔 DOUBAN_MIN_INTERVAL_MS */
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + DOUBAN_MIN_INTERVAL_MS - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

/** 读取未过期缓存 */
async function readCache(cacheKey: string): Promise<DoubanBookInfo | null> {
  const row = await prisma.doubanCache.findUnique({ where: { cacheKey } });
  if (!row) return null;
  if (Date.now() - row.fetchedAt.getTime() > DOUBAN_CACHE_TTL_MS) {
    return null;
  }
  try {
    return JSON.parse(row.payload) as DoubanBookInfo;
  } catch {
    return null;
  }
}

/** 写入缓存 */
async function writeCache(cacheKey: string, info: DoubanBookInfo): Promise<void> {
  const payload = JSON.stringify(info);
  await prisma.doubanCache.upsert({
    where: { cacheKey },
    create: { cacheKey, payload },
    update: { payload, fetchedAt: new Date() },
  });
}

/** 发起豆瓣 HTTP 请求（跟随重定向） */
async function fetchDouban(url: string): Promise<Response> {
  await throttle();
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    redirect: "follow",
    // Next.js 不缓存外部抓取
    cache: "no-store",
  });
}

/** 从页面提取 JSON-LD Book 信息 */
function parseJsonLd($: CheerioRoot): Partial<DoubanBookInfo> {
  const result: Partial<DoubanBookInfo> = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (!raw) return;
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = item["@type"];
        if (type !== "Book" && type !== "Product") continue;

        if (item.name) result.title = String(item.name);
        if (item.isbn) result.isbn = String(item.isbn);
        if (item.description) result.description = String(item.description);
        if (item.url) result.url = String(item.url);
        if (item.image) {
          result.coverUrl = Array.isArray(item.image)
            ? String(item.image[0])
            : String(item.image);
        }
        // 作者可能是字符串或对象/数组
        if (item.author) {
          const authors = Array.isArray(item.author)
            ? item.author
            : [item.author];
          result.author = authors
            .map((a: unknown) =>
              typeof a === "string" ? a : (a as { name?: string })?.name ?? ""
            )
            .filter(Boolean)
            .join(" / ");
        }
        if (item.publisher) {
          result.publisher =
            typeof item.publisher === "string"
              ? item.publisher
              : item.publisher?.name ?? undefined;
        }
        if (item.datePublished) result.publishDate = String(item.datePublished);
        if (item.aggregateRating?.ratingValue) {
          result.rating = parseFloat(item.aggregateRating.ratingValue);
        }
      }
    } catch {
      // 忽略损坏的 JSON-LD
    }
  });
  return result;
}

/** 从页面补充评分、简介、标签、subjectId */
function parsePageExtras(
  $: CheerioRoot,
  pageUrl: string
): Partial<DoubanBookInfo> {
  const extras: Partial<DoubanBookInfo> = {};

  // subjectId
  const subjectMatch = pageUrl.match(/subject\/(\d+)/);
  if (subjectMatch) extras.subjectId = subjectMatch[1];
  if (!extras.subjectId) {
    const canonical = $('link[rel="canonical"]').attr("href") ?? "";
    const m2 = canonical.match(/subject\/(\d+)/);
    if (m2) extras.subjectId = m2[1];
  }

  // 评分（JSON-LD 没有时兜底）
  const ratingText =
    $("strong.rating_num").first().text().trim() ||
    $('[property="v:average"]').first().text().trim() ||
    $(".rating_num").first().text().trim() ||
    $("div.rating_self strong").first().text().trim();
  if (ratingText) {
    const r = parseFloat(ratingText);
    if (!Number.isNaN(r) && r > 0) extras.rating = r;
  }

  // 简介
  const intro =
    $("#link-report .intro").last().text().trim() ||
    $("#link-report .short .intro").text().trim() ||
    $("#link-report").text().trim();
  if (intro) extras.description = intro.slice(0, 2000);

  // 标签（兼容多种页面结构）
  const tags: string[] = [];
  $(
    "#db-tags-section a, .tags-body a, a.tag, #db-tags-section .tag, div.indent a[href*='tag']"
  ).each((_, el) => {
    const t = $(el).text().trim().replace(/\(\d+\)/, "").trim();
    if (t && t.length < 20 && !tags.includes(t)) tags.push(t);
  });
  if (tags.length) extras.tags = tags.slice(0, 12);

  // 书名兜底
  const title =
    $('span[property="v:itemreviewed"]').first().text().trim() ||
    $("h1 span").first().text().trim();
  if (title) extras.title = title;

  // 作者兜底
  const authorLinks: string[] = [];
  $("#info a[href*='/author/'], #info a[href*='/search/']").each((_, el) => {
    const parent = $(el).parent().text();
    if (parent.includes("作者") || parent.includes("译者")) {
      const name = $(el).text().trim();
      if (name) authorLinks.push(name);
    }
  });
  if (authorLinks.length) extras.author = authorLinks.join(" / ");

  // info 区出版社 / 出版年 / ISBN
  const infoText = $("#info").text();
  const pubMatch = infoText.match(/出版社:\s*(.+)/);
  if (pubMatch) extras.publisher = pubMatch[1].split("\n")[0].trim();
  const dateMatch = infoText.match(/出版年:\s*(.+)/);
  if (dateMatch) extras.publishDate = dateMatch[1].split("\n")[0].trim();
  const isbnMatch = infoText.match(/ISBN:\s*([\d-]+)/);
  if (isbnMatch) extras.isbn = isbnMatch[1].replace(/-/g, "");

  extras.url = pageUrl.includes("subject")
    ? pageUrl.split("?")[0]
    : extras.subjectId
      ? `https://book.douban.com/subject/${extras.subjectId}/`
      : pageUrl;

  return extras;
}

/** 解析热门短评 */
function parseComments($: CheerioRoot): DoubanComment[] {
  const comments: DoubanComment[] = [];
  $("#comments .comment-item, .comment-item").each((_, el) => {
    if (comments.length >= 5) return false;
    const node = $(el);
    const author =
      node.find(".comment-info a").first().text().trim() ||
      node.find("a.name").first().text().trim() ||
      "匿名";
    const content =
      node.find(".short").first().text().trim() ||
      node.find(".comment-content").first().text().trim();
    if (!content) return;
    const ratingClass =
      node.find("[class*='rating']").attr("class") ?? "";
    const ratingMatch = ratingClass.match(/allstar(\d)/);
    const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : undefined;
    const date =
      node.find(".comment-time").attr("title") ||
      node.find(".comment-info span").last().text().trim() ||
      undefined;
    comments.push({ author, content, rating, date });
  });
  return comments;
}

/** 从短评列表页补抓（主页常无短评区块） */
async function fetchCommentsPage(subjectId: string): Promise<DoubanComment[]> {
  try {
    const res = await fetchDouban(
      `https://book.douban.com/subject/${subjectId}/comments?status=P`
    );
    if (!res.ok) return [];
    const html = await res.text();
    return parseComments(cheerio.load(html));
  } catch {
    return [];
  }
}

/** 降级结果：仅返回跳转链接 */
function degrade(isbnOrId: string, error: string): DoubanBookInfo {
  const isIsbn = /^\d{10,13}$/.test(isbnOrId.replace(/-/g, ""));
  const url = isIsbn
    ? `https://book.douban.com/isbn/${isbnOrId.replace(/-/g, "")}/`
    : `https://book.douban.com/subject/${isbnOrId}/`;
  return { degraded: true, error, url, subjectId: isIsbn ? undefined : isbnOrId };
}

/**
 * 通过 ISBN 抓取豆瓣图书信息（含缓存、限速、降级）
 */
export async function fetchByIsbn(isbn: string): Promise<DoubanBookInfo> {
  const cleanIsbn = isbn.replace(/[-\s]/g, "");
  if (!/^\d{10,13}$/.test(cleanIsbn)) {
    return { degraded: true, error: "ISBN 格式无效" };
  }

  const cacheKey = `isbn:${cleanIsbn}`;
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchDouban(
      `https://book.douban.com/isbn/${cleanIsbn}/`
    );
    if (!res.ok) {
      const degraded = degrade(cleanIsbn, `豆瓣返回 ${res.status}`);
      await writeCache(cacheKey, degraded);
      return degraded;
    }

    const html = await res.text();
    const finalUrl = res.url;
    const $ = cheerio.load(html);

    // 检测反爬/登录墙
    if (
      html.includes("sec.douban.com") ||
      html.includes("检测到有异常请求") ||
      $("title").text().includes("登录")
    ) {
      const degraded = degrade(cleanIsbn, "豆瓣限制访问，请稍后重试或手动填写");
      await writeCache(cacheKey, degraded);
      return degraded;
    }

    const fromLd = parseJsonLd($);
    const extras = parsePageExtras($, finalUrl);
    let comments = parseComments($);
    if (comments.length === 0 && extras.subjectId) {
      comments = await fetchCommentsPage(extras.subjectId);
    }

    const info: DoubanBookInfo = {
      ...fromLd,
      ...extras,
      // extras 覆盖空缺字段，但不要用空值覆盖已有
      title: extras.title || fromLd.title,
      author: extras.author || fromLd.author,
      publisher: extras.publisher || fromLd.publisher,
      publishDate: extras.publishDate || fromLd.publishDate,
      isbn: extras.isbn || fromLd.isbn || cleanIsbn,
      description: extras.description || fromLd.description,
      rating: extras.rating ?? fromLd.rating,
      tags: extras.tags || fromLd.tags || [],
      comments,
      coverUrl: fromLd.coverUrl,
      url: extras.url || fromLd.url,
      degraded: false,
    };

    // 同时按 subjectId 缓存
    if (info.subjectId) {
      await writeCache(`subject:${info.subjectId}`, info);
    }
    await writeCache(cacheKey, info);
    return info;
  } catch (err) {
    const message = err instanceof Error ? err.message : "网络错误";
    const degraded = degrade(cleanIsbn, message);
    // 短暂失败也缓存，避免狂刷（用较短语义：仍写入，30 天后过期）
    await writeCache(cacheKey, degraded);
    return degraded;
  }
}

/**
 * 通过豆瓣 subjectId 抓取（优先缓存）
 */
export async function fetchBySubjectId(
  subjectId: string
): Promise<DoubanBookInfo> {
  const cacheKey = `subject:${subjectId}`;
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchDouban(
      `https://book.douban.com/subject/${subjectId}/`
    );
    if (!res.ok) {
      const degraded = degrade(subjectId, `豆瓣返回 ${res.status}`);
      await writeCache(cacheKey, degraded);
      return degraded;
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const fromLd = parseJsonLd($);
    const extras = parsePageExtras($, res.url);
    let comments = parseComments($);
    // 主页无短评时，再拉短评页
    if (comments.length === 0) {
      comments = await fetchCommentsPage(subjectId);
    }
    const info: DoubanBookInfo = {
      ...fromLd,
      ...extras,
      title: extras.title || fromLd.title,
      author: extras.author || fromLd.author,
      publisher: extras.publisher || fromLd.publisher,
      publishDate: extras.publishDate || fromLd.publishDate,
      isbn: extras.isbn || fromLd.isbn,
      description: extras.description || fromLd.description,
      tags: extras.tags || fromLd.tags || [],
      comments,
      rating: extras.rating ?? fromLd.rating,
      subjectId,
      degraded: false,
    };
    await writeCache(cacheKey, info);
    return info;
  } catch (err) {
    const message = err instanceof Error ? err.message : "网络错误";
    const degraded = degrade(subjectId, message);
    await writeCache(cacheKey, degraded);
    return degraded;
  }
}

/**
 * 获取短评：优先用缓存 payload 内的 comments，否则按 subjectId 刷新
 */
export async function getComments(
  subjectId: string
): Promise<DoubanComment[]> {
  const info = await fetchBySubjectId(subjectId);
  return info.comments ?? [];
}

type SuggestItem = {
  id?: string;
  title?: string;
  author_name?: string;
  type?: string;
  url?: string;
};

/** 规范化书名用于匹配（去掉空格、全角符号等） */
function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\u3000·・\.\,，。:：;；!！?？"'「」『』《》【】\[\]]/g, "")
    .trim();
}

/**
 * 用豆瓣 subject_suggest 按书名（可选作者）解析出最匹配的 subjectId
 */
export async function resolveSubjectIdByTitle(
  title: string,
  author?: string
): Promise<{ subjectId?: string; error?: string }> {
  const q = title.trim();
  if (!q) return { error: "书名为空" };

  const cacheKey = `suggest:${normalizeTitle(q)}:${normalizeTitle(author ?? "")}`;
  const cached = await readCache(cacheKey);
  if (cached?.subjectId) return { subjectId: cached.subjectId };
  if (cached?.degraded) return { error: cached.error ?? "豆瓣搜索暂不可用" };

  try {
    const url = `https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(q)}`;
    const res = await fetchDouban(url);
    if (!res.ok) {
      const degraded = {
        degraded: true as const,
        error: `豆瓣搜索返回 ${res.status}`,
      };
      await writeCache(cacheKey, degraded);
      return { error: degraded.error };
    }

    const raw = await res.text();
    let items: SuggestItem[] = [];
    try {
      items = JSON.parse(raw) as SuggestItem[];
    } catch {
      const degraded = {
        degraded: true as const,
        error: "豆瓣搜索结果解析失败",
      };
      await writeCache(cacheKey, degraded);
      return { error: degraded.error };
    }

    const books = items.filter(
      (it) => it && (it.type === "b" || it.url?.includes("/book.douban.com/subject/"))
    );
    if (books.length === 0) {
      const degraded = {
        degraded: true as const,
        error: "未找到匹配的豆瓣图书",
      };
      await writeCache(cacheKey, degraded);
      return { error: degraded.error };
    }

    const wantTitle = normalizeTitle(q);
    const wantAuthor = author ? normalizeTitle(author.split(/[/／,，]/)[0] ?? "") : "";

    let best = books[0];
    let bestScore = -1;
    for (const it of books) {
      let score = 0;
      const t = normalizeTitle(it.title ?? "");
      if (t === wantTitle) score += 10;
      else if (t.includes(wantTitle) || wantTitle.includes(t)) score += 5;
      if (wantAuthor) {
        const a = normalizeTitle(it.author_name ?? "");
        if (a && (a.includes(wantAuthor) || wantAuthor.includes(a))) score += 4;
      }
      if (score > bestScore) {
        bestScore = score;
        best = it;
      }
    }

    // 书名完全对不上时仍取第一条，但要求至少有模糊匹配
    if (bestScore < 5 && wantTitle.length > 1) {
      const anyTitleHit = books.some((it) => {
        const t = normalizeTitle(it.title ?? "");
        return t.includes(wantTitle) || wantTitle.includes(t);
      });
      if (!anyTitleHit) {
        const degraded = {
          degraded: true as const,
          error: "未找到书名相近的豆瓣条目",
        };
        await writeCache(cacheKey, degraded);
        return { error: degraded.error };
      }
    }

    const subjectId =
      best.id ||
      (best.url ?? "").match(/subject\/(\d+)/)?.[1];
    if (!subjectId) {
      return { error: "无法解析豆瓣条目 ID" };
    }

    await writeCache(cacheKey, { subjectId, title: best.title, degraded: false });
    return { subjectId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "网络错误";
    await writeCache(cacheKey, { degraded: true, error: message });
    return { error: message };
  }
}

/**
 * 按书名（可选作者）抓取豆瓣信息：先 suggest 再走 subject 详情
 */
export async function fetchByTitle(
  title: string,
  author?: string
): Promise<DoubanBookInfo> {
  const resolved = await resolveSubjectIdByTitle(title, author);
  if (!resolved.subjectId) {
    return {
      degraded: true,
      error: resolved.error ?? "未找到豆瓣条目",
      url: `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(title.trim())}`,
    };
  }
  return fetchBySubjectId(resolved.subjectId);
}
