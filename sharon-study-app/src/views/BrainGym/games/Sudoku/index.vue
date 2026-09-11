<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { playTileClick, playWrongTile, playVictoryFanfare, playLevelUpSound } from '../../sound'
import { Back, RefreshRight, EditPen, Delete, Opportunity } from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  isMuted?: boolean
}>(), {
  isMuted: false
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'record-saved', data: { gameId: string; timeMs: number }): void
}>()

// 模式：4x4极速版, 9x9简单版, 9x9进阶版
type SudokuMode = '4x4' | '9x9_easy' | '9x9_medium'
const currentMode = ref<SudokuMode>('4x4')

// 预设谜题库 (已校验唯一解，纯静态零外部网络)
const PUZZLES = {
  '4x4': [
    {
      initial: [
        [1, 0, 3, 0],
        [0, 0, 0, 1],
        [4, 0, 0, 0],
        [0, 2, 0, 4]
      ],
      solution: [
        [1, 4, 3, 2],
        [2, 3, 4, 1],
        [4, 1, 2, 3],
        [3, 2, 1, 4]
      ]
    },
    {
      initial: [
        [0, 2, 4, 0],
        [1, 0, 0, 3],
        [4, 0, 0, 2],
        [0, 1, 3, 0]
      ],
      solution: [
        [3, 2, 4, 1],
        [1, 4, 2, 3],
        [4, 3, 1, 2],
        [2, 1, 3, 4]
      ]
    }
  ],
  '9x9_easy': [
    {
      initial: [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9]
      ],
      solution: [
        [5, 3, 4, 6, 7, 8, 9, 1, 2],
        [6, 7, 2, 1, 9, 5, 3, 4, 8],
        [1, 9, 8, 3, 4, 2, 5, 6, 7],
        [8, 5, 9, 7, 6, 1, 4, 2, 3],
        [4, 2, 6, 8, 5, 3, 7, 9, 1],
        [7, 1, 3, 9, 2, 4, 8, 5, 6],
        [9, 6, 1, 5, 3, 7, 2, 8, 4],
        [2, 8, 7, 4, 1, 9, 6, 3, 5],
        [3, 4, 5, 2, 8, 6, 1, 7, 9]
      ]
    }
  ],
  '9x9_medium': [
    {
      initial: [
        [0, 0, 0, 2, 6, 0, 7, 0, 1],
        [6, 8, 0, 0, 7, 0, 0, 9, 0],
        [1, 9, 0, 0, 0, 4, 5, 0, 0],
        [8, 2, 0, 1, 0, 0, 0, 4, 0],
        [0, 0, 4, 6, 0, 2, 9, 0, 0],
        [0, 5, 0, 0, 0, 3, 0, 2, 8],
        [0, 0, 9, 3, 0, 0, 0, 7, 4],
        [0, 4, 0, 0, 5, 0, 0, 3, 6],
        [7, 0, 3, 0, 1, 8, 0, 0, 0]
      ],
      solution: [
        [4, 3, 5, 2, 6, 9, 7, 8, 1],
        [6, 8, 2, 5, 7, 1, 4, 9, 3],
        [1, 9, 7, 8, 3, 4, 5, 6, 2],
        [8, 2, 6, 1, 9, 5, 3, 4, 7],
        [3, 7, 4, 6, 8, 2, 9, 1, 5],
        [9, 5, 1, 7, 4, 3, 6, 2, 8],
        [5, 1, 9, 3, 2, 6, 8, 7, 4],
        [2, 4, 8, 9, 5, 7, 1, 3, 6],
        [7, 6, 3, 4, 1, 8, 2, 5, 9]
      ]
    }
  ]
}

interface Cell {
  row: number
  col: number
  value: number
  isFixed: boolean
  notes: number[]
  hasConflict: boolean
}

const size = computed(() => currentMode.value === '4x4' ? 4 : 9)
const boxSize = computed(() => currentMode.value === '4x4' ? 2 : 3)

const grid = ref<Cell[][]>([])
const solutionGrid = ref<number[][]>([])
const selectedCell = ref<{ row: number; col: number } | null>(null)
const isDraftMode = ref(false)
const hintsRemaining = ref(3)
const mistakes = ref(0)
const isCompleted = ref(false)
const elapsedTime = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

// 加载历史最佳记录
const bestRecordKey = computed(() => `study_sudoku_best_${currentMode.value}`)
const bestTimeMs = ref<number | null>(null)

const loadBestRecord = () => {
  const saved = localStorage.getItem(bestRecordKey.value) || localStorage.getItem(`sharon_sudoku_best_${currentMode.value}`)
  bestTimeMs.value = saved ? Number(saved) : null
}

const formatTime = (ms: number) => {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 初始化数独盘面
const initPuzzle = () => {
  if (timerInterval) clearInterval(timerInterval)

  const puzzleList = PUZZLES[currentMode.value]
  const randomP = puzzleList[Math.floor(Math.random() * puzzleList.length)]

  solutionGrid.value = randomP.solution
  grid.value = randomP.initial.map((row, r) =>
    row.map((val, c) => ({
      row: r,
      col: c,
      value: val,
      isFixed: val !== 0,
      notes: [],
      hasConflict: false
    }))
  )

  selectedCell.value = null
  hintsRemaining.value = 3
  mistakes.value = 0
  isCompleted.value = false
  elapsedTime.value = 0

  timerInterval = setInterval(() => {
    elapsedTime.value += 1000
  }, 1000)

  loadBestRecord()
}

// 切换模式
const switchMode = (mode: SudokuMode) => {
  if (currentMode.value === mode) return
  currentMode.value = mode
  initPuzzle()
}

// 选中单元格
const selectCell = (r: number, c: number) => {
  selectedCell.value = { row: r, col: c }
  playTileClick(props.isMuted, 2)
}

// 当前选中的单元格数值（用于全局同数字高亮）
const currentSelectedVal = computed(() => {
  if (!selectedCell.value) return 0
  return grid.value[selectedCell.value.row]?.[selectedCell.value.col]?.value || 0
})

// 检查某个单元格是否与当前选中格属于同一行、列、或九宫格
const isRelated = (r: number, c: number): boolean => {
  if (!selectedCell.value) return false
  const selR = selectedCell.value.row
  const selC = selectedCell.value.col
  if (r === selR || c === selC) return true

  const bs = boxSize.value
  const bRow = Math.floor(r / bs)
  const bCol = Math.floor(c / bs)
  const selBRow = Math.floor(selR / bs)
  const selBCol = Math.floor(selC / bs)
  return bRow === selBRow && bCol === selBCol
}

// 验证冲突
const updateConflicts = () => {
  const n = size.value
  const bs = boxSize.value

  // 清除冲突标记
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      grid.value[r][c].hasConflict = false
    }
  }

  // 检查行重复
  for (let r = 0; r < n; r++) {
    const map = new Map<number, number[]>()
    for (let c = 0; c < n; c++) {
      const v = grid.value[r][c].value
      if (v > 0) {
        if (!map.has(v)) map.set(v, [])
        map.get(v)!.push(c)
      }
    }
    for (const [, cols] of map) {
      if (cols.length > 1) {
        cols.forEach(c => { grid.value[r][c].hasConflict = true })
      }
    }
  }

  // 检查列重复
  for (let c = 0; c < n; c++) {
    const map = new Map<number, number[]>()
    for (let r = 0; r < n; r++) {
      const v = grid.value[r][c].value
      if (v > 0) {
        if (!map.has(v)) map.set(v, [])
        map.get(v)!.push(r)
      }
    }
    for (const [, rows] of map) {
      if (rows.length > 1) {
        rows.forEach(r => { grid.value[r][c].hasConflict = true })
      }
    }
  }

  // 检查宫格重复
  for (let br = 0; br < n / bs; br++) {
    for (let bc = 0; bc < n / bs; bc++) {
      const map = new Map<number, { r: number; c: number }[]>()
      for (let dr = 0; dr < bs; dr++) {
        for (let dc = 0; dc < bs; dc++) {
          const r = br * bs + dr
          const c = bc * bs + dc
          const v = grid.value[r][c].value
          if (v > 0) {
            if (!map.has(v)) map.set(v, [])
            map.get(v)!.push({ r, c })
          }
        }
      }
      for (const [, cells] of map) {
        if (cells.length > 1) {
          cells.forEach(cell => { grid.value[cell.r][cell.c].hasConflict = true })
        }
      }
    }
  }
}

// 填入数字
const inputNumber = (num: number) => {
  if (!selectedCell.value || isCompleted.value) return
  const { row, col } = selectedCell.value
  const cell = grid.value[row][col]
  if (cell.isFixed) return

  if (isDraftMode.value) {
    // 笔记模式
    if (cell.value === 0) {
      const idx = cell.notes.indexOf(num)
      if (idx > -1) {
        cell.notes.splice(idx, 1)
      } else {
        cell.notes.push(num)
        cell.notes.sort((a, b) => a - b)
      }
      playTileClick(props.isMuted, num)
    }
  } else {
    // 正式填入
    if (cell.value === num) {
      cell.value = 0
    } else {
      cell.value = num
      cell.notes = []

      // 验证正确性与音效
      const correctVal = solutionGrid.value[row][col]
      if (num !== correctVal) {
        mistakes.value++
        playWrongTile(props.isMuted)
      } else {
        playLevelUpSound(props.isMuted)
      }
    }
    updateConflicts()
    checkWin()
  }
}

// 擦除数字
const eraseCell = () => {
  if (!selectedCell.value || isCompleted.value) return
  const { row, col } = selectedCell.value
  const cell = grid.value[row][col]
  if (cell.isFixed) return
  cell.value = 0
  cell.notes = []
  updateConflicts()
  playTileClick(props.isMuted)
}

// 智能提示 (填入一个正确格子)
const useHint = () => {
  if (hintsRemaining.value <= 0 || isCompleted.value) return
  const n = size.value
  const candidates: { r: number; c: number }[] = []

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid.value[r][c].value !== solutionGrid.value[r][c]) {
        candidates.push({ r, c })
      }
    }
  }

  if (candidates.length === 0) return

  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  const cell = grid.value[pick.r][pick.c]
  cell.value = solutionGrid.value[pick.r][pick.c]
  cell.notes = []
  hintsRemaining.value--
  selectedCell.value = { row: pick.r, col: pick.c }

  updateConflicts()
  playLevelUpSound(props.isMuted)
  checkWin()
}

// 检查是否全部填完且正确
const checkWin = () => {
  const n = size.value
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid.value[r][c].value !== solutionGrid.value[r][c]) {
        return false
      }
    }
  }

  // 胜利通关！
  if (timerInterval) clearInterval(timerInterval)
  isCompleted.value = true
  playVictoryFanfare(props.isMuted)

  const curMs = elapsedTime.value
  if (!bestTimeMs.value || curMs < bestTimeMs.value) {
    bestTimeMs.value = curMs
    localStorage.setItem(bestRecordKey.value, String(curMs))
  }

  emit('record-saved', {
    gameId: 'sudoku',
    timeMs: curMs
  })

  return true
}

// 键盘监听
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key >= '1' && e.key <= String(size.value)) {
    inputNumber(Number(e.key))
  } else if (['Backspace', 'Delete'].includes(e.key)) {
    eraseCell()
  } else if (selectedCell.value) {
    const { row, col } = selectedCell.value
    const n = size.value
    if (e.key === 'ArrowUp' && row > 0) selectCell(row - 1, col)
    if (e.key === 'ArrowDown' && row < n - 1) selectCell(row + 1, col)
    if (e.key === 'ArrowLeft' && col > 0) selectCell(row, col - 1)
    if (e.key === 'ArrowRight' && col < n - 1) selectCell(row, col + 1)
  }
}

onMounted(() => {
  initPuzzle()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="sudoku-container">
    <!-- 顶部栏 -->
    <div class="game-header">
      <div class="header-left">
        <button type="button" class="back-btn" @click="emit('back')" title="返回大厅">
          <el-icon><Back /></el-icon>
          <span>大厅</span>
        </button>
        <div class="title-group">
          <span class="game-title">🧩 经典数独</span>
          <span class="game-badge">排查归纳与逻辑推导</span>
        </div>
      </div>

      <!-- 模式切换 -->
      <div class="mode-pills">
        <button
          type="button"
          class="mode-btn"
          :class="{ active: currentMode === '4x4' }"
          @click="switchMode('4x4')"
        >
          4×4 (极速)
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ active: currentMode === '9x9_easy' }"
          @click="switchMode('9x9_easy')"
        >
          9×9 (简单)
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ active: currentMode === '9x9_medium' }"
          @click="switchMode('9x9_medium')"
        >
          9×9 (进阶)
        </button>
      </div>

      <div class="header-right">
        <button type="button" class="restart-btn" @click="initPuzzle" title="重新开局">
          <el-icon><RefreshRight /></el-icon>
          <span>重开</span>
        </button>
      </div>
    </div>

    <!-- 状态指示条 -->
    <div class="status-bar">
      <div class="stat-pill">
        <span class="pill-label">⏱️ 用时</span>
        <span class="pill-val font-mono">{{ formatTime(elapsedTime) }}</span>
      </div>
      <div class="stat-pill">
        <span class="pill-label">⚠️ 错漏</span>
        <span class="pill-val">{{ mistakes }} 次</span>
      </div>
      <div class="stat-pill">
        <span class="pill-label">🏆 最佳</span>
        <span class="pill-val font-mono">{{ bestTimeMs ? formatTime(bestTimeMs) : '--' }}</span>
      </div>
    </div>

    <!-- 数独网格容器 -->
    <div class="sudoku-board-wrap" :class="`size-${size}`">
      <div
        v-for="(row, r) in grid"
        :key="r"
        class="board-row"
      >
        <button
          v-for="(cell, c) in row"
          :key="c"
          type="button"
          class="sudoku-cell"
          :class="{
            'is-fixed': cell.isFixed,
            'is-selected': selectedCell?.row === r && selectedCell?.col === c,
            'is-related': isRelated(r, c),
            'is-same-number': currentSelectedVal > 0 && cell.value === currentSelectedVal,
            'has-conflict': cell.hasConflict,
            'border-right-thick': (c + 1) % boxSize === 0 && c + 1 < size,
            'border-bottom-thick': (r + 1) % boxSize === 0 && r + 1 < size
          }"
          @click="selectCell(r, c)"
        >
          <span v-if="cell.value > 0" class="cell-main-num">{{ cell.value }}</span>
          <!-- 笔记草稿微数字 -->
          <div v-else-if="cell.notes.length > 0" class="notes-grid">
            <span v-for="n in cell.notes" :key="n" class="note-num">{{ n }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- 底部控制与数字键盘 -->
    <div class="numpad-section">
      <div class="tools-bar">
        <button
          type="button"
          class="tool-btn"
          :class="{ active: isDraftMode }"
          @click="isDraftMode = !isDraftMode"
        >
          <el-icon><EditPen /></el-icon>
          <span>{{ isDraftMode ? '笔记模式 (开)' : '笔记模式 (关)' }}</span>
        </button>

        <button type="button" class="tool-btn" @click="eraseCell">
          <el-icon><Delete /></el-icon>
          <span>擦除</span>
        </button>

        <button
          type="button"
          class="tool-btn hint-btn"
          :disabled="hintsRemaining <= 0"
          @click="useHint"
        >
          <el-icon><Opportunity /></el-icon>
          <span>提示 (剩{{ hintsRemaining }})</span>
        </button>
      </div>

      <!-- 动态数字键盘 -->
      <div class="digits-row">
        <button
          v-for="digit in size"
          :key="digit"
          type="button"
          class="digit-btn"
          @click="inputNumber(digit)"
        >
          {{ digit }}
        </button>
      </div>
    </div>

    <!-- 通关结算弹窗 -->
    <el-dialog
      v-model="isCompleted"
      title="🎉 数独通关！"
      width="400px"
      align-center
      destroy-on-close
    >
      <div class="win-dialog-body">
        <span class="win-emoji">🧩</span>
        <h3 class="win-title">逻辑严密 · 完美解构！</h3>
        <div class="win-stats-list">
          <div class="stat-row">
            <span>挑战模式：</span>
            <b>{{ currentMode === '4x4' ? '4×4 极速版' : currentMode === '9x9_easy' ? '9×9 简单版' : '9×9 进阶版' }}</b>
          </div>
          <div class="stat-row">
            <span>通关用时：</span>
            <b class="highlight">{{ formatTime(elapsedTime) }}</b>
          </div>
          <div class="stat-row">
            <span>错误次数：</span>
            <b>{{ mistakes }} 次</b>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <el-button @click="emit('back')">返回大厅</el-button>
          <el-button type="primary" @click="initPuzzle">再来一盘</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sudoku-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 580px;
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
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
}

.mode-pills {
  display: flex;
  background: var(--bg-page, #f1f5f9);
  padding: 3px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.mode-btn {
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

.mode-btn.active {
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

/* 状态条 */
.status-bar {
  display: flex;
  justify-content: center;
  gap: 16px;
  width: 100%;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 20px;
  padding: 4px 14px;
  font-size: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.pill-label {
  color: var(--text-secondary, #94a3b8);
}

.pill-val {
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.font-mono {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
}

/* 数独棋盘 */
.sudoku-board-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 460px;
  aspect-ratio: 1 / 1;
  background: var(--bg-card, #ffffff);
  border: 2px solid var(--text-main, #334155);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.08);
  user-select: none;
}

.board-row {
  display: flex;
  flex: 1;
}

.sudoku-cell {
  flex: 1;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  font-weight: 600;
  color: #6366f1;
  position: relative;
  transition: background 0.12s;
  padding: 0;
}

.size-4 .sudoku-cell {
  font-size: 28px;
}

.sudoku-cell.is-fixed {
  color: var(--text-main, #0f172a);
  font-weight: 800;
  background: var(--bg-page, #f8fafc);
}

/* 粗边界区分小宫格 */
.border-right-thick {
  border-right: 2px solid var(--text-main, #334155) !important;
}

.border-bottom-thick {
  border-bottom: 2px solid var(--text-main, #334155) !important;
}

/* 高亮联动 */
.sudoku-cell.is-related {
  background: rgba(99, 102, 241, 0.04);
}

.sudoku-cell.is-same-number {
  background: rgba(99, 102, 241, 0.14) !important;
}

.sudoku-cell.is-selected {
  background: rgba(99, 102, 241, 0.22) !important;
  box-shadow: inset 0 0 0 2px #6366f1;
}

.sudoku-cell.has-conflict {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #ef4444 !important;
}

/* 笔记小字 */
.notes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  height: 100%;
  padding: 2px;
  align-items: center;
  justify-items: center;
}

.note-num {
  font-size: 9px;
  font-weight: 500;
  color: var(--text-secondary, #94a3b8);
  line-height: 1;
}

/* 键盘工具 */
.numpad-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 460px;
}

.tools-bar {
  display: flex;
  gap: 8px;
  width: 100%;
  justify-content: center;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-regular, #475569);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.tool-btn.active {
  background: #6366f1;
  color: #ffffff;
  border-color: #6366f1;
}

.hint-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.digits-row {
  display: flex;
  gap: 8px;
  width: 100%;
  justify-content: center;
}

.digit-btn {
  flex: 1;
  height: 44px;
  max-width: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-main, #0f172a);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.digit-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
  transform: translateY(-2px);
}

.digit-btn:active {
  transform: scale(0.95);
}

/* 结算 */
.win-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.win-emoji {
  font-size: 48px;
  margin-bottom: 8px;
}

.win-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0 0 16px;
}

.win-stats-list {
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

.stat-row {
  display: flex;
  justify-content: space-between;
}

.stat-row .highlight {
  color: #6366f1;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
