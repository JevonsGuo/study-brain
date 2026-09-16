<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTimerStore } from './stores/timer'
import { useAppConfigStore, isLocalEnv } from './stores/appConfig'
import { useUserProfileStore } from './stores/userProfile'
import CloudSyncModal from './components/CloudSyncModal.vue'
import UserOnboardingModal from './components/UserOnboardingModal.vue'
import UserProfileEditModal from './components/UserProfileEditModal.vue'
import DataConsoleModal from './components/DataConsoleModal.vue'
import AboutModal from './components/AboutModal.vue'
import AppVersionModal from './components/AppVersionModal.vue'
import { useAppVersionStore } from './stores/appVersion'
import { ElNotification, ElMessageBox, ElMessage } from 'element-plus'
import { Edit, Star, Sunny, Moon, Menu as MenuIcon, Close, VideoPause, Connection, InfoFilled } from '@element-plus/icons-vue'
import { getSyncConfig, pushCloudBackup } from './utils/cloudSync'

const router = useRouter()
const route = useRoute()

// 模块切换流畅体验引擎 (TopLoader + 即时激活 + 深度过渡)
const navigatingTarget = ref<string | null>(null)
const isPageLoading = ref(false)
const pageProgress = ref(0)
const targetModuleName = ref('')
const showSlowLoadingIndicator = ref(false)
let progressTimer: any = null
let slowTimer: any = null

const getModuleTitle = (path: string): string => {
  if (path.startsWith('/subjects')) return '学科中心'
  if (path.startsWith('/study-plan')) return '学习计划'
  if (path.startsWith('/word-card')) return '单词卡'
  if (path.startsWith('/grade-tracker')) return '成绩追踪'
  if (path.startsWith('/timer')) return '番茄钟'
  if (path.startsWith('/brain-gym') || path.startsWith('/games')) return '脑力工坊'
  if (path.startsWith('/resources')) return '优质资源'
  if (path.startsWith('/home')) return '首页'
  return ''
}

router.beforeEach((to, from, next) => {
  if (to.path !== from.path) {
    isPageLoading.value = true
    pageProgress.value = 25
    targetModuleName.value = getModuleTitle(to.path)

    clearInterval(progressTimer)
    clearTimeout(slowTimer)

    progressTimer = setInterval(() => {
      if (pageProgress.value < 85) {
        pageProgress.value += Math.random() * 18 + 6
      }
    }, 110)

    // 超过 140ms 未就绪（网络慢或组件包大），弹出平滑毛玻璃胶囊提示
    slowTimer = setTimeout(() => {
      if (isPageLoading.value) {
        showSlowLoadingIndicator.value = true
      }
    }, 140)
  }
  next()
})

router.afterEach(() => {
  clearInterval(progressTimer)
  clearTimeout(slowTimer)
  pageProgress.value = 100
  setTimeout(() => {
    isPageLoading.value = false
    showSlowLoadingIndicator.value = false
    navigatingTarget.value = null
    pageProgress.value = 0
  }, 200)
})
const timerStore = useTimerStore()
const appConfig = useAppConfigStore()
const userProfile = useUserProfileStore()
const appVersionStore = useAppVersionStore()
const isCollapse = ref(false)
const isDark = ref(false)
const showCloudModal = ref(false)
const showAboutModal = ref(false)
const showMobileMenu = ref(false)

const mobileNavItems = [
  { index: '/home', icon: 'HomeFilled', title: '首页' },
  { index: '/study-plan', icon: 'Calendar', title: '计划' },
  { index: '/subjects', icon: 'Reading', title: '学科' },
  { index: '/word-card', icon: 'Postcard', title: '单词' },
  { index: '/timer', icon: 'Timer', title: '专注' },
]

const handleMobileSelect = (index: string) => {
  showMobileMenu.value = false
  handleSelect(index)
}

const isLocal = computed(() => {
  if (typeof window === 'undefined') return false
  return import.meta.env.DEV || isLocalEnv()
})

const showEditModeModal = ref(false)

const openPinPrompt = async () => {
  if (!isLocal.value) return
  try {
    const { value } = await ElMessageBox.prompt('请输入管理员密码进入编辑模式：', '🛠️ 公共数据库', {
      inputType: 'password',
      confirmButtonText: '验证进入',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入密码解锁编辑权限',
      inputPattern: /^.+$/,
      inputErrorMessage: '密码不能为空'
    })
    // 验证成功直接进入编辑模式，不弹出遮挡视线的控制台
    appConfig.unlockMaintenanceMode(value)
  } catch {
    // cancelled
  }
}

const confirmExitEdit = () => {
  appConfig.exitMaintenanceMode()
  showEditModeModal.value = false
  ElMessage.info('已退出编辑模式')
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

const displayDbText = computed(() => {
  if (appConfig.dbSyncStatus === 'downloading') {
    return appConfig.dbSyncMessage || '下载中...'
  }
  if (appConfig.dbSyncStatus === 'syncing') {
    return appConfig.dbSyncMessage || '同步中...'
  }
  if (appConfig.dbSyncStatus === 'checking') {
    return '检查中...'
  }
  if (appConfig.dbSyncStatus === 'update_available') {
    return '有新版本'
  }
  if (appConfig.dbSyncStatus === 'offline') {
    return '离线模式'
  }
  return `v${appConfig.currentDbVersion}`
})

onMounted(() => {
  appConfig.initLocalVersion()
  appConfig.checkDatabaseVersion(false)

  // 公共数据库版本感知机制：
  // 1. 标签页切回前台时自动检查更新 (visibilitychange)
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      appConfig.checkDatabaseVersion(false, true)
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange)

  // 2. 后台 60 秒定期心跳探测更新 (嗅探轻量 version.json <1KB)
  const versionInterval = setInterval(() => {
    appConfig.checkDatabaseVersion(false, true)
  }, 60 * 1000)

  onUnmounted(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange)
    clearInterval(versionInterval)
  })
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

  // 端到端加密 5 分钟后台定时自动云端备份机制（默认开启，每 5 分钟静默上云）
  let lastSilentSyncTimestamp = 0
  const runSilentSync = async () => {
    const syncCfg = getSyncConfig()
    if (syncCfg.autoSync && syncCfg.passcode) {
      const now = Date.now()
      // 防抖/节流：两次静默同步间隔不低于 60 秒
      if (now - lastSilentSyncTimestamp < 60 * 1000) return
      lastSilentSyncTimestamp = now
      try {
        await pushCloudBackup(syncCfg.passcode)
      } catch {
        // 静默运行，不打扰沉浸自习
      }
    }
  }

  // 启动 8 秒后首次静默同步，之后每 5 分钟定时执行
  setTimeout(runSilentSync, 8 * 1000)
  setInterval(runSilentSync, 5 * 60 * 1000)

  // 用户切回网页或从休眠唤醒时，若已满 5 分钟自动静默补录
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        if (now - lastSilentSyncTimestamp >= 5 * 60 * 1000) {
          runSilentSync()
        }
      }
    })
  }

  // 平板设备 (Pad 769px ~ 1024px) 人体工学自适应：自动折叠侧边栏至 Rail 模式
  const handlePadResize = () => {
    if (typeof window === 'undefined') return
    const width = window.innerWidth
    if (width > 768 && width <= 1024) {
      isCollapse.value = true
    } else if (width > 1024) {
      isCollapse.value = false
    }
  }
  handlePadResize()
  window.addEventListener('resize', handlePadResize)
  onUnmounted(() => {
    window.removeEventListener('resize', handlePadResize)
  })

  // 启动前端新发布版本生命周期自动检测
  appVersionStore.startAutoCheck()
  if (typeof window !== 'undefined') {
    (window as any).__testAppUpdate = () => appVersionStore.triggerMockUpdateForTesting()
  }
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
  if (navigatingTarget.value) {
    if (navigatingTarget.value.startsWith('/subjects')) return '/subjects'
    return navigatingTarget.value
  }
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
  { index: '/resources', icon: 'Compass', title: '优质资源' },
]

const handleSelect = (index: string) => {
  if (route.path === index) return
  navigatingTarget.value = index
  router.push(index).catch(() => {}).finally(() => {
    setTimeout(() => {
      if (navigatingTarget.value === index) {
        navigatingTarget.value = null
      }
    }, 800)
  })
}

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}
</script>

<template>
  <el-container class="app-container">
    <!-- 顶部 TopLoader 极细渐变加载进度条 -->
    <div
      v-if="isPageLoading"
      class="top-progress-bar"
      :style="{ width: `${pageProgress}%` }"
    >
      <div class="top-progress-glow"></div>
    </div>

    <!-- 模块切换感知微胶囊 (异步加载超过 140ms 时优雅滑入) -->
    <transition name="capsule-drop">
      <div v-if="showSlowLoadingIndicator" class="route-loading-capsule">
        <span class="capsule-spin">⚡</span>
        <span>正在载入{{ targetModuleName ? `【${targetModuleName}】` : '模块' }}...</span>
      </div>
    </transition>

    <!-- 公共资源静默同步感知微胶囊 (无感后台更新，仅在顶部轻量告知) -->
    <transition name="capsule-drop">
      <div v-if="appConfig.dbSyncStatus === 'syncing'" class="route-loading-capsule db-sync-capsule">
        <span class="capsule-spin">🔄</span>
        <span>正在自动同步最新资源...</span>
      </div>
    </transition>

    <!-- 前端新版本发布醒目提示胶囊 (点击即可呼出更新弹窗) -->
    <transition name="capsule-drop">
      <div
        v-if="appVersionStore.hasUpdate && !appVersionStore.showUpdateModal"
        class="route-loading-capsule app-update-capsule"
        @click="appVersionStore.openUpdateModal"
        title="点击查看新版本详情并升级"
      >
        <span class="pulse-dot-green"></span>
        <span class="update-capsule-text">🚀 发现新版本发布 (点击刷新升级)</span>
      </div>
    </transition>
    
    <!-- 移动端顶部 Header (仅在 <= 768px 生效) -->
    <header class="mobile-header">
      <div class="mobile-header-brand" @click="userProfile.showEditModal = true" title="点击修改空间信息">
        <el-icon :size="18" class="logo-icon"><Star /></el-icon>
        <div class="mobile-brand-text">
          <span class="mobile-brand-title">{{ userProfile.userName || '智学' }}</span>
          <span class="mobile-brand-sub">学习大脑</span>
        </div>
        <el-icon :size="12" class="mobile-brand-edit"><Edit /></el-icon>
      </div>
      <div class="mobile-header-actions">
        <button
          type="button"
          class="mobile-header-btn"
          @click="toggleTheme"
          :title="isDark ? '切换亮色模式' : '切换暗色模式'"
        >
          <el-icon :size="16"><component :is="isDark ? 'Sunny' : 'Moon'" /></el-icon>
        </button>
        <button
          type="button"
          class="mobile-header-btn"
          @click="showCloudModal = true"
          title="云端极速跨端同步 (端到端加密)"
        >
          <el-icon :size="16"><Connection /></el-icon>
        </button>
        <button
          type="button"
          class="mobile-header-btn mobile-menu-btn"
          @click="showMobileMenu = true"
          title="展开全部功能导航"
        >
          <el-icon :size="18"><MenuIcon /></el-icon>
        </button>
      </div>
    </header>
    <el-aside :width="isCollapse ? '64px' : '200px'" class="app-aside">
      <div
        class="logo-area"
        :class="{ 'is-clickable': !isCollapse }"
        @click="!isCollapse && (userProfile.showEditModal = true)"
        :title="isCollapse ? '智学大脑' : '点击修改专属名称与个人档案'"
      >
        <el-icon :size="22" class="logo-icon"><Star /></el-icon>
        <div v-show="!isCollapse" class="logo-text-wrap two-lines">
          <div class="logo-title-row">
            <span class="logo-name-text">{{ userProfile.userName || '智学' }}</span>
            <el-icon class="logo-edit-icon" title="修改空间名称与个人档案"><Edit /></el-icon>
          </div>
          <span class="logo-sub-text">学习大脑</span>
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
          <template #title>
            <span class="menu-item-text">{{ item.title }}</span>
            <span v-if="navigatingTarget === item.index" class="nav-loading-indicator" title="加载中..."></span>
          </template>
        </el-menu-item>
      </el-menu>

      <!-- 侧边栏底部操作区：左下角主题切换 + 侧栏折叠 -->
      <div class="aside-footer">
        <!-- PC 端专属：云端极速跨端同步显著入口 -->
        <div class="aside-sync-entry" :class="{ 'is-collapsed': isCollapse }">
          <button
            v-if="!isCollapse"
            type="button"
            class="aside-sync-action-btn"
            @click="showCloudModal = true"
            title="云端极速跨端同步 (端到端加密口令)"
          >
            <div class="sync-action-left">
              <el-icon :size="15" class="sync-action-icon"><Connection /></el-icon>
              <span class="sync-action-title">云端数据同步</span>
            </div>
            <span class="sync-status-dot" title="自动同步已就绪"></span>
          </button>
          <button
            v-else
            type="button"
            class="aside-sync-btn-collapsed"
            @click="showCloudModal = true"
            title="云端极速跨端同步 (端到端加密口令)"
          >
            <el-icon :size="18"><Connection /></el-icon>
          </button>
        </div>

        <!-- 数据库版本常驻角落 (低调淡灰小字) + 关于系统 -->
        <div v-show="!isCollapse" class="aside-db-bar">
          <div
            class="db-version-text"
            @click="showAboutModal = true"
            :title="`公共数据库: v${appConfig.currentDbVersion} (点击查看系统详情、版权与联系反馈)`"
          >
            <span class="db-dot" :class="appConfig.dbSyncStatus"></span>
            <span class="db-status-label">{{ displayDbText }}</span>
          </div>
          <div class="aside-btn-group">
            <button
              v-if="appVersionStore.hasUpdate"
              type="button"
              class="aside-app-update-btn"
              @click="appVersionStore.openUpdateModal"
              title="检测到前端新版本发布，点击升级"
            >
              <span class="aside-update-dot"></span>
              <span>新版本</span>
            </button>
            <button
              type="button"
              class="aside-cloud-btn"
              @click="showAboutModal = true"
              title="关于智学大脑 · 版本、版权与联系反馈"
            >
              <el-icon :size="15"><InfoFilled /></el-icon>
            </button>
          </div>
        </div>

        <!-- 本地专属：公共数据库维护入口（仅在本地 localhost 开发环境显示，线上生产环境彻底隐藏） -->
        <div v-if="isLocal" class="aside-dev-bar" :class="{ 'is-collapsed': isCollapse }">
          <template v-if="!isCollapse">
            <button
              v-if="!appConfig.isMaintenanceMode"
              type="button"
              class="dev-mode-btn"
              @click="openPinPrompt"
              title="点击解锁公共数据库编辑模式（包含学科中心考点与单词词库）"
            >
              🛠️ 公共数据库
            </button>
            <div
              v-else
              class="dev-active-badge"
              @click="showEditModeModal = true"
              title="当前处于编辑模式，点击弹出管理或退出编辑"
            >
              <span class="dev-dot-pulse"></span>
              <span>🛠️ 编辑模式中</span>
            </div>
          </template>
          <template v-else>
            <button
              v-if="!appConfig.isMaintenanceMode"
              type="button"
              class="dev-mode-btn-icon"
              @click="openPinPrompt"
              title="点击解锁公共数据库编辑模式"
            >
              🛠️
            </button>
            <div
              v-else
              class="dev-active-badge-icon"
              @click="showEditModeModal = true"
              title="当前处于编辑模式，点击弹出管理或退出编辑"
            >
              <span class="dev-dot-pulse"></span>
              <span>🛠️</span>
            </div>
          </template>
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
      <router-view v-slot="{ Component, route: currentRoute }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" :key="currentRoute.path" />
        </transition>
      </router-view>
    </el-main>
    <!-- 移动端原生感底部导航栏 (仅在 <= 768px 生效) -->
    <nav class="mobile-bottom-nav">
      <button
        v-for="item in mobileNavItems"
        :key="item.index"
        type="button"
        class="mobile-tab-btn"
        :class="{ active: activeMenu === item.index }"
        @click="handleSelect(item.index)"
      >
        <div class="tab-icon-wrap">
          <el-icon :size="20"><component :is="item.icon" /></el-icon>
          <span v-if="navigatingTarget === item.index" class="tab-nav-dot"></span>
        </div>
        <span class="tab-title">{{ item.title }}</span>
      </button>
    </nav>

    <!-- 移动端全功能侧滑抽屉 -->
    <el-drawer
      v-model="showMobileMenu"
      size="280px"
      :with-header="false"
      direction="rtl"
      class="mobile-nav-drawer"
      destroy-on-close
    >
      <div class="mobile-drawer-body">
        <div class="drawer-header-row">
          <div class="drawer-user-info" @click="showMobileMenu = false; userProfile.showEditModal = true">
            <el-icon :size="22" class="logo-icon"><Star /></el-icon>
            <div class="drawer-user-text">
              <div class="drawer-name-row">
                <span class="drawer-name">{{ userProfile.userName || '智学' }}</span>
                <span class="drawer-grade-tag">{{ userProfile.gradeLevel || '高三' }}</span>
              </div>
              <span class="drawer-quote">{{ userProfile.customQuote || '自律成就梦想' }}</span>
            </div>
          </div>
          <button class="drawer-close-btn" @click="showMobileMenu = false">
            <el-icon :size="18"><Close /></el-icon>
          </button>
        </div>

        <div class="drawer-nav-list">
          <div
            v-for="item in menuItems"
            :key="item.index"
            class="drawer-nav-item"
            :class="{ active: activeMenu === item.index }"
            @click="handleMobileSelect(item.index)"
          >
            <el-icon :size="18" class="drawer-item-icon"><component :is="item.icon" /></el-icon>
            <span class="drawer-item-title">{{ item.title }}</span>
            <span v-if="activeMenu === item.index" class="drawer-active-dot"></span>
          </div>
        </div>

        <div class="drawer-bottom-section">
          <div class="drawer-action-row" @click="showMobileMenu = false; showCloudModal = true">
            <el-icon :size="16" class="action-icon"><Connection /></el-icon>
            <span class="action-title">云端极速跨端同步</span>
          </div>
          <div class="drawer-action-row" @click="showMobileMenu = false; showAboutModal = true">
            <el-icon :size="16" class="action-icon"><InfoFilled /></el-icon>
            <span class="action-title">关于系统 (v{{ appVersionStore.currentVersion }})</span>
          </div>
          <div v-if="isLocal" class="drawer-action-row dev-row" @click="showMobileMenu = false; openPinPrompt()">
            <span class="action-icon">🛠️</span>
            <span class="action-title">公共数据库维护</span>
          </div>
          <div class="drawer-version-tip">
            公共数据: v{{ appConfig.currentDbVersion }} · 本地私有引擎
          </div>
        </div>
      </div>
    </el-drawer>


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
      title="资源更新提醒"
      width="460px"
      :show-close="false"
      class="db-update-dialog"
    >
      <div class="db-update-content">
        <div class="update-icon-box">📦</div>
        <div class="update-text-box">
          <p class="update-version-title">
            检测到最新的资源版本：<b>{{ appConfig.remoteVersionMeta?.database_version }}</b>
          </p>
          <p class="update-current-version">
            当前本地版本：{{ appConfig.currentDbVersion }}
          </p>
          <div class="update-safe-tip">
            💡 说明：本次更新包含最新学习资源与考点精讲。更新<b>不会影响</b>您的任何错题、背诵进度与个人随堂笔记。
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
    <AboutModal v-model="showAboutModal" />

    <!-- 前端新版本发布升级提示弹窗 -->
    <AppVersionModal />

    <!-- 首次使用量身定制专属空间引导弹窗 -->
    <UserOnboardingModal />

    <!-- 随时修改名字与空间信息弹窗 -->
    <UserProfileEditModal />

    
    <!-- 公共数据库编辑模式管理与退出弹窗 -->
    <el-dialog
      v-model="showEditModeModal"
      title="🛠️ 公共数据库编辑模式"
      width="430px"
      destroy-on-close
      class="edit-mode-popup"
    >
      <div class="edit-mode-dialog-body">
        <div class="edit-mode-badge-row">
          <span class="pulse-green-dot"></span>
          <span class="edit-mode-status-text">当前正处于编辑模式</span>
        </div>
        <p class="edit-mode-tip-text">
          学科考点、题型解析与英语单词卡已开启编辑权限。修改后秒级自动写回本地 <code>content/*.json</code> 文件，可通过 IDE 的 Source Control 审查并提交代码。
        </p>
        <div class="edit-mode-extra-action">
          <el-button
            type="primary"
            plain
            size="small"
            @click="showEditModeModal = false; appConfig.showDataConsole = true"
          >
            📦 打开公共数据控制台 (查看统计)
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="showEditModeModal = false">继续编辑</el-button>
        <el-button
          type="danger"
          @click="confirmExitEdit"
          class="exit-btn-main"
        >
          🚪 退出编辑
        </el-button>
      </template>
    </el-dialog>

    <!-- 官方题库与公共数据发布控制台 -->
    <DataConsoleModal v-model="appConfig.showDataConsole" />
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
  height: 66px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  border-bottom: 1px solid var(--aside-border);
  flex-shrink: 0;
  padding: 0 14px;
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
  filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.6));
  flex-shrink: 0;
}

.logo-text-wrap.two-lines {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  overflow: hidden;
}

.logo-title-row {
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: 128px;
}

.logo-name-text {
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logo-edit-icon {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  flex-shrink: 0;
  transition: all 0.2s;
}

.logo-area:hover .logo-edit-icon {
  color: #ffd700;
  transform: scale(1.15);
}

.logo-sub-text {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  background: linear-gradient(90deg, #ffd700, #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  white-space: nowrap;
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
  display: flex;
  flex-direction: column;
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
.aside-btn-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.aside-db-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  margin-bottom: 6px;
  gap: 6px;
}

.db-version-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
  transition: color 0.2s;
  flex: 1;
  min-width: 0;
}

.db-version-text:hover {
  color: rgba(255, 255, 255, 0.95);
}

.db-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  display: inline-block;
  box-shadow: 0 0 6px #10b981;
  flex-shrink: 0;
}

.db-dot.latest {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
}

.db-dot.downloading {
  background: #3b82f6;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.8);
  animation: db-pulse 1s infinite alternate;
}

.db-dot.syncing {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.8);
  animation: db-pulse 1s infinite alternate;
}

.db-dot.checking {
  background: #a855f7;
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.8);
  animation: db-pulse 0.8s infinite alternate;
}

.db-dot.update_available {
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
  animation: db-pulse 0.8s infinite alternate;
}

.db-dot.offline {
  background: #94a3b8;
  box-shadow: none;
}

.db-status-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  letter-spacing: -0.3px;
}

@keyframes db-pulse {
  0% { transform: scale(0.9); opacity: 0.6; }
  100% { transform: scale(1.3); opacity: 1; }
}

/* PC 端侧边栏专属云端同步卡片 */
.aside-sync-entry {
  padding: 0 10px 8px;
}

.aside-sync-entry.is-collapsed {
  padding: 0 6px 8px;
  display: flex;
  justify-content: center;
}

.aside-sync-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.35);
  border-radius: 9px;
  padding: 7px 10px;
  color: #c7d2fe;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.aside-sync-action-btn:hover {
  background: rgba(99, 102, 241, 0.28);
  border-color: rgba(99, 102, 241, 0.6);
  color: #ffffff;
  transform: translateY(-1px);
}

.sync-action-left {
  display: flex;
  align-items: center;
  gap: 7px;
}

.sync-action-icon {
  color: #818cf8;
}

.aside-sync-action-btn:hover .sync-action-icon {
  color: #a5b4fc;
}

.sync-action-title {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.sync-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.aside-sync-btn-collapsed {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.16);
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: #818cf8;
  cursor: pointer;
  transition: all 0.2s;
}

.aside-sync-btn-collapsed:hover {
  background: rgba(99, 102, 241, 0.3);
  color: #ffffff;
  transform: scale(1.06);
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
.aside-dev-bar.is-collapsed {
  padding: 0 6px 8px;
}

.dev-mode-btn-icon {
  width: 38px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px dashed rgba(245, 158, 11, 0.45);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.dev-mode-btn-icon:hover {
  background: rgba(245, 158, 11, 0.25);
  border-color: #f59e0b;
}

.dev-active-badge-icon {
  width: 38px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.6);
  border-radius: 8px;
  cursor: pointer;
}

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

/* 顶部 TopLoader 纤细渐变进度条 */
.top-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, #6366f1, #ec4899, #06b6d4, #10b981);
  z-index: 99999;
  transition: width 0.15s ease-out;
  pointer-events: none;
}

.top-progress-glow {
  position: absolute;
  right: 0;
  top: -2px;
  bottom: -2px;
  width: 80px;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.9) 0%, rgba(99, 102, 241, 0) 70%);
  filter: blur(2px);
}

/* 模块切换与数据同步感知微胶囊 */
.route-loading-capsule.db-sync-capsule {
  border-color: rgba(16, 185, 129, 0.5);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25), 0 0 14px rgba(16, 185, 129, 0.35);
}

/* 前端新发布版本强提醒胶囊 */
.route-loading-capsule.app-update-capsule {
  pointer-events: auto;
  cursor: pointer;
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
  border-color: rgba(255, 255, 255, 0.45);
  box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4), 0 0 16px rgba(59, 130, 246, 0.4);
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.route-loading-capsule.app-update-capsule:hover {
  transform: translateX(-50%) translateY(-2px) scale(1.03);
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.5), 0 0 20px rgba(59, 130, 246, 0.6);
}

.pulse-dot-green {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  animation: pulse-ring 1.8s infinite cubic-bezier(0.66, 0, 0, 1);
}

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.8);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}

.aside-app-update-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.aside-app-update-btn:hover {
  background: #dbeafe;
  transform: translateY(-1px);
}

.aside-update-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
  animation: pulse-ring 1.8s infinite cubic-bezier(0.66, 0, 0, 1);
}

:global(.dark) .aside-app-update-btn {
  background: rgba(37, 99, 235, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}

.route-loading-capsule {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99998;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(99, 102, 241, 0.4);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25), 0 0 12px rgba(99, 102, 241, 0.3);
  pointer-events: none;
  user-select: none;
}

.capsule-spin {
  font-size: 14px;
  animation: pulse-spin 1.2s infinite ease-in-out;
}

.capsule-drop-enter-active,
.capsule-drop-leave-active {
  transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.capsule-drop-enter-from,
.capsule-drop-leave-to {
  opacity: 0;
  transform: translate(-50%, -18px) scale(0.9);
}

/* 侧边栏点击即刻反馈小光点 */
.nav-loading-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffd700;
  margin-left: 8px;
  display: inline-block;
  box-shadow: 0 0 8px #ffd700;
  animation: nav-pulse 0.8s infinite alternate;
}

@keyframes nav-pulse {
  0% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(1.3); opacity: 1; }
}

@keyframes pulse-spin {
  0% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.2) rotate(15deg); }
  100% { transform: scale(1) rotate(0deg); }
}

/* 页面切换平滑淡入微滑 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1), transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}


.edit-mode-dialog-body {
  padding: 4px 0;
}

.edit-mode-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  color: #15803d;
  margin-bottom: 8px;
}

:global(.dark) .edit-mode-badge-row {
  color: #4ade80;
}

.pulse-green-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
  box-shadow: 0 0 8px #16a34a;
  animation: nav-pulse 0.8s infinite alternate;
}

.edit-mode-tip-text {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted, #64748b);
  margin: 0 0 16px;
}

.edit-mode-tip-text code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
}

.edit-mode-btn-group {
  display: flex;
  gap: 12px;
}

.exit-btn-main {
  font-weight: 600;
}


/* ========================================================== */
/* 移动端与多端响应式适配架构 (Mobile & Multi-Device Styles)    */
/* ========================================================== */

/* 桌面端 (宽屏 >= 769px) 绝对隔离：保证移动端外壳在 PC 毫无踪影 */
@media (min-width: 769px) {
  .mobile-header,
  .mobile-bottom-nav,
  .mobile-nav-drawer {
    display: none !important;
  }
}

/* 平板设备 (Pad: 769px ~ 1024px)：自动折叠侧边栏至 Rail 紧凑模式 */
@media (min-width: 769px) and (max-width: 1024px) {
  .app-aside {
    width: 64px !important;
  }
  .app-main {
    padding: 16px 20px !important;
  }
}

/* 移动端 (<= 768px)：侧边栏隐藏，启用顶部 AppBar + 底部 Tabbar */
@media (max-width: 768px) {
  .app-aside {
    display: none !important;
  }

  .app-main {
    padding: calc(50px + 10px) 12px calc(58px + env(safe-area-inset-bottom) + 28px) 12px !important;
    overflow-x: hidden;
    overflow-y: auto !important;
    height: 100vh !important;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
  }

  .global-timer-floater {
    bottom: calc(62px + env(safe-area-inset-bottom) + 12px) !important;
    right: 12px !important;
    padding: 6px 12px !important;
    font-size: 12px !important;
  }
}

/* 移动端顶部轻量 AppBar */
.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 50px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  z-index: 1000;
  transition: background-color 0.25s, border-color 0.25s;
}

:global(.dark) .mobile-header {
  background: rgba(11, 15, 25, 0.88);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.mobile-header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.mobile-brand-text {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.mobile-brand-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

:global(.dark) .mobile-brand-title {
  color: #f8fafc;
}

.mobile-brand-sub {
  font-size: 11px;
  color: #6366f1;
  font-weight: 700;
}

:global(.dark) .mobile-brand-sub {
  color: #818cf8;
}

.mobile-brand-edit {
  color: var(--text-sub, #94a3b8);
  font-size: 11px;
}

.mobile-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mobile-header-btn {
  background: transparent;
  border: 1px solid var(--border-subtle, #e2e8f0);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-main, #334155);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .mobile-header-btn {
  border-color: rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
}

.mobile-header-btn:active {
  transform: scale(0.92);
  background: rgba(0, 0, 0, 0.05);
}

:global(.dark) .mobile-header-btn:active {
  background: rgba(255, 255, 255, 0.08);
}

/* 移动端原生感底部导航栏 (Bottom Tabbar) */
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(56px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 1000;
  user-select: none;
  transition: background-color 0.25s, border-color 0.25s;
}

:global(.dark) .mobile-bottom-nav {
  background: rgba(19, 27, 46, 0.92);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.mobile-tab-btn {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: none;
  border: none;
  color: var(--text-sub, #64748b);
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.18s, transform 0.18s;
  -webkit-tap-highlight-color: transparent;
}

:global(.dark) .mobile-tab-btn {
  color: #94a3b8;
}

.tab-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-nav-dot {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366f1;
  animation: nav-pulse 0.8s infinite alternate;
}

.tab-title {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.mobile-tab-btn.active {
  color: #4f46e5;
  font-weight: 700;
}

:global(.dark) .mobile-tab-btn.active {
  color: #818cf8;
}

.mobile-tab-btn:active {
  transform: scale(0.92);
}

/* 移动端全功能抽屉 */
.mobile-drawer-body {
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

.drawer-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle, #e2e8f0);
  margin-bottom: 12px;
}

:global(.dark) .drawer-header-row {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.drawer-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex: 1;
}

.drawer-user-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.drawer-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.drawer-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

:global(.dark) .drawer-name {
  color: #f8fafc;
}

.drawer-grade-tag {
  font-size: 10px;
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 700;
}

:global(.dark) .drawer-grade-tag {
  background: rgba(129, 140, 248, 0.18);
  color: #818cf8;
}

.drawer-quote {
  font-size: 11px;
  color: var(--text-sub, #64748b);
  max-width: 170px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drawer-close-btn {
  background: none;
  border: none;
  color: var(--text-sub, #64748b);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drawer-nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
}

.drawer-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-main, #334155);
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

:global(.dark) .drawer-nav-item {
  color: #e2e8f0;
}

.drawer-nav-item:hover,
.drawer-nav-item:active {
  background: rgba(99, 102, 241, 0.08);
  color: #4f46e5;
}

:global(.dark) .drawer-nav-item:hover,
:global(.dark) .drawer-nav-item:active {
  background: rgba(129, 140, 248, 0.12);
  color: #818cf8;
}

.drawer-nav-item.active {
  background: #4f46e5;
  color: #ffffff;
}

:global(.dark) .drawer-nav-item.active {
  background: #6366f1;
  color: #ffffff;
}

.drawer-item-icon {
  font-size: 18px;
}

.drawer-active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffffff;
  margin-left: auto;
}

.drawer-bottom-section {
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:global(.dark) .drawer-bottom-section {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.drawer-action-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-main, #334155);
  transition: background 0.2s;
}

:global(.dark) .drawer-action-row {
  color: #cbd5e1;
}

.drawer-action-row:hover,
.drawer-action-row:active {
  background: rgba(0, 0, 0, 0.05);
}

:global(.dark) .drawer-action-row:hover,
:global(.dark) .drawer-action-row:active {
  background: rgba(255, 255, 255, 0.06);
}

.drawer-action-row.dev-row {
  color: #d97706;
}

:global(.dark) .drawer-action-row.dev-row {
  color: #fbbf24;
}

.drawer-version-tip {
  font-size: 10px;
  color: var(--text-sub, #94a3b8);
  text-align: center;
  padding-top: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
}

</style>
