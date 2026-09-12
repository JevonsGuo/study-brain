# 智学大脑 (Study Brain) 🧠

> **面向高考与自律提升的个人全功能智学空间 · 跨平台私有化学习工作台**  
> 纯客户端零成本运行（IndexedDB 本地私有数据引擎） + 集中式双模架构（Express + SQLite）  
> 一次代码提交，多端全自动同步部署（GitHub Pages / Cloudflare Pages / Google Cloud / Ubuntu VPS）

[![GitHub Pages Deployment](https://github.com/JevonsGuo/study-brain/actions/workflows/deploy.yml/badge.svg)](https://github.com/JevonsGuo/study-brain/actions/workflows/deploy.yml)
[![Version](https://img.shields.io/badge/version-1.0.6-blue.svg)](sharon-study-app/package.json)
[![Vue](https://img.shields.io/badge/Vue-3.5-brightgreen.svg)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB%20%2B%20SQLite-orange.svg)]()

---

## 🌟 核心特性

- 🛡️ **私有化与零服务器成本**：
  内置自主研发的 **IndexedDB 本地私有数据引擎**（`localDatabase.ts`），错题、计划、笔记、成绩、专注打卡与词汇进度 100% 存储于学生本地浏览器，无需租用云数据库，保护个人隐私，发一个链接人人开箱即用。
- ⚡ **多端极速秒级并发部署**：
  配置 GitHub Actions CI/CD 流水线，一次提交，自动并发分发至：
  - **GitHub Pages**：`https://jevonsguo.github.io/study-brain/#/home`
  - **Cloudflare Pages**：全球 Anycast 边缘 CDN 加速 + 专有 Worker 反代
  - **Google Cloud Platform (GCP)**：生产级 Nginx 静态优化与 Gzip 深度压缩
  - **自建 Ubuntu 服务器**：自动化拉取、生产备份与热重载
- 🔄 **坚果云 WebDAV 跨设备云端备份**：
  支持直连坚果云 WebDAV（自动突破浏览器 CORS 限制），后台每 30 分钟静默同步至 `/我的坚果云/StudyBrain/backup.json`；同时支持全量学习数据一键导出与导入 JSON 文件。
- 🎨 **学生量身定制系统**：
  新用户首次访问智能呼出入驻向导，输入学生昵称、学段与励志座右铭，全站动态生成专属空间名称（如“子涵 的学习大脑”），随处支持一键 ✏️ 即时修改。
- 📚 **权威分层学科与词汇体系**：
  汇聚高考 9 大学科核心考点大纲、仿真真实课本装订的 3D 教材书架、开阔双栏阅读器；配备从高考核心到 GRE 核心三千词的 6 大词库（22,000+ 词条），全面支持艾宾浩斯间隔记忆。
- 🎮 **沉浸式脑力工坊 (Brain Gym)**：
  纯原生 Vue 3 构建的 8 款高品质自研益智对局（零外部广告/零网络风险）：舒尔特方格、2048、经典数独、数字华容道、见缝插针、经典扫雷、记忆翻牌与汉诺塔。

---

## 🛠️ 技术栈

| 层次 | 技术选型 | 说明 |
|------|----------|------|
| **前端核心** | Vue 3 + TypeScript + Vite 8 | 极速构建、组合式 API (Composition API)、强类型保障 |
| **状态管理** | Pinia 4 | 响应式状态管理（Timer、AppConfig、UserProfile 等） |
| **路由导航** | Vue Router 4 (Hash 模式) | 完美兼容各大静态托管平台（GitHub/Cloudflare/Gitee）防 404 |
| **UI 组件库** | Element Plus + Icons Vue | 现代化沉浸式界面，全深色/浅色自适应主题 |
| **公式与图表** | KaTeX + ECharts 6 | 学科公式实时排版、模拟考试多维雷达图与成绩趋势线 |
| **客户端数据库** | 原生 IndexedDB (`StudyBrainDB`) | 10 大表本地持久化引擎，毫秒级就地读取 |
| **服务端 (可选)**| Express 5 + better-sqlite3 | 支持私有 NAS / Linux 云主机集中部署双模切换 |
| **CI/CD** | GitHub Actions + Cloudflare Workers | 自动化编译打包、多端分发与 WebDAV 跨域反代 |

---

## 📁 项目结构

```
study-brain/
├── .github/workflows/
│   └── deploy.yml            # GitHub Actions 多端自动化流水线 (支持 master/main)
├── sharon-study-app/         # Web 核心应用
│   ├── src/
│   │   ├── views/            # 核心业务页面 (Home, StudyPlan, SubjectHub, WordCard, Timer, BrainGym 等)
│   │   ├── router/           # 路由配置 (Hash 模式，静态平台刷新无 404)
│   │   ├── stores/           # Pinia 状态树 (userProfile, timer, appConfig)
│   │   ├── utils/            # 核心工具集
│   │   │   ├── localDatabase.ts # IndexedDB 本地私有数据引擎 (1000+ 行全功能客户端存储)
│   │   │   ├── api.ts        # 统一客户端 API 路由层 (无感拦截，零延迟就地响应)
│   │   │   └── textbookCatalog.ts # 沪教版等高中教材目录与章节索引
│   │   ├── components/       # 通用组件 (CloudSyncModal, UserOnboardingModal, UserProfileEditModal 等)
│   │   └── App.vue           # 响应式侧边栏布局、全局主题切换与自动备份调度
│   ├── functions/api/nutstore/ # Cloudflare Pages Functions (坚果云 WebDAV 跨域反代)
│   ├── public/               # 静态资源 (音频、高清书皮封面、favicon)
│   └── vite.config.ts        # Vite 编译配置 (base: './' 兼容多级子路径)
├── content/                  # 内容数据源 (内容即代码，入 git)
│   ├── words-default.json    # 高考核心词汇 (763 词)
│   ├── words-shanghai.json   # 上海高考专属词汇 (3669 词，全域真乱序版)
│   ├── words-cet6.json       # 大学英语六级拓展词汇 (1183 词)
│   ├── words-ielts.json      # 雅思核心真题词汇 (4974 词)
│   ├── words-toefl.json      # 托福学术高频词汇 (6959 词)
│   ├── words-gre.json        # GRE 核心三千词 (3036 词)
│   ├── knowledge.json        # 9 大学科知识库考点大纲 (81 个考点，分册分章节)
│   ├── learning-resources.json # 精品学科学习工具与名校资源 (25 条)
│   └── version.json          # 数据库版本元数据
└── scripts/
    ├── copy-content-to-public.mjs # 自动化同步 content/ 到 public/content/ 并生成索引
    ├── dev.sh                # 本地一键启动前后端开发环境
    ├── nginx-gcp.conf        # Google Cloud VM Nginx 生产环境模板配置
    ├── deploy.sh             # Ubuntu 传统服务器部署脚本 (备份 + 同步 + 重启)
    ├── publish.sh            # 本地一键发布到远端 Linux 服务器
    └── sync-content.mjs      # content/ -> SQLite 数据库幂等内容同步
```

---

## 🧭 功能模块详述

### 1. 智学首页 (`/#/home`)
- **个性化问候**：根据作息时间动态问候（“早上好，子涵”、“晚安，浩然”），直观展示高考倒计时与天气；
- **自律座右铭**：常驻呈现学生专属冲刺目标与励志格言，支持点击 ✏️ 铅笔随时在线修改；
- **六大模块快捷入口**：高饱和拟态卡片，支持流畅悬浮缩放动效。

### 2. 学科中心 (`/#/subjects`)
- **学科大厅 (Subject Hall)**：涵盖高中 9 大学科（数学、物理、化学、生物、语文、英语、历史、地理、政治），动态统计考点收录量与错题靶向数；
- **仿真教材书架 (BookShelf)**：立体书脊阴影装订仿真卡片，直观呈现沪教版、统编版等教材分册（高一/高二/高三）；
- **宽屏沉浸双栏阅读器 (Book Reader)**：
  - **左侧（260px）**：结构化章节目录树导航；
  - **右侧（自适应宽栏）**：核心考点流式卡片，KaTeX 矢量公式高清排版、易错技巧 Tips、形象思维图景 Visual Desc，以及 B 站名师精讲视频一键展开播放；
  - **考点笔记与错题互联**：每一条考点均可撰写私有心得笔记，一键联动对应错题；
  - **右上角资源抽屉 (Drawer)**：平滑滑出 420px 专属学习工具侧栏，包含组卷网、GeoGebra、化学方程式配平等优质站点。

### 3. 智词工坊 (`/#/word-card`)
- **6 大分层词库（22,000+ 词条）**：覆盖从高考核心、上海考纲、大学六级到出国留学（雅思/托福/GRE）；
- **丰富 Enrichment 词汇卡片**：音标、中英释义、真题例句、词形变化、同义/反义词、高频搭配、词根词缀剖析与易混辨析；
- **艾宾浩斯间隔复习算法**：1 → 2 → 4 → 7 → 15 → 30 天记忆周期，掌握度智能晋级；
- **全键盘与触屏交互**：`Space` 3D 翻转卡片、`←` / `→` 切换前后词、`1`（不认识）/ `2`（已掌握），支持真人原生发音与全库乱序打散。

### 4. 番茄钟与专注自习 (`/#/timer`)
- **三种专注模式**：25 分钟经典番茄钟、自定义深度自习、高考全真模拟试卷计时；
- **5 大 100% 绝对可用本地轻音乐渠道**：
  - 🎹 星空钢琴（纯琴静心 · 舒缓减压）
  - 🎵 治愈 Lofi（温暖慢调 · 轻松自习）
  - 🌿 空灵微风（木吉他清音 · 空灵专注）
  - 🌙 夜色沉思（极简慢板 · 深度心流）
  - ☕ 街角咖啡（轻语暖调 · 伴读白噪）
- **单按钮下拉曲库面板**：折叠收纳，界面干净极简，自习结束后自动弹出学情成果，打卡记录写入专注档案。

### 5. 错题靶向本 (`/#/wrong-items`)
- 按学科精准收录疑难错题，记录失分原因与详细解析，支持关联考点、重要程度星标与“已掌握/复习中”状态流转。

### 6. 成绩追踪与分析 (`/#/grade-tracker`)
- 模考多科分数录入，ECharts 绘制总分趋势走势图、各科均衡度雷达图；
- 紧盯目标院校分数线，分差红涨绿跌一览无余。

### 7. 脑力工坊 (`/#/brain-gym`)
课间高能思维放松，8 款原创益智对局，纯 Web Audio 音效，支持深浅主题：
1. ⚡ **舒尔特方格 (Schulte Grid)**：3×3 至 5×5 视觉注意力极速训练；
2. 🔢 **2048 经典数字**：经典平滑滑动合成与历史最高分追踪；
3. 🧩 **经典数独 (Sudoku)**：4×4 入门至 9×9 进阶题库，辅助候选数标记；
4. 🔲 **数字华容道 (Klotski)**：3×3 与 4×4 还原挑战，步数与计时双轨追踪；
5. 🎯 **见缝插针 (Arrow Wheel)**：动态变速旋转与防碰撞射击；
6. 💣 **经典扫雷 (Minesweeper)**：首击绝对安全保证、空白连锁揭开、标记插旗与复古数显仪表盘；
7. 🎴 **记忆翻牌 (Memory Match)**：几何 📐、化学 🧪、双螺旋 🧬 等学霸专属 Emoji 3D 翻牌；
8. 🗼 **汉诺塔 (Tower of Hanoi)**：3~6 阶多盘堆叠，防呆校验，比对理论最优极限步数 ($2^n - 1$)。

---

## 🚀 部署与发布指南

项目支持两大运行部署模式：

### 模式一：静态云托管部署（推荐 · 零成本 · 免服务器）

#### 1. 部署到 GitHub Pages
1. 将代码推送到 GitHub 仓库（已配置好自动化 Actions 流水线）；
2. 打开 GitHub 仓库页面：`Settings -> Pages`；
3. 将 **Source** 选项设为 **`GitHub Actions`**；
4. 提交任何代码或点击 `Re-run`，即可自动上线：
   `https://<你的用户名>.github.io/study-brain/#/home`

#### 2. 部署到 Cloudflare Pages
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，进入 **Workers 和 Pages** -> **创建应用程序** -> **Pages** -> **连接到 Git**；
2. 选中仓库 `study-brain`；
3. 构建配置：
   - **构建命令**：`cd sharon-study-app && npm run build`
   - **输出目录**：`sharon-study-app/dist`
   - **环境变量**：添加 `NODE_VERSION: 20`
4. 点击部署，获得全球边缘加速并自动激活坚果云 WebDAV 反代能力。

#### 3. 部署到 Google Cloud VM (GCP Nginx)
1. 运行 `npm run build`，将生成的 `sharon-study-app/dist` 上传至 GCP 服务器目录 `/var/www/study-brain/dist`；
2. 将 `scripts/nginx-gcp.conf` 复制到 `/etc/nginx/conf.d/study-brain.conf`；
3. 执行 `sudo nginx -t && sudo systemctl reload nginx` 完成上线。

---

### 模式二：自建 Linux / Ubuntu 服务器部署 (Nginx 纯静态高性能托管)

统一采用生产级 Nginx 静态托管架构，零 Node.js 后端守护进程，零数据库维护：

#### 1. 首次配置 Nginx (Ubuntu)
```bash
# 1. 创建静态 Web 根目录
sudo mkdir -p /var/www/study-brain/dist

# 2. 复制模板配置
sudo cp scripts/nginx-ubuntu.conf /etc/nginx/sites-available/study-brain.conf
sudo ln -s /etc/nginx/sites-available/study-brain.conf /etc/nginx/sites-enabled/

# 3. 检查并重载
sudo nginx -t && sudo systemctl reload nginx
```

#### 2. 本地一键远程更新发布
本地只需要执行一行命令：
```bash
./scripts/publish.sh <服务器IP> [SSH用户名]
```
脚本自动提交推送并在远程服务器执行构建同步与 Nginx 平滑重载！

---

### 本地极速开发 (0 秒后端，即开即测)
```bash
# 一键启动本地开发 (自动同步学科数据，启动 Vite 5173 极速热更新)
./scripts/dev.sh
```

---

## 🗄️ 客户端私有数据库引擎 (`StudyBrainDB`)

系统内置工业级原生 IndexedDB 引擎（`localDatabase.ts`），全面承载学生的自律私有数据：

| 对象仓库 (Object Store) | 存储内容 | 索引与特性 |
|---|---|---|
| `user_profile` | 学生称呼、学段、自定义空间名、自律座右铭 | 单例记录，支持随处 ✏️ 即时修改 |
| `wrong_items` | 各学科错题本、错因剖析、详细解析 | 支持学科索引、重要性星标与掌握状态流转 |
| `student_notes` | 学科核心考点对应的个人私有笔记心得 | 考点 ID 唯一索引，与考点双向联动 |
| `study_plans` | 每日学习任务清单、预估/实际耗时、完成打卡 | 按日期索引，日历视图快速穿透 |
| `focus_records` | 番茄钟与专注自习计时打卡档案 | 关联学习计划，统计专注总时长与学科分布 |
| `grades` & `grade_goals` | 模考成绩记录、目标院校与各科目标分差距 | ECharts 趋势图与雷达图多维透视 |
| `word_progress` & `study_records` | 6 大词库的掌握级别、复习间隔与艾宾浩斯复习流 | 1→2→4→7→15→30 天记忆算法动态调度 |
| `daily_config` | 每日背词目标与复习上限配置 | 默认每日新词 20、复习 40 |
| `custom_knowledge` & `resources` | 学生在题库维护模式下自定义增补的考点与资源 | 完美融合官方大纲与个人拓展 |

---

## 🤝 Git 多端推送技巧 (GitHub + Gitee)

若同时维护 GitHub 与 Gitee，本地 `origin` 已配置为双推。在终端或 IDE 界面中直接执行一次操作即可两端同步：

```bash
# 检查远端推送地址
git remote -v

# 一键推送至两端
git push
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议发布，欢迎用于个人学习、高中冲刺及班级自律备考分享。
