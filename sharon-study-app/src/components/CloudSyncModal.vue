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
  Lock,
  ArrowDown,
  ArrowUp
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
const showDetails = ref(false)
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
        '重新生成口令将创建一组全新的同步密钥。若需保留旧设备数据，请先记下旧口令。是否确认生成？',
        '生成新口令提示',
        { type: 'warning', confirmButtonText: '确定生成', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }
  passcode.value = generateRandomPasscode()
  saveSyncConfig({ passcode: passcode.value })
  ElMessage.success('已生成新口令！')
}

const handleCopyCode = async () => {
  if (!passcode.value.trim()) return
  try {
    await navigator.clipboard.writeText(passcode.value.trim())
    ElMessage.success('口令已复制！在另一台设备输入即可一键同步。')
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
    ElMessage.success('🎉 备份成功！数据已通过 AES-256 加密安全同步到云端。')
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
      '从云端拉取将使用云端最新的加密备份覆盖本设备数据。是否继续？',
      '恢复数据确认',
      { type: 'warning', confirmButtonText: '确认拉取恢复', cancelButtonText: '取消' }
    )
    isPulling.value = true
    const res = await pullCloudBackup(passcode.value)
    lastSyncTime.value = res.updatedAt
    lastStats.value = res.stats || null
    ElMessage.success('🎉 成功恢复数据！正在重新载入界面...')
    setTimeout(() => window.location.reload(), 800)
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '拉取失败，请检查口令拼写')
    }
  } finally {
    isPulling.value = false
  }
}

// 导出本地离线文件
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
    ElMessage.success('已导出本地离线备份文件')
  } catch {
    ElMessage.error('导出备份文件失败')
  }
}

// 导入本地离线文件
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
      `即将从文件 [${file.name}] 导入数据并恢复本地数据库。此操作将覆盖现有数据。是否继续？`,
      '导入确认',
      { type: 'warning', confirmButtonText: '确认导入', cancelButtonText: '取消' }
    )

    await localDB.importAllUserData(data)
    ElMessage.success('数据导入成功！正在为您重新加载...')
    setTimeout(() => window.location.reload(), 800)
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error('文件解析或导入失败，请确保是合规的备份文件')
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
    title="云端数据同步"
    width="480px"
    destroy-on-close
    class="cloud-sync-dialog"
  >
    <!-- 极简主卡片 -->
    <div class="sync-main-card">
      <!-- 同步口令管理区 -->
      <div class="passcode-section">
        <div class="passcode-label-row">
          <label class="passcode-label">
            <el-icon class="label-icon"><Key /></el-icon>
            <span>专属同步口令 (Passcode)</span>
          </label>
          <span class="passcode-badge">端到端加密</span>
        </div>

        <div class="passcode-input-group">
          <el-input
            v-model="passcode"
            placeholder="例如：sb-7k9p-4m2x"
            class="passcode-input"
            clearable
            @change="handlePasscodeChange"
          >
            <template #prefix>
              <el-icon class="code-prefix-icon"><Key /></el-icon>
            </template>
          </el-input>

          <div class="passcode-actions">
            <el-button :icon="CopyDocument" @click="handleCopyCode" title="复制口令">
              复制
            </el-button>
            <el-button :icon="RefreshRight" @click="handleGenerateNewCode" title="换一个口令">
              换一个
            </el-button>
          </div>
        </div>
      </div>

      <!-- 核心同步操作按钮 -->
      <div class="sync-action-buttons">
        <el-button
          type="primary"
          size="large"
          class="sync-btn push-btn"
          :loading="isPushing"
          @click="handlePush"
          :icon="Upload"
        >
          备份到云端
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
          从云端恢复
        </el-button>
      </div>

      <!-- 自动静默同步与上次时间 -->
      <div class="auto-sync-bar">
        <el-checkbox v-model="autoSyncEnabled" @change="handleAutoSyncChange">
          <span class="auto-sync-text">后台自动静默同步 (每5分钟)</span>
        </el-checkbox>
        <span v-if="lastSyncTime" class="last-sync-time">
          上次: {{ lastSyncTime.slice(5) }}
        </span>
      </div>
    </div>

    <!-- 详细信息与离线备份展开按钮 -->
    <div class="details-toggle-row">
      <button
        type="button"
        class="details-toggle-btn"
        @click="showDetails = !showDetails"
      >
        <span>{{ showDetails ? '收起详情与离线备份' : '查看数据详情与离线备份' }}</span>
        <el-icon :size="12">
          <component :is="showDetails ? ArrowUp : ArrowDown" />
        </el-icon>
      </button>
    </div>

    <!-- 折叠区域：加密说明、统计指标与离线导出导入 -->
    <transition name="details-fade">
      <div v-if="showDetails" class="details-expand-box">
        <!-- 零知识加密说明 -->
        <div class="sync-intro-banner">
          <div class="banner-icon-wrap">
            <el-icon><Lock /></el-icon>
          </div>
          <div class="banner-text">
            <div class="banner-title">AES-256-GCM 本地加密 · 零知识存储</div>
            <div class="banner-desc">
              数据在离开浏览器前均已在本地高强度加密，云端仅作为加密中继，无法窥探明文。在其他设备输入该口令即可解密恢复。
            </div>
          </div>
        </div>

        <!-- 学情指标统计 -->
        <div v-if="lastStats" class="sync-stats-card">
          <div class="stats-title">已同步学情指标</div>
          <div class="status-stats-row">
            <span class="stat-pill">错题本: {{ lastStats.wrongItems ?? 0 }} 题</span>
            <span class="stat-pill">每日计划: {{ lastStats.plans ?? 0 }} 条</span>
            <span class="stat-pill">专注时长: {{ lastStats.timerRecords ?? 0 }} 次</span>
            <span v-if="lastStats.gameRecords" class="stat-pill">益智对局: {{ lastStats.gameRecords }} 项纪录</span>
          </div>
        </div>

        <!-- 离线物理备份 -->
        <div class="offline-backup-card">
          <div class="offline-desc">
            纯离线备份：随时将本地数据导出为 <code>.json</code> 文件保存，或从备份文件导入。
          </div>
          <div class="offline-actions">
            <el-button size="small" type="info" plain :icon="Document" @click="exportLocalBackup">
              导出备份文件
            </el-button>
            <el-button size="small" type="info" plain :icon="FolderOpened" @click="triggerFileInput">
              导入备份文件
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
      </div>
    </transition>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.sync-main-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  padding: 1px 7px;
  border-radius: 9999px;
  background: #fef3c7;
  color: #b45309;
  font-weight: 500;
}

.passcode-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.passcode-input {
  flex: 1;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.passcode-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.sync-action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.sync-btn {
  height: 42px;
  font-size: 13.5px;
  font-weight: 600;
  border-radius: 8px;
}

.push-btn {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.auto-sync-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 2px 0;
}

.auto-sync-text {
  font-size: 12.5px;
  color: var(--text-color, #334155);
}

.last-sync-time {
  font-size: 11.5px;
  color: #10b981;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
}

/* 详情折叠切换按钮 */
.details-toggle-row {
  display: flex;
  justify-content: center;
  margin: 12px 0 2px;
}

.details-toggle-btn {
  background: none;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted, #64748b);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  transition: all 0.2s;
}

.details-toggle-btn:hover {
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.06);
}

:global(.dark) .details-toggle-btn:hover {
  color: #818cf8;
  background: rgba(129, 140, 248, 0.1);
}

/* 展开区域 */
.details-expand-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color, #e2e8f0);
}

.sync-intro-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 10px 12px;
}

.banner-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: #3b82f6;
  color: #fff;
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

.banner-text {
  flex: 1;
}

.banner-title {
  font-size: 12.5px;
  font-weight: 600;
  color: #1e3a8a;
  margin-bottom: 2px;
}

.banner-desc {
  font-size: 11.5px;
  color: #3b82f6;
  line-height: 1.45;
}

.sync-stats-card {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stats-title {
  font-size: 11.5px;
  font-weight: 600;
  color: #15803d;
}

.status-stats-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.stat-pill {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.offline-backup-card {
  background: var(--bg-page, #f8fafc);
  border: 1px dashed var(--border-color, #cbd5e1);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.offline-desc {
  font-size: 11.5px;
  color: var(--text-muted, #64748b);
  line-height: 1.4;
}

.offline-desc code {
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}

.offline-actions {
  display: flex;
  gap: 8px;
}

/* 过渡动画 */
.details-fade-enter-active,
.details-fade-leave-active {
  transition: all 0.22s ease-out;
}

.details-fade-enter-from,
.details-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 深色模式适配 */
:global(.dark) .sync-main-card {
  background: #1e293b;
  border-color: #334155;
}

:global(.dark) .passcode-badge {
  background: #78350f;
  color: #fde68a;
}

:global(.dark) .auto-sync-text {
  color: #cbd5e1;
}

:global(.dark) .details-expand-box {
  border-top-color: #334155;
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

:global(.dark) .sync-stats-card {
  background: #064e3b;
  border-color: #059669;
}

:global(.dark) .stats-title {
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

@media (max-width: 520px) {
  .sync-action-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
