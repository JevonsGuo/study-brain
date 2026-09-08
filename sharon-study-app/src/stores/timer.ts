import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../utils/api'

export type TimerMode = 'pomodoro' | 'exam' | 'stopwatch'

export interface FocusRecord {
  id: number
  subject: string
  plan_id: number | null
  task_name: string
  mode: string
  duration_minutes: number
  completed_at: string
  notes: string
}

export interface FocusStats {
  today_minutes: number
  today_pomodoros: number
  today_sessions: number
  total_minutes: number
  total_pomodoros: number
  total_sessions: number
  active_days: number
  by_subject: { subject: string; minutes: number; count: number }[]
  recent_days: { date: string; minutes: number; count: number }[]
}

export const useTimerStore = defineStore('timer', () => {
  // 1. 基础配置与持久化偏好
  const mode = ref<TimerMode>('pomodoro')
  const selectedSubject = ref(localStorage.getItem('sharon_timer_subject') || '数学')
  const selectedPlanId = ref<number | null>(null)
  const selectedTaskName = ref('')
  const notes = ref('')

  const workDuration = ref(Number(localStorage.getItem('sharon_timer_work_dur')) || 25)
  const breakDuration = ref(Number(localStorage.getItem('sharon_timer_break_dur')) || 5)
  const examDuration = ref(Number(localStorage.getItem('sharon_timer_exam_dur')) || 120)
  const autoStartBreak = ref(localStorage.getItem('sharon_timer_auto_break') !== 'false')
  const isMuted = ref(false)
  const volume = ref(Number(localStorage.getItem('sharon_timer_volume')) || 0.4)
  const noiseType = ref(localStorage.getItem('sharon_timer_noise') || 'none')
  const isZenMode = ref(false)

  // 2. 运行状态
  const isRunning = ref(false)
  const isBreak = ref(false)
  const totalSeconds = ref(workDuration.value * 60)
  const stopwatchSeconds = ref(0)
  const completedPomodoros = ref(0)
  const exam15MinAlerted = ref(false)

  // 3. 完成事件提示状态（用于弹窗提示）
  const showCompletionModal = ref(false)
  const lastFinishedRecord = ref<{
    subject: string
    taskName: string
    planId: number | null
    durationMinutes: number
    mode: TimerMode
  } | null>(null)

  // 4. 统计缓存
  const stats = ref<FocusStats>({
    today_minutes: 0,
    today_pomodoros: 0,
    today_sessions: 0,
    total_minutes: 0,
    total_pomodoros: 0,
    total_sessions: 0,
    active_days: 0,
    by_subject: [],
    recent_days: []
  })
  const recentRecords = ref<FocusRecord[]>([])

  // 计时器与音频变量
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let lastTimestamp = 0
  let audioCtx: AudioContext | null = null
  let noiseNode: AudioNode | null = null
  let noiseGain: GainNode | null = null
  let bgAudioElement: HTMLAudioElement | null = null

  // 在线白噪音与环境音轨
  const onlineTracks: Record<string, string> = {
    rain: 'https://cdn.pixabay.com/audio/2022/03/10/audio_8cb18d7d82.mp3',
    piano: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf1ac.mp3',
    forest: 'https://cdn.pixabay.com/audio/2022/03/15/audio_115e6b3ed8.mp3',
    waves: 'https://cdn.pixabay.com/audio/2024/11/04/audio_4956204700.mp3',
  }

  // 计算属性
  const targetSeconds = computed(() => {
    if (mode.value === 'exam') return examDuration.value * 60
    if (isBreak.value) return breakDuration.value * 60
    return workDuration.value * 60
  })

  const progress = computed(() => {
    if (mode.value === 'stopwatch') {
      // 正向计时：以60分钟为一圈基准
      return Math.min(100, (stopwatchSeconds.value % 3600) / 36)
    }
    const total = targetSeconds.value
    if (total <= 0) return 100
    const elapsed = total - totalSeconds.value
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  })

  const displayMinutes = computed(() => {
    const s = mode.value === 'stopwatch' ? stopwatchSeconds.value : totalSeconds.value
    return String(Math.floor(s / 60)).padStart(2, '0')
  })

  const displaySeconds = computed(() => {
    const s = mode.value === 'stopwatch' ? stopwatchSeconds.value : totalSeconds.value
    return String(s % 60).padStart(2, '0')
  })

  // Web Audio Context 单例
  const getAudioContext = () => {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        audioCtx = new AudioContextClass()
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  }

  // 1. 提示音：番茄完成欢快三和弦
  const playCompleteChime = () => {
    try {
      const ctx = getAudioContext()
      if (!ctx || isMuted.value) return
      const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12)
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12)
        gain.gain.linearRampToValueAtTime(volume.value * 0.4, ctx.currentTime + idx * 0.12 + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.6)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + idx * 0.12)
        osc.stop(ctx.currentTime + idx * 0.12 + 0.65)
      })
    } catch { /* ignore */ }
  }

  // 2. 提示音：模考 15 分钟考前双击警示音
  const playExamWarningChime = () => {
    try {
      const ctx = getAudioContext()
      if (!ctx || isMuted.value) return
      const freqs = [880, 880]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.25)
        gain.gain.setValueAtTime(volume.value * 0.35, ctx.currentTime + idx * 0.25)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.25 + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + idx * 0.25)
        osc.stop(ctx.currentTime + idx * 0.25 + 0.22)
      })
    } catch { /* ignore */ }
  }

  // 3. 提示音：模考终考交卷广播钟声（经典四音学校铃）
  const playExamBell = () => {
    try {
      const ctx = getAudioContext()
      if (!ctx || isMuted.value) return
      const chimeNotes = [659.25, 523.25, 587.33, 392.00] // E5 -> C5 -> D5 -> G4
      chimeNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.5)
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.5)
        gain.gain.linearRampToValueAtTime(volume.value * 0.5, ctx.currentTime + idx * 0.5 + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.5 + 1.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + idx * 0.5)
        osc.stop(ctx.currentTime + idx * 0.5 + 1.25)
      })
    } catch { /* ignore */ }
  }

  // 4. Web Audio 离线纯净白噪/粉噪/布朗噪音生成器
  const startSyntheticNoise = (type: 'pink' | 'brown' | 'white') => {
    stopSound()
    const ctx = getAudioContext()
    if (!ctx) return

    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      }
    } else if (type === 'brown') {
      let lastOut = 0.0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        data[i] = (lastOut + (0.02 * white)) / 1.02
        lastOut = data[i]
        data[i] *= 3.5 // 补偿音量
      }
    }

    const whiteNoiseSource = ctx.createBufferSource()
    whiteNoiseSource.buffer = buffer
    whiteNoiseSource.loop = true

    noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(isMuted.value ? 0 : volume.value * 0.25, ctx.currentTime)

    whiteNoiseSource.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    whiteNoiseSource.start()
    noiseNode = whiteNoiseSource
  }

  // 播放当前选中的背景白噪音
  const playCurrentNoise = () => {
    if (noiseType.value === 'none') {
      stopSound()
      return
    }

    if (['pink', 'brown', 'white'].includes(noiseType.value)) {
      startSyntheticNoise(noiseType.value as 'pink' | 'brown' | 'white')
      return
    }

    // 在线音频音轨
    if (onlineTracks[noiseType.value]) {
      stopSound()
      bgAudioElement = new Audio(onlineTracks[noiseType.value])
      bgAudioElement.loop = true
      bgAudioElement.volume = isMuted.value ? 0 : Math.min(1, volume.value * 0.6)
      bgAudioElement.play().catch(() => {})
    }
  }

  const stopSound = () => {
    if (noiseNode) {
      try {
        (noiseNode as AudioBufferSourceNode).stop()
      } catch { /* ignore */ }
      noiseNode = null
    }
    if (bgAudioElement) {
      bgAudioElement.pause()
      bgAudioElement = null
    }
  }

  // 核心控制方法
  const start = () => {
    if (isRunning.value) return
    isRunning.value = true
    lastTimestamp = Date.now()

    if (noiseType.value !== 'none') {
      playCurrentNoise()
    }

    timerInterval = setInterval(() => {
      const now = Date.now()
      const deltaSeconds = Math.floor((now - lastTimestamp) / 1000)
      if (deltaSeconds >= 1) {
        lastTimestamp = now

        if (mode.value === 'stopwatch') {
          stopwatchSeconds.value += deltaSeconds
        } else {
          // 倒计时
          if (totalSeconds.value > deltaSeconds) {
            totalSeconds.value -= deltaSeconds

            // 考场模式：剩余 15 分钟提示
            if (mode.value === 'exam' && totalSeconds.value <= 15 * 60 && !exam15MinAlerted.value) {
              exam15MinAlerted.value = true
              playExamWarningChime()
            }
          } else {
            totalSeconds.value = 0
            onTimerFinish()
          }
        }
      }
    }, 500)
  }

  const pause = () => {
    isRunning.value = false
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    stopSound()
  }

  const reset = () => {
    pause()
    isBreak.value = false
    exam15MinAlerted.value = false
    if (mode.value === 'stopwatch') {
      stopwatchSeconds.value = 0
    } else if (mode.value === 'exam') {
      totalSeconds.value = examDuration.value * 60
    } else {
      totalSeconds.value = workDuration.value * 60
    }
  }

  const skipBreak = () => {
    pause()
    isBreak.value = false
    totalSeconds.value = workDuration.value * 60
  }

  const switchMode = (newMode: TimerMode) => {
    pause()
    mode.value = newMode
    isBreak.value = false
    exam15MinAlerted.value = false
    if (newMode === 'stopwatch') {
      stopwatchSeconds.value = 0
    } else if (newMode === 'exam') {
      totalSeconds.value = examDuration.value * 60
    } else {
      totalSeconds.value = workDuration.value * 60
    }
  }

  // 倒计时结束触发
  const onTimerFinish = () => {
    pause()

    if (mode.value === 'exam') {
      playExamBell()
      const durationMins = examDuration.value
      lastFinishedRecord.value = {
        subject: selectedSubject.value,
        taskName: selectedTaskName.value || `全真模拟考 (${durationMins}分钟)`,
        planId: selectedPlanId.value,
        durationMinutes: durationMins,
        mode: 'exam'
      }
      showCompletionModal.value = true
      // 记录入库
      recordSessionToBackend(durationMins, false)
    } else if (mode.value === 'pomodoro') {
      if (!isBreak.value) {
        // 专注结束
        playCompleteChime()
        completedPomodoros.value++
        const durationMins = workDuration.value
        lastFinishedRecord.value = {
          subject: selectedSubject.value,
          taskName: selectedTaskName.value || `${durationMins}分钟专注`,
          planId: selectedPlanId.value,
          durationMinutes: durationMins,
          mode: 'pomodoro'
        }
        showCompletionModal.value = true
        recordSessionToBackend(durationMins, false)

        // 切换至休息
        isBreak.value = true
        totalSeconds.value = breakDuration.value * 60
        if (autoStartBreak.value) {
          setTimeout(() => { start() }, 1000)
        }
      } else {
        // 休息结束
        playCompleteChime()
        isBreak.value = false
        totalSeconds.value = workDuration.value * 60
      }
    }
  }

  // 正向计时手动结束
  const finishStopwatch = () => {
    pause()
    const durationMins = Math.max(1, Math.round(stopwatchSeconds.value / 60))
    playCompleteChime()
    lastFinishedRecord.value = {
      subject: selectedSubject.value,
      taskName: selectedTaskName.value || `心流自习 (${durationMins}分钟)`,
      planId: selectedPlanId.value,
      durationMinutes: durationMins,
      mode: 'stopwatch'
    }
    showCompletionModal.value = true
    recordSessionToBackend(durationMins, false)
    stopwatchSeconds.value = 0
  }

  // 记录入库 API
  const recordSessionToBackend = async (durationMinutes: number, markPlanDone: boolean) => {
    try {
      await api.post('/focus-records', {
        subject: selectedSubject.value,
        plan_id: selectedPlanId.value,
        task_name: selectedTaskName.value || (mode.value === 'exam' ? '模拟考试' : '专注自习'),
        mode: mode.value,
        duration_minutes: durationMinutes,
        notes: notes.value,
        mark_plan_done: markPlanDone
      })
      await fetchStats()
    } catch (e) {
      console.error('Failed to save focus record:', e)
    }
  }

  // 确认完成弹窗并可选联动标记学习计划
  const confirmCompletion = async (markPlanDone: boolean) => {
    showCompletionModal.value = false
    if (markPlanDone && lastFinishedRecord.value?.planId) {
      try {
        await api.put(`/study-plans/${lastFinishedRecord.value.planId}/toggle`)
      } catch (e) {
        console.error('Failed to mark plan done:', e)
      }
    }
    await fetchStats()
  }

  // 获取学情统计与历史
  const fetchStats = async () => {
    try {
      const res = await api.get('/focus-records') as { records: FocusRecord[]; stats: FocusStats }
      if (res && res.stats) {
        stats.value = res.stats
        recentRecords.value = res.records || []
      }
    } catch (e) {
      console.error('Failed to fetch focus stats:', e)
    }
  }

  // 设置保存
  const setSubject = (sub: string) => {
    selectedSubject.value = sub
    localStorage.setItem('sharon_timer_subject', sub)
  }

  const setDurations = (work: number, breakTime: number, examTime?: number) => {
    workDuration.value = work
    breakDuration.value = breakTime
    if (examTime) examDuration.value = examTime
    localStorage.setItem('sharon_timer_work_dur', String(work))
    localStorage.setItem('sharon_timer_break_dur', String(breakTime))
    if (examTime) localStorage.setItem('sharon_timer_exam_dur', String(examTime))
    if (!isRunning.value) {
      reset()
    }
  }

  const setVolume = (val: number) => {
    volume.value = val
    localStorage.setItem('sharon_timer_volume', String(val))
    if (noiseGain) noiseGain.gain.setValueAtTime(isMuted.value ? 0 : val * 0.25, audioCtx?.currentTime || 0)
    if (bgAudioElement) bgAudioElement.volume = isMuted.value ? 0 : Math.min(1, val * 0.6)
  }

  const setNoiseType = (type: string) => {
    noiseType.value = type
    localStorage.setItem('sharon_timer_noise', type)
    if (isRunning.value) {
      playCurrentNoise()
    }
  }

  const toggleMute = () => {
    isMuted.value = !isMuted.value
    if (noiseGain) noiseGain.gain.setValueAtTime(isMuted.value ? 0 : volume.value * 0.25, audioCtx?.currentTime || 0)
    if (bgAudioElement) bgAudioElement.volume = isMuted.value ? 0 : Math.min(1, volume.value * 0.6)
  }

  return {
    mode,
    selectedSubject,
    selectedPlanId,
    selectedTaskName,
    notes,
    workDuration,
    breakDuration,
    examDuration,
    autoStartBreak,
    isMuted,
    volume,
    noiseType,
    isZenMode,
    isRunning,
    isBreak,
    totalSeconds,
    stopwatchSeconds,
    completedPomodoros,
    exam15MinAlerted,
    showCompletionModal,
    lastFinishedRecord,
    stats,
    recentRecords,
    targetSeconds,
    progress,
    displayMinutes,
    displaySeconds,
    start,
    pause,
    reset,
    skipBreak,
    switchMode,
    finishStopwatch,
    confirmCompletion,
    fetchStats,
    setSubject,
    setDurations,
    setVolume,
    setNoiseType,
    toggleMute,
    playCompleteChime,
    playExamBell
  }
})
