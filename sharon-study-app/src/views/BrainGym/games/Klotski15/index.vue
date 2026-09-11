<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { playSlideSound, playVictoryFanfare } from '../../sound'
import { Back, RefreshRight } from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  isMuted?: boolean
}>(), {
  isMuted: false
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'record-saved', data: { gameId: string; timeMs: number }): void
}>()

type KlotskiSize = 3 | 4
const currentSize = ref<KlotskiSize>(4)

// 棋盘一维数组，0 表示空格
const tiles = ref<number[]>([])
const movesCount = ref(0)
const startTime = ref(0)
const elapsedTime = ref(0)
const isPlaying = ref(false)
const isVictory = ref(false)
let timerInterval: ReturnType<typeof setInterval> | null = null

const totalTiles = computed(() => currentSize.value * currentSize.value)

// 最佳记录：步数与时间
const bestRecordKey = computed(() => `sharon_klotski_best_${currentSize.value}x${currentSize.value}`)
const bestRecord = ref<{ moves: number; timeMs: number } | null>(null)

const loadBestRecord = () => {
  const saved = localStorage.getItem(bestRecordKey.value)
  if (saved) {
    try {
      bestRecord.value = JSON.parse(saved)
    } catch {
      bestRecord.value = null
    }
  } else {
    bestRecord.value = null
  }
}

const formatTime = (ms: number) => {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 目标终局判断：[1, 2, 3, ..., totalTiles-1, 0]
const isGoal = (arr: number[]): boolean => {
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] !== i + 1) return false
  }
  return arr[arr.length - 1] === 0
}

// 通过反向合法随机漫步洗牌，100% 确保有解
const shuffleBoard = () => {
  const n = currentSize.value
  const arr = Array.from({ length: totalTiles.value }, (_, i) => (i === totalTiles.value - 1 ? 0 : i + 1))

  let blankIdx = totalTiles.value - 1
  let lastMove = -1
  const steps = n === 3 ? 80 : 150

  for (let s = 0; s < steps; s++) {
    const row = Math.floor(blankIdx / n)
    const col = blankIdx % n
    const neighbors: number[] = []

    if (row > 0 && lastMove !== blankIdx - n) neighbors.push(blankIdx - n) // 空格往上移
    if (row < n - 1 && lastMove !== blankIdx + n) neighbors.push(blankIdx + n) // 空格往下移
    if (col > 0 && lastMove !== blankIdx - 1) neighbors.push(blankIdx - 1) // 空格往左移
    if (col < n - 1 && lastMove !== blankIdx + 1) neighbors.push(blankIdx + 1) // 空格往右移

    const chosen = neighbors[Math.floor(Math.random() * neighbors.length)]
    arr[blankIdx] = arr[chosen]
    arr[chosen] = 0
    lastMove = blankIdx
    blankIdx = chosen
  }

  // 若恰好已经是终局，再随手换一步
  if (isGoal(arr)) {
    const temp = arr[0]
    arr[0] = arr[1]
    arr[1] = temp
  }

  return arr
}

// 初始化游戏
const initGame = () => {
  if (timerInterval) clearInterval(timerInterval)
  tiles.value = shuffleBoard()
  movesCount.value = 0
  elapsedTime.value = 0
  isPlaying.value = false
  isVictory.value = false
  loadBestRecord()
}

// 切换方格尺寸 (3x3 / 4x4)
const changeSize = (size: KlotskiSize) => {
  if (currentSize.value === size) return
  currentSize.value = size
  initGame()
}

// 点击某个滑块
const handleTileClick = (idx: number) => {
  if (isVictory.value) return
  const val = tiles.value[idx]
  if (val === 0) return

  const n = currentSize.value
  const blankIdx = tiles.value.indexOf(0)

  const tileRow = Math.floor(idx / n)
  const tileCol = idx % n
  const blankRow = Math.floor(blankIdx / n)
  const blankCol = blankIdx % n

  // 必须在同行或同列
  if (tileRow !== blankRow && tileCol !== blankCol) return

  // 首次有效滑动自动开始计时
  if (!isPlaying.value) {
    isPlaying.value = true
    startTime.value = Date.now()
    timerInterval = setInterval(() => {
      elapsedTime.value = Date.now() - startTime.value
    }, 1000)
  }

  const newTiles = [...tiles.value]

  // 同行移动
  if (tileRow === blankRow) {
    const step = tileCol < blankCol ? 1 : -1
    for (let c = blankCol; c !== tileCol; c -= step) {
      newTiles[tileRow * n + c] = newTiles[tileRow * n + (c - step)]
    }
    newTiles[tileRow * n + tileCol] = 0
  }
  // 同列移动
  else {
    const step = tileRow < blankRow ? 1 : -1
    for (let r = blankRow; r !== tileRow; r -= step) {
      newTiles[r * n + tileCol] = newTiles[(r - step) * n + tileCol]
    }
    newTiles[tileRow * n + tileCol] = 0
  }

  tiles.value = newTiles
  movesCount.value++
  playSlideSound(props.isMuted)

  // 检查是否通关
  if (isGoal(tiles.value)) {
    handleWin()
  }
}

// 键盘移动支持（根据方向滑动空格相邻的滑块）
const handleKeyDown = (e: KeyboardEvent) => {
  if (isVictory.value) return
  const n = currentSize.value
  const blankIdx = tiles.value.indexOf(0)
  const bRow = Math.floor(blankIdx / n)
  const bCol = blankIdx % n

  let targetIdx = -1
  if (['ArrowUp', 'KeyW'].includes(e.code)) {
    if (bRow < n - 1) targetIdx = (bRow + 1) * n + bCol // 下方滑块向上滑入空格
  } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
    if (bRow > 0) targetIdx = (bRow - 1) * n + bCol // 上方滑块向下滑入空格
  } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
    if (bCol < n - 1) targetIdx = bRow * n + (bCol + 1) // 右侧滑块向左滑入空格
  } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
    if (bCol > 0) targetIdx = bRow * n + (bCol - 1) // 左侧滑块向右滑入空格
  }

  if (targetIdx !== -1) {
    e.preventDefault()
    handleTileClick(targetIdx)
  }
}

// 胜利通关
const handleWin = () => {
  if (timerInterval) clearInterval(timerInterval)
  isPlaying.value = false
  isVictory.value = true
  playVictoryFanfare(props.isMuted)

  const curTime = elapsedTime.value
  const curMoves = movesCount.value

  if (!bestRecord.value || curMoves < bestRecord.value.moves || (curMoves === bestRecord.value.moves && curTime < bestRecord.value.timeMs)) {
    bestRecord.value = { moves: curMoves, timeMs: curTime }
    localStorage.setItem(bestRecordKey.value, JSON.stringify(bestRecord.value))
  }

  emit('record-saved', {
    gameId: 'klotski15',
    timeMs: curTime
  })
}

// 判断滑块是否正好位于最终目标位置
const isInCorrectPosition = (val: number, idx: number): boolean => {
  return val > 0 && val === idx + 1
}

onMounted(() => {
  initGame()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="klotski-container">
    <!-- 顶部栏 -->
    <div class="game-header">
      <div class="header-left">
        <button type="button" class="back-btn" @click="emit('back')" title="返回大厅">
          <el-icon><Back /></el-icon>
          <span>大厅</span>
        </button>
        <div class="title-group">
          <span class="game-title">🔲 数字华容道</span>
          <span class="game-badge">空间重构与序列调度</span>
        </div>
      </div>

      <!-- 规格切换 -->
      <div class="size-pills">
        <button
          type="button"
          class="size-btn"
          :class="{ active: currentSize === 3 }"
          @click="changeSize(3)"
        >
          3×3 (八数推盘)
        </button>
        <button
          type="button"
          class="size-btn"
          :class="{ active: currentSize === 4 }"
          @click="changeSize(4)"
        >
          4×4 (经典15)
        </button>
      </div>

      <div class="header-right">
        <button type="button" class="restart-btn" @click="initGame" title="重新打乱">
          <el-icon><RefreshRight /></el-icon>
          <span>重开</span>
        </button>
      </div>
    </div>

    <!-- 状态指示板 -->
    <div class="metrics-bar">
      <div class="metric-card">
        <span class="m-label">👣 步数</span>
        <span class="m-val">{{ movesCount }} 步</span>
      </div>
      <div class="metric-card">
        <span class="m-label">⏱️ 用时</span>
        <span class="m-val font-mono">{{ formatTime(elapsedTime) }}</span>
      </div>
      <div class="metric-card">
        <span class="m-label">🏆 最佳记录</span>
        <span class="m-val font-mono">
          {{ bestRecord ? `${bestRecord.moves}步 / ${formatTime(bestRecord.timeMs)}` : '--' }}
        </span>
      </div>
    </div>

    <!-- 棋盘主区域 -->
    <div class="board-wrapper">
      <div
        class="klotski-board"
        :class="`size-${currentSize}`"
      >
        <button
          v-for="(val, idx) in tiles"
          :key="idx"
          type="button"
          class="tile-box"
          :class="{
            'is-blank': val === 0,
            'is-correct': isInCorrectPosition(val, idx)
          }"
          :disabled="val === 0"
          @click="handleTileClick(idx)"
        >
          <span v-if="val > 0" class="tile-val">{{ val }}</span>
          <span v-if="isInCorrectPosition(val, idx)" class="pos-dot" title="已归位"></span>
        </button>
      </div>

      <p class="control-tip">💡 支持鼠标点击滑动，或键盘方向键 ↑ ↓ ← → 控制滑块</p>
    </div>

    <!-- 胜利结算弹窗 -->
    <el-dialog
      v-model="isVictory"
      title="🎉 华容道复原成功！"
      width="400px"
      align-center
      destroy-on-close
    >
      <div class="win-dialog-content">
        <span class="win-icon">🏆</span>
        <h3 class="win-heading">空间推演 · 秩序归位！</h3>
        <div class="win-stats-card">
          <div class="row">
            <span>棋盘规格：</span>
            <b>{{ currentSize }} × {{ currentSize }}</b>
          </div>
          <div class="row">
            <span>累计步数：</span>
            <b class="highlight">{{ movesCount }} 步</b>
          </div>
          <div class="row">
            <span>总计用时：</span>
            <b>{{ formatTime(elapsedTime) }}</b>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <el-button @click="emit('back')">返回大厅</el-button>
          <el-button type="primary" @click="initGame">再来一盘</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.klotski-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 540px;
  margin: 0 auto;
  gap: 16px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  flex-wrap: wrap;
  gap: 10px;
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

.title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.game-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.game-badge {
  font-size: 11px;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
}

.size-pills {
  display: flex;
  background: var(--bg-page, #f1f5f9);
  padding: 3px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.size-btn {
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

.size-btn.active {
  background: var(--bg-card, #ffffff);
  color: #10b981;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.restart-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 12px;
  border: 1px solid #10b981;
  background: rgba(16, 185, 129, 0.08);
  color: #059669;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.restart-btn:hover {
  background: #10b981;
  color: #ffffff;
}

/* 状态指标条 */
.metrics-bar {
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr;
  gap: 10px;
  width: 100%;
}

.metric-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 8px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.m-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 2px;
}

.m-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.font-mono {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
}

/* 华容道棋盘 */
.board-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.klotski-board {
  display: grid;
  gap: 8px;
  width: 100%;
  max-width: 440px;
  aspect-ratio: 1 / 1;
  padding: 10px;
  background: var(--bg-card, #ffffff);
  border: 2px solid var(--border-color, #e2e8f0);
  border-radius: 20px;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.08);
  user-select: none;
}

.size-3 { grid-template-columns: repeat(3, 1fr); }
.size-4 { grid-template-columns: repeat(4, 1fr); }

.tile-box {
  background: var(--bg-page, #f8fafc);
  border: 2px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 26px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
}

.size-3 .tile-box {
  font-size: 36px;
  border-radius: 16px;
}

.tile-box:hover:not(:disabled) {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.06);
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
}

.tile-box:active:not(:disabled) {
  transform: scale(0.96);
}

.tile-box.is-blank {
  background: transparent;
  border: 2px dashed rgba(148, 163, 184, 0.2);
  box-shadow: none;
  cursor: default;
}

.tile-box.is-correct {
  border-color: rgba(16, 185, 129, 0.4);
}

.pos-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

.control-tip {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  margin: 0;
}

/* 结算 */
.win-dialog-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.win-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.win-heading {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0 0 16px;
}

.win-stats-card {
  width: 100%;
  background: var(--bg-page, #f8fafc);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 12px;
}

.row {
  display: flex;
  justify-content: space-between;
}

.row .highlight {
  color: #10b981;
  font-size: 16px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
