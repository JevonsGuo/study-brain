<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { localDB } from '../utils/localDatabase'
import { useAppConfigStore } from '../stores/appConfig'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Download,
  RefreshRight,
  SwitchButton,
  InfoFilled,
  FolderChecked
} from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const appConfig = useAppConfigStore()

const isLoading = ref(false)
const stats = ref<any>({
  knowledge: { total: 0, modified: 0, added: 0, deleted: 0, hasDraft: false },
  resources: { total: 0, modified: 0, added: 0, deleted: 0, hasDraft: false }
})

const loadStats = async () => {
  try {
    stats.value = await localDB.getDraftStats()
  } catch (err) {
    console.warn('获取草稿统计失败', err)
  }
}

onMounted(() => {
  loadStats()
})

watch(() => props.modelValue, (val) => {
  if (val) {
    loadStats()
  }
})

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
    ElMessage.success('已下载完整 knowledge.json！如未自动写回，可直接覆盖项目的 content/ 目录')
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
    ElMessage.success('已下载完整 learning-resources.json！如未自动写回，可直接覆盖项目的 content/ 目录')
  } catch (err: any) {
    ElMessage.error(`导出失败: ${err.message || '未知错误'}`)
  } finally {
    isLoading.value = false
  }
}

// 3. 重置草稿
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

// 4. 退出维护模式
const handleExit = () => {
  appConfig.exitMaintenanceMode()
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="🛠️ 官方题库维护与数据管理控制台"
    width="580px"
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
            <span v-if="!stats.knowledge.hasDraft" class="tag tag-clean">与当前一致</span>
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
            <span v-if="!stats.resources.hasDraft" class="tag tag-clean">与当前一致</span>
          </div>
        </div>
      </div>
    </div>

    <!-- IDE 源码管理联动指引 -->
    <div class="ide-sync-banner">
      <div class="banner-title-row">
        <el-icon><FolderChecked /></el-icon>
        <span>⚡ IDE Source Control 自动化直写流程</span>
      </div>
      <p class="banner-desc">
        当您通过 <code>./scripts/dev.sh</code> 启动本地服务时：在页面上点击<b>【保存考点】</b>、<b>【删除考点】</b>或<b>【修改学习资源】</b>后，系统已<b>自动秒级直接写回项目本地的 <code>content/knowledge.json</code> 与 <code>content/learning-resources.json</code></b>！
      </p>
      <div class="ide-step-badges">
        <span class="step-badge">1. 页面直接编辑保存</span>
        <span class="step-arrow">➔</span>
        <span class="step-badge">2. 后台 JSON 秒级自动写回</span>
        <span class="step-arrow">➔</span>
        <span class="step-badge active">3. 在 IDE Source Control 中审查 Diff 并 Commit 提交</span>
      </div>
    </div>

    <!-- 手动备用导出卡片 -->
    <div class="manual-export-box">
      <div class="manual-title">
        <el-icon><InfoFilled /></el-icon>
        <span>手动备用另存（支持离线备份与多端覆盖）</span>
      </div>
      <div class="export-btns-row">
        <el-button
          type="primary"
          plain
          :icon="Download"
          :loading="isLoading"
          @click="exportKnowledge"
        >
          下载 knowledge.json
        </el-button>
        <el-button
          type="success"
          plain
          :icon="Download"
          :loading="isLoading"
          @click="exportResources"
        >
          下载 learning-resources.json
        </el-button>
      </div>
    </div>

    <!-- 危险操作与退出 -->
    <div class="danger-zone">
      <div class="danger-row">
        <span class="danger-tip">重置回官方种子初始状态：</span>
        <el-button type="danger" plain size="small" :icon="RefreshRight" @click="resetDrafts">
          放弃修改并重置
        </el-button>
      </div>
      <div class="danger-row">
        <span class="danger-tip">退出管理员编辑状态（隐藏所有编辑按钮）：</span>
        <el-button type="info" plain size="small" :icon="SwitchButton" @click="handleExit">
          退出官方维护模式
        </el-button>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">返回页面继续编辑</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.stats-overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-card, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
}

:global(.dark) .stat-card {
  background: #1e293b;
  border-color: #334155;
}

.stat-icon {
  font-size: 26px;
  line-height: 1;
}

.stat-title {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  font-weight: 500;
}

.stat-num {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

:global(.dark) .stat-num {
  color: #f1f5f9;
}

.stat-num span {
  font-size: 11px;
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

.ide-sync-banner {
  padding: 14px 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  margin-bottom: 14px;
}

:global(.dark) .ide-sync-banner {
  background: rgba(22, 101, 52, 0.2);
  border-color: rgba(34, 197, 94, 0.35);
}

.banner-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #15803d;
  margin-bottom: 6px;
}

:global(.dark) .banner-title-row {
  color: #4ade80;
}

.banner-desc {
  font-size: 12px;
  line-height: 1.6;
  color: #166534;
  margin: 0 0 10px;
}

:global(.dark) .banner-desc {
  color: #86efac;
}

.banner-desc code {
  background: rgba(0, 0, 0, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
}

.ide-step-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
}

.step-badge {
  padding: 3px 8px;
  background: #ffffff;
  border: 1px solid #86efac;
  border-radius: 6px;
  color: #15803d;
  font-weight: 600;
}

:global(.dark) .step-badge {
  background: #0f172a;
  border-color: #22c55e;
  color: #86efac;
}

.step-badge.active {
  background: #15803d;
  color: #ffffff;
  border-color: #15803d;
}

:global(.dark) .step-badge.active {
  background: #22c55e;
  color: #0f172a;
}

.step-arrow {
  color: #86efac;
  font-weight: bold;
}

.manual-export-box {
  padding: 12px 14px;
  background: var(--bg-card, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  margin-bottom: 14px;
}

:global(.dark) .manual-export-box {
  background: #1e293b;
  border-color: #334155;
}

.manual-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted, #64748b);
  margin-bottom: 8px;
}

.export-btns-row {
  display: flex;
  gap: 10px;
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(239, 68, 68, 0.03);
  border: 1px dashed rgba(239, 68, 68, 0.3);
  border-radius: 10px;
}

.danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.danger-tip {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}
</style>
