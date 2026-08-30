/**
 * DeepSeek Chat API（OpenAI 兼容）
 * 环境变量：DEEPSEEK_API_KEY
 * 可选：DEEPSEEK_API_BASE（默认 https://api.deepseek.com）
 * 可选：DEEPSEEK_MODEL（默认 deepseek-chat）
 */

export function getDeepseekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const base = (
    process.env.DEEPSEEK_API_BASE?.trim() || "https://api.deepseek.com"
  ).replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  return { apiKey, base, model };
}

export function isDeepseekConfigured() {
  return Boolean(getDeepseekConfig().apiKey);
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chatCompletions(messages: ChatMessage[]): Promise<string> {
  const { apiKey, base, model } = getDeepseekConfig();
  if (!apiKey) {
    throw new Error("未配置 DEEPSEEK_API_KEY，请在项目根目录 .env 中设置");
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 220,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek 请求失败 ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("DeepSeek 返回空内容");
  return content;
}

/** 为一本书生成简短中文简介（2～4 句，不剧透） */
export async function generateBookBlurb(input: {
  title: string;
  author?: string | null;
  category?: string | null;
  tags?: string[];
}): Promise<string> {
  const meta = [
    `书名：${input.title}`,
    input.author ? `作者：${input.author}` : "",
    input.category ? `分类：${input.category}` : "",
    input.tags?.length ? `标签：${input.tags.join("、")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const text = await chatCompletions([
    {
      role: "system",
      content:
        "你是图书简介助手。根据书名等信息写一段简短中文简介，2～4句话，约80～150字。" +
        "语气自然、口语一点，不要剧透关键情节，不要虚构精确出版数据或评分。" +
        "只输出简介正文，不要标题、引号或「简介：」前缀。",
    },
    {
      role: "user",
      content: `请为下面这本书写简介：\n${meta}`,
    },
  ]);

  return text.replace(/^简介[:：]\s*/u, "").trim();
}
