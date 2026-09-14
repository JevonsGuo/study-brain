# AGENTS.md

面向 AI 会话的项目约定。人类可读的完整文档见 `README.md`。

## 项目概况

- 智学大脑 (Study Brain)：Vue 3 + Vite + TypeScript + Pinia 前端应用
- 核心存储架构：**纯客户端 IndexedDB 本地私有数据引擎**（`sharon-study-app/src/utils/localDatabase.ts`）+ 公共学科静态数据
- 零后端、零服务器数据库：已彻底废弃旧 Express + SQLite 集中式架构，全平台（GitHub Pages / Cloudflare Pages / GCP / Ubuntu Linux）统一采用纯静态架构
- 维护者是测试人员：**所有操作必须一键化**，构建与部署自动化，严禁引入复杂手工运维步骤

## 核心原则（不可违反）

1. **内容即代码**：单词字典/知识库/学习资源的唯一数据源是 `content/*.json`（入 git）。在 `npm run build` 或 `./scripts/dev.sh` 时，由 `scripts/copy-content-to-public.mjs` 自动同步到 `sharon-study-app/public/content/`，严禁通过手工脚本或服务端 API 灌内容。
2. **用户数据客户端绝对私有**：学生的个人昵称、自律座右铭、每日计划、错题本、成绩追踪、专注打卡与背诵进度，严格保存在每个学生自己的浏览器 `IndexedDB` (`StudyBrainDB`) 中。跨设备同步通过端到端高强度加密口令极速同步（Cloudflare 零知识中继）或全量 JSON 导入导出。
3. **API 客户端虚拟路由层**：页面所有 `api.get` / `api.post` / `api.put` / `api.del` 请求由 `sharon-study-app/src/utils/api.ts` 的 `handleLocalRequest` 统一拦截并无感就地响应，严禁破坏这套解耦架构。
4. **统一现代化静态部署**：
   - GitHub Pages / Cloudflare Pages：由 `.github/workflows/deploy.yml` 自动打包分发；
   - Ubuntu / GCP 生产服务器：由 Nginx 直接托管 `dist/` 纯静态目录（`scripts/nginx-ubuntu.conf` 与 `scripts/nginx-gcp.conf`），使用 `./scripts/deploy.sh` 一键构建并平滑重载 Nginx；无 Node.js 后端守护进程，无 PM2，无 `.env.production`。

## 常用命令

```bash
./scripts/dev.sh                   # 本地极速开发：自动同步内容并启动 Vite (localhost:5173)
cd sharon-study-app && npm run build # 严格构建：自动触发 copy-content-to-public 并执行 vue-tsc 类型检查
./scripts/publish.sh <host>        # 发布：git add + commit + push + 触发远端 Nginx 静态部署
```

- 版本号维护：更新 `sharon-study-app/package.json` 与根目录 `package.json` 的 version 字段
- Git 多端同步：本地 `origin` 已配置同时绑定 Gitee 与 GitHub，执行 `git push`（或 IDE 中 Commit & Push）自动双端推送

## 单词卡 enrichment 字段

`content/words-*.json` 提供丰富的结构化语言学字段：
| 字段 | 类型 | 说明 |
|------|------|------|
| `forms` | JSON object | 词形变化：`{past, past_participle, present_participle, noun, plural, comparative, superlative, third_person}` |
| `synonyms` | JSON array | 同义词：`["desert","forsake"]` |
| `antonyms` | JSON array | 反义词：`["retain","keep"]` |
| `collocations` | JSON array | 搭配：`[{phrase:"abandon hope", meaning:"放弃希望"}]` |
| `etymology` | plain text | 词根词缀：`"a-(away) + bandon(control)，源自古法语"` |
| `distinction` | JSON array | 易混辨析：`[{word:"desert", diff:"desert强调违背责任的抛弃"}]` |

前端卡片背面采用 **折叠面板**（el-collapse accordion）渐进展示，空字段自动隐藏。

## 知识库交互架构：教材书架 + 沉浸式宽屏阅读

- **阶段一：教材书架（BookShelf）**：左侧快速切换 9 大学科；主区域按年级陈列仿真真实实体课本封面的教材卡片（含书脊装订立体阴影、版署标识与考点进度徽章）。
- **阶段二：沉浸式阅读器（Book Reader）**：点击进入宽屏阅读：
  - **左边栏（260px）**：章节与小节目录树状导航。
  - **右边栏（宽栏 flex: 1）**：开阔宽敞展示考点卡片流（KaTeX 公式渲染、解题技巧 Tips、思维图景 Visual Desc 与 B站名师视频嵌入）。
  - **学习资源右侧滑出抽屉（Drawer）**：点击右上角快捷按钮滑出 420px 抽屉，平时隐藏不占据视界。

## 验证方法

改完代码后必须验证：
```bash
cd sharon-study-app && npm run build
```
只要 `vue-tsc -b && vite build` 0 错误通过，即可 100% 放心提交推送！
