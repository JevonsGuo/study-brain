# AGENTS.md

面向 AI 会话的项目约定。人类可读的完整文档见 `README.md`。

## 项目概况

- Sharon 的学习应用：Vue 3 + Vite 前端 / Express + better-sqlite3 后端 / SQLite 单文件库
- 维护者是测试人员：**所有操作必须一键化**（脚本），永远不要让她手敲 SQL 或多步手工操作
- 需求模式：她说"做 1.0.x，需求是 X/Y/Z"，落盘位置、实现方式由 AI 决定

## 核心原则（不可违反）

1. **内容即代码**：单词字典/知识库/学习资源的唯一数据源是 `content/*.json`（入 git）。禁止通过 HTTP API 或临时脚本灌内容数据
2. **用户数据神圣**：学习计划/错题/成绩/背诵进度只存在于生产库，靠备份保护。任何内容同步/重置操作不得触碰
3. **归属标记**：内容三表（words/knowledge_points/learning_resources）有 `origin`（seed|user）和 `user_modified` 列
   - 路由 POST 创建 → `origin='user', user_modified=1`；PUT 编辑 → `user_modified=1`；进度类操作（remember/forget）不得改 `user_modified`
   - sync-content 跳过 `user_modified=1` 的行，且只更新内容字段，不碰进度字段
4. **数据文件不入 git**：`sharon-study-app/data/` 已 gitignore。全新克隆后必须先跑 `node scripts/sync-content.mjs`（自动建库+灌内容），直接启动服务只会得到空库
5. `.env*` 不入 git。生产用 `sharon-study-app/.env.production`（DB_PATH 为绝对路径 `/data/sharon-study/production.db`），本地用 `.env.local`

## 常用命令

```bash
./scripts/publish.sh <host>        # 发布：git add -A + commit + push + ssh 执行 deploy.sh
node scripts/sync-content.mjs      # 幂等内容同步；NODE_ENV=production 读 .env.production；DB_PATH 环境变量可覆盖
node scripts/export-content.mjs [words|knowledge|learning-resources]  # DB -> JSON（特殊场景才用）
./scripts/reset-production.sh --confirm   # 生产库重置（守卫：无 --confirm 拒绝；先备份到 <db目录>/backups/）
```

- 发布前更新版本号：三个 package.json（根 / sharon-study-app / server），publish 提交信息取 `sharon-study-app/package.json` 的 version
- 迁移：`server/src/db/index.js` 的 `MIGRATIONS` 数组，命名 `00N_description`，启动时自动执行
- 新增内容表时必须：加 origin/user_modified 列、建自然键唯一索引、sync-content 加对应同步函数
- 自然键约定：words 用 `(word, word_list)`；knowledge 用 `(subject, title)`；learning-resources 用 `(subject, url)`——**组卷网同一 URL 挂多个科目是合法的，不能只用 url**

## 单词卡 enrichment 字段

words 表 6 个 JSON/TEXT 列（迁移 006），content JSON 可选提供：

| 字段 | 类型 | 说明 |
|------|------|------|
| `forms` | JSON object | 词形变化：`{past, past_participle, present_participle, noun, plural, comparative, superlative, third_person}` |
| `synonyms` | JSON array | 同义词：`["desert","forsake"]` |
| `antonyms` | JSON array | 反义词：`["retain","keep"]` |
| `collocations` | JSON array | 搭配：`[{phrase:"abandon hope", meaning:"放弃希望"}]` |
| `etymology` | plain text | 词根词缀：`"a-(away) + bandon(control)，源自古法语"` |
| `distinction` | JSON array | 易混辨析：`[{word:"desert", diff:"desert强调违背责任的抛弃"}]` |

前端卡片背面用 **折叠面板**（el-collapse accordion）渐进展示：词形变化 → 搭配 → 易混辨析 → 同义/反义。词根底部一行常驻。空字段不生成面板。卡片固定高度 420px，背面 `overflow-y: auto` 滚动。

## 知识库交互架构：教材书架 + 沉浸式宽屏阅读

知识库采用“教材书架陈列 + 沉浸式宽屏阅读”两阶段交互架构：
- **阶段一：教材书架（BookShelf）**：左侧快速切换 9 大学科（数学、语文、英语、物理、化学、生物、政治、历史、地理）；主区域按年级陈列高度仿真真实实体课本封面的教材卡片（含书脊装订立体阴影、版署、封面几何/艺术纹样与考点收录进度徽章）。
- **阶段二：沉浸式阅读器（Book Reader）**：点击某本教材进入宽屏阅读：
  - **左边栏（260px）**：章节与小节目录树状导航（章级汇总 + 小节精准过滤）。
  - **右边栏（宽栏 flex: 1）**：开阔宽敞展示考点卡片流（KaTeX 公式渲染、解题技巧 Tips、思维图景 Visual Desc 与 B站名师视频）。
  - **学习资源右侧滑出抽屉（Drawer）**：点击右上角“学习资源”按钮滑出 420px 抽屉，平时隐藏不占据阅读空间。

`knowledge_points` 表包含 `grade` 与 `book` 列（迁移 007），`content/knowledge.json` 维护每条知识点的年级与分册归属。

## 验证方法（改完必须验证）

用 /tmp 下的 scratch 库，**永远不要拿开发库/生产库做实验**：

```bash
# sync 支持环境变量覆盖，例：
DB_PATH=/tmp/scratch.db node scripts/sync-content.mjs
```

- **幂等性**：连跑两次 sync，第二次必须全部"无变化"
- **迁移测试**：手工构造旧 schema 库（建表+灌脏数据+插入旧迁移记录到 `_migrations`），再触发 getDb() 验证升级
- **起服务测试**：`DB_PATH=/tmp/x.db PORT=3999 node src/index.js &` + curl + kill **必须在同一条 bash 命令内完成**——后台进程不跨工具调用存活
- **reset 演练**：临时把 `.env.production` 的 DB_PATH 指到 scratch 路径，跑 `--confirm`，跑完**立即还原** env 文件

## 环境陷阱（本会话踩过的坑）

- `better-sqlite3` 只能从 `sharon-study-app/server` 目录解析——`node -e "require('better-sqlite3')"` 的 cwd 必须是 server/
- zsh 对无匹配的通配符直接报错（`rm -f /tmp/x.db*` 文件不存在时命令失败），避免裸 glob
- curl 的 URL 里不要放未编码中文（`?subject=数学` 会得到空响应），用英文或先编码
- SQLite WAL 模式：改动可能躺在 `-wal` 文件里，验证数据时以查询结果为准而非文件时间戳
- deploy.sh 在 `git pull` 前有 `git checkout -- sharon-study-app/data/`（过渡期防冲突），data 彻底出库后可移除
- 服务器仓库在 `/opt/sharon-study`，生产库在仓库外（`/data/sharon-study/`），两者互不影响
- 迁移中建索引要在条件分支外执行：迁移 005 的 `CREATE INDEX` 不能只放在 `if (!columns.includes('word_list'))` 内，否则新库（CREATE TABLE 已含 word_list）会跳过整个分支导致索引缺失
- 迁移 004 创建 `idx_words_word` 前要检查 `idx_words_word_list` 是否已存在，两个唯一索引冲突会导致 INSERT 失败
