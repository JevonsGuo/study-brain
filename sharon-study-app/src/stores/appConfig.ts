import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../utils/api'
import { ElMessage } from 'element-plus'

const DB_VERSION_KEY = 'sharon_database_version'

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

  const initLocalVersion = () => {
    const saved = localStorage.getItem(DB_VERSION_KEY)
    if (saved) {
      currentDbVersion.value = saved
    }
  }

  const checkDatabaseVersion = async (manual = false) => {
    try {
      const meta = await api.get('/version') as VersionMeta
      if (meta && meta.database_version) {
        remoteVersionMeta.value = meta
        const saved = localStorage.getItem(DB_VERSION_KEY)
        if (!saved) {
          // 首次运行，静默记录当前版本
          localStorage.setItem(DB_VERSION_KEY, meta.database_version)
          currentDbVersion.value = meta.database_version
          if (manual) {
            ElMessage.success(`当前数据库已是最新版本：${currentDbVersion.value}`)
          }
          return
        }

        if (meta.database_version !== saved) {
          // 发现新版本，弹出更新确认提示框
          showUpdateModal.value = true
        } else if (manual) {
          ElMessage.success(`当前数据库已是最新版本：${currentDbVersion.value}`)
        }
      }
    } catch (err) {
      console.warn('Failed to check database version', err)
      if (manual) {
        ElMessage.warning('检查数据库版本失败，请检查网络连接')
      }
    }
  }

  const confirmDatabaseUpdate = () => {
    if (remoteVersionMeta.value?.database_version) {
      currentDbVersion.value = remoteVersionMeta.value.database_version
      localStorage.setItem(DB_VERSION_KEY, currentDbVersion.value)
      showUpdateModal.value = false
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
    initLocalVersion,
    checkDatabaseVersion,
    confirmDatabaseUpdate,
    dismissUpdateModal,
    unlockMaintenanceMode,
    exitMaintenanceMode,
    fetchVersion
  }
})
