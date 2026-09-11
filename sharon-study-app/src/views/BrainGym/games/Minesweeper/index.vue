<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { playTileClick, playFlagSound, playExplosionSound, playVictoryFanfare } from '../../sound'
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

interface LevelConfig {
  name: string
  rows: number
  cols: number
  mines: number
  key: string
}

const LEVELS: LevelConfig[] = [
  { name: '极速 8×8 (8雷)', rows: 8, cols: 8, mines: 8, key: '8x8' },
  { name: '初级 9×9 (10雷)', rows: 9, cols: 9, mines: 10, key: '9x9' },
  { name: '进阶 12×12 (20雷)', rows: 12, cols: 12, mines: 20, key: '12x12' }
]

const currentLevelIdx = ref(0)
const currentLevel = computed(() => LEVELS[currentLevelIdx.value])

interface Cell {
  row: number
  col: number
  isMine: boolean
  isOpen: boolean
  isFlagged: boolean
  neighborMines: number
  exploded?: boolean
  wrongFlag?: boolean
}

// 游戏状态
const board = ref<Cell[][]>([])
const isPlaying = ref(false)
const isGameOver = ref(false)
const isVictory = ref(false)
const minesGenerated = ref(false)
const startTime = ref(0)
const elapsedTime = ref(0)
const faceState = ref<'normal' | 'pressed' | 'won' | 'dead'>('normal')
// 操作模式：dig (挖开) 或 flag (插旗)，便于触控与触控板单手操作
const interactMode = ref<'dig' | 'flag'>('dig')

let timerInterval: ReturnType<typeof setInterval> | null = null

// 统计剩余雷数
const flagCount = computed(() => {
  let count = 0
  for (const row of board.value) {
    for (const cell of row) {
      if (cell.isFlagged) count++
    }
  }
  return count
})

const remainingMines = computed(() => {
  return Math.max(0, currentLevel.value.mines - flagCount.value)
})

// 最佳用时持久化
const bestTimeKey = computed(() => `sharon_minesweeper_best_${currentLevel.value.key}`)
const bestTimeMs = ref<number | null>(null)
const isNewRecord = ref(false)

const loadBestRecord = () => {
  const saved = localStorage.getItem(bestTimeKey.value)
  if (saved) {
    bestTimeMs.value = Number(saved)
  } else {
    bestTimeMs.value = null
  }
}

const formatTime = (ms: number) => {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 生成空网格
const createEmptyBoard = () => {
  const { rows, cols } = currentLevel.value
  const newBoard: Cell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < cols; c++) {
      row.push({
        row: r,
        col: c,
        isMine: false,
        isOpen: false,
        isFlagged: false,
        neighborMines: 0
      })
    }
    newBoard.push(row)
  }
  return newBoard
}

// 首次点击生成地雷（确保首击点及其 8 个邻居 100% 绝对无雷，给开局一个开阔岛）
const plantMines = (safeRow: number, safeCol: number) => {
  const { rows, cols, mines } = currentLevel.value
  const safeZones = new Set<string>()

  // 将安全点及其 8 邻域加入排除集合
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeRow + dr
      const nc = safeCol + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        safeZones.add(`${nr},${nc}`)
      }
    }
  }

  // 收集所有可选候选点
  const candidates: { r: number; c: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!safeZones.has(`${r},${c}`)) {
        candidates.push({ r, c })
      }
    }
  }

  // 随机洗牌放入地雷
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = candidates[i]
    candidates[i] = candidates[j]
    candidates[j] = temp
  }

  const minePositions = candidates.slice(0, mines)
  for (const pos of minePositions) {
    board.value[pos.r][pos.c].isMine = true
  }

  // 计算每格周围雷数
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board.value[r][c].isMine) continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board.value[nr][nc].isMine) {
            count++
          }
        }
      }
      board.value[r][c].neighborMines = count
    }
  }

  minesGenerated.value = true
}

// 重启本关
const resetGame = () => {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  board.value = createEmptyBoard()
  isPlaying.value = false
  isGameOver.value = false
  isVictory.value = false
  minesGenerated.value = false
  elapsedTime.value = 0
  faceState.value = 'normal'
  isNewRecord.value = false
  loadBestRecord()
}

// 切换难度
const switchLevel = (idx: number) => {
  if (currentLevelIdx.value === idx) return
  currentLevelIdx.value = idx
  resetGame()
}

// 递归展开空白区域 (Flood Fill)
const revealCell = (r: number, c: number) => {
  const { rows, cols } = currentLevel.value
  const cell = board.value[r][c]

  if (cell.isOpen || cell.isFlagged) return

  cell.isOpen = true

  // 若周围雷数为 0，连锁展开 8 方向邻近未开启方格
  if (cell.neighborMines === 0 && !cell.isMine) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          revealCell(nr, nc)
        }
      }
    }
  }
}

// 检查是否达成胜利条件：所有非雷方格均已揭开
const checkWinCondition = () => {
  const { rows, cols, mines } = currentLevel.value
  let openCount = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board.value[r][c].isOpen && !board.value[r][c].isMine) {
        openCount++
      }
    }
  }

  const targetOpenCount = rows * cols - mines
  if (openCount === targetOpenCount) {
    handleVictory()
  }
}

// 胜利结算
const handleVictory = () => {
  if (timerInterval) clearInterval(timerInterval)
  isPlaying.value = false
  isVictory.value = true
  faceState.value = 'won'

  // 将所有未标旗的地雷自动插满小红旗
  const { rows, cols } = currentLevel.value
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board.value[r][c].isMine) {
        board.value[r][c].isFlagged = true
      }
    }
  }

  playVictoryFanfare(props.isMuted)

  // 记录保存
  const duration = elapsedTime.value
  if (!bestTimeMs.value || duration < bestTimeMs.value) {
    bestTimeMs.value = duration
    isNewRecord.value = true
    localStorage.setItem(bestTimeKey.value, String(duration))
  }

  emit('record-saved', {
    gameId: 'minesweeper',
    timeMs: duration
  })
}

// 触雷失败结算
const handleDefeat = (triggerCell: Cell) => {
  if (timerInterval) clearInterval(timerInterval)
  isPlaying.value = false
  isGameOver.value = true
  faceState.value = 'dead'
  triggerCell.exploded = true

  playExplosionSound(props.isMuted)

  // 翻开所有地雷，并标记插错旗的位置
  const { rows, cols } = currentLevel.value
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board.value[r][c]
      if (cell.isMine) {
        cell.isOpen = true
      } else if (cell.isFlagged && !cell.isMine) {
        cell.wrongFlag = true
      }
    }
  }
}

// 点击方格
const handleCellClick = (r: number, c: number) => {
  if (isGameOver.value || isVictory.value) return

  // 插旗模式下点击
  if (interactMode.value === 'flag') {
    handleToggleFlag(r, c)
    return
  }

  const cell = board.value[r][c]
  if (cell.isFlagged || cell.isOpen) return

  // 启动计时
  if (!isPlaying.value) {
    isPlaying.value = true
    startTime.value = Date.now()
    timerInterval = setInterval(() => {
      elapsedTime.value = Date.now() - startTime.value
    }, 1000)
  }

  // 首次点击动态下雷
  if (!minesGenerated.value) {
    plantMines(r, c)
  }

  // 踩雷判断
  if (cell.isMine) {
    handleDefeat(cell)
    return
  }

  // 揭开
  playTileClick(props.isMuted, cell.neighborMines)
  revealCell(r, c)
  checkWinCondition()
}

// 右键或插旗操作
const handleToggleFlag = (r: number, c: number) => {
  if (isGameOver.value || isVictory.value) return
  const cell = board.value[r][c]
  if (cell.isOpen) return

  cell.isFlagged = !cell.isFlagged
  playFlagSound(props.isMuted)
}

// 双击已开数字快捷排查 (Chord)
const handleChordClick = (r: number, c: number) => {
  if (isGameOver.value || isVictory.value) return
  const cell = board.value[r][c]
  if (!cell.isOpen || cell.neighborMines === 0) return

  const { rows, cols } = currentLevel.value
  let surroundingFlags = 0

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board.value[nr][nc].isFlagged) {
        surroundingFlags++
      }
    }
  }

  // 当周围旗子数等于标号时，揭开其余所有未标旗邻居
  if (surroundingFlags === cell.neighborMines) {
    let triggeredMine: Cell | null = null
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighbor = board.value[nr][nc]
          if (!neighbor.isOpen && !neighbor.isFlagged) {
            if (neighbor.isMine) {
              triggeredMine = neighbor
            } else {
              revealCell(nr, nc)
            }
          }
        }
      }
    }

    if (triggeredMine) {
      handleDefeat(triggeredMine)
    } else {
      playTileClick(props.isMuted, cell.neighborMines)
      checkWinCondition()
    }
  }
}

// 数字配色表
const getNumberColor = (num: number) => {
  switch (num) {
    case 1: return '#2563eb' // 蓝
    case 2: return '#16a34a' // 绿
    case 3: return '#dc2626' // 红
    case 4: return '#7c3aed' // 紫
    case 5: return '#9333ea' // 深紫
    case 6: return '#0d9488' // 青
    case 7: return '#000000' // 黑
    case 8: return '#64748b' // 灰
    default: return '#2563eb'
  }
}

onMounted(() => {
  resetGame()
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<template>
  <div class="minesweeper-game">
    <!-- 1. 顶部控制栏 -->
    <div class="game-top-bar">
      <button type="button" class="back-hub-btn" @click="emit('back')">
        <el-icon><Back /></el-icon>
        <span>脑力大厅</span>
      </button>

      <div class="game-title-center">
        <h2 class="title-text">经典扫雷</h2>
        <span class="game-badge">排查归纳 · 逻辑推理</span>
      </div>

      <div class="top-bar-right">
        <div class="mode-toggle-group">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: interactMode === 'dig' }"
            @click="interactMode = 'dig'"
            title="挖开模式"
          >
            ⛏️ 挖开
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: interactMode === 'flag' }"
            @click="interactMode = 'flag'"
            title="插旗标记模式"
          >
            🚩 插旗
          </button>
        </div>
      </div>
    </div>

    <!-- 2. 关卡难度与状态仪表盘 -->
    <div class="controls-panel">
      <!-- 难度选择 -->
      <div class="level-pills">
        <button
          v-for="(lvl, idx) in LEVELS"
          :key="lvl.key"
          type="button"
          class="level-pill"
          :class="{ active: currentLevelIdx === idx }"
          @click="switchLevel(idx)"
        >
          {{ lvl.name }}
        </button>
      </div>

      <!-- 经典复古数显表盘 -->
      <div class="mines-dashboard">
        <!-- 剩余雷数仪表 -->
        <div class="counter-box" title="剩余地雷">
          <span class="counter-label">💣 剩余</span>
          <span class="counter-value">{{ String(remainingMines).padStart(2, '0') }}</span>
        </div>

        <!-- 经典表情重开按钮 -->
        <button
          type="button"
          class="face-btn"
          :title="'点击重新开始本局'"
          @click="resetGame"
        >
          <span v-if="faceState === 'won'">😎</span>
          <span v-else-if="faceState === 'dead'">😵</span>
          <span v-else-if="faceState === 'pressed'">😮</span>
          <span v-else>🙂</span>
        </button>

        <!-- 计时表盘 -->
        <div class="counter-box" title="当前用时">
          <span class="counter-label">⏱️ 用时</span>
          <span class="counter-value">{{ formatTime(elapsedTime) }}</span>
        </div>
      </div>

      <!-- 最佳纪录展示 -->
      <div class="best-record-pill">
        <span class="record-icon">🏆</span>
        <span class="record-text">
          最佳：{{ bestTimeMs ? formatTime(bestTimeMs) : '--:--' }}
        </span>
      </div>
    </div>

    <!-- 3. 扫雷网格主体 -->
    <div class="board-wrapper">
      <div
        class="mines-grid"
        :style="{
          gridTemplateColumns: `repeat(${currentLevel.cols}, minmax(0, 1fr))`,
          maxWidth: `${Math.min(520, currentLevel.cols * 42)}px`
        }"
        @contextmenu.prevent
      >
        <template v-for="(row, rIdx) in board" :key="rIdx">
          <div
            v-for="(cell, cIdx) in row"
            :key="`${rIdx}-${cIdx}`"
            class="mine-cell"
            :class="{
              'is-open': cell.isOpen,
              'is-mine': cell.isOpen && cell.isMine,
              'is-exploded': cell.exploded,
              'is-flagged': cell.isFlagged,
              'is-wrong-flag': cell.wrongFlag
            }"
            @click="handleCellClick(rIdx, cIdx)"
            @contextmenu.prevent="handleToggleFlag(rIdx, cIdx)"
            @dblclick="handleChordClick(rIdx, cIdx)"
          >
            <!-- 开启且是地雷 -->
            <template v-if="cell.isOpen && cell.isMine">
              <span class="cell-icon">💣</span>
            </template>

            <!-- 插旗 -->
            <template v-else-if="cell.isFlagged">
              <span class="cell-icon flag">🚩</span>
            </template>

            <!-- 插错旗（游戏结束揭晓） -->
            <template v-else-if="cell.wrongFlag">
              <span class="cell-icon wrong">❌</span>
            </template>

            <!-- 开启且有周围地雷数 -->
            <template v-else-if="cell.isOpen && cell.neighborMines > 0">
              <span
                class="cell-number"
                :style="{ color: getNumberColor(cell.neighborMines) }"
              >
                {{ cell.neighborMines }}
              </span>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- 底部操作提示 -->
    <div class="game-footer-tips">
      <span class="tip-item">💡 提示：电脑端可直接<strong>右键插旗</strong>，左键点击</span>
      <span class="tip-item">⚡ 技巧：双击已开数字，当周围旗数匹配时可<strong>快速排查</strong>周围</span>
    </div>

    <!-- 4. 胜利通关模态弹窗 -->
    <div v-if="isVictory" class="victory-modal-mask">
      <div class="victory-card">
        <div class="victory-icon">🎉</div>
        <h3 class="victory-title">排雷大捷 · 逻辑拉满！</h3>
        <p class="victory-sub">你成功排除了所有地雷，思维极其缜密！</p>

        <div class="victory-stats-row">
          <div class="stat-cell">
            <span class="stat-label">本次用时</span>
            <span class="stat-val highlight">{{ formatTime(elapsedTime) }}</span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">关卡规模</span>
            <span class="stat-val">{{ currentLevel.name }}</span>
          </div>
        </div>

        <div v-if="isNewRecord" class="new-record-pill">
          ✨ 突破本难度历史最快纪录！
        </div>

        <div class="victory-actions">
          <button type="button" class="action-btn retry" @click="resetGame">
            <el-icon><RefreshRight /></el-icon>
            <span>再来一局</span>
          </button>
          <button type="button" class="action-btn back" @click="emit('back')">
            <span>返回大厅</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.minesweeper-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

/* 顶部栏 */
.game-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.back-hub-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-regular, #475569);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.back-hub-btn:hover {
  border-color: #0ea5e9;
  color: #0ea5e9;
}

.game-title-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title-text {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0;
}

.game-badge {
  font-size: 11px;
  color: #0ea5e9;
  font-weight: 600;
  margin-top: 2px;
}

.mode-toggle-group {
  display: flex;
  background: var(--bg-page, #f1f5f9);
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.mode-btn {
  padding: 5px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn.active {
  background: #0ea5e9;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(14, 165, 233, 0.3);
}

/* 控制仪表盘 */
.controls-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.level-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.level-pill {
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-regular, #475569);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.level-pill:hover {
  border-color: #0ea5e9;
  color: #0ea5e9;
}

.level-pill.active {
  background: rgba(14, 165, 233, 0.12);
  border-color: #0ea5e9;
  color: #0ea5e9;
  font-weight: 700;
}

.mines-dashboard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 420px;
  background: var(--bg-card, #ffffff);
  border: 2px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 8px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.counter-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #0f172a;
  color: #ef4444;
  padding: 4px 12px;
  border-radius: 8px;
  min-width: 80px;
  font-family: 'Courier New', Courier, monospace;
}

.counter-label {
  font-size: 9px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.5px;
}

.counter-value {
  font-size: 20px;
  font-weight: 900;
  color: #ef4444;
}

.face-btn {
  font-size: 28px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.face-btn:hover {
  transform: scale(1.08);
  border-color: #0ea5e9;
}

.face-btn:active {
  transform: scale(0.95);
}

.best-record-pill {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.record-icon {
  font-size: 14px;
}

/* 扫雷棋盘 */
.board-wrapper {
  padding: 16px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 20px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
  width: 100%;
  display: flex;
  justify-content: center;
  user-select: none;
}

.mines-grid {
  display: grid;
  gap: 4px;
  width: 100%;
}

.mine-cell {
  aspect-ratio: 1;
  background: var(--bg-page, #e2e8f0);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.12s, transform 0.08s;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.15);
}

.mine-cell:hover:not(.is-open) {
  background: #cbd5e1;
  transform: translateY(-1px);
}

.mine-cell.is-open {
  background: var(--bg-card, #ffffff);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
  cursor: default;
}

.mine-cell.is-mine {
  background: #fee2e2;
}

.mine-cell.is-exploded {
  background: #ef4444;
  animation: pulse 0.3s ease-in-out;
}

.cell-icon {
  font-size: 18px;
  line-height: 1;
}

.cell-icon.flag {
  transform: scale(1.1);
}

.cell-icon.wrong {
  font-size: 14px;
}

.cell-number {
  font-size: 17px;
  line-height: 1;
  font-family: system-ui, -apple-system, sans-serif;
}

/* 底部提示 */
.game-footer-tips {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

/* 胜利弹窗 */
.victory-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.25s ease-out;
}

.victory-card {
  background: var(--bg-card, #ffffff);
  border-radius: 24px;
  padding: 32px;
  width: 90%;
  max-width: 380px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.victory-icon {
  font-size: 48px;
}

.victory-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0;
}

.victory-sub {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.victory-stats-row {
  display: flex;
  gap: 20px;
  width: 100%;
  justify-content: center;
  background: var(--bg-page, #f8fafc);
  padding: 12px;
  border-radius: 14px;
  margin: 6px 0;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

.stat-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.stat-val.highlight {
  color: #0ea5e9;
}

.new-record-pill {
  font-size: 12px;
  font-weight: 700;
  color: #d97706;
  background: rgba(245, 158, 11, 0.12);
  padding: 4px 12px;
  border-radius: 12px;
}

.victory-actions {
  display: flex;
  gap: 12px;
  width: 100%;
  margin-top: 8px;
}

.action-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
  border: none;
}

.action-btn.retry {
  background: #0ea5e9;
  color: #ffffff;
}

.action-btn.retry:hover {
  background: #0284c7;
}

.action-btn.back {
  background: var(--bg-page, #f1f5f9);
  color: var(--text-regular, #475569);
}

.action-btn.back:hover {
  background: #e2e8f0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>
