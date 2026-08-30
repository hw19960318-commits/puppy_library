# 奥奥图书馆

以比熊「奥奥」为主题的**实体书藏书管理** Web 应用：拍照 OCR 编目、读过/想读状态、每日推荐、DeepSeek 短简介。本地运行，可选用内网穿透从外网访问。

## 技术栈

- Next.js（App Router）+ TypeScript
- SQLite + Prisma
- Tailwind CSS
- 豆瓣：服务端温和抓取（限速 + 30 天缓存 + 失败降级为跳转链接）

## 快速开始

```bash
# 安装依赖
npm install

# 同步数据库（首次）
npm run db:push

# 启动开发服务（绑定 0.0.0.0，便于局域网/穿透访问）
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

### 可选：导入示例数据

```bash
npm run import:books
```

会读取 `data/books-import.json` 入库。文件中 `fetchDouban: false` 时不请求豆瓣；改为 `true` 或删除该字段则会按 ISBN 排队补全。

## 环境变量

复制 `.env.example` 为 `.env`：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | SQLite 路径，默认 `file:./dev.db` |
| `ACCESS_CODE` | 可选访问码；留空则不启用保护 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key，用于生成图书短简介 |

设置访问码后，首次访问会跳到 `/login`，验证通过后写入 Cookie（30 天）。

配置好 DeepSeek Key 后，可为全部藏书写简介：

```bash
npm run describe:books
```

只补空简介：`ONLY_MISSING=1 npm run describe:books`（Windows PowerShell 可用 `$env:ONLY_MISSING=1; npm run describe:books`）。

## 功能一览

| 页面 | 路径 | 说明 |
|------|------|------|
| 今日推荐 | `/` | 以日期为种子，从想读/未读池推荐一本，可「换一本」 |
| 书架 | `/library` | 封面墙、状态筛选、搜索、智能书架「沉睡超一年」 |
| 详情 | `/books/[id]` | 状态标记、DeepSeek 简介、相似推荐 |
| 录入 | `/add` | 书架照片 OCR 批量入库；可选手动 / ISBN 补全 |
| 统计 | `/stats` | 状态分布、年度月度读完、分类构成 |

## 内网穿透（ngrok 示例）

开发服务已绑定 `0.0.0.0`。需要从外网访问时：

1. 安装 [ngrok](https://ngrok.com/)
2. 本地先启动：`npm run dev`（默认端口 3000）
3. 另开终端：

```bash
ngrok http 3000
```

4. 使用 ngrok 给出的 `https://xxxx.ngrok-free.app` 访问

**强烈建议**在 `.env` 中设置 `ACCESS_CODE`，避免公网链接被随意打开。

生产模式：

```bash
npm run build
npm run start
```

## 拍照批量录入

在应用内打开 **录入** 页：

1. 上传一张或多张书架 / 书脊照片（最多 12 张）
2. 点击「开始识别」，服务端用 Tesseract（简体中文横/竖排）抽出候选书名
3. 勾选、改名、删错项后「确认入库」——照片**不会**当作封面

也可继续用脚本方式：整理 `data/books-import.json` 后执行 `npm run import:books`。

奥奥形象图在 `public/mascot/`。

## 目录结构（要点）

```
prisma/schema.prisma     # Book / DoubanCache
src/lib/douban.ts        # 豆瓣抓取、缓存、限速、降级
src/lib/recommend.ts     # 相似推荐与每日推荐
src/app/api/             # books / books/batch / ocr / douban / upload / …
scripts/importBooks.ts   # 批量导入
data/books-import.json   # 导入数据
public/covers/           # 本地封面
```

## 注意事项

- 豆瓣无官方 API，抓取可能被限流；失败时应用会降级为「打开豆瓣链接」，不影响本地编目。
- 家庭宽带 IP 比云主机更适合温和抓取，这也是选择本地部署的原因之一。
- 请合理使用，勿高频刷取。
- OCR 对模糊、倾斜、密集书脊准确率有限，入库前请人工核对书名；首次识别会下载语言包，可能较慢。
