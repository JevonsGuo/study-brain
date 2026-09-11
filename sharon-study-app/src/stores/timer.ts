import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../utils/api'

export type TimerMode = 'pomodoro' | 'exam' | 'stopwatch'

export type SoundCategory = 'all' | 'music'

export interface SoundTrack {
  id: string
  name: string
  icon: string
  type: 'none' | 'local' | 'online'
  category?: SoundCategory
  desc: string
  badge?: string
  url?: string
}

export interface FreeAudioPreset {
  id: string
  name: string
  icon: string
  category: SoundCategory
  sourceName: string
  desc: string
  url: string
}

export const FREE_AUDIO_PRESETS: FreeAudioPreset[] = []

export interface CustomSoundTrack {
  id: string
  name: string
  url: string
  icon?: string
}

// 5 大绝对高可用本地轻音乐渠道（100%零网络依赖，纯净专注）
export const RELIABLE_SOUND_CHANNELS: SoundTrack[] = [
  { id: 'piano', name: '星空钢琴', icon: '🎹', type: 'local', category: 'music', desc: '纯琴静心 · 舒缓减压', badge: '100%可靠', url: '/audio/piano_celestia.mp3' },
  { id: 'lofi', name: '治愈Lofi', icon: '🎵', type: 'local', category: 'music', desc: '温暖慢调 · 轻松自习', badge: '100%可靠', url: '/audio/lofi_study.mp3' },
  { id: 'wood', name: '空灵微风', icon: '🌿', type: 'local', category: 'music', desc: '木吉他清音 · 空灵专注', badge: '100%可靠', url: '/audio/silent_wood.mp3' },
  { id: 'night', name: '夜色沉思', icon: '🌙', type: 'local', category: 'music', desc: '极简慢板 · 深度心流', badge: '100%可靠', url: '/audio/lost_and_found.mp3' },
  { id: 'cafe', name: '街角咖啡', icon: '☕', type: 'local', category: 'music', desc: '轻语暖调 · 伴读白噪', badge: '100%可靠', url: '/audio/cafe.mp3' },
]

export const BUILTIN_SOUND_TRACKS: SoundTrack[] = [
  { id: 'none', name: '静音专注', icon: '🔇', type: 'none', category: 'all', desc: '纯净无声 · 深度心流', badge: '无声' },
  ...RELIABLE_SOUND_CHANNELS
]

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

// 规范化与解析 5 大可靠轻音乐渠道
export const normalizeNoiseType = (raw: string | null): string => {
  if (!raw || raw === 'none') return 'none'
  if (raw === 'piano' || raw === 'piano_celestia') return 'piano'
  if (raw === 'lofi' || raw === 'lofi_study' || raw === 'lofi_crescent') return 'lofi'
  if (raw === 'wood' || raw === 'silent_wood') return 'wood'
  if (raw === 'night' || raw === 'lost_and_found') return 'night'
  if (raw === 'cafe') return 'cafe'
  return 'none'
}

export const useTimerStore = defineStore('timer', () => {
  // 1. 基础配置与持久化偏好
  const mode = ref<TimerMode>('pomodoro')
  const selectedSubject = ref(localStorage.getItem('study_timer_subject') || localStorage.getItem('sharon_timer_subject') || '数学')
  const selectedPlanId = ref<number | null>(null)
  const selectedTaskName = ref('')
  const notes = ref('')

  const workDuration = ref(Number(localStorage.getItem('study_timer_work_dur') || localStorage.getItem('sharon_timer_work_dur')) || 25)
  const breakDuration = ref(Number(localStorage.getItem('study_timer_break_dur') || localStorage.getItem('sharon_timer_break_dur')) || 5)
  const examDuration = ref(Number(localStorage.getItem('study_timer_exam_dur') || localStorage.getItem('sharon_timer_exam_dur')) || 120)
  const autoStartBreak = ref((localStorage.getItem('study_timer_auto_break') || localStorage.getItem('sharon_timer_auto_break')) !== 'false')
  const isMuted = ref(false)
  const volume = ref(Number(localStorage.getItem('study_timer_volume') || localStorage.getItem('sharon_timer_volume')) || 0.4)
  const noiseType = ref(normalizeNoiseType(localStorage.getItem('study_timer_noise') || localStorage.getItem('sharon_timer_noise') || 'none'))
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
  let bgAudioElement: HTMLAudioElement | null = null

  // 播放状态与自定义音源兼容
  const isAudioPlaying = ref(false)
  const audioError = ref<string | null>(null)
  const customTracks = ref<CustomSoundTrack[]>([])
  const addCustomTrack = () => ''
  const removeCustomTrack = () => {}
  const allSoundTracks = computed<SoundTrack[]>(() => BUILTIN_SOUND_TRACKS)

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


  // 播放当前选中的轻音乐频道（100% 本地音频，秒开零网络延迟）
  const playCurrentNoise = () => {
    audioError.value = null
    const trackId = normalizeNoiseType(noiseType.value)
    if (trackId === 'none') {
      stopSound()
      return
    }

    const channel = RELIABLE_SOUND_CHANNELS.find(c => c.id === trackId)
    if (!channel || !channel.url) {
      stopSound()
      return
    }

    // 先妥善停止并卸载先前的音频，解绑所有事件监听器，避免旧元素的异步事件污染新状态
    stopSound()

    try {
      const audio = new Audio(channel.url)
      audio.loop = true
      audio.volume = isMuted.value ? 0 : Math.min(1, volume.value * 0.7)

      audio.onerror = (e) => {
        // 关键防御：如果当前音频已被替换，或是空 src / 切到静音，绝不触发错误状态
        if (bgAudioElement !== audio) return
        if (noiseType.value === 'none') return
        const srcAttr = audio.getAttribute('src')
        if (!srcAttr) return

        console.warn('Audio playback error:', e)
        isAudioPlaying.value = false
        audioError.value = '音频加载异常'
      }

      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (bgAudioElement === audio) {
            isAudioPlaying.value = true
            audioError.value = null
          }
        }).catch((err) => {
          // 用户切歌或主动暂停导致的 AbortError 属于正常打断，不作为错误上报
          if (err.name === 'AbortError') {
            return
          }
          if (err.name === 'NotAllowedError') {
            console.warn('Autoplay prevented by browser:', err)
            isAudioPlaying.value = false
            return
          }
          console.warn('Audio play request prevented:', err)
        })
      }

      bgAudioElement = audio
    } catch (err) {
      console.warn('Failed to initialize audio:', err)
    }
  }

  const stopSound = () => {
    if (bgAudioElement) {
      try {
        // 必须先解绑所有监听器！防止在 pause/src 清除过程中触发旧元素的 onerror
        bgAudioElement.onerror = null
        bgAudioElement.onplay = null
        bgAudioElement.onpause = null
        bgAudioElement.onended = null
        bgAudioElement.pause()
        bgAudioElement.currentTime = 0
        // 使用 removeAttribute('src')，切忌直接赋值为 ''（浏览器内核会将 '' 解析为无效 URI 抛出 error）
        bgAudioElement.removeAttribute('src')
        bgAudioElement.load()
      } catch { /* ignore */ }
      bgAudioElement = null
    }
    isAudioPlaying.value = false
  }

  const toggleAudioPlay = () => {
    if (isAudioPlaying.value) {
      stopSound()
    } else {
      if (noiseType.value === 'none') {
        setNoiseType('piano', true)
      } else {
        playCurrentNoise()
      }
    }
  }

  // 切歌与模式控制
  const nextTrack = () => {
    const list = allSoundTracks.value.filter(t => t.id !== 'none')
    if (list.length === 0) return
    const curIdx = list.findIndex(t => t.id === noiseType.value)
    const nextIdx = (curIdx + 1) % list.length
    setNoiseType(list[nextIdx].id, true)
  }

  const prevTrack = () => {
    const list = allSoundTracks.value.filter(t => t.id !== 'none')
    if (list.length === 0) return
    const curIdx = list.findIndex(t => t.id === noiseType.value)
    const prevIdx = (curIdx - 1 + list.length) % list.length
    setNoiseType(list[prevIdx].id, true)
  }

  const toggleShuffle = () => {
    const list = allSoundTracks.value.filter(t => t.id !== 'none' && t.id !== noiseType.value)
    if (list.length === 0) return
    const randomTrack = list[Math.floor(Math.random() * list.length)]
    setNoiseType(randomTrack.id, true)
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
    localStorage.setItem('study_timer_subject', sub)
  }

  const setDurations = (work: number, breakTime: number, examTime?: number) => {
    workDuration.value = work
    breakDuration.value = breakTime
    if (examTime) examDuration.value = examTime
    localStorage.setItem('study_timer_work_dur', String(work))
    localStorage.setItem('study_timer_break_dur', String(breakTime))
    if (examTime) localStorage.setItem('study_timer_exam_dur', String(examTime))
    if (!isRunning.value) {
      reset()
    }
  }

  const setVolume = (val: number) => {
    volume.value = val
    localStorage.setItem('study_timer_volume', String(val))
    if (bgAudioElement) bgAudioElement.volume = isMuted.value ? 0 : Math.min(1, val * 0.7)
  }

  const setNoiseType = (type: string, autoPlay = true) => {
    const normalized = normalizeNoiseType(type)
    const oldType = noiseType.value
    audioError.value = null
    noiseType.value = normalized
    localStorage.setItem('study_timer_noise', normalized)
    if (normalized === 'none') {
      stopSound()
      return
    }
    // 若重复点击同一渠道且正在播放，保持播放不中断
    if (normalized === oldType && isAudioPlaying.value) {
      return
    }
    if (isRunning.value || isAudioPlaying.value || autoPlay) {
      playCurrentNoise()
    }
  }

  const toggleMute = () => {
    isMuted.value = !isMuted.value
    if (bgAudioElement) bgAudioElement.volume = isMuted.value ? 0 : Math.min(1, volume.value * 0.7)
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
    isAudioPlaying,
    audioError,
    customTracks,
    allSoundTracks,
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
    toggleAudioPlay,
    playCurrentNoise,
    stopSound,
    addCustomTrack,
    removeCustomTrack,
    playCompleteChime,
    playExamBell,
    nextTrack,
    prevTrack,
    toggleShuffle,
    FREE_AUDIO_PRESETS
  }
})
