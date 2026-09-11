<script setup lang="ts">
import { Back, VideoPlay } from '@element-plus/icons-vue'
import type { GameMeta } from '../types'

defineProps<{
  game: GameMeta
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'play-schulte'): void
}>()
</script>

<template>
  <div class="stub-container">
    <button type="button" class="back-btn" @click="emit('back')">
      <el-icon><Back /></el-icon>
      <span>返回大厅</span>
    </button>

    <div class="stub-card">
      <div class="stub-icon-box" :style="{ backgroundColor: game.accentBg }">
        <span class="stub-icon">{{ game.icon }}</span>
      </div>

      <h2 class="stub-title">{{ game.name }}</h2>
      <p class="stub-sub">{{ game.subtitle }}</p>

      <div class="tags-row">
        <span v-for="t in game.tags" :key="t" class="game-tag">{{ t }}</span>
      </div>

      <div class="info-block">
        <div class="info-header">
          <span>🎯 规则与脑力锻炼目标</span>
        </div>
        <p class="info-desc">{{ game.desc }}</p>
        <div class="info-meta">
          <span>⏱️ 单局参考时长：{{ game.duration }}</span>
          <span>⚡ 挑战难度：{{ game.difficulty }}</span>
        </div>
      </div>

      <div class="status-banner">
        <span class="pulse-sparkle">✨</span>
        <span>工坊正在精心打磨中，下一款即将解锁！</span>
      </div>

      <div class="actions">
        <el-button @click="emit('back')">返回大厅</el-button>
        <el-button type="primary" :icon="VideoPlay" @click="emit('play-schulte')">
          先来一局舒尔特方格
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stub-container {
  max-width: 620px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.back-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-regular, #475569);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.back-btn:hover {
  color: #6366f1;
  border-color: #6366f1;
}

.stub-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 24px;
  padding: 36px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.stub-icon-box {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.stub-icon {
  font-size: 38px;
}

.stub-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin-bottom: 4px;
}

.stub-sub {
  font-size: 14px;
  color: var(--text-secondary, #64748b);
  margin-bottom: 16px;
}

.tags-row {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.game-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--bg-page, #f1f5f9);
  color: var(--text-regular, #475569);
}

.info-block {
  width: 100%;
  background: var(--bg-page, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 16px 20px;
  text-align: left;
  margin-bottom: 24px;
}

.info-header {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  margin-bottom: 8px;
}

.info-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-regular, #475569);
  margin-bottom: 12px;
}

.info-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  border-top: 1px dashed var(--border-color, #e2e8f0);
  padding-top: 10px;
}

.status-banner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
  padding: 8px 16px;
  border-radius: 20px;
  margin-bottom: 24px;
}

.actions {
  display: flex;
  gap: 12px;
}
</style>
