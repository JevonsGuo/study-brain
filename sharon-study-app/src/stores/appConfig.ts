export const isLocalEnv = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.')
}

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, localDB } from '../utils/api'
import type { DbSyncState } from '../utils/localDatabase'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'

const DB_VERSION_KEY = 'study_database_version'

export interface VersionMeta {
  database_version: string
  updated_at: string
  description?: string
}

export const useAppConfigStore = defineStore('appConfig', () => {
  const currentDbVersion = ref<string>('20260912.00000000')
  const dataVersionCounter = ref(0)
  const remoteVersionMeta = ref<VersionMeta | null>(null)
  const showUpdateModal = ref(false)
  const isMaintenanceMode = ref(isLocalEnv() && typeof sessionStorage !== 'undefined' && sessionStorage.getItem('study_admin_unlocked') === 'true')
  const showDataConsole = ref(false)

  // 动态数据库实时状态
  const dbSyncStatus = ref<DbSyncState>('latest')
  const dbSyncMessage = ref<string>('数据库就绪')

  const setDbSyncStatus = (status: DbSyncState, message?: string) => {
    dbSyncStatus.value = status
    if (message) dbSyncMessage.value = message
  }

  const initLocalVersion = () => {
    const saved = localStorage.getItem(DB_VERSION_KEY) || localStorage.getItem('sharon_database_version')
    if (saved) {
      currentDbVersion.value = saved
    }

    // 监听本地数据库下载与装载进度
    localDB.onSyncStateChange((status, message) => {
      dbSyncStatus.value = status
      dbSyncMessage.value = message
    })
  }

  const checkDatabaseVersion = async (manual = false, _silent = false) => {
    dbSyncStatus.value = 'checking'
    dbSyncMessage.value = '正在检查更新...'

    try {
      const meta = await api.get(`/version?_t=${Date.now()}`) as VersionMeta
      if (meta && meta.database_version) {
        remoteVersionMeta.value = meta
        const saved = localStorage.getItem(DB_VERSION_KEY)
        if (!saved) {
          // 首次运行，静默记录当前版本
          localStorage.setItem(DB_VERSION_KEY, meta.database_version)
          currentDbVersion.value = meta.database_version
          dbSyncStatus.value = 'latest'
          dbSyncMessage.value = `已是最新 (v${meta.database_version})`
          if (manual) {
            ElMessage.success(`当前数据库已是最新版本：v${currentDbVersion.value}`)
          }
          return
        }

        if (meta.database_version !== saved) {
          // 发现新版本：自动静默热更新！
          console.log(`[DatabaseSync] 发现公共数据新版本: v${meta.database_version} (本地原版本: v${saved})`)
          dbSyncStatus.value = 'syncing'
          dbSyncMessage.value = `正在自动同步 v${meta.database_version}...`

          // 1. 清空本地公共数据缓存，保证下一次请求获取全量最新数据
          localDB.invalidatePublicContentCache()

          // 2. 存储新版本号并更新响应式状态
          localStorage.setItem(DB_VERSION_KEY, meta.database_version)
          currentDbVersion.value = meta.database_version
          dbSyncStatus.value = 'latest'
          dbSyncMessage.value = `已更新至 v${meta.database_version}`

          // 3. 递增响应式计数器并派发全局事件，触发当前页面组件就地静默拉取新数据
          dataVersionCounter.value++
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('study-brain-data-updated', { detail: meta }))
          }

          // 4. 显示非阻塞的明显右下角更新提醒
          ElNotification({
            title: '✨ 公共数据已自动更新',
            message: `已自动静默同步至最新版本 (v${meta.database_version})，学科考点与单词词库即刻生效！`,
            type: 'success',
            duration: 4500,
            position: 'bottom-right'
          })
        } else {
          dbSyncStatus.value = 'latest'
          dbSyncMessage.value = `已是最新 (v${currentDbVersion.value})`
          if (manual) {
            ElMessage.success(`当前数据库已是最新版本：v${currentDbVersion.value}`)
          }
        }
      }
    } catch (err) {
      console.warn('Failed to check database version', err)
      dbSyncStatus.value = 'offline'
      dbSyncMessage.value = '本地离线就绪'
      if (manual) {
        ElMessage.warning('检查数据库版本失败，已处于本地离线保护模式')
      }
    }
  }

  const confirmDatabaseUpdate = () => {
    if (remoteVersionMeta.value?.database_version) {
      localDB.invalidatePublicContentCache()
      currentDbVersion.value = remoteVersionMeta.value.database_version
      localStorage.setItem(DB_VERSION_KEY, currentDbVersion.value)
      dataVersionCounter.value++
      showUpdateModal.value = false
      dbSyncStatus.value = 'latest'
      dbSyncMessage.value = `已更新至 v${currentDbVersion.value}`
      ElMessage.success('数据库已成功更新至最新版本！')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('study-brain-data-updated', { detail: remoteVersionMeta.value }))
      }
    }
  }

  const dismissUpdateModal = () => {
    showUpdateModal.value = false
  }

  const unlockMaintenanceMode = (pin: string): boolean => {
    if (!isLocalEnv()) {
      ElMessageBox.alert(
        '当前为【云端生产环境 (study.gyfolk.com)】，托管于云端静态 CDN，无法连接修改您本地电脑的磁盘代码。\n\n💡 如需维护题库并联动 IDE Source Control 审查提交：\n请在本地终端运行「./scripts/dev.sh」，打开「http://localhost:5173」进行可视化编辑与秒级直写！',
        '线上只读环境提示',
        { type: 'info', confirmButtonText: '我知道了' }
      )
      return false
    }
    if (pin.trim() === '654321') {
      isMaintenanceMode.value = true
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('study_admin_unlocked', 'true')
      }
      ElMessage.success('已解锁【本地题库维护模式】，页面修改将直接写回本地磁盘 content 目录！')
      return true
    }
    ElMessage.error('维护密码错误，验证失败')
    return false
  }

  const exitMaintenanceMode = () => {
    isMaintenanceMode.value = false
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('study_admin_unlocked')
    }
    showDataConsole.value = false
    ElMessage.info('已退出官方数据维护模式')
  }

  const fetchVersion = async () => {
    try {
      const meta = await api.get('/version') as VersionMeta
      if (meta && meta.database_version) {
        remoteVersionMeta.value = meta
        currentDbVersion.value = meta.database_version
        localStorage.setItem(DB_VERSION_KEY, meta.database_version)
      }
    } catch (e) {
      console.warn('Failed to fetch version', e)
    }
  }

  return {
    currentDbVersion,
    dataVersionCounter,
    remoteVersionMeta,
    showUpdateModal,
    isMaintenanceMode,
    showDataConsole,
    dbSyncStatus,
    dbSyncMessage,
    setDbSyncStatus,
    initLocalVersion,
    checkDatabaseVersion,
    confirmDatabaseUpdate,
    dismissUpdateModal,
    unlockMaintenanceMode,
    exitMaintenanceMode,
    fetchVersion
  }
})
