<script setup lang="ts">
import { useAppVersionStore } from '../stores/appVersion'
import { RefreshRight, Close, Lightning } from '@element-plus/icons-vue'

const appVersionStore = useAppVersionStore()

/**
 * 格式化为精确北京时间 (UTC+8 / Asia/Shanghai)
 * 优先依据绝对时间戳 (buildTimestamp) 进行标准时区换算，
 * 兜底解析 buildTime 字符串，确保跨设备、跨时区或 CI 构建环境下均精准显示北京时间。
 */
const formatBeijingDateTime = (timeStr?: string, timestamp?: number): string => {
  if (timestamp && typeof timestamp === 'number' && !isNaN(timestamp) && timestamp > 0) {
    try {
      const d = new Date(timestamp)
      const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      const parts = formatter.formatToParts(d)
      const map: Record<string, string> = {}
      for (const p of parts) map[p.type] = p.value
      return `${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`
    } catch {}
  }

  if (!timeStr) return '--'
  const clean = timeStr.trim().slice(5)
  return clean || '--'
}
</script>

<template>
  <el-dialog
    v-model="appVersionStore.showUpdateModal"
    title=""
    width="480px"
    align-center
    destroy-on-close
    :show-close="true"
    :before-close="appVersionStore.dismissUpdate"
    class="app-update-dialog"
  >
    <div class="update-modal-body">
      <!-- 顶部徽章与动效图标 -->
      <div class="update-hero-icon-box">
        <div class="icon-ambient-glow"></div>
        <div class="icon-circle">
          <span class="rocket-emoji">🚀</span>
        </div>
      </div>

      <!-- 核心升级标题与提问 -->
      <div class="update-header-info">
        <div class="update-badge-pill">
          <el-icon><Lightning /></el-icon>
          <span>全新版本现已上线</span>
        </div>
        <h2 class="update-main-title">发现新版本发布</h2>
        <p class="update-question-text">
          智学大脑已在云端发布全新优化版本，是否立即刷新页面进行升级？
        </p>
      </div>

      <!-- 版本对照卡片 -->
      <div class="version-comparison-deck">
        <div class="version-cell current-cell">
          <span class="cell-label">当前运行版本</span>
          <span class="cell-version">v{{ appVersionStore.currentVersion }}</span>
          <span class="cell-time">构建于 {{ formatBeijingDateTime(appVersionStore.currentBuildTime, appVersionStore.currentTimestamp) }}</span>
          <span class="cell-tz-badge">北京时间</span>
        </div>

        <div class="version-arrow-divider">
          <span class="arrow-symbol">➜</span>
          <span
            v-if="appVersionStore.remoteBuildInfo?.version === appVersionStore.currentVersion"
            class="update-kind-chip"
            title="同一大版本下的日常补丁与内容更新"
          >
            补丁升级
          </span>
          <span v-else class="update-kind-chip highlight" title="版本号自增升级">
            新版升级
          </span>
        </div>

        <div class="version-cell target-cell">
          <span class="cell-label">最新已发布版本</span>
          <span class="cell-version highlight">
            v{{ appVersionStore.remoteBuildInfo?.version || '最新' }}
          </span>
          <span class="cell-time highlight">
            发布于 {{ formatBeijingDateTime(appVersionStore.remoteBuildInfo?.buildTime, appVersionStore.remoteBuildInfo?.buildTimestamp) }}
          </span>
          <span class="cell-tz-badge highlight">北京时间</span>
        </div>
      </div>

      <!-- 数据安全提示 -->
      <div class="update-safety-tip">
        <span class="tip-icon">🛡️</span>
        <div class="tip-content">
          <strong>数据绝对安全保证：</strong>
          刷新仅重新载入最新前端页面资源，您的所有自选科目、错题笔记、打卡专注与背诵进度严格保存在您自己的本地设备中，不会有任何丢失。
        </div>
      </div>
    </div>

    <template #footer>
      <div class="update-footer-actions">
        <el-button
          size="large"
          class="btn-cancel-update"
          :icon="Close"
          @click="appVersionStore.dismissUpdate"
        >
          取消升级
        </el-button>
        <el-button
          type="primary"
          size="large"
          class="btn-confirm-update"
          :icon="RefreshRight"
          :loading="appVersionStore.isReloading"
          @click="appVersionStore.applyUpdate"
        >
          {{ appVersionStore.isReloading ? '正在刷新升级...' : '确定升级' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
:deep(.app-update-dialog) {
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-color, #e2e8f0);
}

:deep(.app-update-dialog .el-dialog__header) {
  display: none;
}

:deep(.app-update-dialog .el-dialog__body) {
  padding: 30px 26px 16px;
}

:deep(.app-update-dialog .el-dialog__footer) {
  padding: 0 26px 26px;
  border-top: none;
}

.update-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
}

/* 顶部光环与火箭图标 */
.update-hero-icon-box {
  position: relative;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-ambient-glow {
  position: absolute;
  inset: -10px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, rgba(139, 92, 246, 0) 70%);
  border-radius: 50%;
  animation: glow-pulse 3s infinite ease-in-out;
}

.icon-circle {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
}

.rocket-emoji {
  font-size: 32px;
  animation: rocket-bounce 2s infinite ease-in-out;
}

@keyframes rocket-bounce {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-4px) rotate(4deg);
  }
}

@keyframes glow-pulse {
  0%, 100% {
    transform: scale(0.9);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.15);
    opacity: 1;
  }
}

/* 标题与描述 */
.update-header-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.update-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.update-main-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  letter-spacing: -0.3px;
}

.update-question-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted, #64748b);
  line-height: 1.5;
  max-width: 380px;
}

/* 版本对照卡片 */
.version-comparison-deck {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--bg-page, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 12px 18px;
  gap: 12px;
}

.version-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.cell-label {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  font-weight: 600;
}

.cell-version {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main, #334155);
}

.cell-version.highlight {
  color: #2563eb;
  font-weight: 800;
}

.cell-time {
  font-size: 11px;
  color: #94a3b8;
}

.cell-time.highlight {
  color: #0284c7;
  font-weight: 600;
}

.cell-tz-badge {
  display: inline-block;
  font-size: 10px;
  color: #64748b;
  background: rgba(100, 116, 139, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  margin-top: 2px;
  letter-spacing: 0.2px;
}

.cell-tz-badge.highlight {
  color: #0284c7;
  background: rgba(2, 132, 199, 0.1);
  font-weight: 700;
}

.version-arrow-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 18px;
  color: #3b82f6;
  font-weight: 800;
  padding: 0 4px;
}

.update-kind-chip {
  font-size: 10px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e2e8f0;
  color: #475569;
  font-weight: 700;
  white-space: nowrap;
}

.update-kind-chip.highlight {
  background: #dbeafe;
  color: #1d4ed8;
}

:global(.dark) .update-kind-chip {
  background: #1e293b;
  color: #94a3b8;
}

:global(.dark) .update-kind-chip.highlight {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}

/* 安全提示 */
.update-safety-tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 10px 14px;
  text-align: left;
  width: 100%;
}

.tip-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.tip-content {
  font-size: 12px;
  color: #166534;
  line-height: 1.5;
}

.tip-content strong {
  color: #14532d;
}

/* 底部操作按钮 */
.update-footer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.btn-cancel-update {
  flex: 1;
  border-radius: 12px;
  font-weight: 600;
  color: #64748b;
  border-color: #cbd5e1;
}

.btn-cancel-update:hover {
  color: #334155;
  border-color: #94a3b8;
  background: #f8fafc;
}

.btn-confirm-update {
  flex: 1.4;
  border-radius: 12px;
  font-weight: 700;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border: none;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
  transition: all 0.2s ease;
}

.btn-confirm-update:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
}

/* 暗色模式适配 */
:global(.dark) :deep(.app-update-dialog) {
  background: #131b2e;
  border-color: #1e293b;
}

:global(.dark) .update-main-title {
  color: #f8fafc;
}

:global(.dark) .version-comparison-deck {
  background: #0b1120;
  border-color: #1e293b;
}

:global(.dark) .cell-version {
  color: #f8fafc;
}

:global(.dark) .update-safety-tip {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.25);
}

:global(.dark) .tip-content {
  color: #86efac;
}

:global(.dark) .btn-cancel-update {
  background: #0b1120;
  border-color: #334155;
  color: #94a3b8;
}

:global(.dark) .btn-cancel-update:hover {
  background: #1e293b;
  color: #f8fafc;
}

:global(.dark) .cell-tz-badge {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}

:global(.dark) .cell-tz-badge.highlight {
  background: rgba(2, 132, 199, 0.2);
  color: #38bdf8;
}

@media (max-width: 640px) {
  :deep(.app-update-dialog) {
    width: 92% !important;
    max-width: 380px !important;
  }
  :deep(.app-update-dialog .el-dialog__body) {
    padding: 24px 16px 14px !important;
  }
  :deep(.app-update-dialog .el-dialog__footer) {
    padding: 0 16px 20px !important;
  }
  .version-comparison-deck {
    padding: 10px 8px;
    gap: 6px;
  }
  .cell-time {
    font-size: 10px;
  }
}
</style>
