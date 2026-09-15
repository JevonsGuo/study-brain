<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Download,
  Upload,
  Key,
  Document,
  FolderOpened,
  CopyDocument,
  RefreshRight,
  Lock
} from '@element-plus/icons-vue'
import { localDB } from '../utils/localDatabase'
import {
  getSyncConfig,
  saveSyncConfig,
  pushCloudBackup,
  pullCloudBackup,
  generateRandomPasscode,
  validatePasscode,
  type SyncStats
} from '../utils/cloudSync'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const passcode = ref('')
const autoSyncEnabled = ref(true)
const lastSyncTime = ref('')
const lastStats = ref<SyncStats | null>(null)
const isPushing = ref(false)
const isPulling = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  const cfg = getSyncConfig()
  if (cfg.passcode) {
    passcode.value = cfg.passcode
  } else {
    // 首次进入自动生成一个口令，开箱即用
    passcode.value = generateRandomPasscode()
    saveSyncConfig({ passcode: passcode.value })
  }
  autoSyncEnabled.value = cfg.autoSync
  lastSyncTime.value = cfg.lastSyncTime
  lastStats.value = cfg.lastStats || null
})

const handlePasscodeChange = () => {
  saveSyncConfig({ passcode: passcode.value.trim() })
}

const handleAutoSyncChange = () => {
  saveSyncConfig({ autoSync: autoSyncEnabled.value })
  ElMessage.success(
    autoSyncEnabled.value ? '已开启后台自动静默同步 (每5分钟)' : '已关闭后台自动同步'
  )
}

const handleGenerateNewCode = async () => {
  if (passcode.value) {
    try {
      await ElMessageBox.confirm(
        '重新生成口令将生成一组新的同步密钥。若需保留旧设备数据，请先记下旧口令。是否确认生成新口令？',
        '生成新口令提示',
        { type: 'warning', confirmButtonText: '确定生成', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }
  passcode.value = generateRandomPasscode()
  saveSyncConfig({ passcode: passcode.value })
  ElMessage.success('已生成新口令！请点击下方「上传备份」将本设备数据同步至云端。')
}

const handleCopyCode = async () => {
  if (!passcode.value.trim()) return
  try {
    await navigator.clipboard.writeText(passcode.value.trim())
    ElMessage.success('口令已复制！在手机或另一台电脑输入该口令，即可一键拉取恢复。')
  } catch {
    ElMessage.info('口令为：' + passcode.value)
  }
}

const handlePush = async () => {
  const check = validatePasscode(passcode.value)
  if (!check.valid) {
    ElMessage.warning(check.message)
    return
  }
  isPushing.value = true
  try {
    const res = await pushCloudBackup(passcode.value)
    lastSyncTime.value = res.updatedAt
    lastStats.value = res.stats || null
    ElMessage.success('🎉 备份成功！数据已通过 AES-256 高强度加密安全同步到云端。')
  } catch (err: any) {
    ElMessage.error(err.message || '上传备份失败，请检查网络或口令')
  } finally {
    isPushing.value = false
  }
}

const handlePull = async () => {
  const check = validatePasscode(passcode.value)
  if (!check.valid) {
    ElMessage.warning(check.message)
    return
  }
  try {
    await ElMessageBox.confirm(
      '从云端拉取将使用云端最新的加密数据库覆盖本设备当前数据。是否继续？',
      '恢复数据确认',
      { type: 'warning', confirmButtonText: '确认拉取恢复', cancelButtonText: '取消' }
    )
    isPulling.value = true
    const res = await pullCloudBackup(passcode.value)
    lastSyncTime.value = res.updatedAt
    lastStats.value = res.stats || null
    ElMessage.success('🎉 成功拉取并解密恢复学习数据！正在重新载入界面...')
    setTimeout(() => window.location.reload(), 900)
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '拉取恢复失败，请检查口令是否拼写正确')
    }
  } finally {
    isPulling.value = false
  }
}

// 一键导出本地完整数据库备份文件
const exportLocalBackup = async () => {
  try {
    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `study_brain_backup_${dateStr}.json`
    const payload = await localDB.exportAllUserData()

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('已成功导出本地完整备份文件！')
  } catch (err) {
    ElMessage.error('导出备份文件失败')
  }
}

// 一键从本地 JSON 文件导入恢复
const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileImport = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    await ElMessageBox.confirm(
      `即将从文件 [${file.name}] 导入数据并恢复本地数据库。此操作将合并覆盖现有进度。是否继续？`,
      '导入数据确认',
      { type: 'warning', confirmButtonText: '确认导入', cancelButtonText: '取消' }
    )

    await localDB.importAllUserData(data)
    ElMessage.success('数据导入成功！正在为您重新加载应用...')
    setTimeout(() => window.location.reload(), 800)
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error('文件解析或导入失败，请确保是正确的备份文件')
    }
  } finally {
    target.value = ''
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="☁️ 云端极速跨端同步 (端到端加密)"
    width="580px"
    destroy-on-close
    class="cloud-sync-dialog"
  >
    <!-- 安全零知识介绍横幅 -->
    <div class="sync-intro-banner">
      <div class="banner-icon-wrap">
        <el-icon><Lock /></el-icon>
      </div>
      <div class="banner-text">
        <div class="banner-title">零下载 · 零账号 · 浏览器端 AES-256-GCM 端到端强加密</div>
        <div class="banner-desc">
          您的学习数据在离开浏览器前均已在本地完成加密，云端中继仅存储无法破解的密文。只要保管好您的<b>同步口令</b>，即可在手机、平板与电脑间安全无缝漫游！
        </div>
      </div>
    </div>

    <div class="sync-main-card">
      <!-- 同步口令管理区 -->
      <div class="passcode-section">
        <div class="passcode-label-row">
          <label class="passcode-label">
            <el-icon class="label-icon"><Key /></el-icon>
            <span>我的同步口令 (Passcode)</span>
          </label>
          <span class="passcode-badge">端到端密钥</span>
        </div>

        <div class="passcode-input-group">
          <el-input
            v-model="passcode"
            placeholder="例如：sb-839210 或自定义安全词"
            class="passcode-input"
            clearable
            @change="handlePasscodeChange"
          >
            <template #prefix>
              <span class="code-prefix">🔑</span>
            </template>
          </el-input>

          <div class="passcode-actions">
            <el-button :icon="CopyDocument" @click="handleCopyCode" title="复制口令到剪贴板">
              复制口令
            </el-button>
            <el-button :icon="RefreshRight" @click="handleGenerateNewCode" title="随机生成新口令">
              换一个
            </el-button>
          </div>
        </div>

        <div class="passcode-guide-tip">
          💡 口令规则：至少包含<b>字母与数字</b>组合，长度<b>8位以上</b>（如系统自动生成的 <code>sb-7k9p-4m2x</code>）。在另一台设备输入该口令，即可一键恢复全部学情与益智战报。
        </div>
      </div>

      <!-- 核心同步动作按钮 -->
      <div class="sync-action-buttons">
        <el-button
          type="primary"
          size="large"
          class="sync-btn push-btn"
          :loading="isPushing"
          @click="handlePush"
          :icon="Upload"
        >
          🚀 一键备份到云端
        </el-button>
        <el-button
          type="success"
          plain
          size="large"
          class="sync-btn pull-btn"
          :loading="isPulling"
          @click="handlePull"
          :icon="Download"
        >
          📥 从云端恢复到此设备
        </el-button>
      </div>

      <!-- 自动同步选项 -->
      <div class="auto-sync-box">
        <el-checkbox v-model="autoSyncEnabled" @change="handleAutoSyncChange">
          <span class="auto-sync-text">⏱️ 后台定时自动静默同步 (每 5 分钟)</span>
        </el-checkbox>
        <span class="auto-sync-sub">（在有学习进度变动时自动加密并同步最新备份）</span>
      </div>

      <!-- 同步状态提示条 -->
      <div v-if="lastSyncTime" class="sync-status-card">
        <div class="status-top-row">
          <span class="status-indicator"></span>
          <span class="status-time">上次同步成功时间：{{ lastSyncTime }}</span>
        </div>
        <div v-if="lastStats" class="status-stats-row">
          <span class="stat-pill">错题本: {{ lastStats.wrongItems ?? 0 }} 题</span>
          <span class="stat-pill">每日计划: {{ lastStats.plans ?? 0 }} 条</span>
          <span class="stat-pill">专注时长: {{ lastStats.timerRecords ?? 0 }} 次</span>
          <span v-if="lastStats.gameRecords" class="stat-pill">益智对局: {{ lastStats.gameRecords }} 项纪录</span>
        </div>
      </div>
    </div>

    <!-- 底部：纯离线物理文件备份兜底方案 -->
    <el-divider content-position="center">
      <span class="divider-text">📦 纯离线物理备份兜底方案</span>
    </el-divider>

    <div class="offline-backup-card">
      <div class="offline-desc">
        无需任何网络，随时将本地 IndexedDB 导出为 <code>.json</code> 文件妥善保存，可随时导入还原。
      </div>
      <div class="offline-actions">
        <el-button type="info" plain :icon="Document" @click="exportLocalBackup">
          导出离线备份文件
        </el-button>
        <el-button type="info" plain :icon="FolderOpened" @click="triggerFileInput">
          导入离线备份文件
        </el-button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleFileImport"
        />
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.sync-intro-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 18px;
}

.banner-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #3b82f6;
  color: #fff;
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.banner-text {
  flex: 1;
}

.banner-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #1e3a8a;
  margin-bottom: 3px;
}

.banner-desc {
  font-size: 12px;
  color: #3b82f6;
  line-height: 1.5;
}

.sync-main-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.passcode-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.passcode-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.passcode-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-color, #1e293b);
}

.label-icon {
  color: #f59e0b;
}

.passcode-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9999px;
  background: #fef3c7;
  color: #b45309;
  font-weight: 500;
}

.passcode-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.passcode-input {
  flex: 1;
  min-width: 220px;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.code-prefix {
  font-size: 14px;
}

.passcode-actions {
  display: flex;
  gap: 6px;
}

.passcode-guide-tip {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  line-height: 1.5;
  background: rgba(0, 0, 0, 0.02);
  padding: 6px 10px;
  border-radius: 6px;
}

.sync-action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 4px;
}

.sync-btn {
  height: 44px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
}

.push-btn {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.auto-sync-box {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 2px;
}

.auto-sync-text {
  font-size: 13px;
  font-weight: 500;
}

.auto-sync-sub {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.sync-status-card {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-top-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
}

.status-time {
  font-size: 12.5px;
  font-weight: 600;
  color: #15803d;
}

.status-stats-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
  font-weight: 500;
}

.divider-text {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.offline-backup-card {
  background: var(--bg-page, #f8fafc);
  border: 1px dashed var(--border-color, #cbd5e1);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.offline-desc {
  font-size: 12.5px;
  color: var(--text-muted, #64748b);
  line-height: 1.5;
}

.offline-desc code {
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
}

.offline-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

:global(.dark) .sync-intro-banner {
  background: linear-gradient(135deg, #1e293b 0%, #142e2b 100%);
  border-color: #3b82f6;
}

:global(.dark) .banner-title {
  color: #93c5fd;
}

:global(.dark) .banner-desc {
  color: #bfdbfe;
}

:global(.dark) .sync-main-card {
  background: #1e293b;
  border-color: #334155;
}

:global(.dark) .passcode-badge {
  background: #78350f;
  color: #fde68a;
}

:global(.dark) .passcode-guide-tip {
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
}

:global(.dark) .sync-status-card {
  background: #064e3b;
  border-color: #059669;
}

:global(.dark) .status-time {
  color: #a7f3d0;
}

:global(.dark) .stat-pill {
  background: rgba(255, 255, 255, 0.1);
  color: #d1fae5;
}

:global(.dark) .offline-backup-card {
  background: #0f172a;
  border-color: #334155;
}

:global(.dark) .offline-desc code {
  background: rgba(255, 255, 255, 0.1);
}

@media (max-width: 640px) {
  .sync-action-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
