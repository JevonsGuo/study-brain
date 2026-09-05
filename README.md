# Sharon Study

为 Sharon 高中学习打造的辅助工具，包含学习计划、错题本、单词卡、成绩追踪、番茄钟、知识库等功能。

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Element Plus
- **后端**：Express + better-sqlite3
- **数据库**：SQLite（文件存储，零运维）

## 项目结构

```
sharon-study/
├── sharon-study-app/         # 前端 + 后端项目
│   ├── src/
│   │   ├── views/            # 页面组件
│   │   ├── router/           # 路由配置
│   │   ├── utils/            # 工具函数（API 请求等）
│   │   └── App.vue           # 主布局（侧边栏导航）
│   ├── server/               # 后端项目
│   │   └── src/
│   │       ├── index.js      # Express 入口
│   │       ├── db/index.js   # SQLite 初始化 + 迁移机制
│   │       └── routes/       # REST API 路由
│   ├── data/                 # SQLite 数据库文件（不入git，自动创建）
│   ├── .env.example          # 环境变量模板（入git）
│   ├── .env.local            # 本地开发环境（不入git）
│   └── .env.production       # 生产环境（不入git）
├── content/                  # 内容数据（入git，随版本发布）
│   ├── words.json            # 单词字典（763词）
│   ├── knowledge.json        # 知识库内容（34个知识点）
│   └── learning-resources.json # 学习资源（25条）
├── scripts/
│   ├── deploy.sh             # 服务器部署脚本（备份+内容同步+重启）
│   ├── publish.sh            # 本地一键发布脚本
│   ├── sync-content.mjs      # content/ -> 数据库 幂等内容同步
│   ├── export-content.mjs    # 数据库 -> content/ 内容导出（一次性/特殊场景）
│   ├── reset-production.sh   # 生产库重置（备份->清空->重建->灌内容）
│   └── seed-grades.js        # 测试成绩数据（仅限本地开发）
```

## 功能模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 首页 | /home | 问候语、实时时钟、模块导航卡片 |
| 学习计划 | /study-plan | 日期导航、快速录入、按科目分组、进度追踪、日历弹窗 |
| 错题本 | /wrong-book | 记录错题与原因，按科目筛选 |
| 单词卡 | /word-card | 3D翻转卡片、间隔重复、每日目标、发音、掌握度、搜索 |
| 知识库 | /knowledge | 学科卡片、章节导航、KaTeX公式、B站视频嵌入 |
| 成绩追踪 | /grade-tracker | ECharts图表、趋势线/雷达/柱状图、科目详情、红涨绿跌 |
| 番茄钟 | /timer | SVG进度环、背景音乐、可调时长、自动轮换 |

## 环境隔离

项目通过 `.env` 文件区分开发与生产环境，环境变量不入git。

| | 开发环境 (MacBook) | 生产环境 (Ubuntu/NAS) |
|---|---|---|
| 配置文件 | `.env.local` | `.env.production` |
| 数据库 | `data/test.db` | `/data/sharon-study/production.db` |
| NODE_ENV | `development` | `production` |
| 端口 | 3000 | 3000 |

### 环境变量说明

```bash
# 数据库路径（相对于 sharon-study-app/ 目录，生产环境用绝对路径）
DB_PATH=data/test.db

# 服务端口
PORT=3000

# 运行环境
NODE_ENV=development
```

### 新环境初始化

```bash
cd sharon-study-app
cp .env.example .env.local     # 开发环境
# 或
cp .env.example .env.production  # 生产环境，修改DB_PATH为绝对路径
```

## 数据库迁移

项目使用 `_migrations` 表自动追踪迁移记录。启动时自动执行未运行的迁移。

新增迁移：编辑 `server/src/db/index.js`，在 `MIGRATIONS` 数组中添加：

```js
{
  name: '003_description',
  up: () => {
    // ALTER TABLE 等操作
  }
}
```

迁移按顺序执行，已执行的不会重复运行。

## 版本号

版本号定义在 `sharon-study-app/package.json` 的 `version` 字段，当前版本：**1.0.1**

每次发布前更新版本号。

## 本地开发

### 安装依赖

```bash
cd sharon-study-app
npm install --cache /tmp/npm-cache
cd server && npm install --cache /tmp/npm-cache
```

### 启动开发服务

```bash
# 终端1：后端
cd sharon-study-app/server
NODE_ENV=development node src/index.js

# 终端2：前端（热更新）
cd sharon-study-app
npm run dev
```

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5173 | Vite 开发服务器，修改代码自动刷新 |
| 后端 | http://localhost:3000 | Express API + SQLite |

浏览器访问 **http://localhost:5173**，前端 API 请求会自动代理到后端 3000 端口。

### 内容数据与测试数据

内容数据（单词字典/知识库/学习资源）统一放在 `content/*.json`，随 git 版本管理。数据库文件（`sharon-study-app/data/`）不入git，**全新克隆后先执行一次 sync-content**（自动建库+建表+灌入内容），直接启动服务只会得到空库。

### 内容数据同步（sync-content.mjs）

同一个脚本，根据 `NODE_ENV` 自动判断环境，读取对应的 `.env` 文件连接数据库。幂等执行，按自然键 upsert，重复执行不会产生冗余数据。

| 命令 | 环境 | 读取配置 | 目标数据库 |
|------|------|---------|-----------|
| `node scripts/sync-content.mjs` | 开发 | `.env.local` | `data/test.db` |
| `NODE_ENV=production node scripts/sync-content.mjs` | 生产 | `.env.production` | `/data/sharon-study/production.db` |

也可用 `DB_PATH` 环境变量覆盖，直接指定数据库路径（不依赖 env 文件）：

```bash
DB_PATH=/tmp/scratch.db node scripts/sync-content.mjs
```

```bash
# 开发环境灌入内容
node scripts/sync-content.mjs

# 生产环境灌入内容
NODE_ENV=production node scripts/sync-content.mjs

# 灌入测试成绩数据（仅限本地，脚本会拒绝指向非本地地址）
node scripts/seed-grades.js
```

更新内容的流程：修改 `content/*.json` -> commit -> 发布（deploy.sh 自动执行 sync-content）。

## 生产部署 (Ubuntu)

### 首次部署

```bash
# 1. 克隆仓库
git clone https://gitee.com/jevonsguo/sharon-study.git /opt/sharon-study
cd /opt/sharon-study

# 2. 安装依赖
cd sharon-study-app && npm install --cache /tmp/npm-cache
cd server && npm install --cache /tmp/npm-cache

# 3. 配置环境
cp .env.example .env.production
# 编辑 .env.production:
#   DB_PATH=/data/sharon-study/production.db
#   PORT=3000
#   NODE_ENV=production

# 4. 创建数据目录
mkdir -p /data/sharon-study/backups

# 5. 构建前端
cd /opt/sharon-study/sharon-study-app
npm run build --cache /tmp/npm-cache

# 6. 启动服务（pm2）
npm install -g pm2
cd /opt/sharon-study/sharon-study-app/server
NODE_ENV=production pm2 start src/index.js --name sharon-study
pm2 save
pm2 startup
```

### 一键发布

本地 MacBook 执行：

```bash
./scripts/publish.sh <服务器IP> [用户名]
# 例如：
./scripts/publish.sh 192.168.1.100
./scripts/publish.sh my-nas jevons
```

该脚本自动完成：
1. Git commit + push
2. SSH 到服务器执行 `deploy.sh`（git pull + npm install + build + 备份数据库 + 内容同步 + restart）

### 服务器手动部署

```bash
cd /opt/sharon-study
bash scripts/deploy.sh
```

## 数据管理策略

数据按"能否重建"分为两类，维护方式完全不同：

| 类别 | 包含内容 | 来源 | 维护方式 |
|------|---------|------|---------|
| **内容数据**（可重建） | 单词字典、知识库、学习资源 | `content/*.json`（入git） | 改 JSON -> 发布，`sync-content.mjs` 幂等灌入 |
| **用户数据**（不可重建） | 学习计划、错题、成绩、背诵进度、用户对内容条目的修改 | 用户在页面上的操作 | 只存在于生产库，靠备份保护 |

### 归属标记

三张内容表（words / knowledge_points / learning_resources）每行带两个标记：

- `origin`：`seed`（来自 content/）或 `user`（用户在页面创建）
- `user_modified`：用户在页面编辑过则为 1，内容同步永远跳过这些行

内容同步只更新内容字段，不碰背诵进度（mastery_level / next_review 等），因此更新字典不会影响学习进度。

### 数据备份

deploy.sh 每次发布前自动备份到 `/data/sharon-study/backups/pre-deploy-<时间戳>.db`。

生产服务器建议配置每日定时备份（crontab）：

```bash
# 每天凌晨3点备份（.backup 方式对 WAL 模式安全）
0 3 * * * cd /opt/sharon-study/sharon-study-app/server && node -e "require('better-sqlite3')('/data/sharon-study/production.db').backup('/data/sharon-study/backups/daily-' + new Date().toISOString().slice(0,10) + '.db').then(()=>process.exit(0))"
```

备份应定期复制到另一台机器，防止单机故障。

### 生产库重置（一次性）

1.0.0 的生产库是从测试库拷贝的，包含测试数据。1.0.1 发布后在服务器上执行一次：

```bash
cd /opt/sharon-study
bash scripts/reset-production.sh --confirm
```

脚本会：备份 -> 停服 -> 删库 -> 重建表结构 -> 从 content/ 灌入内容 -> 重启。执行后生产库为干净的初始态（内容数据齐全，用户数据为空）。

## 目录规划 (Ubuntu 服务器)

```
/opt/sharon-study/              # Git 仓库（代码）
  sharon-study-app/             # 前端 + 后端源码
  scripts/                      # 部署脚本

/data/sharon-study/             # 数据目录（不入git）
  production.db                 # 生产数据库
  backups/                      # SQL 备份
```

## 注意事项

- npm cache 可能遇到权限问题，使用 `--cache /tmp/npm-cache`
- SQLite 中 `date()` 在 better-sqlite3 的 prepare() 里需用单引号 `date('now')`
- Express 5 路由通配符用 `{*path}` 而非 `*`
- 成绩趋势颜色：红涨绿跌（中国股市惯例）
- 数据库文件（.db / .db-shm / .db-wal）已在 .gitignore 中，不入版本控制
