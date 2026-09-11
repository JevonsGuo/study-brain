<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTimerStore } from './stores/timer'
import { useAppConfigStore } from './stores/appConfig'
import { useUserProfileStore } from './stores/userProfile'
import CloudSyncModal from './components/CloudSyncModal.vue'
import UserOnboardingModal from './components/UserOnboardingModal.vue'
import UserProfileEditModal from './components/UserProfileEditModal.vue'
import { ElNotification, ElMessageBox } from 'element-plus'
import { Edit } from '@element-plus/icons-vue'
import { localDB } from './utils/localDatabase'

const router = useRouter()
const route = useRoute()
const timerStore = useTimerStore()
const appConfig = useAppConfigStore()
const userProfile = useUserProfileStore()
const isCollapse = ref(false)
const isDark = ref(false)
const showCloudModal = ref(false)
const isDev = import.meta.env.DEV

const openPinPrompt = async () => {
  try {
    const { value } = await ElMessageBox.prompt('请输入开发者维护密码：', '官方数据维护模式', {
      inputType: 'password',
      confirmButtonText: '验证进入',
      cancelButtonText: '取消',
      inputPattern: /^.+$/,
      inputErrorMessage: '密码不能为空'
    })
    appConfig.unlockMaintenanceMode(value)
  } catch {
    // cancelled
  }
}

const THEME_KEY = 'study_theme'

watch(() => timerStore.showCompletionModal, (show) => {
  if (show && route.path !== '/timer') {
    const rec = timerStore.lastFinishedRecord
    ElNotification({
      title: '🎉 专注达成！',
      message: `刚刚完成在【${rec?.subject || '学习'}】的 ${rec?.durationMinutes || 25} 分钟专注，点击查看学情成果！`,
      type: 'success',
      duration: 6000,
      onClick: () => {
        router.push('/timer')
      }
    })
  }
})

onMounted(() => {
  appConfig.initLocalVersion()
  appConfig.checkDatabaseVersion(false)
  userProfile.fetchProfile()

  const queryTheme = new URLSearchParams(window.location.search).get('theme')
  if (queryTheme) {
    isDark.value = queryTheme === 'dark'
  } else {
    const savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem('sharon_study_theme')
    if (savedTheme) {
      isDark.value = savedTheme === 'dark'
    } else {
      isDark.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    }
  }
  applyTheme(isDark.value)

  // 坚果云 30 分钟后台定时自动备份机制
  setInterval(async () => {
    const autoSync = localStorage.getItem('study_nutstore_auto_sync') === 'true'
    const email = localStorage.getItem('study_nutstore_email') || ''
    const pwd = localStorage.getItem('study_nutstore_pwd') || ''
    if (autoSync && email && pwd) {
      try {
        const authHeader = 'Basic ' + btoa(`${email.trim()}:${pwd.trim()}`)
        const payload = await localDB.exportAllUserData()
        await fetch('/api/nutstore/我的坚果云/StudyBrain/backup.json', {
          method: 'PUT',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(payload, null, 2)
        })
        const nowStr = new Date().toLocaleString()
        localStorage.setItem('study_nutstore_last_sync', nowStr)
      } catch {
        // 静默运行，不打扰自习状态
      }
    }
  }, 30 * 60 * 1000)
})

const applyTheme = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

const setTheme = (dark: boolean) => {
  if (isDark.value === dark) return
  isDark.value = dark
  applyTheme(dark)
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
}

const toggleTheme = () => {
  setTheme(!isDark.value)
}

const activeMenu = computed(() => {
  if (route.path.startsWith('/subjects')) return '/subjects'
  return route.path
})

const menuItems = [
  { index: '/home', icon: 'HomeFilled', title: '首页' },
  { index: '/study-plan', icon: 'Calendar', title: '学习计划' },
  { index: '/subjects', icon: 'Reading', title: '学科中心' },
  { index: '/word-card', icon: 'Postcard', title: '单词卡' },
  { index: '/grade-tracker', icon: 'TrendCharts', title: '成绩追踪' },
  { index: '/timer', icon: 'Timer', title: '番茄钟' },
  { index: '/brain-gym', icon: 'MagicStick', title: '脑力工坊' },
]

const handleSelect = (index: string) => {
  router.push(index)
}

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}
</script>

<template>
  <el-container class="app-container">
    <el-aside :width="isCollapse ? '64px' : '200px'" class="app-aside">
      <div
        class="logo-area"
        :class="{ 'is-clickable': !isCollapse }"
        @click="!isCollapse && (userProfile.showEditModal = true)"
        :title="isCollapse ? '智学大脑' : '点击修改空间专属名称与个人档案'"
      >
        <el-icon :size="24" class="logo-icon"><Star /></el-icon>
        <div v-show="!isCollapse" class="logo-text-wrap">
          <span class="logo-text">{{ userProfile.appTitle }}</span>
          <el-icon class="logo-edit-icon" title="修改空间名称"><Edit /></el-icon>
        </div>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :collapse-transition="true"
        @select="handleSelect"
        class="app-menu"
      >
        <el-menu-item v-for="item in menuItems" :key="item.index" :index="item.index">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>

      <!-- 侧边栏底部操作区：左下角主题切换 + 侧栏折叠 -->
      <div class="aside-footer">
        <!-- 数据库版本常驻角落 (低调淡灰小字) + 坚果云备份入口 -->
        <div v-show="!isCollapse" class="aside-db-bar">
          <div
            class="db-version-text"
            @click="appConfig.checkDatabaseVersion(true)"
            title="点击手动检查数据库版本更新"
          >
            <span class="db-dot"></span>
            <span>数据库版本: {{ appConfig.currentDbVersion }}</span>
          </div>
          <button
            type="button"
            class="aside-cloud-btn"
            @click="showCloudModal = true"
            title="坚果云多端备份 (可选)"
          >
            ☁️
          </button>
        </div>

        <!-- 仅在开发环境（import.meta.env.DEV）展示的维护模式切换按钮 -->
        <div v-if="isDev && !isCollapse" class="aside-dev-bar">
          <button
            v-if="!appConfig.isMaintenanceMode"
            type="button"
            class="dev-mode-btn"
            @click="openPinPrompt"
            title="输入密码（654321）解锁官方数据维护模式"
          >
            🛠️ 题库维护
          </button>
          <div
            v-else
            class="dev-active-badge"
            @click="appConfig.exitMaintenanceMode"
            title="当前处于维护模式，点击退出"
          >
            <span class="dev-dot-pulse"></span>
            <span>维护中(点击退出)</span>
          </div>
        </div>

        <!-- 切换暗色/亮色模板 -->
        <div class="theme-switch-box" :class="{ 'is-collapsed': isCollapse }">
          <template v-if="!isCollapse">
            <div class="theme-pill-track">
              <div
                class="theme-pill-slider"
                :style="{ transform: isDark ? 'translateX(100%)' : 'translateX(0)' }"
              />
              <button
                type="button"
                class="theme-opt-btn"
                :class="{ active: !isDark }"
                @click="setTheme(false)"
                title="亮色模板 (Daylight)"
              >
                <el-icon :size="14" class="opt-icon sun-icon"><Sunny /></el-icon>
                <span class="opt-label">亮色</span>
              </button>
              <button
                type="button"
                class="theme-opt-btn"
                :class="{ active: isDark }"
                @click="setTheme(true)"
                title="暗色模板 (Cyber Night)"
              >
                <el-icon :size="14" class="opt-icon moon-icon"><Moon /></el-icon>
                <span class="opt-label">暗色</span>
              </button>
            </div>
          </template>
          <template v-else>
            <button
              type="button"
              class="theme-single-btn"
              @click="toggleTheme"
              :title="isDark ? '当前暗色模式，点击切换为亮色' : '当前亮色模式，点击切换为暗色'"
            >
              <el-icon :size="18" :class="{ 'icon-sun': !isDark, 'icon-moon': isDark }">
                <component :is="isDark ? 'Moon' : 'Sunny'" />
              </el-icon>
            </button>
          </template>
        </div>

        <!-- 侧栏折叠展开按钮 -->
        <div class="collapse-btn" @click="toggleCollapse" :title="isCollapse ? '展开侧栏' : '收起侧栏'">
          <el-icon :size="18">
            <component :is="isCollapse ? 'Expand' : 'Fold'" />
          </el-icon>
        </div>
      </div>
    </el-aside>
    <el-main class="app-main">
      <router-view />
    </el-main>

    <!-- 全局悬浮计时小药丸：离开番茄钟页面但正在计时时常驻右下角 -->
    <transition name="floater-slide">
      <div
        v-if="timerStore.isRunning && route.path !== '/timer'"
        class="global-timer-floater"
        @click="router.push('/timer')"
        title="正在专注计时中，点击返回番茄钟工作台"
      >
        <div class="floater-pulse" :class="{ 'is-break': timerStore.isBreak }"></div>
        <span class="floater-icon">
          {{ timerStore.isBreak ? '☕' : (timerStore.mode === 'exam' ? '📝' : '🍅') }}
        </span>
        <span class="floater-subject">{{ timerStore.selectedSubject }}</span>
        <span class="floater-time">
          {{ timerStore.displayMinutes }}:{{ timerStore.displaySeconds }}
        </span>
        <button
          class="floater-action-btn"
          @click.stop="timerStore.pause()"
          title="暂停计时"
        >
          <el-icon :size="12"><VideoPause /></el-icon>
        </button>
      </div>
    </transition>

    <!-- 数据库版本更新提醒弹窗 -->
    <el-dialog
      v-model="appConfig.showUpdateModal"
      title="数据库更新提醒"
      width="460px"
      :show-close="false"
      class="db-update-dialog"
    >
      <div class="db-update-content">
        <div class="update-icon-box">📦</div>
        <div class="update-text-box">
          <p class="update-version-title">
            检测到最新的数据库版本：<b>{{ appConfig.remoteVersionMeta?.database_version }}</b>
          </p>
          <p class="update-current-version">
            当前本地版本：{{ appConfig.currentDbVersion }}
          </p>
          <div class="update-safe-tip">
            💡 说明：本次更新包含最新考点勘误与微课精讲。更新<b>不会影响</b>您的任何错题、背诵进度与个人随堂笔记。
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="appConfig.dismissUpdateModal">稍后再说</el-button>
        <el-button type="primary" @click="appConfig.confirmDatabaseUpdate">
          立即确认更新
        </el-button>
      </template>
    </el-dialog>

    <!-- 坚果云云端备份弹窗 -->
    <CloudSyncModal v-model="showCloudModal" />

    <!-- 首次使用量身定制专属空间引导弹窗 -->
    <UserOnboardingModal />

    <!-- 随时修改名字与空间信息弹窗 -->
    <UserProfileEditModal />
  </el-container>
</template>

<style scoped>
.app-container {
  height: 100vh;
}

.app-aside {
  background: var(--aside-bg);
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  border-right: 1px solid var(--aside-border);
}

.logo-area {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid var(--aside-border);
  flex-shrink: 0;
  padding: 0 10px;
  user-select: none;
}

.logo-area.is-clickable {
  cursor: pointer;
  transition: background-color 0.2s;
}

.logo-area.is-clickable:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.logo-icon {
  color: #ffd700;
  filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.5));
  flex-shrink: 0;
}

.logo-text-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.logo-text {
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 125px;
}

.logo-edit-icon {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  flex-shrink: 0;
  transition: all 0.2s;
}

.logo-area:hover .logo-edit-icon {
  color: #ffd700;
  transform: scale(1.15);
}

.app-menu {
  flex: 1;
  border-right: none;
  background: transparent;
  overflow-y: auto;
}

.app-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.68);
  font-weight: 500;
  margin: 4px 8px;
  border-radius: 8px;
  height: 44px;
  line-height: 44px;
  transition: all 0.2s ease;
}

.app-menu .el-menu-item:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.09);
}

.app-menu .el-menu-item.is-active {
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  font-weight: 600;
}

/* 底部区域 */
.aside-footer {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--aside-border);
  background: rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

/* 展开状态药丸切换器 */
.theme-switch-box {
  padding: 10px 12px 6px;
  display: flex;
  justify-content: center;
}

.theme-switch-box.is-collapsed {
  padding: 10px 0 6px;
}

.theme-pill-track {
  position: relative;
  display: flex;
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 2px;
  box-sizing: border-box;
}

.theme-pill-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(50% - 2px);
  height: calc(100% - 4px);
  border-radius: 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.theme-opt-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  font-weight: 500;
  transition: color 0.2s;
  padding: 0;
  border-radius: 16px;
}

.theme-opt-btn:hover {
  color: rgba(255, 255, 255, 0.9);
}

.theme-opt-btn.active {
  color: #ffffff;
  font-weight: 600;
}

.theme-opt-btn.active .sun-icon {
  color: #fde047;
}

.theme-opt-btn.active .moon-icon {
  color: #93c5fd;
}

/* 折叠状态单图标按钮 */
.theme-single-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.85);
  transition: all 0.2s ease;
}

.theme-single-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  transform: scale(1.05);
}

.icon-sun {
  color: #fde047;
}

.icon-moon {
  color: #93c5fd;
}

/* 折叠开关 */
.collapse-btn {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s;
}

.collapse-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.app-main {
  background: var(--bg-page);
  color: var(--text-main);
  padding: 24px;
  overflow-y: auto;
  transition: var(--theme-transition);
}

/* 全局悬浮计时胶囊 */
.global-timer-floater {
  position: fixed;
  bottom: 24px;
  right: 28px;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 24px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 12px rgba(99, 102, 241, 0.3);
  color: #f8fafc;
  cursor: pointer;
  user-select: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.global-timer-floater:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45), 0 0 18px rgba(99, 102, 241, 0.5);
}

.floater-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
  box-shadow: 0 0 8px #6366f1;
  animation: pulse-ring 1.5s infinite;
}

.floater-pulse.is-break {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

@keyframes pulse-ring {
  0% { transform: scale(0.9); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.5; }
  100% { transform: scale(0.9); opacity: 1; }
}

.floater-icon {
  font-size: 14px;
}

.floater-subject {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
}

.floater-time {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  letter-spacing: 0.5px;
}

.floater-action-btn {
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: 2px;
}

.floater-action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

/* 滑动动画 */
.floater-slide-enter-active,
.floater-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.floater-slide-enter-from,
.floater-slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.85);
}

/* 数据库版本与坚果云常驻底部栏 */
.aside-db-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  margin-bottom: 6px;
}

.db-version-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  user-select: none;
  transition: color 0.2s;
}

.db-version-text:hover {
  color: rgba(255, 255, 255, 0.85);
}

.db-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  display: inline-block;
  box-shadow: 0 0 6px #10b981;
}

.aside-cloud-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 13px;
  opacity: 0.6;
  padding: 2px;
  transition: all 0.2s;
}

.aside-cloud-btn:hover {
  opacity: 1;
  transform: scale(1.15);
}

/* 仅开发环境展示的维护模式 */
.aside-dev-bar {
  padding: 0 10px 8px;
  display: flex;
  justify-content: center;
}

.dev-mode-btn {
  font-size: 11px;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.12);
  border: 1px dashed rgba(245, 158, 11, 0.45);
  color: #fbbf24;
  padding: 3px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.dev-mode-btn:hover {
  background: rgba(245, 158, 11, 0.25);
  border-color: #f59e0b;
  color: #fef08a;
}

.dev-active-badge {
  font-size: 11px;
  font-weight: 700;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.6);
  color: #fca5a5;
  padding: 3px 10px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.dev-dot-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
}

/* 数据库版本更新弹窗 */
.db-update-content {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 10px 0;
}

.update-icon-box {
  font-size: 38px;
  line-height: 1;
  flex-shrink: 0;
}

.update-text-box {
  flex: 1;
}

.update-version-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.update-current-version {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.update-safe-tip {
  font-size: 12px;
  line-height: 1.5;
  color: #1e40af;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 8px 12px;
  border-radius: 8px;
}

:global(.dark) .update-safe-tip {
  background: #1e293b;
  border-color: #3b82f6;
  color: #93c5fd;
}
</style>
