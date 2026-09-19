<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Close, Download, Iphone, Monitor } from '@element-plus/icons-vue'

const isVisible = ref(false)
const isIos = ref(false)
const isStandalone = ref(false)
const deferredPrompt = ref<any>(null)
const showIosGuide = ref(false)

const STORAGE_KEY = 'study_pwa_install_dismissed'

const checkIsStandalone = (): boolean => {
  if (typeof window === 'undefined') return false
  const isMatchMedia = window.matchMedia('(display-mode: standalone)').matches
  const isNavigator = (navigator as any).standalone === true
  return isMatchMedia || isNavigator
}

const checkIsIos = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
}

onMounted(() => {
  isStandalone.value = checkIsStandalone()
  isIos.value = checkIsIos()

  // 如果已经在独立 App 窗口模式运行，无需弹出安装引导
  if (isStandalone.value) {
    return
  }

  // 检查是否最近 5 天内已被用户关闭过
  const lastDismissed = localStorage.getItem(STORAGE_KEY)
  const isDismissedRecently = lastDismissed && Date.now() - Number(lastDismissed) < 5 * 24 * 60 * 60 * 1000

  // 1. Android / Chrome / Edge / PC: 监听系统原生安装事件
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e
    if (!isDismissedRecently) {
      // 延迟 2.5 秒弹出，不干扰首次进入视线
      setTimeout(() => {
        if (!isStandalone.value) isVisible.value = true
      }, 2500)
    }
  })

  // 2. iOS Safari: 无法捕获 beforeinstallprompt，通过 UserAgent 识别
  if (isIos.value && !isDismissedRecently) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isSafari) {
      setTimeout(() => {
        if (!isStandalone.value) isVisible.value = true
      }, 3500)
    }
  }
})

const handleInstallClick = async () => {
  if (deferredPrompt.value) {
    // 唤起浏览器原生安装面板
    deferredPrompt.value.prompt()
    const choiceResult = await deferredPrompt.value.userChoice
    if (choiceResult.outcome === 'accepted') {
      isVisible.value = false
      deferredPrompt.value = null
    }
  } else if (isIos.value) {
    // iOS Safari 展开手势指引
    showIosGuide.value = !showIosGuide.value
  }
}

const dismissPrompt = () => {
  isVisible.value = false
  showIosGuide.value = false
  localStorage.setItem(STORAGE_KEY, String(Date.now()))
}

// 供外部父组件（如 AboutModal）主动唤起安装引导
const openInstallModal = () => {
  if (isStandalone.value) return
  isVisible.value = true
  if (isIos.value) {
    showIosGuide.value = true
  }
}

defineExpose({
  openInstallModal,
  isStandalone
})
</script>

<template>
  <transition name="pwa-slide">
    <div v-if="isVisible && !isStandalone" class="pwa-install-banner">
      <div class="pwa-banner-main">
        <div class="pwa-app-icon-wrap">
          <img src="/pwa-192x192.png" alt="智学大脑" class="pwa-app-icon" />
          <span class="pwa-icon-glow"></span>
        </div>

        <div class="pwa-text-content">
          <div class="pwa-title-row">
            <span class="pwa-title">安装「智学大脑」App</span>
            <span class="pwa-tag">全屏免浏览器</span>
          </div>
          <div class="pwa-desc">
            添加到主屏幕，享受独立沉浸全屏、离线秒开与原生流畅体验
          </div>
        </div>

        <div class="pwa-action-btns">
          <button
            type="button"
            class="pwa-install-btn"
            @click="handleInstallClick"
          >
            <el-icon class="btn-icon">
              <component :is="isIos ? Iphone : (deferredPrompt ? Download : Monitor)" />
            </el-icon>
            <span>{{ isIos ? (showIosGuide ? '收起指引' : '安装指引') : '立即安装' }}</span>
          </button>

          <button
            type="button"
            class="pwa-close-btn"
            @click="dismissPrompt"
            title="暂不安装"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </div>

      <!-- iOS Safari 步骤指引展开卡片 -->
      <transition name="guide-expand">
        <div v-if="isIos && showIosGuide" class="ios-install-guide">
          <div class="guide-steps">
            <div class="step-item">
              <span class="step-num">1</span>
              <span class="step-text">点击 Safari 底部栏正中央的<b>「分享」</b>按钮（一个方框向上箭头 ⎋）</span>
            </div>
            <div class="step-item">
              <span class="step-num">2</span>
              <span class="step-text">在弹出菜单中向下滑动，选择<b>「添加到主屏幕 ➕」</b></span>
            </div>
            <div class="step-item">
              <span class="step-num">3</span>
              <span class="step-text">点击右上角<b>「添加」</b>即可在手机桌面获得独立全屏 App</span>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<style scoped>
.pwa-install-banner {
  position: fixed;
  bottom: calc(64px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, calc(100vw - 24px));
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(99, 102, 241, 0.25);
  padding: 12px 14px;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.pwa-banner-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pwa-app-icon-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.pwa-app-icon {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
  position: relative;
  z-index: 2;
}

.pwa-icon-glow {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%);
  filter: blur(6px);
  z-index: 1;
}

.pwa-text-content {
  flex: 1;
  min-width: 0;
}

.pwa-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.pwa-title {
  font-size: 14.5px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: -0.2px;
}

.pwa-tag {
  font-size: 10.5px;
  font-weight: 600;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: #ffffff;
  padding: 1px 6px;
  border-radius: 6px;
}

.pwa-desc {
  font-size: 11.5px;
  color: #94a3b8;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pwa-action-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.pwa-install-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
}

.pwa-install-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.45);
}

.pwa-install-btn:active {
  transform: scale(0.96);
}

.btn-icon {
  font-size: 14px;
}

.pwa-close-btn {
  background: transparent;
  border: none;
  color: #64748b;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.pwa-close-btn:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.1);
}

/* iOS 手势引导卡片 */
.ios-install-guide {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 12px;
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.step-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.4;
}

.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #6366f1;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

/* 动效 */
.pwa-slide-enter-active,
.pwa-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.pwa-slide-enter-from,
.pwa-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}

.guide-expand-enter-active,
.guide-expand-leave-active {
  transition: all 0.25s ease-out;
}

.guide-expand-enter-from,
.guide-expand-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

@media (max-width: 600px) {
  .pwa-desc {
    display: none;
  }
  .pwa-install-btn {
    padding: 7px 11px;
    font-size: 12px;
  }
}
</style>
