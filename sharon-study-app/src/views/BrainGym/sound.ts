// 脑力工坊轻量级 Web Audio 拟真音效单例 (纯代码合成，零外部音频资源依赖)
let audioCtx: AudioContext | null = null

export const getAudioCtx = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export const playTileClick = (muted = false, pitchOffset = 0) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const freq = 480 + pitchOffset * 18 // 随数字增大音调逐渐清脆上升

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, ctx.currentTime)

    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.09)
  } catch { /* ignore */ }
}

export const playWrongTile = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(180, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.12)

    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch { /* ignore */ }
}

export const playVictoryFanfare = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    // 愉悦的大三和弦上行琶音
    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1)

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1)
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.1 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.45)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime + idx * 0.1)
      osc.stop(ctx.currentTime + idx * 0.1 + 0.48)
    })
  } catch { /* ignore */ }
}

// 2048 / 华容道：滑动风声
export const playSlideSound = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.07)

    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.08)
  } catch { /* ignore */ }
}

// 2048：数字碰撞合并提示音（清脆小和弦）
export const playMergeSound = (muted = false, value = 4) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const baseFreq = 300 + Math.min(600, Math.log2(value || 2) * 60)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.25, ctx.currentTime + 0.08)

    gain.gain.setValueAtTime(0.14, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.13)
  } catch { /* ignore */ }
}

// 见缝插针：射针音效
export const playShootSound = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(620, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.06)

    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.07)
  } catch { /* ignore */ }
}

// 见缝插针 / 数独：过关或填对大九宫格音效
export const playLevelUpSound = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const notes = [659.25, 880, 1174.66] // E5 -> A5 -> D6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08)
      gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + idx * 0.08)
      osc.stop(ctx.currentTime + idx * 0.08 + 0.28)
    })
  } catch { /* ignore */ }
}

// 扫雷：插旗 / 拔旗音效
export const playFlagSound = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.07)
  } catch { /* ignore */ }
}

// 扫雷：触雷爆炸音效
export const playExplosionSound = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(140, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch { /* ignore */ }
}

// 记忆翻牌：翻牌轻快沙沙声
export const playCardFlipSound = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(420, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06)
    gain.gain.setValueAtTime(0.09, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.08)
  } catch { /* ignore */ }
}

// 汉诺塔：拾起圆盘轻鸣
export const playDiskPickSound = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.09)
  } catch { /* ignore */ }
}

// 汉诺塔：圆盘沉落木质撞击声
export const playDiskDropSound = (muted = false) => {
  if (muted) return
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(260, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.09)
    gain.gain.setValueAtTime(0.16, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.1)
  } catch { /* ignore */ }
}

