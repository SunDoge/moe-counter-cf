# Moe Counter CF

基于 Cloudflare Workers、D1 和 Hono 的 SVG 访问计数器，使用 Kysely 与 `@sundoge/kysely-d1` 访问数据库。

## 本地开发

需要 Node.js 22 或更高版本，推荐使用 `.node-version` 指定的 Node.js 24。

```bash
npm ci
cp wrangler.example.toml wrangler.toml
npm run db:init:local
npm run dev
```

访问 `http://localhost:8787/SunDoge/moe-counter-cf`。

## 接口

计数路由严格限定为 `GET /username/reponame`，计数键为完整的 `username/reponame`，区分大小写。单段、多段和尾部斜杠路径返回 404。用户名允许 1–39 位字母、数字及中间的连字符；仓库名允许 1–100 位字母、数字、点、下划线和连字符，不允许单独的 `.` 或 `..`。编码后的斜杠也不允许。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `theme` | `gelbooru` | `asoul`、`gelbooru`、`gelbooru-h`、`moebooru`、`moebooru-h`、`rule34` |
| `length` | `7` | 最小位数，范围 1–30；`auto` 不补零，计数不会被截断 |
| `add` | `1` | `0` 仅读取，其他值递增 |
| `pixelated` | 无 | `pixelated` 开启像素化渲染 |

非法参数返回 400，且不会递增计数。HEAD 请求只读取。递增与返回计数在同一条数据库语句中完成，支持并发请求。响应使用 `Cache-Control: no-store`。

```markdown
![Moe Counter](https://your-worker.workers.dev/SunDoge/moe-counter-cf?theme=asoul)
```

## 部署

```bash
npx wrangler login
npx wrangler d1 create moe-counter-cf
```

将返回的数据库名称和 ID 填入 `wrangler.toml` 的 `d1_databases`，保留绑定名 `DB`，然后执行：

```bash
npm run db:init:remote
npm run deploy
```

可选 SVG 缓存：运行 `npx wrangler kv namespace create KV`，取消模板中的 `kv_namespaces` 注释并填写 ID。未配置 KV 或缓存读写失败时仍可生成图片。KV 只缓存图片，计数存储于 D1。缓存键包含 SVG 渲染版本，避免复用旧格式。

SVG 使用 `<defs>` 与 `<use>` 复用重复数字，每个用到的数字只嵌入一次图片数据。数字定义在 Worker 实例内预生成；保留原始 GIF/PNG 素材和像素化选项。

## 从 0.1 升级

- Hono 升至 4，Wrangler 升至 4，构建统一使用 npm，并提交锁文件。
- 将现有配置的构建命令改为 `npm run build`，参考模板更新 `compatibility_date`。
- 原 `/:name` 接口已移除，链接需要改为 `/username/reponame`。旧的 `username:reponame` 数据不会自动改名；如需保留计数，需单独迁移对应的 `counters.name`，避免与已有新键冲突。
- 表结构兼容原数据库；初始化脚本可重复执行，不再删除计数数据。
- Wrangler 固定为 4.107.0（4.108.0 起要求 Workers 类型 5.x），Workers 类型使用兼容 `@sundoge/kysely-d1` peer dependency 的 4.x 系列。通过限定于 Miniflare 的 overrides 更新 `sharp` 和 `undici`，修复开发依赖的已知漏洞。

## 验证

```bash
npm run check
npx wrangler deploy --dry-run --config wrangler.example.toml
```

测试在 Miniflare 的本地 D1 上验证路由限制、参数校验、只读请求、并发递增、主题渲染和数据库初始化。
