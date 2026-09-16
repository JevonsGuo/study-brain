---
name: ui-craftsmanship
description: Industry-grade UI/UX craftsmanship guidelines to eliminate 'AI slop' aesthetics, enforce typography and color restraint, and implement ergonomic multi-device responsiveness (Phone, Pad, Desktop).
---

# UI Craftsmanship & Anti-AI-Slop Design Guidelines

本指南面向前端与全栈工程开发，旨在杜绝“AI 味（AI-Slop）”界面，建立媲美 Linear、Vercel、Apple HIG 及 Refactoring UI 的现代高品味数字产品体验。

---

## 1. 核心铁律：去 AI 味 (Anti-AI-Slop Manifesto)

### 1.1 严禁 Emoji 充当 UI 控件图标
* ❌ **错误做法**：在按钮、Tab 标签、列表项前滥用彩色 Emoji（如 `✨ 快速开始`、`🚀 立即更新`、`🎓 知识库`、`💡 提示`、`☁️ 同步`）。这是 AI 生成界面的最大视觉特征，廉价且不专业。
* ✅ **正确标准**：
  * 一律采用严谨单色矢量线性图标（SVG / Element Plus Icons / Lucide / Heroicons）；
  * 图标尺寸在 14px~20px 之间，线条粗细（Stroke width）统一为 1.5px~1.75px；
  * 图标置于光学对齐的居中容器中（如 32×32px 圆角方形底座），颜色跟随文本继承或采用沉稳中性色。

### 1.2 色彩克制与灰度优先 (Greyscale First)
* ❌ **错误做法**：无节制的紫红粉蓝高饱和渐变背景，全屏卡片到处发光。
* ✅ **正确标准**：
  * **90% 灰度中性底色**：浅色模式采用 Slate (`#f8fafc` / `#f1f5f9`)，深色模式采用深邃星空灰 (`#0b0f19` / `#131b2e`)，严禁使用粗暴纯黑 `#000000`（避免 OLED 滚动断层与视觉疲劳）；
  * **单一功能焦点色（Single Accent Color）**：全站仅保留 1 个核心品牌强调色（如 `#3b82f6` 经典科技蓝或 `#0284c7` 智学青），其余语义色（成功绿、警告橙、危险红）仅在状态提示时出现；
  * **字阶对比度而非颜色分类**：依靠字体粗细（400 / 500 / 600）与字号建立层级，而不是给每个模块涂不同颜色。

### 1.3 边框与微光物理质感 (Subtle Borders & Elevation)
* ❌ **错误做法**：大号彩色投影、到处画 2px 粗实线描边、滥用大面积高斯模糊毛玻璃。
* ✅ **正确标准**：
  * **1px 微物理质感细边框**：
    * 浅色模式：`border: 1px solid rgba(15, 23, 42, 0.08);`
    * 深色模式：`border: 1px solid rgba(255, 255, 255, 0.08);`
  * **多层级自然沉淀投影**：
    * 卡片：`box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05);`
    * 浮层：`box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08);`

### 1.4 严格的 4px 网格间距律 (Spacing System)
* 严禁随意写 `margin: 17px;` 或 `padding: 23px;`；
* 严格采用 `4px` 倍数间距比例尺：`4px (0.25rem)` / `8px (0.5rem)` / `12px (0.75rem)` / `16px (1rem)` / `24px (1.5rem)` / `32px (2rem)`。

---

## 2. 跨端人体工学设计 (Multi-Device Responsive Ergonomics)

```
        ┌───────────────────────────────────────────────────────────┐
        │                 三端断点与交互设计规范                     │
        └───────────────────────────────────────────────────────────┘
               │                          │                         │
     手机 (Phone: < 768px)       平板 (Pad: 768px-1024px)    桌面 (Desktop: > 1024px)
   ────────────────────────    ──────────────────────────   ──────────────────────────
   • 核心操作位于底部40%拇指区    • 侧边栏折叠为窄 Rail 图标列   • 完整侧边栏常驻展开
   • 弹窗自适应为 Bottom Sheet    • 考点/书架双栏 Split-View    • 多列高密度信息面板
   • 底部原生感 Tabbar           • 2~3列自适应栅格             • 丰富的鼠标 Hover 微交互
   • 适配 100dvh 与 Safe Area    • 规避触控 hover 假死状态      • 键盘快捷键高频支持
```

### 2.1 手机端规范 (Phone: `< 768px`)
1. **彻底废除居中硬弹窗，全面升级为底部抽屉 (Bottom Sheet)**：
   * 手机单手操作时，手指无法舒适触及屏幕中央及顶部的关闭按钮；
   * 移动端弹窗必须贴底滑出，顶部带有 `36px × 4px` 的轻量滑动条（Drag Handle）；
   * 支持向下轻划或点击蒙层流畅退出。
2. **拇指操作热区优先 (Thumb Zone)**：
   * 底部常驻核心 Tabbar（首页、学科、单词、专注、我的）；
   * 高频操作按钮（如“开始计时”、“翻转单词卡”）固定在底部或视口下半部，严禁堆在右上角。
3. **视口与 iOS 安全区兜底**：
   * 高度必须使用 `height: 100dvh`（兼容移动端 Safari 动态地址栏收起/展开）；
   * 底部容器必须加上 `padding-bottom: calc(12px + env(safe-area-inset-bottom));`。
4. **触摸靶心规范**：所有可点击元素最小点击区域不得小于 `44px × 44px`。

### 2.2 平板端规范 (Pad / Tablet: `768px ~ 1024px`)
1. **拒绝超大号拉伸**：
   * 平板不是拉大版手机。单列内容在 Pad 上会显得极其空旷、排版松散；
   * 必须采用 **自适应栅格（Grid 2~3列）**，卡片最高宽度限制在 `360px ~ 480px`，自动流式排列。
2. **Master-Detail 左右双栏结构**：
   * 横屏状态下，阅读与检索场景采用左侧 280px 目录树，右侧宽屏流式卡片，免去全屏反复跳转；
   * 导航栏折叠为 64px 紧凑 Rail（仅显示精致矢量图标），释放横向空间。
3. **触控设备防 Hover 粘滞**：
   * 针对 `:hover` 样式必须包裹在 `@media (hover: hover)` 中，避免触屏点击后样式残留无法复原：
     ```css
     @media (hover: hover) {
       .card:hover {
         transform: translateY(-2px);
         box-shadow: var(--shadow-md);
       }
     }
     ```

### 2.3 桌面端规范 (Desktop: `> 1024px`)
* 保持沉浸宽屏与高效键盘流，侧边栏展开，信息密度充沛而呼吸感良好。

---

## 3. 代码审查检查单 (Pre-Commit Craftsmanship Checklist)

- [ ] 是否清理了无意义的 Emoji 图标，换为统一样式的单色 SVG 矢量图标？
- [ ] 移动端（<= 768px）的所有模态弹窗是否均已自适应为底部抽屉（Bottom Sheet）形态？
- [ ] 底部导航和固定按钮是否加入了 `env(safe-area-inset-bottom)` 保护？
- [ ] 平板端（768px~1024px）是否做到了 2~3 列网格排布与 Rail 侧栏，避免了拉伸空旷感？
- [ ] 是否消除了刺眼的五彩霓虹高亮，保持了克制的单主色 + 中性灰调？
- [ ] 字体排版是否建立在严格的 4px 网格与 1.5 倍行高基线之上？
