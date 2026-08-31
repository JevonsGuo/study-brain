<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

const WORK_TIME = 25 * 60
const BREAK_TIME = 5 * 60

const totalSeconds = ref(WORK_TIME)
const isRunning = ref(false)
const isBreak = ref(false)
const completedPomodoros = ref(0)

let interval: ReturnType<typeof setInterval> | null = null

const minutes = computed(() => String(Math.floor(totalSeconds.value / 60)).padStart(2, '0'))
const seconds = computed(() => String(totalSeconds.value % 60).padStart(2, '0'))

const progress = computed(() => {
  const total = isBreak.value ? BREAK_TIME : WORK_TIME
  return ((total - totalSeconds.value) / total) * 100
})

const start = () => {
  if (isRunning.value) return
  isRunning.value = true
  interval = setInterval(() => {
    if (totalSeconds.value > 0) {
      totalSeconds.value--
    } else {
      if (!isBreak.value) {
        completedPomodoros.value++
        isBreak.value = true
        totalSeconds.value = BREAK_TIME
      } else {
        isBreak.value = false
        totalSeconds.value = WORK_TIME
      }
      stop()
    }
  }, 1000)
}

const stop = () => {
  isRunning.value = false
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}

const reset = () => {
  stop()
  isBreak.value = false
  totalSeconds.value = WORK_TIME
}

onUnmounted(() => {
  stop()
})
</script>

<template>
  <div class="timer-page">
    <h2>番茄钟</h2>

    <div class="timer-container">
      <div class="timer-circle" :class="{ break: isBreak }">
        <el-progress
          type="circle"
          :percentage="progress"
          :width="260"
          :stroke-width="8"
          :color="isBreak ? '#52c41a' : '#1890ff'"
        >
          <div class="timer-display">
            <div class="timer-time">{{ minutes }}:{{ seconds }}</div>
            <div class="timer-label">{{ isBreak ? '休息一下' : '专注学习' }}</div>
          </div>
        </el-progress>
      </div>

      <div class="timer-actions">
        <el-button v-if="!isRunning" type="primary" size="large" @click="start" :icon="'VideoPlay'">
          开始
        </el-button>
        <el-button v-else type="warning" size="large" @click="stop" :icon="'VideoPause'">
          暂停
        </el-button>
        <el-button size="large" @click="reset" :icon="'RefreshLeft'">
          重置
        </el-button>
      </div>

      <div class="pomodoro-count">
        <span>已完成番茄：</span>
        <el-tag type="success" size="large">{{ completedPomodoros }}</el-tag>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timer-page h2 {
  margin: 0 0 20px;
}

.timer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
}

.timer-circle {
  margin-bottom: 32px;
}

.timer-display {
  text-align: center;
}

.timer-time {
  font-size: 48px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.timer-label {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}

.timer-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.pomodoro-count {
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
