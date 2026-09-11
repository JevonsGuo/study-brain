<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { playCardFlipSound, playMergeSound, playVictoryFanfare } from '../../sound'
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

// 学霸理科专属图符库
const EMOJI_POOLS = [
  { icon: '📐', name: '几何三角' },
  { icon: '🧪', name: '化学反应' },
  { icon: '🧬', name: '双螺旋' },
  { icon: '⚡', name: '电磁物理' },
  { icon: '🪐', name: '天体引力' },
  { icon: '💡', name: '顿悟灵感' },
  { icon: '🏆', name: '学霸金杯' },
  { icon: '🎯', name: '精准命中' },
  { icon: '📖', name: '经典教材' },
  { icon: '🔭', name: '射电巡天' },
  { icon: '🚀', name: '航天探索' },
  { icon: '🧮', name: '速算心算' }
]

interface LevelConfig {
  name: string
  rows: number
  cols: number
  pairs: number
  key: string
}

const LEVELS: LevelConfig[] = [
  { name: '4×4 (8对 · 初级)', rows: 4, cols: 4, pairs: 8, key: '4x4' },
  { name: '4×5 (10对 · 进阶)', rows: 4, cols: 5, pairs: 10, key: '4x5' },
  { name: '4×6 (12对 · 挑战)', rows: 4, cols: 6, pairs: 12, key: '4x6' }
]

const currentLevelIdx = ref(0)
const currentLevel = computed(() => LEVELS[currentLevelIdx.value])

interface Card {
  id: number
  pairId: number
  icon: string
  name: string
  isFlipped: boolean
  isMatched: boolean
}

const cards = ref<Card[]>([])
const flippedIndices = ref<number[]>([])
const isLocked = ref(false)
const flipsCount = ref(0)
const startTime = ref(0)
const elapsedTime = ref(0)
const isPlaying = ref(false)
const isVictory = ref(false)
const isNewRecord = ref(false)
let timerInterval: ReturnType<typeof setInterval> | null = null

// 配对完成对数
const matchedPairsCount = computed(() => {
  return cards.value.filter(c => c.isMatched).length / 2
})

// 最佳记录持久化（综合以最少步数与最少时间评价）
const bestRecordKey = computed(() => `sharon_memory_best_${currentLevel.value.key}`)
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

// 洗牌并初始化卡片
const initCards = () => {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null

  const { pairs } = currentLevel.value
  const selectedPool = EMOJI_POOLS.slice(0, pairs)

  const cardList: Card[] = []
  let cardId = 0

  selectedPool.forEach((item, pIdx) => {
    // 每一对由两张相同图符的卡片组成
    cardList.push({
      id: cardId++,
      pairId: pIdx,
      icon: item.icon,
      name: item.name,
      isFlipped: false,
      isMatched: false
    })
    cardList.push({
      id: cardId++,
      pairId: pIdx,
      icon: item.icon,
      name: item.name,
      isFlipped: false,
      isMatched: false
    })
  })

  // 随机洗牌 (Fisher-Yates)
  for (let i = cardList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = cardList[i]
    cardList[i] = cardList[j]
    cardList[j] = temp
  }

  cards.value = cardList
  flippedIndices.value = []
  isLocked.value = false
  flipsCount.value = 0
  elapsedTime.value = 0
  isPlaying.value = false
  isVictory.value = false
  isNewRecord.value = false
  loadBestRecord()
}

// 切换难度
const switchLevel = (idx: number) => {
  if (currentLevelIdx.value === idx) return
  currentLevelIdx.value = idx
  initCards()
}

// 点击卡片翻转
const handleCardClick = (idx: number) => {
  if (isLocked.value || isVictory.value) return
  const card = cards.value[idx]

  // 已翻开或已消除的不响应
  if (card.isFlipped || card.isMatched) return

  // 启动计时
  if (!isPlaying.value) {
    isPlaying.value = true
    startTime.value = Date.now()
    timerInterval = setInterval(() => {
      elapsedTime.value = Date.now() - startTime.value
    }, 1000)
  }

  // 翻开该卡片
  card.isFlipped = true
  playCardFlipSound(props.isMuted)
  flippedIndices.value.push(idx)

  // 翻开第一张卡片
  if (flippedIndices.value.length === 1) {
    return
  }

  // 翻开第二张卡片：进行匹配判定
  if (flippedIndices.value.length === 2) {
    flipsCount.value++
    const [firstIdx, secondIdx] = flippedIndices.value
    const firstCard = cards.value[firstIdx]
    const secondCard = cards.value[secondIdx]

    if (firstCard.pairId === secondCard.pairId) {
      // 匹配成功！
      firstCard.isMatched = true
      secondCard.isMatched = true
      playMergeSound(props.isMuted, 8)
      flippedIndices.value = []

      // 检查全部配对成功
      if (matchedPairsCount.value === currentLevel.value.pairs) {
        handleVictory()
      }
    } else {
      // 匹配失败，锁定 650ms 供记忆后翻回
      isLocked.value = true
      setTimeout(() => {
        firstCard.isFlipped = false
        secondCard.isFlipped = false
        flippedIndices.value = []
        isLocked.value = false
      }, 650)
    }
  }
}

// 胜利结算
const handleVictory = () => {
  if (timerInterval) clearInterval(timerInterval)
  isPlaying.value = false
  isVictory.value = true
  playVictoryFanfare(props.isMuted)

  const duration = elapsedTime.value
  const moves = flipsCount.value

  // 更新最佳记录（优先比较更少步数，步数相同比较更快用时）
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
    gameId: 'memory',
    timeMs: duration
  })
}

onMounted(() => {
  initCards()
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<template>
  <div class="memory-match-game">
    <!-- 1. 顶部控制栏 -->
    <div class="game-top-bar">
      <button type="button" class="back-hub-btn" @click="emit('back')">
        <el-icon><Back /></el-icon>
        <span>脑力大厅</span>
      </button>

      <div class="game-title-center">
        <h2 class="title-text">记忆翻牌</h2>
        <span class="game-badge">工作记忆 · 图像映射</span>
      </div>

      <div class="top-bar-right">
        <button type="button" class="restart-top-btn" @click="initCards">
          <el-icon><RefreshRight /></el-icon>
          <span>重新洗牌</span>
        </button>
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

      <!-- 状态数值面板 -->
      <div class="stats-panel">
        <div class="stat-box">
          <span class="stat-label">✨ 配对进度</span>
          <span class="stat-value highlight">{{ matchedPairsCount }} / {{ currentLevel.pairs }}</span>
        </div>

        <div class="stat-box">
          <span class="stat-label">👆 翻牌次数</span>
          <span class="stat-value">{{ flipsCount }} 次</span>
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
    </div>

    <!-- 3. 3D 翻转卡片网格 -->
    <div class="cards-board-wrapper">
      <div
        class="cards-grid"
        :style="{
          gridTemplateColumns: `repeat(${currentLevel.cols}, minmax(0, 1fr))`,
          maxWidth: `${Math.min(640, currentLevel.cols * 95)}px`
        }"
      >
        <div
          v-for="(card, idx) in cards"
          :key="card.id"
          class="card-container"
          :class="{
            'is-flipped': card.isFlipped || card.isMatched,
            'is-matched': card.isMatched
          }"
          @click="handleCardClick(idx)"
        >
          <div class="card-inner">
            <!-- 卡片背面（朝上盖着时） -->
            <div class="card-face card-back">
              <div class="card-back-pattern">
                <span class="back-logo">✦</span>
              </div>
            </div>

            <!-- 卡片正面（翻开展示图符） -->
            <div class="card-face card-front">
              <span class="front-emoji">{{ card.icon }}</span>
              <span class="front-label">{{ card.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作提示 -->
    <div class="game-footer-tips">
      <span class="tip-item">💡 观察与联想：每次翻开两张，相同理科图符立即消除</span>
      <span class="tip-item">🧠 训练目标：在脑海构建空间网格坐标，挑战最少步数全消</span>
    </div>

    <!-- 4. 胜利通关模态弹窗 -->
    <div v-if="isVictory" class="victory-modal-mask">
      <div class="victory-card">
        <div class="victory-icon">🎉</div>
        <h3 class="victory-title">超凡记忆 · 全部配对！</h3>
        <p class="victory-sub">你凭借卓越的空间工作记忆，完成了所有卡片归位！</p>

        <div class="victory-stats-row">
          <div class="stat-cell">
            <span class="stat-label">翻牌次数</span>
            <span class="stat-val highlight">{{ flipsCount }} 次</span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">总用时</span>
            <span class="stat-val">{{ formatTime(elapsedTime) }}</span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">难度</span>
            <span class="stat-val">{{ currentLevel.name }}</span>
          </div>
        </div>

        <div v-if="isNewRecord" class="new-record-pill">
          ✨ 突破本难度历史最佳纪录！
        </div>

        <div class="victory-actions">
          <button type="button" class="action-btn retry" @click="initCards">
            <el-icon><RefreshRight /></el-icon>
            <span>再玩一局</span>
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
.memory-match-game {
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
  border-color: #8b5cf6;
  color: #8b5cf6;
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
  color: #8b5cf6;
  font-weight: 600;
  margin-top: 2px;
}

.restart-top-btn {
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

.restart-top-btn:hover {
  border-color: #8b5cf6;
  color: #8b5cf6;
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
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.level-pill.active {
  background: rgba(139, 92, 246, 0.12);
  border-color: #8b5cf6;
  color: #8b5cf6;
  font-weight: 700;
}

.stats-panel {
  display: flex;
  gap: 16px;
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
  color: #8b5cf6;
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

/* 3D 翻转卡片容器 */
.cards-board-wrapper {
  padding: 20px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 20px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
  width: 100%;
  display: flex;
  justify-content: center;
  user-select: none;
}

.cards-grid {
  display: grid;
  gap: 12px;
  width: 100%;
}

.card-container {
  aspect-ratio: 3/4;
  perspective: 800px;
  cursor: pointer;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.card-container.is-flipped .card-inner {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
}

/* 卡片背面：时尚几何渐变纹样 */
.card-back {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
  border: 2px solid rgba(255, 255, 255, 0.4);
  transition: transform 0.15s, box-shadow 0.15s;
}

.card-container:hover:not(.is-flipped) .card-back {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(139, 92, 246, 0.3);
}

.card-back-pattern {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-logo {
  color: #ffffff;
  font-size: 16px;
  opacity: 0.9;
}

/* 卡片正面：图符与标识 */
.card-front {
  background: var(--bg-card, #ffffff);
  border: 2px solid #e2e8f0;
  transform: rotateY(180deg);
  gap: 4px;
  padding: 6px;
}

.front-emoji {
  font-size: 28px;
  line-height: 1;
}

.front-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-regular, #475569);
  white-space: nowrap;
}

/* 已配对消除高亮 */
.card-container.is-matched .card-front {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.08);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);
}

.card-container.is-matched .front-label {
  color: #10b981;
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
  color: #8b5cf6;
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
  background: #8b5cf6;
  color: #ffffff;
}

.action-btn.retry:hover {
  background: #7c3aed;
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
</style>
