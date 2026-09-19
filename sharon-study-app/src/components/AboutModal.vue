<script setup lang="ts">
import { ref } from "vue"
import { ElMessage } from "element-plus"
import { useAppConfigStore, isLocalEnv } from "../stores/appConfig"
import { useAppVersionStore } from "../stores/appVersion"
import {
  Message,
  DocumentCopy,
  Check,
  RefreshRight,
  Lock,
  Reading,
  Cpu,
  Lightning
} from "@element-plus/icons-vue"

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
}>()

const appConfig = useAppConfigStore()
const appVersionStore = useAppVersionStore()
const isLocal = isLocalEnv()
const copied = ref(false)
const showPwaGuide = ref(false)
const contactEmail = "Jevons@GYFolk.com"

const isStandalone = typeof window !== 'undefined' && (
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
)

const copyEmail = async () => {
  try {
    await navigator.clipboard.writeText(contactEmail)
    copied.value = true
    ElMessage.success("联系邮箱已复制到剪贴板：Jevons@GYFolk.com")
    setTimeout(() => {
      copied.value = false
    }, 2500)
  } catch {
    // 降级使用传统方法
    const input = document.createElement("input")
    input.value = contactEmail
    document.body.appendChild(input)
    input.select()
    document.execCommand("copy")
    document.body.removeChild(input)
    copied.value = true
    ElMessage.success("联系邮箱已复制到剪贴板：Jevons@GYFolk.com")
    setTimeout(() => {
      copied.value = false
    }, 2500)
  }
}

const sendMail = () => {
  window.open(`mailto:${contactEmail}?subject=【智学大脑】用户使用反馈与建议`, "_blank")
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="🌟 关于 智学大脑 (About Study Brain)"
    width="560px"
    destroy-on-close
    class="about-modal-dialog"
  >
    <div class="about-modal-container">
      <!-- 品牌头部卡片 -->
      <div class="about-hero-card">
        <div class="hero-logo-box">
          <span class="hero-emblem">🎯</span>
        </div>
        <div class="hero-brand-info">
          <div class="hero-title-row">
            <h2 class="hero-title">智学大脑 · Study Brain</h2>
            <span class="hero-badge">个人自律学习助手</span>
          </div>
          <p class="hero-tagline">
            个人独立开发的高考自律学习小工具，纯本地私有离线运行，简单自律、踏实提分。
          </p>
        </div>
      </div>

      <!-- 版本与数据状态网格 -->
      <div class="about-specs-grid">
        <div class="spec-card">
          <div class="spec-header">
            <el-icon class="spec-icon"><Cpu /></el-icon>
            <span class="spec-name">应用版本</span>
          </div>
          <div class="spec-val">
            <span class="spec-badge blue">v{{ appVersionStore.currentVersion }}</span>
            <button
              type="button"
              class="spec-refresh-btn"
              :disabled="appVersionStore.isChecking"
              @click="appVersionStore.checkAppUpdate(false, true)"
              title="检查前端页面是否有新发布版本"
            >
              <el-icon><RefreshRight /></el-icon> 检查更新
            </button>
            <button
              v-if="isLocal"
              type="button"
              class="spec-refresh-btn test-btn"
              @click="appVersionStore.triggerMockUpdateForTesting"
              title="模拟触发新版本发布弹窗"
              style="margin-left: 6px; background: rgba(245, 158, 11, 0.1); color: #d97706; border-color: rgba(245, 158, 11, 0.3);"
            >
              <el-icon><Lightning /></el-icon> 模拟弹窗
            </button>
          </div>
        </div>

        <div class="spec-card">
          <div class="spec-header">
            <el-icon class="spec-icon"><Reading /></el-icon>
            <span class="spec-name">公共学习资源</span>
          </div>
          <div class="spec-val">
            <span class="spec-badge green">v{{ appConfig.currentDbVersion }}</span>
            <button
              type="button"
              class="spec-refresh-btn"
              @click="appConfig.checkDatabaseVersion(true)"
              title="检查学习资源是否有新版本"
            >
              <el-icon><RefreshRight /></el-icon> 检查更新
            </button>
          </div>
        </div>
      </div>

      <!-- 类 App 原生化运行模式与添加到桌面指引 -->
      <div class="about-pwa-card">
        <div class="pwa-header-row">
          <div class="pwa-title-left">
            <span class="pwa-icon-badge">📲</span>
            <span class="pwa-title-text">类 App 原生化运行模式</span>
            <span class="pwa-status-badge" :class="{ active: isStandalone }">
              {{ isStandalone ? '已作为 App 运行' : 'PWA 就绪' }}
            </span>
          </div>
          <button
            type="button"
            class="pwa-guide-btn"
            @click="showPwaGuide = !showPwaGuide"
          >
            {{ showPwaGuide ? '收起指引' : '添加到桌面 / 独立运行' }}
          </button>
        </div>
        <p class="pwa-card-desc">
          支持免浏览器全屏独立运行、离线秒开与多任务卡片。在手机或电脑将本页面添加到桌面，即可获得 100% 沉浸原生 App 体验。
        </p>
        <transition name="pwa-expand">
          <div v-if="showPwaGuide" class="pwa-guide-content">
            <div class="pwa-guide-step">
              <span class="guide-tag ios">🍎 iPhone / iPad</span>
              <span>在 Safari 点击底部分享按钮 ➔ 选择<b>「添加到主屏幕 ➕」</b></span>
            </div>
            <div class="pwa-guide-step">
              <span class="guide-tag android">🤖 安卓 / 鸿蒙</span>
              <span>在浏览器菜单中选择<b>「添加到桌面」</b>或等待底部自动弹出安装</span>
            </div>
            <div class="pwa-guide-step">
              <span class="guide-tag desktop">💻 PC / Mac</span>
              <span>在 Chrome / Edge 地址栏右侧点击<b>「安装应用」</b>图标</span>
            </div>
          </div>
        </transition>
      </div>

      <!-- 核心技术架构与数据安全说明 -->
      <div class="about-privacy-box">
        <div class="privacy-title-row">
          <el-icon class="privacy-icon"><Lock /></el-icon>
          <span class="privacy-title">纯客户端本地私有数据引擎</span>
        </div>
        <p class="privacy-desc">
          零商业服务器与第三方数据库。学生的每日计划、自律座右铭、个人错题、历次成绩追踪与背诵专注打卡，
          严格保存在当前设备的浏览器私有 <code>IndexedDB</code> 中。
          支持通过端到端加密口令极速跨端同步或全量 JSON 文件自主备份迁移，个人学科学情绝对私密、离线秒开。
        </p>
      </div>

      <!-- 版权归属与联系方式 -->
      <div class="about-copyright-deck">
        <div class="copyright-row">
          <span class="copyright-label">版权所有</span>
          <span class="copyright-val">Copyright © 2026 GYFolk / Study Brain. All Rights Reserved.</span>
        </div>
        
        <div class="contact-row">
          <div class="contact-meta">
            <span class="contact-label">作者联系与反馈交流</span>
            <div class="contact-email-badge">
              <el-icon class="email-icon"><Message /></el-icon>
              <span class="email-text">{{ contactEmail }}</span>
            </div>
          </div>

          <div class="contact-actions">
            <button
              type="button"
              class="contact-action-btn mail-btn"
              @click="sendMail"
              title="使用邮件客户端直接发信"
            >
              <el-icon><Message /></el-icon> 发送邮件
            </button>
            <button
              type="button"
              class="contact-action-btn copy-btn"
              :class="{ 'is-copied': copied }"
              @click="copyEmail"
              title="复制联系邮箱"
            >
              <el-icon v-if="!copied"><DocumentCopy /></el-icon>
              <el-icon v-else><Check /></el-icon>
              <span>{{ copied ? "已复制" : "复制邮箱" }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.about-modal-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

/* 品牌头部 */
.about-hero-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%);
  border: 1px solid rgba(99, 102, 241, 0.18);
}

.hero-logo-box {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.28);
  flex-shrink: 0;
}

.hero-emblem {
  font-size: 26px;
}

.hero-brand-info {
  flex: 1;
  min-width: 0;
}

.hero-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.hero-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  letter-spacing: -0.3px;
}

.hero-badge {
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.15);
  color: #4f46e5;
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.hero-tagline {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-sub, #64748b);
  line-height: 1.45;
}

/* 版本与规格网格 */
.about-specs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.spec-card {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg-card, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
}

.spec-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-sub, #64748b);
  font-weight: 600;
  margin-bottom: 6px;
}

.spec-icon {
  font-size: 14px;
  color: #4f46e5;
}

.spec-val {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.spec-badge {
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}

.spec-badge.blue {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.spec-badge.green {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.spec-sub {
  font-size: 11.5px;
  color: var(--text-sub, #94a3b8);
}

.spec-refresh-btn {
  background: none;
  border: 1px solid var(--border-color, #cbd5e1);
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 11px;
  color: var(--text-sub, #475569);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.spec-refresh-btn:hover {
  border-color: #3b82f6;
  color: #2563eb;
  background: rgba(59, 130, 246, 0.06);
}

/* PWA 类 App 运行卡片 */
.about-pwa-card {
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(124, 58, 237, 0.05) 100%);
  border: 1px solid rgba(99, 102, 241, 0.25);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pwa-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.pwa-title-left {
  display: flex;
  align-items: center;
  gap: 7px;
}

.pwa-icon-badge {
  font-size: 15px;
}

.pwa-title-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.pwa-status-badge {
  font-size: 10px;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
  padding: 1px 7px;
  border-radius: 999px;
}

.pwa-status-badge.active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.pwa-guide-btn {
  background: #4f46e5;
  color: #ffffff;
  border: none;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.pwa-guide-btn:hover {
  background: #4338ca;
}

.pwa-card-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-sub, #64748b);
  line-height: 1.5;
}

.pwa-guide-content {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-main, #1e293b);
  margin-top: 2px;
}

:global(.dark) .pwa-guide-content {
  background: rgba(0, 0, 0, 0.3);
  color: #cbd5e1;
}

.pwa-guide-step {
  display: flex;
  align-items: baseline;
  gap: 8px;
  line-height: 1.4;
}

.guide-tag {
  font-weight: 700;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
}

.guide-tag.ios {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.guide-tag.android {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.guide-tag.desktop {
  background: rgba(139, 92, 246, 0.12);
  color: #7c3aed;
}

.pwa-expand-enter-active,
.pwa-expand-leave-active {
  transition: all 0.2s ease-out;
}

.pwa-expand-enter-from,
.pwa-expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 隐私与技术说明 */
.about-privacy-box {
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.privacy-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: #d97706;
  margin-bottom: 6px;
}

.privacy-icon {
  font-size: 14px;
}

.privacy-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-main, #334155);
  line-height: 1.55;
}

.privacy-desc code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 600;
}

/* 版权与联系方式 */
.about-copyright-deck {
  padding: 14px;
  border-radius: 10px;
  background: var(--bg-card, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.copyright-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border-color, #e2e8f0);
}

.copyright-label {
  color: var(--text-sub, #64748b);
  font-weight: 600;
}

.copyright-val {
  color: var(--text-main, #1e293b);
  font-weight: 500;
}

.contact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.contact-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.contact-label {
  font-size: 11.5px;
  color: var(--text-sub, #64748b);
  font-weight: 600;
}

.contact-email-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 700;
  color: #2563eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.email-icon {
  font-size: 15px;
}

.contact-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.contact-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.mail-btn {
  background: #3b82f6;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
}

.mail-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.copy-btn {
  background: var(--bg-hover, #e2e8f0);
  color: var(--text-main, #334155);
}

.copy-btn:hover {
  background: #cbd5e1;
}

.copy-btn.is-copied {
  background: #10b981;
  color: #ffffff;
}
</style>
