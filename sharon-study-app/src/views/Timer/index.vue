<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'

const LONG_BREAK = 15 * 60
const LONG_BREAK_INTERVAL = 4

const workDuration = ref(25)
const breakDuration = ref(5)
const totalSeconds = ref(workDuration.value * 60)
const isRunning = ref(false)
const isBreak = ref(false)
const completedPomodoros = ref(0)
const todayPomodoros = ref(0)
const autoStartBreak = ref(true)
const showSettings = ref(false)
const isMuted = ref(false)
const currentMusic = ref(0)
const musicPlaying = ref(false)

const musicList = [
  { name: '雨声', icon: '🌧️', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_8cb18d7d82.mp3' },
  { name: '钢琴', icon: '🎹', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf1ac.mp3' },
  { name: '森林', icon: '🌲', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_115e6b3ed8.mp3' },
  { name: '海浪', icon: '🌊', url: 'https://cdn.pixabay.com/audio/2024/11/04/audio_4956204700.mp3' },
]

let interval: ReturnType<typeof setInterval> | null = null
let audio: HTMLAudioElement | null = null

const minutes = computed(() => String(Math.floor(totalSeconds.value / 60)).padStart(2, '0'))
const seconds = computed(() => String(totalSeconds.value % 60).padStart(2, '0'))

const currentDuration = computed(() => {
  if (isBreak.value) {
    return (completedPomodoros.value % LONG_BREAK_INTERVAL === 0 && completedPomodoros.value > 0)
      ? LONG_BREAK : breakDuration.value * 60
  }
  return workDuration.value * 60
})

const progress = computed(() => {
  const total = currentDuration.value
  return ((total - totalSeconds.value) / total) * 100
})

const circumference = 2 * Math.PI * 130
const strokeDashoffset = computed(() => {
  return circumference - (progress.value / 100) * circumference
})

const ringBg = computed(() => isBreak.value ? 'rgba(82,196,26,0.1)' : 'rgba(99,102,241,0.1)')
const gradientStart = computed(() => isBreak.value ? '#52c41a' : '#6366f1')
const gradientEnd = computed(() => isBreak.value ? '#95de64' : '#818cf8')

const playMusic = () => {
  if (audio) { audio.pause(); audio = null }
  const track = musicList[currentMusic.value]
  if (!track) return
  audio = new Audio(track.url)
  audio.loop = true
  audio.volume = isMuted.value ? 0 : 0.3
  audio.play().catch(() => {})
  musicPlaying.value = true
}

const stopMusic = () => {
  if (audio) { audio.pause(); audio = null }
  musicPlaying.value = false
}

const toggleMute = () => { isMuted.value = !isMuted.value }

const switchMusic = (index: number) => {
  currentMusic.value = index
  if (musicPlaying.value) playMusic()
}

const start = () => {
  if (isRunning.value) return
  isRunning.value = true
  if (!musicPlaying.value && !isBreak.value) playMusic()
  interval = setInterval(() => {
    if (totalSeconds.value > 0) {
      totalSeconds.value--
    } else {
      onComplete()
    }
  }, 1000)
}

const onComplete = () => {
  stop()
  playNotificationSound()
  if (!isBreak.value) {
    completedPomodoros.value++
    todayPomodoros.value++
    isBreak.value = true
    const breakTime = (completedPomodoros.value % LONG_BREAK_INTERVAL === 0) ? LONG_BREAK : breakDuration.value * 60
    totalSeconds.value = breakTime
    stopMusic()
    if (autoStartBreak.value) start()
  } else {
    isBreak.value = false
    totalSeconds.value = workDuration.value * 60
    if (autoStartBreak.value) { start(); playMusic() }
  }
}

const stop = () => {
  isRunning.value = false
  if (interval) { clearInterval(interval); interval = null }
}

const reset = () => {
  stop(); stopMusic()
  isBreak.value = false
  totalSeconds.value = workDuration.value * 60
}

const playNotificationSound = () => {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880; gain.gain.value = 0.15
    osc.start(); osc.stop(ctx.currentTime + 0.3)
    setTimeout(() => {
      const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain()
      osc2.connect(gain2); gain2.connect(ctx.destination)
      osc2.frequency.value = 1100; gain2.gain.value = 0.15
      osc2.start(); osc2.stop(ctx.currentTime + 0.5)
    }, 350)
  } catch { /* silent */ }
}

const saveSettings = () => {
  if (!isRunning.value) {
    totalSeconds.value = isBreak.value ? breakDuration.value * 60 : workDuration.value * 60
  }
  showSettings.value = false
}

watch(isMuted, (val) => { if (audio) audio.volume = val ? 0 : 0.3 })
onUnmounted(() => { stop(); stopMusic() })
</script>

<template>
  <div class="timer-page">
    <div class="timer-hero" :style="{ background: `linear-gradient(135deg, ${gradientStart}15 0%, ${gradientEnd}08 100%)` }">
      <div class="hero-top">
        <div class="status-pill" :class="{ break: isBreak }">
          <span class="status-dot"></span>
          {{ isBreak ? '休息中' : '专注中' }}
        </div>
        <el-button text circle @click="showSettings = true" class="settings-btn">
          <el-icon size="18"><Setting /></el-icon>
        </el-button>
      </div>

      <div class="ring-wrapper">
        <svg class="progress-ring" viewBox="0 0 280 280">
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" :stop-color="gradientStart" />
              <stop offset="100%" :stop-color="gradientEnd" />
            </linearGradient>
          </defs>
          <circle class="ring-bg" cx="140" cy="140" r="130" :stroke="ringBg" />
          <circle
            class="ring-progress"
            cx="140" cy="140" r="130"
            :stroke="'url(#ringGradient)'"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="strokeDashoffset"
            stroke-linecap="round"
            transform="rotate(-90 140 140)"
          />
        </svg>
        <div class="ring-content">
          <div class="time-display">{{ minutes }}<span class="time-colon">:</span>{{ seconds }}</div>
          <div class="time-label">{{ isBreak ? (completedPomodoros % LONG_BREAK_INTERVAL === 0 && completedPomodoros > 0 ? '长休息' : '短休息') : '保持专注' }}</div>
        </div>
      </div>

      <div class="action-row">
        <button v-if="!isRunning" class="action-btn start-btn" @click="start">
          <el-icon size="20"><VideoPlay /></el-icon>
          <span>开始</span>
        </button>
        <button v-else class="action-btn pause-btn" @click="stop">
          <el-icon size="20"><VideoPause /></el-icon>
          <span>暂停</span>
        </button>
        <button class="action-btn reset-btn" @click="reset">
          <el-icon size="18"><RefreshLeft /></el-icon>
        </button>
      </div>
    </div>

    <div class="bottom-section">
      <div class="music-panel">
        <div class="music-header">
          <span class="music-title">🎵 学习背景音</span>
          <div class="music-btns">
            <button v-if="!musicPlaying" class="icon-btn" @click="playMusic" title="播放">
              <el-icon size="14"><VideoPlay /></el-icon>
            </button>
            <button v-else class="icon-btn active" @click="stopMusic" title="停止">
              <el-icon size="14"><VideoPause /></el-icon>
            </button>
            <button class="icon-btn" :class="{ muted: isMuted }" @click="toggleMute" :title="isMuted ? '取消静音' : '静音'">
              <el-icon size="14"><component :is="isMuted ? 'Mute' : 'Microphone'" /></el-icon>
            </button>
          </div>
        </div>
        <div class="music-tracks">
          <button
            v-for="(m, i) in musicList" :key="i"
            class="track-btn"
            :class="{ active: currentMusic === i }"
            @click="switchMusic(i)"
          >
            <span class="track-icon">{{ m.icon }}</span>
            <span class="track-name">{{ m.name }}</span>
          </button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-emoji">🍅</div>
          <div class="stat-val">{{ completedPomodoros }}</div>
          <div class="stat-key">总番茄</div>
        </div>
        <div class="stat-item">
          <div class="stat-emoji">📅</div>
          <div class="stat-val">{{ todayPomodoros }}</div>
          <div class="stat-key">今日</div>
        </div>
        <div class="stat-item">
          <div class="stat-emoji">⏱️</div>
          <div class="stat-val">{{ completedPomodoros * workDuration }}</div>
          <div class="stat-key">专注分</div>
        </div>
        <div class="stat-item tip-item">
          <div class="tip-text">每{{ LONG_BREAK_INTERVAL }}个番茄长休{{ LONG_BREAK / 60 }}分钟</div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showSettings" title="⏱ 番茄钟设置" width="380px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="专注时长">
          <el-input-number v-model="workDuration" :min="15" :max="60" :step="5" />
          <span class="unit">分钟</span>
        </el-form-item>
        <el-form-item label="短休息">
          <el-input-number v-model="breakDuration" :min="3" :max="15" :step="1" />
          <span class="unit">分钟</span>
        </el-form-item>
        <el-form-item label="自动切换">
          <el-switch v-model="autoStartBreak" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.timer-page {
  max-width: 540px;
  margin: 0 auto;
}

.timer-hero {
  border-radius: 20px;
  padding: 28px 32px 32px;
  margin-bottom: 20px;
  position: relative;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  background: rgba(99,102,241,0.1);
  color: #6366f1;
}

.status-pill.break {
  background: rgba(82,196,26,0.1);
  color: #52c41a;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.settings-btn {
  color: #909399;
}

.ring-wrapper {
  position: relative;
  width: 280px;
  height: 280px;
  margin: 16px auto 24px;
}

.progress-ring {
  width: 100%;
  height: 100%;
}

.ring-bg {
  fill: none;
  stroke-width: 6;
}

.ring-progress {
  fill: none;
  stroke-width: 6;
  transition: stroke-dashoffset 1s linear;
}

.ring-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.time-display {
  font-size: 56px;
  font-weight: 800;
  color: #1a1a2e;
  letter-spacing: -2px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.time-colon {
  opacity: 0.4;
  margin: 0 2px;
}

.time-label {
  font-size: 13px;
  color: #909399;
  margin-top: 8px;
  font-weight: 500;
}

.action-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.action-btn {
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.25s;
  color: #fff;
  border-radius: 28px;
}

.start-btn {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  padding: 12px 36px;
  box-shadow: 0 4px 16px rgba(99,102,241,0.35);
}

.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99,102,241,0.45);
}

.pause-btn {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  padding: 12px 36px;
  box-shadow: 0 4px 16px rgba(245,158,11,0.35);
}

.pause-btn:hover {
  transform: translateY(-2px);
}

.reset-btn {
  background: rgba(0,0,0,0.06);
  color: #606266;
  padding: 12px 16px;
}

.reset-btn:hover {
  background: rgba(0,0,0,0.1);
}

.bottom-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.music-panel {
  background: #fff;
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.music-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.music-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.music-btns {
  display: flex;
  gap: 4px;
}

.icon-btn {
  border: none;
  background: #f0f2f5;
  border-radius: 8px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #606266;
  transition: all 0.2s;
}

.icon-btn:hover { background: #e4e7ed; }
.icon-btn.active { background: #6366f1; color: #fff; }
.icon-btn.muted { background: #fef0f0; color: #f56c6c; }

.music-tracks {
  display: flex;
  gap: 8px;
}

.track-btn {
  flex: 1;
  border: 2px solid #f0f2f5;
  background: #fff;
  border-radius: 12px;
  padding: 10px 6px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.track-btn:hover {
  border-color: #d5d8dc;
}

.track-btn.active {
  border-color: #6366f1;
  background: rgba(99,102,241,0.04);
}

.track-icon {
  font-size: 20px;
  display: block;
  margin-bottom: 4px;
}

.track-name {
  font-size: 11px;
  color: #606266;
}

.track-btn.active .track-name {
  color: #6366f1;
  font-weight: 600;
}

.stats-row {
  display: flex;
  gap: 12px;
}

.stat-item {
  flex: 1;
  background: #fff;
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.stat-emoji {
  font-size: 20px;
  margin-bottom: 2px;
}

.stat-val {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-key {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}

.tip-item {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}

.tip-text {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.unit {
  margin-left: 8px;
  color: #909399;
  font-size: 13px;
}
</style>
