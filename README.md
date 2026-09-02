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
├── scripts/
│   ├── deploy.sh             # 服务器部署脚本
│   ├── publish.sh            # 本地一键发布脚本
│   ├── seed-words.js         # 词汇种子数据
│   ├── seed-examples.js      # 例句种子数据
│   ├── seed-math.js          # 数学知识种子数据
│   ├── seed-grades.js        # 成绩种子数据
│   ├── seed-plans.js         # 学习计划种子数据
│   └── restore-db.js         # 从SQL文件恢复数据库
└── data/
    └── sharon-study-dump.sql # SQL文本导出（跨机器同步用）
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

版本号定义在 `sharon-study-app/package.json` 的 `version` 字段，当前版本：**0.1.0**

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

### 种子数据

```bash
cd sharon-study-app
node scripts/seed-words.js      # 763个高考词汇
node scripts/seed-examples.js   # 678个例句
node scripts/seed-math.js       # 34个数学知识点
node scripts/seed-grades.js     # 45条成绩记录
node scripts/seed-plans.js      # 过去30天随机计划
```

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
2. SSH 到服务器执行 `deploy.sh`（git pull + npm install + build + restart）

### 服务器手动部署

```bash
cd /opt/sharon-study
bash scripts/deploy.sh
```

## 数据管理

### 数据库文件位置

| 环境 | 路径 |
|------|------|
| 开发 | `sharon-study-app/data/test.db` |
| 生产 | `/data/sharon-study/production.db` |

### 数据备份

```bash
# SQL文本备份（推荐，可diff可入git）
sqlite3 /data/sharon-study/production.db .dump > /data/sharon-study/backups/$(date +%Y-%m-%d).sql

# 文件备份
cp /data/sharon-study/production.db /data/sharon-study/backups/$(date +%Y-%m-%d).db
```

### 跨机器数据同步

使用 SQL 文本导出（不入 git 的 .db 文件）：

```bash
# 导出
sqlite3 data/test.db .dump > data/sharon-study-dump.sql

# 在新机器恢复
node scripts/restore-db.js
```

### 定时备份 (Ubuntu crontab)

```bash
# 每天凌晨3点备份
0 3 * * * sqlite3 /data/sharon-study/production.db .dump > /data/sharon-study/backups/$(date +\%Y-\%m-\%d).sql
```

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
