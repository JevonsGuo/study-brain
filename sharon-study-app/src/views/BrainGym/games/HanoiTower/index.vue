<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { playDiskPickSound, playDiskDropSound, playWrongTile, playVictoryFanfare } from '../../sound'
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

interface DiskLevelConfig {
  name: string
  disks: number
  key: string
}

const LEVELS: DiskLevelConfig[] = [
  { name: '3 阶 (入门 · 最优 7 步)', disks: 3, key: '3' },
  { name: '4 阶 (经典 · 最优 15 步)', disks: 4, key: '4' },
  { name: '5 阶 (进阶 · 最优 31 步)', disks: 5, key: '5' },
  { name: '6 阶 (大师 · 最优 63 步)', disks: 6, key: '6' }
]

const currentLevelIdx = ref(0)
const currentLevel = computed(() => LEVELS[currentLevelIdx.value])
const minMoves = computed(() => Math.pow(2, currentLevel.value.disks) - 1)

// 柱子数据：三根柱子 (0: A起点, 1: B中转, 2: C目标)
// 每根柱子存放在其中的圆盘尺寸编号 [5, 4, 3...]，数组末尾为柱顶圆盘
const pegs = ref<number[][]>([[], [], []])

// 当前选中的来源柱索引 (0, 1, 2) 或 null
const selectedPegIdx = ref<number | null>(null)

// 步数与历史记录（用于撤销）
interface MoveRecord {
  from: number
  to: number
  disk: number
}
const moveHistory = ref<MoveRecord[]>([])
const movesCount = ref(0)

// 计时与状态
const startTime = ref(0)
const elapsedTime = ref(0)
const isPlaying = ref(false)
const isVictory = ref(false)
const isNewRecord = ref(false)
const errorMessage = ref<string | null>(null)
const shakingPeg = ref<number | null>(null)
let timerInterval: ReturnType<typeof setInterval> | null = null

// 最佳记录持久化
const bestRecordKey = computed(() => `study_hanoi_best_${currentLevel.value.key}`)
const bestRecord = ref<{ moves: number; timeMs: number } | null>(null)

const loadBestRecord = () => {
  const saved = localStorage.getItem(bestRecordKey.value) || localStorage.getItem(`sharon_hanoi_best_${currentLevel.value.key}`)
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

// 圆盘配色表
const DISK_COLORS = [
  'linear-gradient(135deg, #ef4444, #dc2626)', // 1: 红
  'linear-gradient(135deg, #f97316, #ea580c)', // 2: 橙
  'linear-gradient(135deg, #eab308, #ca8a04)', // 3: 黄
  'linear-gradient(135deg, #10b981, #059669)', // 4: 绿
  'linear-gradient(135deg, #06b6d4, #0891b2)', // 5: 青
  'linear-gradient(135deg, #6366f1, #4f46e5)'  // 6: 靛蓝
]

const getDiskStyle = (size: number) => {
  const total = currentLevel.value.disks
  // 宽度从 38% 线性增长到 96%
  const minPercent = 38
  const maxPercent = 96
  const widthPercent = minPercent + ((size - 1) / Math.max(1, total - 1)) * (maxPercent - minPercent)
  const bg = DISK_COLORS[(size - 1) % DISK_COLORS.length]

  return {
    width: `${widthPercent}%`,
    background: bg
  }
}

// 初始化汉诺塔
const resetGame = () => {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null

  const n = currentLevel.value.disks
  // 初始时，所有圆盘自底向上由大到小放置在 A 柱 (索引 0)
  const startDisks: number[] = []
  for (let i = n; i >= 1; i--) {
    startDisks.push(i)
  }

  pegs.value = [startDisks, [], []]
  selectedPegIdx.value = null
  moveHistory.value = []
  movesCount.value = 0
  elapsedTime.value = 0
  isPlaying.value = false
  isVictory.value = false
  isNewRecord.value = false
  errorMessage.value = null
  shakingPeg.value = null
  loadBestRecord()
}

// 切换阶数
const switchLevel = (idx: number) => {
  if (currentLevelIdx.value === idx) return
  currentLevelIdx.value = idx
  resetGame()
}

// 点击柱子
const handlePegClick = (pegIdx: number) => {
  if (isVictory.value) return
  errorMessage.value = null

  // 1. 若当前未选定圆盘：执行“拾起”
  if (selectedPegIdx.value === null) {
    const currentPegDisks = pegs.value[pegIdx]
    if (currentPegDisks.length === 0) return

    selectedPegIdx.value = pegIdx
    playDiskPickSound(props.isMuted)
    return
  }

  // 2. 若点击已选定的柱子：取消选定
  if (selectedPegIdx.value === pegIdx) {
    selectedPegIdx.value = null
    playDiskDropSound(props.isMuted)
    return
  }

  // 3. 尝试将圆盘从 source 移到 target
  const sourcePeg = pegs.value[selectedPegIdx.value]
  const targetPeg = pegs.value[pegIdx]

  const movingDisk = sourcePeg[sourcePeg.length - 1]
  const targetTopDisk = targetPeg.length > 0 ? targetPeg[targetPeg.length - 1] : Infinity

  // 规则校验：目标柱顶圆盘必须大于被移动圆盘（大盘不能压小盘）
  if (movingDisk > targetTopDisk) {
    errorMessage.value = `非法移动！圆盘 (${movingDisk}) 不能放置在较小圆盘 (${targetTopDisk}) 之上`
    shakingPeg.value = pegIdx
    setTimeout(() => {
      shakingPeg.value = null
    }, 400)
    playWrongTile(props.isMuted)
    return
  }

  // 校验合法：启动计时器（首次有效步）
  if (!isPlaying.value) {
    isPlaying.value = true
    startTime.value = Date.now()
    timerInterval = setInterval(() => {
      elapsedTime.value = Date.now() - startTime.value
    }, 1000)
  }

  // 执行移动
  sourcePeg.pop()
  targetPeg.push(movingDisk)
  moveHistory.value.push({
    from: selectedPegIdx.value,
    to: pegIdx,
    disk: movingDisk
  })
  movesCount.value++
  selectedPegIdx.value = null
  playDiskDropSound(props.isMuted)

  // 检查胜利条件：所有圆盘全部移动至 C 柱 (索引 2)
  if (pegs.value[2].length === currentLevel.value.disks) {
    handleVictory()
  }
}

// 撤销一步
const undoLastMove = () => {
  if (moveHistory.value.length === 0 || isVictory.value) return
  const last = moveHistory.value.pop()
  if (!last) return

  // 将圆盘从 to 归还给 from
  pegs.value[last.to].pop()
  pegs.value[last.from].push(last.disk)
  selectedPegIdx.value = null
  playDiskDropSound(props.isMuted)
  errorMessage.value = null
}

// 胜利结算
const handleVictory = () => {
  if (timerInterval) clearInterval(timerInterval)
  isPlaying.value = false
  isVictory.value = true
  playVictoryFanfare(props.isMuted)

  const duration = elapsedTime.value
  const moves = movesCount.value

  // 比较最佳记录（步数更少或相同步数用时更短）
  if (
    !bestRecord.value ||
    moves < bestRecord.value.moves ||
    (moves === bestRecord.value.moves && duration < bestRecord.value.timeMs)
  ) {
    bestRecord.value = { moves, timeMs: duration }
    isNewRecord.value = true
    localStorage.setItem(bestRecordKey.value, JSON.stringify(bestRecord.value))
  }

  emit('record-saved', {
    gameId: 'hanoi',
    timeMs: duration
  })
}

// 评级计算
const performanceEvaluation = computed(() => {
  const m = movesCount.value
  const opt = minMoves.value
  if (m === opt) {
    return { title: '完美无缺 · 理论极限！', desc: '步数分毫不差，精准匹配数学递归公式！', tag: '💎 极速大师' }
  }
  if (m <= opt * 1.25) {
    return { title: '卓越推演 · 行云流水！', desc: '近乎最优解，全局推演能力极其出众！', tag: '🌟 卓越' }
  }
  return { title: '顺利通关 · 功德圆满！', desc: '成功将所有圆盘移至目标柱，思维耐力可嘉！', tag: '👍 通关' }
})

onMounted(() => {
  resetGame()
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<template>
  <div class="hanoi-tower-game">
    <!-- 1. 顶部控制栏 -->
    <div class="game-top-bar">
      <button type="button" class="back-hub-btn" @click="emit('back')">
        <el-icon><Back /></el-icon>
        <span>脑力大厅</span>
      </button>

      <div class="game-title-center">
        <h2 class="title-text">汉诺塔</h2>
        <span class="game-badge">递归推演 · 步骤优化</span>
      </div>

      <div class="top-bar-right">
        <button
          type="button"
          class="undo-top-btn"
          :disabled="moveHistory.length === 0"
          @click="undoLastMove"
        >
          ↩️ 撤销一步
        </button>
        <button type="button" class="restart-top-btn" @click="resetGame">
          <el-icon><RefreshRight /></el-icon>
          <span>重置</span>
        </button>
      </div>
    </div>

    <!-- 2. 阶数选择与数据仪表盘 -->
    <div class="controls-panel">
      <!-- 阶数选择 -->
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

      <!-- 数值统计 -->
      <div class="stats-panel">
        <div class="stat-box">
          <span class="stat-label">👆 当前步数</span>
          <span class="stat-value" :class="{ highlight: movesCount <= minMoves }">
            {{ movesCount }}
          </span>
        </div>

        <div class="stat-box">
          <span class="stat-label">🎯 最优理论步数</span>
          <span class="stat-value target">2^{{ currentLevel.disks }} - 1 = {{ minMoves }} 步</span>
        </div>

        <div class="stat-box">
          <span class="stat-label">⏱️ 用时</span>
          <span class="stat-value">{{ formatTime(elapsedTime) }}</span>
        </div>
      </div>

      <!-- 最佳纪录展示 -->
      <div class="best-record-pill">
        <span class="record-icon">🏆</span>
        <span class="record-text">
          最佳：{{ bestRecord ? `${bestRecord.moves}步 (${formatTime(bestRecord.timeMs)})` : '暂无纪录' }}
        </span>
      </div>

      <!-- 错误警告提示 -->
      <div v-if="errorMessage" class="error-banner">
        ⚠️ {{ errorMessage }}
      </div>
    </div>

    <!-- 3. 汉诺塔柱子与圆盘实体展示区 -->
    <div class="tower-stage-wrapper">
      <div class="pegs-container">
        <!-- 3 根柱子 -->
        <div
          v-for="(pegDisks, pIdx) in pegs"
          :key="pIdx"
          class="peg-column"
          :class="{
            'is-selected': selectedPegIdx === pIdx,
            'is-shaking': shakingPeg === pIdx
          }"
          @click="handlePegClick(pIdx)"
        >
          <!-- 选中提示气泡 -->
          <div class="peg-select-indicator">
            <span v-if="selectedPegIdx === pIdx" class="indicator-active">已选顶盘 ↑</span>
            <span v-else class="indicator-hint">点击放置/选择</span>
          </div>

          <!-- 垂直插杆 -->
          <div class="peg-rod"></div>

          <!-- 圆盘栈结构（自底向上） -->
          <div class="disks-stack">
            <div
              v-for="(diskSize, dIdx) in pegDisks"
              :key="diskSize"
              class="disk-item"
              :class="{
                'is-top-selected': selectedPegIdx === pIdx && dIdx === pegDisks.length - 1
              }"
              :style="getDiskStyle(diskSize)"
            >
              <span class="disk-num">{{ diskSize }}</span>
            </div>
          </div>

          <!-- 底座 -->
          <div class="peg-base">
            <span class="peg-label">
              {{ pIdx === 0 ? 'A (起始柱)' : pIdx === 1 ? 'B (中转柱)' : 'C (目标柱)' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作提示 -->
    <div class="game-footer-tips">
      <span class="tip-item">💡 规则：每次只能移动最上方的一只圆盘，且<strong>大圆盘绝对不能落在小圆盘上方</strong></span>
      <span class="tip-item">📐 数学之美：n 阶汉诺塔理论最优步数为 2ⁿ - 1 步，支持随时撤销纠错</span>
    </div>

    <!-- 4. 胜利通关模态弹窗 -->
    <div v-if="isVictory" class="victory-modal-mask">
      <div class="victory-card">
        <div class="victory-icon">🎉</div>
        <h3 class="victory-title">{{ performanceEvaluation.title }}</h3>
        <p class="victory-sub">{{ performanceEvaluation.desc }}</p>

        <div class="victory-tag-pill">{{ performanceEvaluation.tag }}</div>

        <div class="victory-stats-row">
          <div class="stat-cell">
            <span class="stat-label">实际步数</span>
            <span class="stat-val highlight">{{ movesCount }} 步</span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">理论最优</span>
            <span class="stat-val">{{ minMoves }} 步</span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">耗时</span>
            <span class="stat-val">{{ formatTime(elapsedTime) }}</span>
          </div>
        </div>

        <div v-if="isNewRecord" class="new-record-pill">
          ✨ 刷新本阶历史最佳纪录！
        </div>

        <div class="victory-actions">
          <button type="button" class="action-btn retry" @click="resetGame">
            <el-icon><RefreshRight /></el-icon>
            <span>再战一局</span>
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
.hanoi-tower-game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 860px;
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
  border-color: #f59e0b;
  color: #f59e0b;
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
  color: #f59e0b;
  font-weight: 600;
  margin-top: 2px;
}

.top-bar-right {
  display: flex;
  gap: 8px;
}

.undo-top-btn, .restart-top-btn {
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

.undo-top-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.undo-top-btn:not(:disabled):hover, .restart-top-btn:hover {
  border-color: #f59e0b;
  color: #f59e0b;
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
  border-color: #f59e0b;
  color: #f59e0b;
}

.level-pill.active {
  background: rgba(245, 158, 11, 0.12);
  border-color: #f59e0b;
  color: #f59e0b;
  font-weight: 700;
}

.stats-panel {
  display: flex;
  gap: 20px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 8px 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

.stat-value {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.stat-value.highlight {
  color: #10b981;
}

.stat-value.target {
  color: #f59e0b;
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

.error-banner {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 600;
  animation: shake 0.35s ease-in-out;
}

/* 汉诺塔主体舞台 */
.tower-stage-wrapper {
  padding: 24px 16px 16px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 20px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
  width: 100%;
  user-select: none;
}

.pegs-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  width: 100%;
  height: 280px;
}

.peg-column {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  cursor: pointer;
  border-radius: 16px;
  transition: all 0.2s;
  padding: 0 8px;
}

.peg-column:hover {
  background: var(--bg-page, rgba(241, 245, 249, 0.6));
}

.peg-column.is-selected {
  background: rgba(245, 158, 11, 0.08);
  outline: 2px dashed #f59e0b;
}

.peg-select-indicator {
  position: absolute;
  top: 6px;
  font-size: 11px;
  font-weight: 700;
}

.indicator-active {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  padding: 2px 8px;
  border-radius: 8px;
  animation: bounce 0.8s infinite alternate;
}

.indicator-hint {
  color: transparent;
  transition: color 0.15s;
}

.peg-column:hover .indicator-hint {
  color: var(--text-secondary, #94a3b8);
}

/* 垂直金属立杆 */
.peg-rod {
  position: absolute;
  bottom: 24px;
  width: 12px;
  height: 200px;
  background: linear-gradient(to right, #94a3b8, #cbd5e1, #64748b);
  border-radius: 6px 6px 0 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  z-index: 1;
}

/* 圆盘栈容器 */
.disks-stack {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  width: 100%;
  margin-bottom: 24px;
}

/* 单个圆盘样式 */
.disk-item {
  height: 28px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2), inset 0 2px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.25);
  margin-top: -2px;
}

.disk-item.is-top-selected {
  transform: translateY(-16px);
  box-shadow: 0 10px 20px rgba(245, 158, 11, 0.4);
  outline: 2px solid #ffffff;
}

.disk-num {
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

/* 底座 */
.peg-base {
  width: 100%;
  height: 24px;
  background: linear-gradient(135deg, #334155, #1e293b);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
  z-index: 3;
}

.peg-label {
  font-size: 11px;
  font-weight: 700;
  color: #cbd5e1;
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
  max-width: 400px;
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

.victory-tag-pill {
  font-size: 12px;
  font-weight: 700;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  padding: 4px 14px;
  border-radius: 12px;
}

.victory-stats-row {
  display: flex;
  gap: 16px;
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
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.stat-val.highlight {
  color: #10b981;
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
  background: #f59e0b;
  color: #ffffff;
}

.action-btn.retry:hover {
  background: #d97706;
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

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-4px); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
</style>
