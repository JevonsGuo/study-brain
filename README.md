# Sharon Study

为 Sharon 高中学习打造的辅助工具，包含学习计划、错题本、单词卡、成绩追踪、番茄钟等功能。

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Element Plus
- **后端**：Express + better-sqlite3
- **数据库**：SQLite（文件存储，零运维）

## 项目结构

```
sharon-study/
├── sharon-study-app/       # 前端项目
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   ├── router/         # 路由配置
│   │   ├── utils/          # 工具函数（API 请求等）
│   │   └── App.vue         # 主布局（侧边栏导航）
│   └── vite.config.ts      # Vite 配置（含 API 代理）
├── server/                 # 后端项目
│   └── src/
│       ├── index.js        # Express 入口
│       ├── db/index.js     # SQLite 初始化与表结构
│       └── routes/         # REST API 路由
├── data/                   # SQLite 数据库文件（自动创建）
├── dist/                   # 前端构建产物（npm run build 后生成）
└── scripts/
    ├── dev.sh              # 开发模式一键启动
    └── start.sh            # 生产模式一键启动
```

## 功能模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 首页 | /home | 问候语、实时时钟、模块导航 |
| 学习计划 | /study-plan | 添加/完成/删除每日学习任务 |
| 错题本 | /wrong-book | 记录错题与原因，按科目筛选 |
| 单词卡 | /word-card | 卡片翻转记忆 + 列表模式 |
| 成绩追踪 | /grade-tracker | 录入分数，可视化进度条 |
| 番茄钟 | /timer | 25分钟专注 + 5分钟休息 |

## 开发模式

启动前后端开发服务器，支持热更新：

```bash
./scripts/dev.sh
```

启动后：

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5173 | Vite 开发服务器，修改代码自动刷新 |
| 后端 | http://localhost:3000 | Express API + SQLite |

浏览器访问 **http://localhost:5173**，前端 API 请求会自动代理到后端 3000 端口。

## 生产模式（本地模拟）

先构建前端，再以单进程启动，Express 同时托管前端静态文件和 API：

```bash
./scripts/start.sh
```

启动后访问 **http://localhost:3000**，一个端口提供全部服务。

## 部署到 NAS

### 方式一：完整项目部署

1. 将整个项目拷贝到 NAS：
   ```bash
   scp -r sharon-study/ user@nas:/path/to/
   ```

2. 在 NAS 上安装 Node.js（v18+）

3. 安装依赖并启动：
   ```bash
   cd /path/to/sharon-study
   cd sharon-study-app && npm install && npm run build && cd ..
   cd sharon-study-app/server && npm install && cd ..
   node sharon-study-app/server/src/index.js
   ```

4. 访问 `http://NAS_IP:3000`

### 方式二：只部署必要文件

在本地构建好，只拷贝运行所需文件：

```bash
# 本地构建
./scripts/start.sh  # Ctrl+C 停止后，dist/ 已生成

# 拷贝到 NAS（dist 在 sharon-study-app/dist/）
scp -r sharon-study-app/server/ sharon-study-app/dist/ data/ user@nas:/path/to/sharon-study/
```

NAS 上只需：
```bash
cd /path/to/sharon-study/server
npm install
node src/index.js
```

### 数据备份

SQLite 数据库文件位于 `data/sharon-study.db`，备份只需拷贝该文件：

```bash
cp data/sharon-study.db data/sharon-study-$(date +%Y%m%d).db
```

### 后台运行（NAS 推荐）

使用 `nohup` 或 `pm2` 保持服务持续运行：

```bash
# nohup 方式
nohup node sharon-study-app/server/src/index.js > sharon-study.log 2>&1 &

# pm2 方式（需先 npm install -g pm2）
pm2 start sharon-study-app/server/src/index.js --name sharon-study
pm2 save
pm2 startup  # 开机自启
```
