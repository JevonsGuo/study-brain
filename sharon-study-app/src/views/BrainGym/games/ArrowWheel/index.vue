<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { playShootSound, playWrongTile, playLevelUpSound } from '../../sound'
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

// 关卡配置生成
interface LevelConfig {
  level: number
  initialPins: number[] // 初始针的角度（弧度）
  totalPinsToShoot: number
  rotationSpeed: number // 弧度/帧
}

const getLevelConfig = (lvl: number): LevelConfig => {
  const initCount = Math.min(8, 2 + Math.floor(lvl / 2))
  const initialPins: number[] = []
  for (let i = 0; i < initCount; i++) {
    initialPins.push((Math.PI * 2 / initCount) * i)
  }
  const speedDir = lvl % 3 === 0 ? -1 : 1
  const baseSpeed = (0.018 + Math.min(0.025, lvl * 0.003)) * speedDir

  return {
    level: lvl,
    initialPins,
    totalPinsToShoot: Math.min(15, 5 + Math.floor(lvl * 1.2)),
    rotationSpeed: baseSpeed
  }
}

const currentLevel = ref(1)
const bestLevel = ref(1)
const remainingPins = ref(6)
const isGameOver = ref(false)
const isLevelCleared = ref(false)
const isShaking = ref(false)

const BEST_LEVEL_KEY = 'study_arrow_best_level'

const loadBestLevel = () => {
  const saved = localStorage.getItem(BEST_LEVEL_KEY) || localStorage.getItem('sharon_arrow_best_level')
  bestLevel.value = saved ? Number(saved) : 1
}

const saveBestLevel = () => {
  if (currentLevel.value > bestLevel.value) {
    bestLevel.value = currentLevel.value
    localStorage.setItem(BEST_LEVEL_KEY, String(bestLevel.value))
    emit('record-saved', {
      gameId: 'arrow',
      timeMs: currentLevel.value * 1000
    })
  }
}

// Canvas 与物理参数
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animFrameId: number | null = null

// 旋转靶心中心坐标与半径
const CENTER_X = 200
const CENTER_Y = 160
const WHEEL_RADIUS = 46
const PIN_LENGTH = 90
const PIN_HEAD_RADIUS = 9
const SHOOT_SPEED = 18
const COLLISION_THRESHOLD = 0.22 // 弧度阈值（约12.6度）

// 旋转靶心当前角度
let currentRotation = 0
// 当前钉在轮上的针（角度列表，弧度）
let pinnedAngles: number[] = []
// 正在飞行的针
let flyingPin: { y: number; number: number } | null = null
let currentConfig: LevelConfig = getLevelConfig(1)

// 初始化当前关卡
const initLevel = (lvl: number) => {
  currentLevel.value = lvl
  currentConfig = getLevelConfig(lvl)
  pinnedAngles = [...currentConfig.initialPins]
  remainingPins.value = currentConfig.totalPinsToShoot
  flyingPin = null
  isGameOver.value = false
  isLevelCleared.value = false
  isShaking.value = false
  loadBestLevel()
}

// 发射一根针
const shootPin = () => {
  if (isGameOver.value || isLevelCleared.value || flyingPin !== null || remainingPins.value <= 0) return

  const pinNumber = currentConfig.totalPinsToShoot - remainingPins.value + 1
  remainingPins.value--

  flyingPin = {
    y: 380, // 底部发射位置
    number: pinNumber
  }
  playShootSound(props.isMuted)
}

// 主渲染与物理循环
const renderLoop = () => {
  if (!ctx || !canvasRef.value) return

  const cvs = canvasRef.value
  ctx.clearRect(0, 0, cvs.width, cvs.height)

  // 1. 旋转靶心递增
  if (!isGameOver.value) {
    currentRotation += currentConfig.rotationSpeed
    if (currentRotation > Math.PI * 2) currentRotation -= Math.PI * 2
    if (currentRotation < -Math.PI * 2) currentRotation += Math.PI * 2
  }

  // 2. 绘制插在靶心上的所有针
  pinnedAngles.forEach((ang) => {
    const totalAngle = ang + currentRotation
    const startX = CENTER_X + Math.cos(totalAngle) * WHEEL_RADIUS
    const startY = CENTER_Y + Math.sin(totalAngle) * WHEEL_RADIUS
    const endX = CENTER_X + Math.cos(totalAngle) * (WHEEL_RADIUS + PIN_LENGTH)
    const endY = CENTER_Y + Math.sin(totalAngle) * (WHEEL_RADIUS + PIN_LENGTH)

    // 针杆
    ctx!.beginPath()
    ctx!.moveTo(startX, startY)
    ctx!.lineTo(endX, endY)
    ctx!.strokeStyle = '#6366f1'
    ctx!.lineWidth = 2
    ctx!.stroke()

    // 针头圆球
    ctx!.beginPath()
    ctx!.arc(endX, endY, PIN_HEAD_RADIUS, 0, Math.PI * 2)
    ctx!.fillStyle = '#6366f1'
    ctx!.fill()
  })

  // 3. 绘制中心大圆盘
  ctx.beginPath()
  ctx.arc(CENTER_X, CENTER_Y, WHEEL_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = '#1e1b4b'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#818cf8'
  ctx.stroke()

  // 靶心文字（当前关卡）
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 16px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`LV.${currentLevel.value}`, CENTER_X, CENTER_Y)

  // 4. 更新与绘制飞行的针
  if (flyingPin) {
    flyingPin.y -= SHOOT_SPEED

    const targetY = CENTER_Y + WHEEL_RADIUS

    if (flyingPin.y <= targetY) {
      // 触碰到了靶盘边缘！计算撞击点的绝对角度（在正下方，即 Math.PI / 2）
      const hitAngle = Math.PI / 2
      // 减去靶盘的当前旋转，得出相对于靶盘本地的角度
      let relativeAngle = hitAngle - currentRotation
      relativeAngle = ((relativeAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

      // 碰撞检测：检查是否与已有的针发生干涉
      let collided = false
      for (const existing of pinnedAngles) {
        let diff = Math.abs(existing - relativeAngle)
        if (diff > Math.PI) diff = Math.PI * 2 - diff
        if (diff < COLLISION_THRESHOLD) {
          collided = true
          break
        }
      }

      if (collided) {
        // 碰撞失败！
        isGameOver.value = true
        isShaking.value = true
        playWrongTile(props.isMuted)
        setTimeout(() => { isShaking.value = false }, 500)
      } else {
        // 成功插针！
        pinnedAngles.push(relativeAngle)
        flyingPin = null

        // 检查关卡是否全部插完
        if (remainingPins.value === 0) {
          isLevelCleared.value = true
          saveBestLevel()
          playLevelUpSound(props.isMuted)
        }
      }
    } else {
      // 绘制飞行动画中的针
      ctx.beginPath()
      ctx.moveTo(CENTER_X, flyingPin.y)
      ctx.lineTo(CENTER_X, flyingPin.y + PIN_LENGTH)
      ctx.strokeStyle = '#ec4899'
      ctx.lineWidth = 2.5
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(CENTER_X, flyingPin.y + PIN_LENGTH, PIN_HEAD_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#ec4899'
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(flyingPin.number), CENTER_X, flyingPin.y + PIN_LENGTH)
    }
  }

  // 5. 绘制待发射排队的针队列预览
  const queueCount = Math.min(5, remainingPins.value)
  for (let i = 0; i < queueCount; i++) {
    const qY = 380 + i * 28
    const pinNum = currentConfig.totalPinsToShoot - remainingPins.value + 1 + i
    ctx.beginPath()
    ctx.arc(CENTER_X, qY, PIN_HEAD_RADIUS - 1, 0, Math.PI * 2)
    ctx.fillStyle = i === 0 ? '#ec4899' : 'rgba(236, 72, 153, 0.4)'
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = '9px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(pinNum), CENTER_X, qY)
  }

  animFrameId = requestAnimationFrame(renderLoop)
}

// 下一关
const handleNextLevel = () => {
  initLevel(currentLevel.value + 1)
}

// 重新本关
const handleRetry = () => {
  initLevel(currentLevel.value)
}

// 键盘与点击控制
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    e.preventDefault()
    shootPin()
  }
}

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    initLevel(1)
    renderLoop()
  }
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="arrow-game-container">
    <!-- 顶部栏 -->
    <div class="game-header">
      <div class="header-left">
        <button type="button" class="back-btn" @click="emit('back')" title="返回大厅">
          <el-icon><Back /></el-icon>
          <span>大厅</span>
        </button>
        <div class="title-group">
          <span class="game-title">🎯 见缝插针</span>
          <span class="game-badge">节奏把控与瞬时反应</span>
        </div>
      </div>

      <div class="header-right">
        <button type="button" class="restart-btn" @click="handleRetry" title="重新挑战">
          <el-icon><RefreshRight /></el-icon>
          <span>重试</span>
        </button>
      </div>
    </div>

    <!-- 状态指示板 -->
    <div class="metrics-bar">
      <div class="metric-card">
        <span class="m-label">🚩 当前关卡</span>
        <span class="m-val highlight">第 {{ currentLevel }} 关</span>
      </div>
      <div class="metric-card">
        <span class="m-label">🎯 剩余针数</span>
        <span class="m-val">{{ remainingPins }} 根</span>
      </div>
      <div class="metric-card">
        <span class="m-label">🏆 最佳关卡</span>
        <span class="m-val font-mono">LV.{{ bestLevel }}</span>
      </div>
    </div>

    <!-- 游戏主舞台 Canvas -->
    <div
      class="canvas-stage"
      :class="{ 'is-shaking': isShaking }"
      @click="shootPin"
    >
      <canvas
        ref="canvasRef"
        width="400"
        height="480"
        class="game-canvas"
      ></canvas>

      <!-- 关卡成功浮层 -->
      <div v-if="isLevelCleared" class="overlay success-overlay">
        <span class="overlay-emoji">🎉</span>
        <h3 class="overlay-title">PASS！第 {{ currentLevel }} 关达成</h3>
        <p class="overlay-desc">反应敏锐，成功避开所有针尖！</p>
        <div class="overlay-actions">
          <el-button type="primary" size="large" @click.stop="handleNextLevel">
            挑战第 {{ currentLevel + 1 }} 关 →
          </el-button>
        </div>
      </div>

      <!-- 关卡失败浮层 -->
      <div v-if="isGameOver" class="overlay fail-overlay">
        <span class="overlay-emoji">💥</span>
        <h3 class="overlay-title">针尖发生碰撞！</h3>
        <p class="overlay-desc">停留在第 {{ currentLevel }} 关，找准节奏再试一次！</p>
        <div class="overlay-actions">
          <el-button size="large" @click.stop="emit('back')">返回大厅</el-button>
          <el-button type="primary" size="large" @click.stop="handleRetry">
            重新挑战
          </el-button>
        </div>
      </div>
    </div>

    <!-- 底部发射大按钮与提示 -->
    <div class="shoot-action-bar">
      <button
        type="button"
        class="shoot-big-btn"
        :disabled="isGameOver || isLevelCleared"
        @click="shootPin"
      >
        <span>🎯 点击射出针尖 (空格键)</span>
      </button>
      <span class="hint-text">点击屏幕任意区域或按键盘【空格键】快速发射</span>
    </div>
  </div>
</template>

<style scoped>
.arrow-game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 480px;
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
  background: rgba(236, 72, 153, 0.12);
  color: #db2777;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
}

.restart-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 12px;
  border: 1px solid #ec4899;
  background: rgba(236, 72, 153, 0.08);
  color: #db2777;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.restart-btn:hover {
  background: #ec4899;
  color: #ffffff;
}

/* 状态条 */
.metrics-bar {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  width: 100%;
}

.metric-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 8px 12px;
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

.m-val.highlight {
  color: #ec4899;
}

.font-mono {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
}

/* Canvas 舞台 */
.canvas-stage {
  position: relative;
  width: 100%;
  max-width: 400px;
  background: var(--bg-card, #ffffff);
  border: 2px solid var(--border-color, #e2e8f0);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  user-select: none;
}

.game-canvas {
  display: block;
  width: 100%;
  height: 480px;
}

.is-shaking {
  animation: shakeStage 0.4s ease;
  border-color: #ef4444 !important;
}

@keyframes shakeStage {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(5px); }
}

/* 浮层 */
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  animation: fadeIn 0.2s ease;
  z-index: 10;
}

:deep(.dark) .overlay {
  background: rgba(15, 23, 42, 0.95);
}

.overlay-emoji {
  font-size: 48px;
  margin-bottom: 8px;
}

.overlay-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0 0 6px;
}

.overlay-desc {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  margin: 0 0 20px;
}

.overlay-actions {
  display: flex;
  gap: 12px;
}

/* 发射按钮 */
.shoot-action-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.shoot-big-btn {
  width: 100%;
  padding: 12px 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ec4899, #f43f5e);
  color: #ffffff;
  border: none;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(236, 72, 153, 0.3);
}

.shoot-big-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(236, 72, 153, 0.4);
}

.shoot-big-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.shoot-big-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint-text {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}
</style>
