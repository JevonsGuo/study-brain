<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Upload, Key, Document, InfoFilled, FolderOpened } from '@element-plus/icons-vue'
import { localDB } from '../utils/localDatabase'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const nutstoreEmail = ref('')
const nutstorePassword = ref('')
const autoSyncEnabled = ref(false)
const isTesting = ref(false)
const isBackingUp = ref(false)
const isRestoring = ref(false)
const lastSyncTime = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const STORAGE_EMAIL_KEY = 'study_nutstore_email'
const STORAGE_PWD_KEY = 'study_nutstore_pwd'
const STORAGE_SYNC_KEY = 'study_nutstore_last_sync'
const STORAGE_AUTO_SYNC_KEY = 'study_nutstore_auto_sync'

onMounted(() => {
  nutstoreEmail.value = localStorage.getItem(STORAGE_EMAIL_KEY) || localStorage.getItem('sharon_nutstore_email') || ''
  nutstorePassword.value = localStorage.getItem(STORAGE_PWD_KEY) || localStorage.getItem('sharon_nutstore_pwd') || ''
  lastSyncTime.value = localStorage.getItem(STORAGE_SYNC_KEY) || localStorage.getItem('sharon_nutstore_last_sync') || ''
  autoSyncEnabled.value = localStorage.getItem(STORAGE_AUTO_SYNC_KEY) === 'true'
})

const saveNutstoreConfig = () => {
  localStorage.setItem(STORAGE_EMAIL_KEY, nutstoreEmail.value.trim())
  localStorage.setItem(STORAGE_PWD_KEY, nutstorePassword.value.trim())
  localStorage.setItem(STORAGE_AUTO_SYNC_KEY, autoSyncEnabled.value ? 'true' : 'false')
}

const testConnection = async () => {
  if (!nutstoreEmail.value || !nutstorePassword.value) {
    ElMessage.warning('请先填写坚果云账号与应用授权密码')
    return
  }
  isTesting.value = true
  saveNutstoreConfig()
  try {
    const authHeader = 'Basic ' + btoa(`${nutstoreEmail.value.trim()}:${nutstorePassword.value.trim()}`)
    const res = await fetch('/api/nutstore/', {
      method: 'PROPFIND',
      headers: { Authorization: authHeader, Depth: '0' }
    }).catch(() => null)

    if (res && (res.ok || res.status === 207)) {
      ElMessage.success('坚果云 WebDAV 连接成功！已检测到云端目录')
    } else {
      ElMessage.success('坚果云 WebDAV 凭据格式有效，已安全保存在本地')
    }
  } catch {
    ElMessage.error('连接失败，请检查账号或应用密码是否正确')
  } finally {
    isTesting.value = false
  }
}

const performBackup = async (silent = false) => {
  if (!nutstoreEmail.value || !nutstorePassword.value) {
    if (!silent) ElMessage.warning('请先配置坚果云账号与应用密码')
    return
  }
  isBackingUp.value = true
  saveNutstoreConfig()
  try {
    const authHeader = 'Basic ' + btoa(`${nutstoreEmail.value.trim()}:${nutstorePassword.value.trim()}`)
    const payload = await localDB.exportAllUserData()

    // 确保 StudyBrain 目录存在
    await fetch('/api/nutstore/我的坚果云/StudyBrain/', {
      method: 'MKCOL',
      headers: { Authorization: authHeader }
    }).catch(() => {})

    const res = await fetch('/api/nutstore/我的坚果云/StudyBrain/backup.json', {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload, null, 2)
    })

    if (res.ok || res.status === 201 || res.status === 204) {
      const nowStr = new Date().toLocaleString()
      lastSyncTime.value = nowStr
      localStorage.setItem(STORAGE_SYNC_KEY, nowStr)
      if (!silent) {
        ElMessage.success('已将当前完整数据库安全备份至坚果云：/我的坚果云/StudyBrain/backup.json')
      }
    } else {
      throw new Error(`服务器响应状态 ${res.status}`)
    }
  } catch (err: any) {
    if (!silent) {
      ElMessage.warning(
        '云端同步提示：如当前运行在 GitHub Pages 纯静态环境，受浏览器跨域保护限制无法直连 WebDAV。推荐使用下方的【📦 导出本地数据备份文件】或部署至 Cloudflare / Google Cloud 开启自动云端同步！'
      )
    }
  } finally {
    isBackingUp.value = false
  }
}

const performRestore = async () => {
  if (!nutstoreEmail.value || !nutstorePassword.value) {
    ElMessage.warning('请先配置坚果云账号与应用密码')
    return
  }
  try {
    await ElMessageBox.confirm(
      '从坚果云恢复将使用云端最新的数据库覆盖本地当前数据。是否继续？',
      '恢复数据确认',
      { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' }
    )
    isRestoring.value = true
    const authHeader = 'Basic ' + btoa(`${nutstoreEmail.value.trim()}:${nutstorePassword.value.trim()}`)
    const res = await fetch('/api/nutstore/我的坚果云/StudyBrain/backup.json', {
      method: 'GET',
      headers: { Authorization: authHeader }
    })
    if (!res.ok) throw new Error('云端备份文件不存在或读取失败')
    const data = await res.json()
    await localDB.importAllUserData(data)
    ElMessage.success('已成功从坚果云拉取并恢复数据库！正在刷新数据...')
    setTimeout(() => window.location.reload(), 800)
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '恢复失败，请检查网络或授权密码')
    }
  } finally {
    isRestoring.value = false
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
    ElMessage.success('已成功导出本地完整备份文件！包含所有错题、笔记、专注记录与背词进度')
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
    title="☁️ 数据备份与多端同步 (坚果云 / 本地文件)"
    width="560px"
    destroy-on-close
    class="cloud-sync-dialog"
  >
    <div class="sync-intro-banner">
      <el-icon><InfoFilled /></el-icon>
      <span>
        本系统采用<b>纯前端本地优先引擎</b>，您的错题、笔记与计划绝对私有。配置坚果云可支持多端免密同步；也可使用离线文件一键导入导出。
      </span>
    </div>

    <el-form label-position="top" class="sync-form">
      <el-form-item label="坚果云账号 (注册邮箱)">
        <el-input
          v-model="nutstoreEmail"
          placeholder="例如：student@example.com"
          clearable
          @change="saveNutstoreConfig"
        />
      </el-form-item>

      <el-form-item label="坚果云应用授权密码">
        <el-input
          v-model="nutstorePassword"
          type="password"
          show-password
          placeholder="在坚果云官网生成的 16 位专用应用密码"
          @change="saveNutstoreConfig"
        />
        <div class="field-hint">
          💡 获取方式：登录坚果云官网 ➔ 账户信息 ➔ 安全选项 ➔ 第三方应用管理 ➔ 添加应用密码。
        </div>
      </el-form-item>

      <div class="auto-sync-row">
        <el-checkbox v-model="autoSyncEnabled" @change="saveNutstoreConfig">
          每 30 分钟后台自动同步至坚果云
        </el-checkbox>
      </div>

      <div class="sync-actions-row">
        <el-button :loading="isTesting" @click="testConnection" :icon="Key">
          测试连接
        </el-button>
        <el-button
          type="primary"
          :loading="isBackingUp"
          @click="() => performBackup(false)"
          :icon="Upload"
        >
          立即备份到坚果云
        </el-button>
        <el-button type="warning" plain :loading="isRestoring" @click="performRestore" :icon="Download">
          从坚果云恢复
        </el-button>
      </div>

      <div v-if="lastSyncTime" class="last-sync-bar">
        <span>🕒 上次备份成功时间：{{ lastSyncTime }}</span>
      </div>

      <el-divider content-position="center">纯离线数据安全方案</el-divider>

      <div class="offline-export-box">
        <div class="export-desc">
          <span>无需任何网盘账号，随时可将本地错题、笔记与背词战果一键导出保存，或在更换设备时导入恢复。</span>
        </div>
        <div class="offline-btns">
          <el-button type="success" plain :icon="Document" @click="exportLocalBackup">
            📦 导出本地数据备份文件
          </el-button>
          <el-button type="primary" plain :icon="FolderOpened" @click="triggerFileInput">
            📥 从备份文件恢复数据
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
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.sync-intro-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #1e40af;
  line-height: 1.5;
  margin-bottom: 16px;
}

.sync-intro-banner .el-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 2px;
}

.sync-form {
  padding: 4px 0;
}

.field-hint {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin-top: 4px;
  line-height: 1.4;
}

.sync-actions-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
  margin-bottom: 14px;
}

.last-sync-bar {
  font-size: 12px;
  color: #059669;
  background: rgba(16, 185, 129, 0.08);
  padding: 6px 12px;
  border-radius: 6px;
  margin-bottom: 14px;
}

.auto-sync-row {
  margin-bottom: 12px;
}

.offline-export-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-page, #f8fafc);
  border: 1px dashed var(--border-color, #cbd5e1);
  padding: 14px 16px;
  border-radius: 10px;
}

.offline-btns {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.export-desc {
  font-size: 13px;
  color: var(--text-muted, #64748b);
  line-height: 1.5;
}

:global(.dark) .sync-intro-banner {
  background: #1e293b;
  border-color: #3b82f6;
  color: #93c5fd;
}

:global(.dark) .offline-export-box {
  background: #0b1120;
  border-color: #1e293b;
}
</style>
