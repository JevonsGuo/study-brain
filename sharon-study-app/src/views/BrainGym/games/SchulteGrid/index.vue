<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { playTileClick, playWrongTile, playVictoryFanfare } from '../../sound'
import { RefreshRight, Back } from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  isMuted?: boolean
}>(), {
  isMuted: false
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'record-saved', data: { gameId: string; timeMs: number }): void
}>()

// 模式：3x3, 5x5, 6x6
type GridSize = 3 | 5 | 6
const currentSize = ref<GridSize>(5)

interface Tile {
  id: number
  value: number
  isClicked: boolean
  isWrong: boolean
}

const tiles = ref<Tile[]>([])
const currentTarget = ref(1)
const gameState = ref<'ready' | 'playing' | 'completed'>('ready')
const startTime = ref(0)
const elapsedTime = ref(0)
const mistakes = ref(0)
const showVictoryModal = ref(false)
const isNewRecord = ref(false)

let timerInterval: ReturnType<typeof setInterval> | null = null

const totalCount = computed(() => currentSize.value * currentSize.value)

// 最佳纪录（按模式存储于 localStorage）
const bestRecordKey = computed(() => `study_schulte_best_${currentSize.value}x${currentSize.value}`)
const bestTimeMs = ref<number | null>(null)

const loadBestRecord = () => {
  const saved = localStorage.getItem(bestRecordKey.value) || localStorage.getItem(`sharon_schulte_best_${currentSize.value}x${currentSize.value}`)
  bestTimeMs.value = saved ? Number(saved) : null
}

// 格式化用时：分:秒.毫秒
const formatTime = (ms: number) => {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const millis = Math.floor((ms % 1000) / 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(millis).padStart(2, '0')}`
}

const formatSecondsOnly = (ms: number) => {
  return (ms / 1000).toFixed(2)
}

// 洗牌算法
const shuffleArray = <T>(arr: T[]): T[] => {
  const res = [...arr]
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[res[i], res[j]] = [res[j], res[i]]
  }
  return res
}

// 初始化棋盘
const initGame = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  gameState.value = 'ready'
  currentTarget.value = 1
  elapsedTime.value = 0
  mistakes.value = 0
  showVictoryModal.value = false
  isNewRecord.value = false

  const numbers = Array.from({ length: totalCount.value }, (_, i) => i + 1)
  const shuffled = shuffleArray(numbers)

  tiles.value = shuffled.map((val, idx) => ({
    id: idx,
    value: val,
    isClicked: false,
    isWrong: false
  }))

  loadBestRecord()
}

// 切换方格尺寸
const changeSize = (size: GridSize) => {
  if (currentSize.value === size) return
  currentSize.value = size
  initGame()
}

// 点击方格
const handleTileClick = (tile: Tile) => {
  if (tile.isClicked || gameState.value === 'completed') return

  // 点击数字 1 时自动开启计时
  if (gameState.value === 'ready') {
    if (tile.value === 1) {
      gameState.value = 'playing'
      startTime.value = Date.now()
      timerInterval = setInterval(() => {
        elapsedTime.value = Date.now() - startTime.value
      }, 30)
    } else {
      // 提示必须从 1 开始
      triggerWrongTile(tile)
      return
    }
  }

  // 判断是否点中了当前目标数字
  if (tile.value === currentTarget.value) {
    tile.isClicked = true
    playTileClick(props.isMuted, currentTarget.value)

    if (currentTarget.value === totalCount.value) {
      // 顺利通关！
      handleGameWin()
    } else {
      currentTarget.value++
    }
  } else {
    triggerWrongTile(tile)
  }
}

// 误点反馈
const triggerWrongTile = (tile: Tile) => {
  mistakes.value++
  tile.isWrong = true
  playWrongTile(props.isMuted)
  setTimeout(() => {
    tile.isWrong = false
  }, 400)
}

// 通关结算
const handleGameWin = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  elapsedTime.value = Date.now() - startTime.value
  gameState.value = 'completed'
  playVictoryFanfare(props.isMuted)

  // 记录判定
  const curMs = elapsedTime.value
  if (!bestTimeMs.value || curMs < bestTimeMs.value) {
    isNewRecord.value = true
    bestTimeMs.value = curMs
    localStorage.setItem(bestRecordKey.value, String(curMs))
  }

  // 触发上层记录保存
  emit('record-saved', {
    gameId: 'schulte',
    timeMs: curMs
  })

  showVictoryModal.value = true
}

// 专注力评级判定
const focusGrade = computed(() => {
  const sec = elapsedTime.value / 1000
  if (currentSize.value === 3) {
    if (sec <= 5) return { label: '🚀 神级视幅', color: '#8b5cf6', desc: '极其敏锐的广域视觉！' }
    if (sec <= 8) return { label: '🌟 卓越敏捷', color: '#10b981', desc: '眼疾手快，注意力高度集中！' }
    return { label: '💡 良好专注', color: '#3b82f6', desc: '状态良好，继续挑战5x5吧！' }
  } else if (currentSize.value === 5) {
    if (sec <= 20) return { label: '🚀 飞行员级视幅', color: '#8b5cf6', desc: '达到了顶级飞行员与特种视神经水平！' }
    if (sec <= 28) return { label: '🌟 学霸级专注', color: '#10b981', desc: '大脑处于极高运转速率的心流状态！' }
    if (sec <= 40) return { label: '💡 敏捷锐利', color: '#3b82f6', desc: '视野宽广，疲劳感一扫而空！' }
    return { label: '🌱 暖脑完成', color: '#f59e0b', desc: '大脑已被成功唤醒，可以继续攻坚！' }
  } else {
    if (sec <= 35) return { label: '🚀 超维视神经', color: '#8b5cf6', desc: '不可思议的广角空间扫描力！' }
    if (sec <= 50) return { label: '🌟 大师专注', color: '#10b981', desc: '顶尖视野把控，专注如炬！' }
    return { label: '💡 良好通关', color: '#3b82f6', desc: '成功克服高密度信息干扰！' }
  }
})

onMounted(() => {
  initGame()
})

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})
</script>

<template>
  <div class="schulte-game-container">
    <!-- 顶部状态与控制栏 -->
    <div class="schulte-header">
      <div class="header-left">
        <button type="button" class="back-btn" @click="emit('back')" title="返回游戏大厅">
          <el-icon><Back /></el-icon>
          <span>大厅</span>
        </button>
        <div class="game-info">
          <span class="game-title">⚡ 舒尔特方格</span>
          <span class="game-badge">视幅与专注力激活</span>
        </div>
      </div>

      <!-- 尺寸模式切换 -->
      <div class="size-segmented">
        <button
          type="button"
          class="seg-btn"
          :class="{ active: currentSize === 3 }"
          @click="changeSize(3)"
        >
          3×3 (热身)
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ active: currentSize === 5 }"
          @click="changeSize(5)"
        >
          5×5 (标准)
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ active: currentSize === 6 }"
          @click="changeSize(6)"
        >
          6×6 (大师)
        </button>
      </div>

      <div class="header-right">
        <button type="button" class="restart-btn" @click="initGame" title="重新打乱">
          <el-icon><RefreshRight /></el-icon>
          <span>重开</span>
        </button>
      </div>
    </div>

    <!-- 舞台指标卡片 -->
    <div class="schulte-metrics-bar">
      <!-- 目标数字引导卡 -->
      <div class="metric-card target-card">
        <span class="metric-label">寻找目标</span>
        <div class="target-badge-glow">
          <span class="target-num">{{ currentTarget }}</span>
          <span class="target-sub">/ {{ totalCount }}</span>
        </div>
      </div>

      <!-- 实时计时器 -->
      <div class="metric-card timer-card">
        <span class="metric-label">
          <span v-if="gameState === 'playing'" class="pulse-dot"></span>
          当前用时
        </span>
        <span class="timer-display" :class="{ 'is-running': gameState === 'playing' }">
          {{ formatTime(elapsedTime) }}
        </span>
      </div>

      <!-- 最佳记录 -->
      <div class="metric-card best-card">
        <span class="metric-label">历史最佳</span>
        <span class="best-display">
          {{ bestTimeMs ? formatSecondsOnly(bestTimeMs) + ' s' : '--' }}
        </span>
      </div>
    </div>

    <!-- 舒尔特主方格棋盘 -->
    <div class="board-wrapper">
      <div
        class="schulte-grid"
        :class="`grid-${currentSize}x${currentSize}`"
      >
        <button
          v-for="tile in tiles"
          :key="tile.id"
          type="button"
          class="grid-tile"
          :class="{
            'is-clicked': tile.isClicked,
            'is-wrong': tile.isWrong,
            'is-target': !tile.isClicked && tile.value === currentTarget && gameState === 'ready'
          }"
          :disabled="tile.isClicked"
          @click="handleTileClick(tile)"
        >
          <span class="tile-number">{{ tile.value }}</span>
          <span v-if="tile.isClicked" class="tile-check">✓</span>
        </button>
      </div>

      <div v-if="gameState === 'ready'" class="start-hint">
        <span>👉 点击数字 <b>1</b> 立即开始极速扫描</span>
      </div>
    </div>

    <!-- 胜利结算弹窗 -->
    <el-dialog
      v-model="showVictoryModal"
      title="🎉 专注力训练达成！"
      width="420px"
      align-center
      destroy-on-close
      class="victory-dialog"
    >
      <div class="victory-content">
        <div class="victory-trophy-box">
          <span class="trophy-emoji">🏆</span>
          <div v-if="isNewRecord" class="new-record-ribbon">NEW RECORD!</div>
        </div>

        <div class="grade-badge" :style="{ backgroundColor: focusGrade.color }">
          {{ focusGrade.label }}
        </div>
        <p class="grade-desc">{{ focusGrade.desc }}</p>

        <div class="score-summary-grid">
          <div class="summary-item">
            <span class="sum-label">最终用时</span>
            <span class="sum-val highlight">{{ formatSecondsOnly(elapsedTime) }} 秒</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">误点次数</span>
            <span class="sum-val">{{ mistakes }} 次</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">方格规格</span>
            <span class="sum-val">{{ currentSize }} × {{ currentSize }}</span>
          </div>
          <div class="summary-item">
            <span class="sum-label">历史最佳</span>
            <span class="sum-val">{{ bestTimeMs ? formatSecondsOnly(bestTimeMs) + ' 秒' : '--' }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-actions">
          <el-button @click="emit('back')">返回大厅</el-button>
          <el-button type="primary" @click="initGame">再来一局 (空格/回车)</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.schulte-game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 720px;
  margin: 0 auto;
  gap: 20px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 顶部栏 */
.schulte-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
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

.game-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.game-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.game-badge {
  font-size: 11px;
  background: rgba(234, 179, 8, 0.12);
  color: #d97706;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
}

/* 尺寸分段按钮 */
.size-segmented {
  display: flex;
  background: var(--bg-page, #f1f5f9);
  padding: 3px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.seg-btn {
  border: none;
  background: transparent;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.2s;
}

.seg-btn.active {
  background: var(--bg-card, #ffffff);
  color: #6366f1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.restart-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 12px;
  border: 1px solid #6366f1;
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.restart-btn:hover {
  background: #6366f1;
  color: #ffffff;
}

/* 舞台指标卡 */
.schulte-metrics-bar {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 12px;
  width: 100%;
}

.metric-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.metric-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 1s infinite alternate;
}

.target-badge-glow {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.target-num {
  font-size: 26px;
  font-weight: 800;
  color: #eab308;
  line-height: 1;
}

.target-sub {
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
}

.timer-display {
  font-size: 24px;
  font-weight: 800;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  color: var(--text-main, #0f172a);
}

.timer-display.is-running {
  color: #6366f1;
}

.best-display {
  font-size: 20px;
  font-weight: 700;
  color: #10b981;
}

/* 舒尔特棋盘 */
.board-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.schulte-grid {
  display: grid;
  gap: 8px;
  width: 100%;
  max-width: 520px;
  aspect-ratio: 1 / 1;
  padding: 10px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 20px;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.06);
  user-select: none;
}

.grid-3x3 { grid-template-columns: repeat(3, 1fr); }
.grid-5x5 { grid-template-columns: repeat(5, 1fr); }
.grid-6x6 { grid-template-columns: repeat(6, 1fr); }

.grid-tile {
  background: var(--bg-page, #f8fafc);
  border: 2px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.grid-3x3 .grid-tile { font-size: 32px; border-radius: 16px; }
.grid-5x5 .grid-tile { font-size: 22px; border-radius: 12px; }
.grid-6x6 .grid-tile { font-size: 18px; border-radius: 10px; }

.grid-tile:hover:not(:disabled) {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.04);
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.15);
}

.grid-tile:active:not(:disabled) {
  transform: scale(0.96);
}

.grid-tile.is-target {
  border-color: #eab308;
  background: rgba(234, 179, 8, 0.08);
  box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.3);
}

.grid-tile.is-clicked {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.3);
  color: rgba(16, 185, 129, 0.4);
  transform: scale(0.94);
  cursor: default;
}

.tile-check {
  position: absolute;
  font-size: 14px;
  color: #10b981;
  top: 4px;
  right: 6px;
}

.grid-tile.is-wrong {
  animation: shake 0.35s ease;
  border-color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.12) !important;
  color: #ef4444 !important;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

.start-hint {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  animation: pulse 1.5s infinite alternate;
}

/* 结算弹窗 */
.victory-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 10px 0;
}

.victory-trophy-box {
  position: relative;
  margin-bottom: 8px;
}

.trophy-emoji {
  font-size: 54px;
  display: inline-block;
  animation: bounce 1s infinite alternate;
}

@keyframes bounce {
  0% { transform: translateY(0); }
  100% { transform: translateY(-8px); }
}

.new-record-ribbon {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 10px;
  position: absolute;
  bottom: -4px;
  right: -20px;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
}

.grade-badge {
  color: #ffffff;
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.grade-desc {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  margin-bottom: 20px;
}

.score-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
  background: var(--bg-page, #f8fafc);
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sum-label {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

.sum-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.sum-val.highlight {
  color: #6366f1;
  font-size: 18px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
}
</style>
