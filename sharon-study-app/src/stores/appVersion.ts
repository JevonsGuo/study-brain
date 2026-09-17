import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export interface AppBuildInfo {
  version: string
  buildTime: string
  buildTimestamp: number
  gitHash: string
}

// 获取编译期嵌入的本应用版本信息
const getLocalBuildInfo = (): AppBuildInfo => {
  try {
    if (typeof __APP_BUILD_INFO__ !== 'undefined' && __APP_BUILD_INFO__) {
      return __APP_BUILD_INFO__
    }
  } catch {}

  return {
    version: '1.0.0',
    buildTime: '2026-09-13 00:00:00',
    buildTimestamp: 1789260000000,
    gitHash: 'initial'
  }
}

const SNOOZE_KEY = 'study_app_update_snoozed_ts'
const LAST_UPGRADED_TS_KEY = 'study_last_upgraded_ts'
const LAST_UPGRADED_HASH_KEY = 'study_last_upgraded_hash'

export const useAppVersionStore = defineStore('appVersion', () => {
  const localBuildInfo = getLocalBuildInfo()

  const currentVersion = ref(localBuildInfo.version)
  const currentBuildTime = ref(localBuildInfo.buildTime)
  const currentGitHash = ref(localBuildInfo.gitHash)
  const currentTimestamp = ref(localBuildInfo.buildTimestamp)

  const remoteBuildInfo = ref<AppBuildInfo | null>(null)
  const hasUpdate = ref(false)
  const showUpdateModal = ref(false)
  const isChecking = ref(false)
  const isReloading = ref(false)
  const lastCheckedAt = ref(0)

  // 检查服务端是否存在新发布版本
  const checkAppUpdate = async (silent = true, forceShow = false) => {
    // 节流控制：15 秒内不重复发起相同请求
    const now = Date.now()
    if (isChecking.value || (!forceShow && now - lastCheckedAt.value < 15000)) {
      return
    }

    isChecking.value = true
    try {
      // 避免浏览器或 CDN 强缓存，添加毫秒级时间戳参数
      const basePath = import.meta.env.BASE_URL || './'
      const cleanBase = basePath.endsWith('/') ? basePath : `${basePath}/`
      const url = `${cleanBase}app-version.json?_t=${now}`

      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })

      if (!res.ok) {
        if (!silent) ElMessage.warning('未检测到远端版本文件')
        return
      }

      const remote = (await res.json()) as AppBuildInfo
      if (remote && remote.buildTimestamp) {
        lastCheckedAt.value = now

        // 核心防护 1：比对用户是否已确认升级过此完全相同的版本，防止点击“确定升级”刷新后循环反复弹出
        const lastUpgradedTs = Number(localStorage.getItem(LAST_UPGRADED_TS_KEY) || 0)
        const lastUpgradedHash = localStorage.getItem(LAST_UPGRADED_HASH_KEY) || ''

        // 只有当本地已经升级到或高于远端版本，且构建时间戳一致时才视作已升级；
        // 若远端版本号不同，或远端时间戳更新，一律视为新版本并提示升级
        const isAlreadyUpgraded =
          !forceShow &&
          remote.version === currentVersion.value &&
          lastUpgradedTs > 0 &&
          remote.buildTimestamp <= lastUpgradedTs &&
          (!lastUpgradedHash || remote.gitHash === lastUpgradedHash)

        if (isAlreadyUpgraded) {
          hasUpdate.value = false
          showUpdateModal.value = false
          return
        }

        // 比对条件：远端时间戳更新、或者 gitHash 变动、或者版本号变动
        const isNewer =
          remote.buildTimestamp > currentTimestamp.value ||
          (Boolean(remote.gitHash && currentGitHash.value) && remote.gitHash !== currentGitHash.value) ||
          remote.version !== currentVersion.value

        if (isNewer) {
          hasUpdate.value = true
          remoteBuildInfo.value = remote

          // 核心防护 2：检查用户是否对此特定发布版本点击过“取消/稍后”
          const snoozedTs = localStorage.getItem(SNOOZE_KEY)
          const isSnoozed = snoozedTs && Number(snoozedTs) === remote.buildTimestamp

          if (forceShow || !isSnoozed) {
            showUpdateModal.value = true
          }
        } else {
          hasUpdate.value = false
          if (!silent) {
            ElMessage.success(`当前已是最新版本 (v${currentVersion.value})！`)
          }
        }
      }
    } catch (err) {
      console.warn('[AppVersion] 检查前端新版本失败:', err)
      if (!silent) {
        ElMessage.error('检查版本更新失败，请稍后重试')
      }
    } finally {
      isChecking.value = false
    }
  }

  // 取消升级：平滑关闭弹窗，记录 snoozed 避免频繁弹窗打扰
  const dismissUpdate = () => {
    showUpdateModal.value = false
    if (remoteBuildInfo.value) {
      localStorage.setItem(SNOOZE_KEY, String(remoteBuildInfo.value.buildTimestamp))
    }
    ElMessage.info('已推迟升级，您可以随时点击顶栏【新版本】进行升级 🚀')
  }

  // 确定升级：记录当前已确认的版本指纹，防止刷新后再次弹窗，并强制绕过缓存刷新
  const applyUpdate = () => {
    isReloading.value = true

    // 记录确认升级的构建时间戳与 Hash
    if (remoteBuildInfo.value) {
      localStorage.setItem(LAST_UPGRADED_TS_KEY, String(remoteBuildInfo.value.buildTimestamp))
      if (remoteBuildInfo.value.gitHash) {
        localStorage.setItem(LAST_UPGRADED_HASH_KEY, remoteBuildInfo.value.gitHash)
      }
    }
    localStorage.removeItem(SNOOZE_KEY)

    ElMessage.success('正在为您升级到最新版本，即将刷新页面...')

    setTimeout(() => {
      if (typeof window !== 'undefined') {
        // 通过 URL query 强制跳过 index.html 的浏览器缓存
        try {
          const url = new URL(window.location.href)
          url.searchParams.set('_v', String(remoteBuildInfo.value?.buildTimestamp || Date.now()))
          window.location.replace(url.toString())
        } catch {
          window.location.reload()
        }
      }
    }, 350)
  }

  // 供顶栏快捷徽章重新唤醒弹窗
  const openUpdateModal = () => {
    if (hasUpdate.value) {
      showUpdateModal.value = true
    } else {
      checkAppUpdate(false, true)
    }
  }

  // 格式化为北京时间字符串
  const formatToBeijingTimeString = (d: Date): string => {
    try {
      const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      const parts = formatter.formatToParts(d)
      const pMap: Record<string, string> = {}
      for (const p of parts) pMap[p.type] = p.value
      return `${pMap.year}-${pMap.month}-${pMap.day} ${pMap.hour}:${pMap.minute}:${pMap.second}`
    } catch {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    }
  }

  // 供开发/测试人员一键模拟新版本弹窗体验
  const triggerMockUpdateForTesting = () => {
    const targetDate = new Date(Date.now() + 1000000)
    const mockRemote: AppBuildInfo = {
      version: '1.1.0',
      buildTime: formatToBeijingTimeString(targetDate),
      buildTimestamp: targetDate.getTime(),
      gitHash: 'demo789'
    }
    remoteBuildInfo.value = mockRemote
    hasUpdate.value = true
    showUpdateModal.value = true
    ElMessage.success('已模拟触发【新版本发布升级弹窗】')
  }

  // 启动全局生命周期自动检测
  let checkTimer: any = null
  const startAutoCheck = () => {
    // 1. 初次载入后 3 秒静默检查
    setTimeout(() => {
      checkAppUpdate(true)
    }, 3000)

    // 2. 定时轮询：每隔 3 分钟轻量轮询一次
    if (checkTimer) clearInterval(checkTimer)
    checkTimer = setInterval(() => {
      checkAppUpdate(true)
    }, 180000)

    // 3. 页面唤醒/切回本标签页时检查（最高频使用场景）
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkAppUpdate(true)
        }
      })
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        checkAppUpdate(true)
      })
    }
  }

  return {
    currentVersion,
    currentBuildTime,
    currentGitHash,
    currentTimestamp,
    remoteBuildInfo,
    hasUpdate,
    showUpdateModal,
    isChecking,
    isReloading,
    checkAppUpdate,
    dismissUpdate,
    applyUpdate,
    openUpdateModal,
    triggerMockUpdateForTesting,
    startAutoCheck
  }
})
