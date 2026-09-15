/**
 * 智学大脑 - 极速云端端到端加密同步服务 (Cloud Sync Service)
 * 纯客户端 AES-256-GCM 本地加密 + 零知识云端中继
 * 零下载、零第三方账号注册、跨端秒级同步
 */

import { localDB } from './localDatabase'
import { encryptPayload, decryptPayload, hashPasscode, generateRandomPasscode } from './crypto'

export const SYNC_STORAGE_KEYS = {
  PASSCODE: 'study_sync_passcode',
  AUTO_SYNC: 'study_sync_auto_enabled',
  LAST_SYNC: 'study_sync_last_time',
  LAST_STATS: 'study_sync_last_stats'
}

export interface SyncStats {
  wrongItems?: number
  plans?: number
  timerRecords?: number
  gameRecords?: number
  userName?: string
}

/**
 * 严格校验同步口令合规性：
 * 规则：必须包含字母与数字组合，长度至少 8 位以上
 */
export function validatePasscode(code: string): { valid: boolean; message?: string } {
  const clean = (code || '').trim()
  if (!clean) {
    return { valid: false, message: '请输入同步口令' }
  }
  if (clean.length < 8) {
    return { valid: false, message: '同步口令长度至少需 8 位以上' }
  }
  const hasLetter = /[a-zA-Z]/.test(clean)
  const hasNumber = /[0-9]/.test(clean)
  if (!hasLetter || !hasNumber) {
    return { valid: false, message: '同步口令必须为“字母 + 数字”组合（长度至少 8 位，例如 sb-7k9p-4m2x）' }
  }
  return { valid: true }
}

export interface SyncConfig {
  passcode: string
  autoSync: boolean
  lastSyncTime: string
  lastStats?: SyncStats | null
}

export function getSyncConfig(): SyncConfig {
  if (typeof window === 'undefined') {
    return { passcode: '', autoSync: false, lastSyncTime: '', lastStats: null }
  }

  const passcode = localStorage.getItem(SYNC_STORAGE_KEYS.PASSCODE) || ''
  const autoSync = localStorage.getItem(SYNC_STORAGE_KEYS.AUTO_SYNC) === 'true'
  const lastSyncTime = localStorage.getItem(SYNC_STORAGE_KEYS.LAST_SYNC) || ''
  let lastStats: SyncStats | null = null
  try {
    const rawStats = localStorage.getItem(SYNC_STORAGE_KEYS.LAST_STATS)
    if (rawStats) lastStats = JSON.parse(rawStats)
  } catch { }

  return { passcode, autoSync, lastSyncTime, lastStats }
}

export function saveSyncConfig(config: Partial<SyncConfig>): void {
  if (typeof window === 'undefined') return

  if (config.passcode !== undefined) {
    localStorage.setItem(SYNC_STORAGE_KEYS.PASSCODE, config.passcode.trim())
  }
  if (config.autoSync !== undefined) {
    localStorage.setItem(SYNC_STORAGE_KEYS.AUTO_SYNC, config.autoSync ? 'true' : 'false')
  }
  if (config.lastSyncTime !== undefined) {
    localStorage.setItem(SYNC_STORAGE_KEYS.LAST_SYNC, config.lastSyncTime)
  }
  if (config.lastStats !== undefined) {
    localStorage.setItem(SYNC_STORAGE_KEYS.LAST_STATS, JSON.stringify(config.lastStats))
  }
}

/**
 * 智能解析同步后端接口基址：
 * - 在 Cloudflare Pages (study.gyfolk.com) 或本地开发环境中直接使用相对路径 /api/sync
 * - 在 GitHub Pages (github.io) 或其他外部纯静态环境中，无缝路由至 Cloudflare Pages 边缘服务
 */
function getSyncApiBase(): string {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host.includes('gyfolk.com')) {
    return ''
  }
  return 'https://study.gyfolk.com'
}

/**
 * 一键上传当前数据库备份到云端
 * 1. 导出本地 IndexedDB 全量数据
 * 2. 在浏览器端使用口令进行 AES-256-GCM 加密
 * 3. 将密文 POST 上传至云端
 */
export async function pushCloudBackup(passcode: string): Promise<{ ok: boolean; updatedAt: string; stats?: SyncStats }> {
  const cleanPasscode = passcode.trim()
  const check = validatePasscode(cleanPasscode)
  if (!check.valid) {
    throw new Error(check.message)
  }

  // 1. 提取所有本地私有数据
  const payload = await localDB.exportAllUserData()

  // 2. 本地端到端高强度加密
  const encryptedPackage = await encryptPayload(payload, cleanPasscode)
  const codeHash = await hashPasscode(cleanPasscode)

  // 3. 上传密文包
  const apiBase = getSyncApiBase()
  const res = await fetch(`${apiBase}/api/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      codeHash,
      payload: encryptedPackage
    })
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.message || `上传失败 (HTTP ${res.status})`)
  }

  await res.json()
  const nowDisplay = new Date().toLocaleString()

  // 保存最新状态
  saveSyncConfig({
    passcode: cleanPasscode,
    lastSyncTime: nowDisplay,
    lastStats: encryptedPackage.dataStats
  })

  return {
    ok: true,
    updatedAt: nowDisplay,
    stats: encryptedPackage.dataStats
  }
}

/**
 * 从云端拉取备份并解密合并到本地 IndexedDB
 * 1. 从云端拉取与口令哈希对应的密文包
 * 2. 在浏览器端使用口令解密验证
 * 3. 将解密出的数据全量恢复覆盖本地 IndexedDB
 */
export async function pullCloudBackup(passcode: string): Promise<{ ok: boolean; data: any; updatedAt: string; stats?: SyncStats }> {
  const cleanPasscode = passcode.trim()
  const check = validatePasscode(cleanPasscode)
  if (!check.valid) {
    throw new Error(check.message)
  }

  const codeHash = await hashPasscode(cleanPasscode)
  const apiBase = getSyncApiBase()

  const res = await fetch(`${apiBase}/api/sync/pull?code=${encodeURIComponent(codeHash)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    if (res.status === 404) {
      throw new Error('未在云端找到该口令的备份数据。请核对口令是否拼写正确，或者先在另一台设备上点击「上传备份」。')
    }
    throw new Error(errorData.message || `拉取备份失败 (HTTP ${res.status})`)
  }

  const result = await res.json()
  if (!result.payload) {
    throw new Error('拉取的云端备份数据无效')
  }

  // 本地端到端解密
  const decryptedData = await decryptPayload(result.payload, cleanPasscode)

  // 写入本地 IndexedDB
  await localDB.importAllUserData(decryptedData)

  const nowDisplay = new Date().toLocaleString()
  saveSyncConfig({
    passcode: cleanPasscode,
    lastSyncTime: nowDisplay,
    lastStats: result.payload.dataStats
  })

  return {
    ok: true,
    data: decryptedData,
    updatedAt: nowDisplay,
    stats: result.payload.dataStats
  }
}

export { generateRandomPasscode }

