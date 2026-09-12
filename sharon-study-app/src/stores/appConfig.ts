import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, localDB } from '../utils/api'
import type { DbSyncState } from '../utils/localDatabase'
import { ElMessage } from 'element-plus'

const DB_VERSION_KEY = 'study_database_version'

export interface VersionMeta {
  database_version: string
  updated_at: string
  description?: string
}

export const useAppConfigStore = defineStore('appConfig', () => {
  const currentDbVersion = ref<string>('20260911-001')
  const remoteVersionMeta = ref<VersionMeta | null>(null)
  const showUpdateModal = ref(false)
  const isMaintenanceMode = ref(false)

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

  const checkDatabaseVersion = async (manual = false) => {
    dbSyncStatus.value = 'checking'
    dbSyncMessage.value = '正在检查更新...'

    try {
      const meta = await api.get('/version') as VersionMeta
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
          // 发现新版本
          dbSyncStatus.value = 'update_available'
          dbSyncMessage.value = `发现新版本 v${meta.database_version}`
          showUpdateModal.value = true
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
      currentDbVersion.value = remoteVersionMeta.value.database_version
      localStorage.setItem(DB_VERSION_KEY, currentDbVersion.value)
      showUpdateModal.value = false
      dbSyncStatus.value = 'latest'
      dbSyncMessage.value = `已更新至 v${currentDbVersion.value}`
      ElMessage.success('数据库已成功更新至最新版本！')
    }
  }

  const dismissUpdateModal = () => {
    showUpdateModal.value = false
  }

  const unlockMaintenanceMode = (pin: string): boolean => {
    if (pin.trim() === '654321') {
      isMaintenanceMode.value = true
      ElMessage.success('已解锁【官方数据维护模式】，可直接编辑考点与工具')
      return true
    }
    ElMessage.error('维护密码错误，验证失败')
    return false
  }

  const exitMaintenanceMode = () => {
    isMaintenanceMode.value = false
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
    remoteVersionMeta,
    showUpdateModal,
    isMaintenanceMode,
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
