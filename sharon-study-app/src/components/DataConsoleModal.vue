<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { localDB } from '../utils/localDatabase'
import { useAppConfigStore } from '../stores/appConfig'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Download,
  Upload,
  RefreshRight,
  SwitchButton,
  Key,
  InfoFilled,
  WarningFilled
} from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const appConfig = useAppConfigStore()

const activeTab = ref<'export' | 'github' | 'danger'>('export')
const isLoading = ref(false)
const stats = ref<any>({
  knowledge: { total: 0, modified: 0, added: 0, deleted: 0, hasDraft: false },
  resources: { total: 0, modified: 0, added: 0, deleted: 0, hasDraft: false }
})

// GitHub API 推送状态
const GITHUB_TOKEN_KEY = 'study_admin_github_token'
const githubToken = ref('')
const commitMessage = ref('feat(data): 维护更新考点与学科资源')
const isPushing = ref(false)

const loadStats = async () => {
  try {
    stats.value = await localDB.getDraftStats()
  } catch (err) {
    console.warn('获取草稿统计失败', err)
  }
}

onMounted(() => {
  githubToken.value = localStorage.getItem(GITHUB_TOKEN_KEY) || ''
})

watch(() => props.modelValue, (val) => {
  if (val) {
    loadStats()
    githubToken.value = localStorage.getItem(GITHUB_TOKEN_KEY) || ''
  }
})

const saveGithubToken = () => {
  if (githubToken.value.trim()) {
    localStorage.setItem(GITHUB_TOKEN_KEY, githubToken.value.trim())
    ElMessage.success('GitHub Token 已安全暂存在本地浏览器')
  } else {
    localStorage.removeItem(GITHUB_TOKEN_KEY)
  }
}

// 辅助：前端触发 JSON 文件下载
const downloadJsonFile = (filename: string, contentStr: string) => {
  const blob = new Blob([contentStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 1. 导出 knowledge.json
const exportKnowledge = async () => {
  isLoading.value = true
  try {
    const jsonStr = await localDB.exportConsolidatedKnowledgeJson()
    downloadJsonFile('knowledge.json', jsonStr)
    ElMessage.success('已成功导出完整 knowledge.json！请覆盖 content/knowledge.json')
  } catch (err: any) {
    ElMessage.error(`导出失败: ${err.message || '未知错误'}`)
  } finally {
    isLoading.value = false
  }
}

// 2. 导出 learning-resources.json
const exportResources = async () => {
  isLoading.value = true
  try {
    const jsonStr = await localDB.exportConsolidatedResourcesJson()
    downloadJsonFile('learning-resources.json', jsonStr)
    ElMessage.success('已成功导出完整 learning-resources.json！请覆盖 content/learning-resources.json')
  } catch (err: any) {
    ElMessage.error(`导出失败: ${err.message || '未知错误'}`)
  } finally {
    isLoading.value = false
  }
}

// 3. 纯网页在线推送 GitHub 仓库
const pushToGitHub = async (targetFile: 'knowledge' | 'resources') => {
  const token = githubToken.value.trim()
  if (!token) {
    ElMessage.warning('请先配置具备 repo 写入权限的 GitHub Personal Access Token (PAT)')
    return
  }
  saveGithubToken()

  const repo = 'JevonsGuo/study-brain'
  const branch = 'master'
  const filePath = targetFile === 'knowledge' ? 'content/knowledge.json' : 'content/learning-resources.json'
  const fileDesc = targetFile === 'knowledge' ? '考点知识库 (knowledge.json)' : '学习资源清单 (learning-resources.json)'

  isPushing.value = true
  try {
    // A. 准备待提交的纯净 JSON 字符串
    const jsonStr = targetFile === 'knowledge'
      ? await localDB.exportConsolidatedKnowledgeJson()
      : await localDB.exportConsolidatedResourcesJson()

    // B. 查询目标文件在 GitHub 当前分支上的最新 SHA
    const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`
    const getRes = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    })

    let currentSha: string | undefined
    if (getRes.ok) {
      const existingData = await getRes.json()
      currentSha = existingData.sha
    } else if (getRes.status === 401 || getRes.status === 403) {
      throw new Error('GitHub Token 无效或权限不足，请确认拥有 repo 读写权限')
    }

    // C. UTF-8 编码为 Base64
    const utf8Bytes = new TextEncoder().encode(jsonStr)
    let binary = ''
    utf8Bytes.forEach((b) => { binary += String.fromCharCode(b) })
    const base64Content = btoa(binary)

    // D. PUT 请求向 GitHub 提交 Commit
    const commitRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: commitMessage.value.trim() || `update ${filePath}`,
        content: base64Content,
        branch,
        sha: currentSha
      })
    })

    if (!commitRes.ok) {
      const err = await commitRes.json().catch(() => ({}))
      throw new Error(err.message || `GitHub 拒绝更新 (HTTP ${commitRes.status})`)
    }

    const commitResult = await commitRes.json()
    ElMessage.success({
      message: `🎉 成功将 ${fileDesc} 推送到 GitHub master 分支！GitHub Actions 正在自动化构建上线！`,
      duration: 5000
    })
    console.log('GitHub Commit Succeeded:', commitResult)
  } catch (err: any) {
    ElMessage.error(`推送 GitHub 失败: ${err.message}`)
  } finally {
    isPushing.value = false
  }
}

// 4. 重置草稿
const resetDrafts = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有本地考点/资源草稿并恢复为官方原版数据吗？此操作不可逆！',
      '重置确认',
      { type: 'warning', confirmButtonText: '确认重置', cancelButtonText: '取消' }
    )
    await localDB.resetAllOfficialDrafts()
    await loadStats()
    ElMessage.success('已恢复官方原版数据，所有本地草稿已清空')
    emit('update:modelValue', false)
    setTimeout(() => window.location.reload(), 400)
  } catch {
    // cancelled
  }
}

// 5. 退出维护模式
const handleExit = () => {
  appConfig.exitMaintenanceMode()
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="🛠️ 题库与公共数据发布控制台 (Official Admin)"
    width="640px"
    destroy-on-close
    class="data-console-dialog"
  >
    <!-- 顶部状态看板 -->
    <div class="stats-overview-grid">
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div class="stat-info">
          <div class="stat-title">全科知识库考点</div>
          <div class="stat-num">{{ stats.knowledge.total }} <span>个考点</span></div>
          <div class="stat-draft-tags">
            <span v-if="stats.knowledge.modified" class="tag tag-mod">改动 {{ stats.knowledge.modified }}</span>
            <span v-if="stats.knowledge.added" class="tag tag-add">新增 {{ stats.knowledge.added }}</span>
            <span v-if="stats.knowledge.deleted" class="tag tag-del">删除 {{ stats.knowledge.deleted }}</span>
            <span v-if="!stats.knowledge.hasDraft" class="tag tag-clean">与官方一致</span>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🧰</div>
        <div class="stat-info">
          <div class="stat-title">学科在线工具箱</div>
          <div class="stat-num">{{ stats.resources.total }} <span>个资源</span></div>
          <div class="stat-draft-tags">
            <span v-if="stats.resources.modified" class="tag tag-mod">改动 {{ stats.resources.modified }}</span>
            <span v-if="stats.resources.added" class="tag tag-add">新增 {{ stats.resources.added }}</span>
            <span v-if="stats.resources.deleted" class="tag tag-del">删除 {{ stats.resources.deleted }}</span>
            <span v-if="!stats.resources.hasDraft" class="tag tag-clean">与官方一致</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 标签切换 -->
    <el-tabs v-model="activeTab" class="console-tabs">
      <!-- Tab 1: 离线导出 JSON (覆盖本地后 Git 推送) -->
      <el-tab-pane label="📦 导出官方 JSON 文件" name="export">
        <div class="tab-pane-content">
          <div class="info-callout">
            <el-icon><InfoFilled /></el-icon>
            <div class="callout-text">
              在网页上新增、修改或删除考点后，点击下方按钮下载对应 JSON 文件。覆盖到本地项目 <code>content/</code> 文件夹，运行 <code>git push origin master</code> 即可双端同步上线！
            </div>
          </div>

          <div class="export-actions-list">
            <div class="export-item-card">
              <div class="export-item-info">
                <div class="export-name">9大学科完整考点库 (knowledge.json)</div>
                <div class="export-desc">包含高中九大学科实体教材目录、核心考点精析、KaTeX 公式与思维图景</div>
              </div>
              <el-button
                type="primary"
                :icon="Download"
                :loading="isLoading"
                @click="exportKnowledge"
              >
                下载 knowledge.json
              </el-button>
            </div>

            <div class="export-item-card">
              <div class="export-item-info">
                <div class="export-name">各学科在线学习工具 (learning-resources.json)</div>
                <div class="export-desc">包含动态几何画板、分子模型、函数绘图等各学科精选外部工具</div>
              </div>
              <el-button
                type="success"
                :icon="Download"
                :loading="isLoading"
                @click="exportResources"
              >
                下载 learning-resources.json
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 2: 云端免终端直推 GitHub -->
      <el-tab-pane label="🚀 云端一键推送到 GitHub" name="github">
        <div class="tab-pane-content">
          <div class="info-callout highlight">
            <el-icon><InfoFilled /></el-icon>
            <div class="callout-text">
              <b>免终端极速发布</b>：配置 GitHub Token 后，直接在网页上改完考点一键直推 GitHub 仓库！GitHub Actions 会自动打包并发布至 <code>study.gyfolk.com</code>。
            </div>
          </div>

          <el-form label-position="top" class="github-push-form">
            <el-form-item label="GitHub Personal Access Token (PAT)">
              <el-input
                v-model="githubToken"
                type="password"
                show-password
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx (需具备 repo 权限)"
                @change="saveGithubToken"
                clearable
              >
                <template #prepend><el-icon><Key /></el-icon></template>
              </el-input>
              <div class="form-hint">Token 仅保存在当前浏览器的本地缓存中，绝不上传第三方服务器。</div>
            </el-form-item>

            <el-form-item label="提交说明 (Commit Message)">
              <el-input v-model="commitMessage" placeholder="输入本次改动的提交摘要" />
            </el-form-item>

            <div class="cloud-push-btns">
              <el-button
                type="primary"
                :icon="Upload"
                :loading="isPushing"
                @click="() => pushToGitHub('knowledge')"
              >
                🚀 一键推送 knowledge.json 到 GitHub
              </el-button>
              <el-button
                type="success"
                plain
                :icon="Upload"
                :loading="isPushing"
                @click="() => pushToGitHub('resources')"
              >
                🚀 一键推送 resources 到 GitHub
              </el-button>
            </div>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- Tab 3: 重置与退出 -->
      <el-tab-pane label="⚙️ 重置与退出" name="danger">
        <div class="tab-pane-content">
          <div class="danger-box">
            <div class="danger-title">
              <el-icon><WarningFilled /></el-icon>
              <span>草稿管理与危险操作</span>
            </div>
            <p class="danger-desc">
              如果您在维护模式下的考点改动存在偏差，想放弃未导出的本地修改，可点击下方按钮一键重置回官方种子数据：
            </p>
            <el-button type="danger" plain :icon="RefreshRight" @click="resetDrafts">
              🔄 放弃所有本地修改，恢复官方原版数据
            </el-button>
          </div>

          <div class="exit-box">
            <div class="exit-desc">完成维护后，点击此处恢复普通学生浏览界面：</div>
            <el-button type="info" :icon="SwitchButton" @click="handleExit">
              退出官方数据维护模式
            </el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭控制台</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.stats-overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: var(--bg-card, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
}

:global(.dark) .stat-card {
  background: #1e293b;
  border-color: #334155;
}

.stat-icon {
  font-size: 28px;
  line-height: 1;
}

.stat-title {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  font-weight: 500;
}

.stat-num {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

:global(.dark) .stat-num {
  color: #f1f5f9;
}

.stat-num span {
  font-size: 12px;
  font-weight: normal;
  color: var(--text-muted, #64748b);
}

.stat-draft-tags {
  margin-top: 4px;
  display: flex;
  gap: 4px;
}

.tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.tag-mod { background: #fef3c7; color: #b45309; }
.tag-add { background: #d1fae5; color: #065f46; }
.tag-del { background: #fee2e2; color: #991b1b; }
.tag-clean { background: #e2e8f0; color: #475569; }

:global(.dark) .tag-mod { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
:global(.dark) .tag-add { background: rgba(16, 185, 129, 0.2); color: #34d399; }
:global(.dark) .tag-del { background: rgba(239, 68, 68, 0.2); color: #f87171; }
:global(.dark) .tag-clean { background: #334155; color: #94a3b8; }

.tab-pane-content {
  padding: 8px 0;
}

.info-callout {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 14px;
  background: #f1f5f9;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #334155;
  margin-bottom: 16px;
}

:global(.dark) .info-callout {
  background: #1e293b;
  color: #cbd5e1;
}

.info-callout.highlight {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

:global(.dark) .info-callout.highlight {
  background: rgba(30, 64, 175, 0.2);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.3);
}

.export-actions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.export-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  background: var(--bg-card, #ffffff);
}

:global(.dark) .export-item-card {
  background: #0f172a;
  border-color: #334155;
}

.export-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #0f172a);
}

:global(.dark) .export-name {
  color: #f1f5f9;
}

.export-desc {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin-top: 2px;
}

.form-hint {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  margin-top: 4px;
}

.cloud-push-btns {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.danger-box {
  padding: 14px 16px;
  border: 1px dashed #ef4444;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.04);
  margin-bottom: 16px;
}

.danger-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #dc2626;
  margin-bottom: 6px;
}

.danger-desc {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 12px;
  line-height: 1.5;
}

:global(.dark) .danger-desc {
  color: #94a3b8;
}

.exit-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-card, #f8fafc);
  border-radius: 8px;
}

:global(.dark) .exit-box {
  background: #1e293b;
}

.exit-desc {
  font-size: 13px;
  color: var(--text-main, #334155);
}

:global(.dark) .exit-desc {
  color: #cbd5e1;
}
</style>
