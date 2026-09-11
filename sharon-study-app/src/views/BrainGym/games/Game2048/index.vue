<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { playSlideSound, playMergeSound, playVictoryFanfare, playWrongTile } from '../../sound'
import { Back, RefreshRight, Top, Bottom, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  isMuted?: boolean
}>(), {
  isMuted: false
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'record-saved', data: { gameId: string; timeMs: number }): void
}>()

const GRID_SIZE = 4

// 4x4 网格二维数组
const board = ref<number[][]>([])
const score = ref(0)
const bestScore = ref(0)
const isGameOver = ref(false)
const hasWon2048 = ref(false)
const continuePlayingAfterWin = ref(false)

// 撤回一步状态缓存
const prevBoard = ref<number[][] | null>(null)
const prevScore = ref<number>(0)
const canUndo = ref(false)

// 开始时间与计时
const startTime = ref(0)

const BEST_SCORE_KEY = 'sharon_2048_best_score'

const loadBestScore = () => {
  const saved = localStorage.getItem(BEST_SCORE_KEY)
  bestScore.value = saved ? Number(saved) : 0
}

const saveBestScore = () => {
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore.value))
    emit('record-saved', {
      gameId: 'game2048',
      timeMs: Date.now() - startTime.value
    })
  }
}

// 初始化空棋盘
const createEmptyBoard = (): number[][] => {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
}

// 寻找空单元格
const getEmptyCells = (b: number[][]): { r: number; c: number }[] => {
  const empty: { r: number; c: number }[] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (b[r][c] === 0) empty.push({ r, c })
    }
  }
  return empty
}

// 随机在一个空单元格生成 2 或 4
const spawnRandomTile = (b: number[][]) => {
  const empty = getEmptyCells(b)
  if (empty.length === 0) return
  const randCell = empty[Math.floor(Math.random() * empty.length)]
  b[randCell.r][randCell.c] = Math.random() < 0.9 ? 2 : 4
}

// 复制棋盘
const cloneBoard = (b: number[][]): number[][] => {
  return b.map(row => [...row])
}

// 新游戏
const startNewGame = () => {
  board.value = createEmptyBoard()
  score.value = 0
  isGameOver.value = false
  hasWon2048.value = false
  continuePlayingAfterWin.value = false
  canUndo.value = false
  prevBoard.value = null
  startTime.value = Date.now()

  spawnRandomTile(board.value)
  spawnRandomTile(board.value)
  loadBestScore()
}

// 撤回一步
const handleUndo = () => {
  if (!canUndo.value || !prevBoard.value) return
  board.value = cloneBoard(prevBoard.value)
  score.value = prevScore.value
  canUndo.value = false
  isGameOver.value = false
  playSlideSound(props.isMuted)
}

// 单行向左滑动合并逻辑
const slideRowLeft = (row: number[]): { newRow: number[]; gainedScore: number; mergedValues: number[] } => {
  // 1. 过滤掉 0
  const nonZero = row.filter(val => val !== 0)
  const newRow: number[] = []
  const mergedValues: number[] = []
  let gainedScore = 0

  let i = 0
  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      const mergedVal = nonZero[i] * 2
      newRow.push(mergedVal)
      mergedValues.push(mergedVal)
      gainedScore += mergedVal
      i += 2
    } else {
      newRow.push(nonZero[i])
      i += 1
    }
  }

  // 补齐 0
  while (newRow.length < GRID_SIZE) {
    newRow.push(0)
  }

  return { newRow, gainedScore, mergedValues }
}

// 旋转棋盘：顺时针 90 度
const rotateClockwise = (b: number[][]): number[][] => {
  const res = createEmptyBoard()
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      res[c][GRID_SIZE - 1 - r] = b[r][c]
    }
  }
  return res
}

// 4 方向统一滑动处理
type Direction = 'left' | 'right' | 'up' | 'down'

const move = (dir: Direction) => {
  if (isGameOver.value) return

  // 备份当前状态以支持撤回
  const backupBoard = cloneBoard(board.value)
  const backupScore = score.value

  let rotated = cloneBoard(board.value)
  let rotations = 0

  // 统一通过旋转转化为向左滑动
  if (dir === 'up') {
    rotated = rotateClockwise(rotateClockwise(rotateClockwise(rotated))) // 270度
    rotations = 1
  } else if (dir === 'right') {
    rotated = rotateClockwise(rotateClockwise(rotated)) // 180度
    rotations = 2
  } else if (dir === 'down') {
    rotated = rotateClockwise(rotated) // 90度
    rotations = 3
  }

  let moved = false
  let turnScore = 0
  let maxMergedVal = 0

  for (let r = 0; r < GRID_SIZE; r++) {
    const { newRow, gainedScore, mergedValues } = slideRowLeft(rotated[r])
    if (newRow.some((val, idx) => val !== rotated[r][idx])) {
      moved = true
    }
    rotated[r] = newRow
    turnScore += gainedScore
    if (mergedValues.length > 0) {
      maxMergedVal = Math.max(maxMergedVal, ...mergedValues)
    }
  }

  // 逆旋转还原
  const backRotations = (4 - rotations) % 4
  for (let k = 0; k < backRotations; k++) {
    rotated = rotateClockwise(rotated)
  }

  if (moved) {
    prevBoard.value = backupBoard
    prevScore.value = backupScore
    canUndo.value = true

    board.value = rotated
    score.value += turnScore
    saveBestScore()

    // 播放音效
    if (maxMergedVal > 0) {
      playMergeSound(props.isMuted, maxMergedVal)
      if (maxMergedVal >= 2048 && !hasWon2048.value && !continuePlayingAfterWin.value) {
        hasWon2048.value = true
        playVictoryFanfare(props.isMuted)
      }
    } else {
      playSlideSound(props.isMuted)
    }

    // 随机生成一个新块
    spawnRandomTile(board.value)

    // 检查是否 Game Over
    checkGameOver()
  }
}

// 检查是否无法再移动
const checkGameOver = () => {
  // 如果还有空格子，肯定没结束
  if (getEmptyCells(board.value).length > 0) return

  // 检查横向或纵向相邻是否有相同数字
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = board.value[r][c]
      if (c + 1 < GRID_SIZE && val === board.value[r][c + 1]) return
      if (r + 1 < GRID_SIZE && val === board.value[r + 1][c]) return
    }
  }

  isGameOver.value = true
  playWrongTile(props.isMuted)
}

// 键盘按键监听
const handleKeyDown = (e: KeyboardEvent) => {
  if (['ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault()
    move('up')
  } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
    e.preventDefault()
    move('down')
  } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
    e.preventDefault()
    move('left')
  } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
    e.preventDefault()
    move('right')
  } else if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    handleUndo()
  }
}

// 触摸手势滑动支持
let touchStartX = 0
let touchStartY = 0

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  if (e.changedTouches.length === 1) {
    const deltaX = e.changedTouches[0].clientX - touchStartX
    const deltaY = e.changedTouches[0].clientY - touchStartY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (Math.max(absX, absY) > 30) {
      if (absX > absY) {
        move(deltaX > 0 ? 'right' : 'left')
      } else {
        move(deltaY > 0 ? 'down' : 'up')
      }
    }
  }
}

// 方块颜色字典 (现代精美渐变调色板)
const getTileClass = (val: number) => {
  if (val === 0) return 'tile-empty'
  return `tile-${val}`
}

onMounted(() => {
  startNewGame()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="game2048-container">
    <!-- 顶部工坊控制栏 -->
    <div class="game-header">
      <div class="header-left">
        <button type="button" class="back-btn" @click="emit('back')" title="返回大厅">
          <el-icon><Back /></el-icon>
          <span>大厅</span>
        </button>
        <div class="title-group">
          <span class="game-title">🔢 2048</span>
          <span class="game-badge">数字合成与空间推演</span>
        </div>
      </div>

      <div class="header-right">
        <button
          type="button"
          class="ctrl-btn undo-btn"
          :disabled="!canUndo"
          title="撤回上一步 (Ctrl+Z)"
          @click="handleUndo"
        >
          <span>↩ 撤回</span>
        </button>
        <button type="button" class="ctrl-btn restart-btn" @click="startNewGame" title="新开一局">
          <el-icon><RefreshRight /></el-icon>
          <span>重开</span>
        </button>
      </div>
    </div>

    <!-- 计分看板与最高纪录 -->
    <div class="score-board-row">
      <div class="score-card current-score">
        <span class="score-label">当前得分</span>
        <span class="score-val">{{ score }}</span>
      </div>
      <div class="score-card best-score">
        <span class="score-label">🏆 历史最高</span>
        <span class="score-val">{{ bestScore }}</span>
      </div>
    </div>

    <!-- 2048 棋盘区域 -->
    <div
      class="board-container"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <div class="grid-board">
        <div
          v-for="(row, r) in board"
          :key="r"
          class="grid-row"
        >
          <div
            v-for="(cell, c) in row"
            :key="`${r}-${c}`"
            class="tile-cell"
            :class="getTileClass(cell)"
          >
            <span v-if="cell > 0" class="tile-number">{{ cell }}</span>
          </div>
        </div>
      </div>

      <!-- 达成 2048 胜利浮层 -->
      <div v-if="hasWon2048 && !continuePlayingAfterWin" class="board-overlay win-overlay">
        <span class="overlay-emoji">🎉</span>
        <h3 class="overlay-title">达成 2048！</h3>
        <p class="overlay-desc">思维极具纵深，成功突破空间极限！</p>
        <div class="overlay-btns">
          <button type="button" class="overlay-btn primary" @click="continuePlayingAfterWin = true">
            继续挑战更高分
          </button>
          <button type="button" class="overlay-btn" @click="startNewGame">
            重新开局
          </button>
        </div>
      </div>

      <!-- Game Over 失败浮层 -->
      <div v-if="isGameOver" class="board-overlay gameover-overlay">
        <span class="overlay-emoji">💫</span>
        <h3 class="overlay-title">棋盘已满</h3>
        <p class="overlay-desc">本次得分：<b>{{ score }}</b> 分</p>
        <div class="overlay-btns">
          <button v-if="canUndo" type="button" class="overlay-btn primary" @click="handleUndo">
            ↩ 撤回上一手
          </button>
          <button type="button" class="overlay-btn" @click="startNewGame">
            再来一局
          </button>
        </div>
      </div>
    </div>

    <!-- 屏幕虚拟方向按键 (方便鼠标/触屏单手操作) -->
    <div class="virtual-dpad">
      <div class="dpad-row">
        <button type="button" class="dpad-btn up" title="向上滑动 (W / ↑)" @click="move('up')">
          <el-icon><Top /></el-icon>
        </button>
      </div>
      <div class="dpad-row middle">
        <button type="button" class="dpad-btn left" title="向左滑动 (A / ←)" @click="move('left')">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <button type="button" class="dpad-btn down" title="向下滑动 (S / ↓)" @click="move('down')">
          <el-icon><Bottom /></el-icon>
        </button>
        <button type="button" class="dpad-btn right" title="向右滑动 (D / →)" @click="move('right')">
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>
      <span class="dpad-hint">支持键盘方向键 ↑ ↓ ← → 或 WASD</span>
    </div>
  </div>
</template>

<style scoped>
.game2048-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 520px;
  margin: 0 auto;
  gap: 16px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 顶部栏 */
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
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
  background: rgba(249, 115, 22, 0.12);
  color: #ea580c;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
}

.header-right {
  display: flex;
  gap: 8px;
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.undo-btn {
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-regular, #475569);
}

.undo-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.undo-btn:hover:not(:disabled) {
  border-color: #6366f1;
  color: #6366f1;
}

.restart-btn {
  border: 1px solid #f97316;
  background: rgba(249, 115, 22, 0.08);
  color: #ea580c;
}

.restart-btn:hover {
  background: #f97316;
  color: #ffffff;
}

/* 计分板 */
.score-board-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
}

.score-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.score-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 2px;
}

.score-val {
  font-size: 22px;
  font-weight: 800;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  color: var(--text-main, #0f172a);
}

.current-score .score-val {
  color: #ea580c;
}

.best-score .score-val {
  color: #10b981;
}

/* 棋盘 */
.board-container {
  position: relative;
  width: 100%;
  max-width: 420px;
  aspect-ratio: 1 / 1;
  background: var(--bg-page, #bbada0);
  border-radius: 18px;
  padding: 12px;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.08);
  user-select: none;
  touch-action: none;
}

.grid-board {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  height: 100%;
}

.grid-row {
  display: flex;
  gap: 10px;
  flex: 1;
}

.tile-cell {
  flex: 1;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 26px;
  transition: transform 0.1s ease, background 0.15s ease;
}

.tile-empty {
  background: rgba(238, 228, 218, 0.35);
}

/* 数字颜色层次 (柔和高雅配色) */
.tile-2 { background: #eee4da; color: #776e65; font-size: 28px; }
.tile-4 { background: #ede0c8; color: #776e65; font-size: 28px; }
.tile-8 { background: #f2b179; color: #f9f6f2; }
.tile-16 { background: #f59563; color: #f9f6f2; }
.tile-32 { background: #f67c5f; color: #f9f6f2; }
.tile-64 { background: #f65e3b; color: #f9f6f2; }
.tile-128 { background: #edcf72; color: #f9f6f2; font-size: 22px; box-shadow: 0 0 10px rgba(237, 207, 114, 0.4); }
.tile-256 { background: #edcc61; color: #f9f6f2; font-size: 22px; box-shadow: 0 0 12px rgba(237, 204, 97, 0.5); }
.tile-512 { background: #edc850; color: #f9f6f2; font-size: 22px; box-shadow: 0 0 15px rgba(237, 200, 80, 0.6); }
.tile-1024 { background: #edc53f; color: #f9f6f2; font-size: 18px; box-shadow: 0 0 18px rgba(237, 197, 63, 0.7); }
.tile-2048 { background: #edc22e; color: #f9f6f2; font-size: 18px; box-shadow: 0 0 24px rgba(237, 194, 46, 0.8); }
.tile-4096 { background: #3c3a32; color: #f9f6f2; font-size: 18px; }

/* 浮层 */
.board-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(4px);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  animation: fadeIn 0.25s ease;
  z-index: 10;
}

:deep(.dark) .board-overlay {
  background: rgba(15, 23, 42, 0.94);
}

.overlay-emoji {
  font-size: 44px;
  margin-bottom: 6px;
}

.overlay-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0 0 6px;
}

.overlay-desc {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  margin: 0 0 18px;
}

.overlay-btns {
  display: flex;
  gap: 10px;
}

.overlay-btn {
  padding: 8px 18px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-main, #0f172a);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.overlay-btn.primary {
  background: #f97316;
  border-color: #f97316;
  color: #ffffff;
}

/* 屏幕按键引导 */
.virtual-dpad {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.dpad-row {
  display: flex;
  gap: 8px;
}

.dpad-btn {
  width: 44px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-regular, #475569);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.dpad-btn:hover {
  border-color: #f97316;
  color: #f97316;
  transform: translateY(-1px);
}

.dpad-btn:active {
  transform: scale(0.94);
}

.dpad-hint {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}
</style>
