<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, ArrowRight, Check, Close, RefreshRight, Refresh,
  Microphone, Setting, Plus, Sort
} from '@element-plus/icons-vue'

interface WordForms {
  past?: string
  past_participle?: string
  present_participle?: string
  noun?: string
  plural?: string
  comparative?: string
  superlative?: string
  third_person?: string
}

interface Collocation {
  phrase: string
  meaning: string
}

interface DistinctionItem {
  word: string
  diff: string
}

interface Word {
  id: number
  word: string
  phonetic: string
  meaning: string
  example_en: string
  example_cn: string
  mastery_level: number
  interval_days: number
  next_review: string
  review_count: number
  last_review: string
  word_list: string
  forms: string
  synonyms: string
  antonyms: string
  collocations: string
  etymology: string
  distinction: string
}

interface Stats {
  total: number
  newCount: number
  learningCount: number
  masteredCount: number
  dueCount: number
  todayStudied: number
  todayNew: number
  todayReviewed: number
  targetNew: number
  targetReview: number
  streak: number
}

interface WordListDetail {
  word_list: string
  count: number
  stats: { total: number; newCount: number; learningCount: number; masteredCount: number; dueCount: number }
}

// 视图层级：词库选单 vs 学习工作台
const route = useRoute()
const router = useRouter()
const view = ref<'list' | 'study'>('list')
const words = ref<Word[]>([])
const stats = ref<Stats | null>(null)
const loading = ref(false)
const wordLists = ref<WordListDetail[]>([])

const selectedWordList = ref('')
const searchQuery = ref('')
const filterMastery = ref(-1)

// 学习模式：
// card: ✨ 治愈手帐卡片 | quiz: 🎯 极速四选一 | spelling: ✏️ 语法拼写盲盒 | listening: 🎧 晚安磨耳朵 | table: 📋 词汇全表
export type StudySubMode = 'card' | 'quiz' | 'spelling' | 'listening' | 'table'
const studySubMode = ref<StudySubMode>('card')
const studyMode = ref<'all' | 'due'>('due')

const currentIndex = ref(0)
const flipped = ref(false)
const savedShuffle = typeof localStorage !== 'undefined' ? (localStorage.getItem('study_word_shuffle') || localStorage.getItem('sharon_word_shuffle')) : null
const shuffled = ref(savedShuffle === null ? true : savedShuffle === '1')
const autoPlayAudio = ref(true)
const preferredAccent = ref<'us' | 'uk'>('us') // us: 美音, uk: 英音

// 连击激励系统
const comboCount = ref(0)
const maxCombo = ref(0)
const comboAnimating = ref(false)

// 极速四选一状态
interface QuizOption {
  text: string
  isCorrect: boolean
  state: 'default' | 'correct' | 'wrong'
}
const quizOptions = ref<QuizOption[]>([])
const quizAnswered = ref(false)

// 语法拼写盲盒状态
const spellingInput = ref('')
const spellingInputRef = ref<HTMLInputElement | null>(null)
const spellingHintRevealed = ref(1) // 初始透露1个字母
const spellingErrorShake = ref(false)
const spellingShowAnswer = ref(false)

// 晚安磨耳朵状态
const isListeningPlaying = ref(false)
let listeningTimer: ReturnType<typeof setTimeout> | null = null

// 弹窗与表单
const addDialogVisible = ref(false)
const configDialogVisible = ref(false)
const stampModalVisible = ref(false)
const newWord = ref({ word: '', phonetic: '', meaning: '', example_en: '', example_cn: '', word_list: '' })
const dailyConfig = ref({ target_new: 20, target_review: 40 })

// 暖心鼓励寄语集（专为高中女生设计）
const warmQuotes = [
  '星光不问赶路人，今天也是在悄悄拔尖的一天 ✨',
  '向着理想的大学，每一步积累都在闪闪发光 🌸',
  '做个自律的高中女孩，温柔且有力量 💖',
  '今天的高考核心词汇全部拿下，你比想象中更优秀 🌟',
  '保持热爱，奔赴山海，今天的坚持定有回响 🍃'
]
const currentQuote = computed(() => {
  const day = new Date().getDate()
  return warmQuotes[day % warmQuotes.length]
})

// Web Audio API 音频上下文单例（卡林巴琴水滴治愈音效）
let audioCtx: AudioContext | null = null
const getAudioContext = () => {
  if (!audioCtx) {
    const AudioClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioClass) audioCtx = new AudioClass()
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// 治愈系卡林巴琴 (Kalimba) 泛音合成
const playKalimbaChime = (type: 'success' | 'combo' | 'error' | 'stamp') => {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    if (type === 'success') {
      // 五度和弦水滴轻音
      const freqs = [523.25, 659.25, 783.99] // C5, E5, G5
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f, now + i * 0.08)
        gain.gain.setValueAtTime(0, now + i * 0.08)
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.08)
        osc.stop(now + i * 0.08 + 0.55)
      })
    } else if (type === 'combo') {
      // 欢快上扬琶音
      const freqs = [523.25, 659.25, 783.99, 1046.50]
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(f, now + i * 0.07)
        gain.gain.setValueAtTime(0, now + i * 0.07)
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.07 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.6)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.07)
        osc.stop(now + i * 0.07 + 0.65)
      })
    } else if (type === 'error') {
      // 温柔低频轻音
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(329.63, now) // E4
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.35)
    } else if (type === 'stamp') {
      // 火漆盖章钝音
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.18)
      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.25)
    }
  } catch { /* silent */ }
}

// 真人地道发音源（有道词典真人语音，type=1 英音，type=2 美音）
const playPronunciation = (wordText?: string, accent?: 'us' | 'uk') => {
  const w = wordText || currentWord.value?.word
  if (!w) return
  const typeCode = (accent || preferredAccent.value) === 'uk' ? 1 : 2
  const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(w)}&type=${typeCode}`
  const audio = new Audio(audioUrl)
  audio.play().catch(() => {
    // 浏览器 SpeechSynthesis 备选
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(w)
      u.lang = typeCode === 1 ? 'en-GB' : 'en-US'
      u.rate = 0.85
      window.speechSynthesis.speak(u)
    }
  })
}

// 例句朗读
const playSentence = (sentence: string) => {
  if (!sentence || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(sentence)
  u.lang = preferredAccent.value === 'uk' ? 'en-GB' : 'en-US'
  u.rate = 0.88
  window.speechSynthesis.speak(u)
}

// 解析 JSON 字段
const safeParse = <T>(json: string): T | null => {
  if (!json) return null
  try { return JSON.parse(json) as T } catch { return null }
}

const currentWord = computed(() => words.value[currentIndex.value])

// 高考考点 enrichment 解析
const parsedForms = computed(() => safeParse<WordForms>(currentWord.value?.forms || ''))
const parsedSynonyms = computed(() => safeParse<string[]>(currentWord.value?.synonyms || ''))
const parsedAntonyms = computed(() => safeParse<string[]>(currentWord.value?.antonyms || ''))
const parsedCollocations = computed(() => safeParse<Collocation[]>(currentWord.value?.collocations || ''))
const parsedDistinction = computed(() => safeParse<DistinctionItem[]>(currentWord.value?.distinction || ''))
const parsedEtymology = computed(() => currentWord.value?.etymology || '')

// 音节划分（根据词形与音标辅助标注）
const syllableDisplay = computed(() => {
  if (!currentWord.value?.word) return ''
  const w = currentWord.value.word
  // 简易自然拼读音节断词展示（针对常见前后缀与音标）
  return w.replace(/(ing|tion|ment|able|ness|less|ful|ous|ive)$/i, '·$1')
})

// 植物生长记忆阶梯 Metaphor
const plantStage = (level: number, interval = 0) => {
  if (level === 0) return { emoji: '🌱', label: '播种新词', desc: '初次相遇', badgeClass: 'stage-seed' }
  if (level === 1) return { emoji: '🌿', label: '破土发芽', desc: `已记${interval}天`, badgeClass: 'stage-sprout' }
  if (level === 2 && interval < 15) return { emoji: '🌸', label: '熟记开花', desc: '牢记考点', badgeClass: 'stage-bloom' }
  return { emoji: '🍎', label: '硕果掌握', desc: '永久记忆', badgeClass: 'stage-fruit' }
}

const currentPlant = computed(() => {
  if (!currentWord.value) return plantStage(0)
  return plantStage(currentWord.value.mastery_level, currentWord.value.interval_days)
})

// 词库标识与颜色
const wordListLabel = (name: string) => {
  const labels: Record<string, string> = {
    default: '高考核心词汇',
    shanghai: '上海高考专属词汇',
    cet6: '六级拓展词汇',
    gre: 'GRE 核心三千词',
    toefl: '托福核心词汇',
    ielts: '雅思核心词汇',
  }
  return labels[name] || name
}

const wordListColor = (name: string) => {
  const colors: Record<string, string> = {
    default: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    shanghai: 'linear-gradient(135deg, #f43f5e 0%, #a855f7 100%)',
    cet6: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
    gre: 'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%)',
    toefl: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
    ielts: 'linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #0284c7 100%)',
  }
  return colors[name] || 'linear-gradient(135deg, #34d399 0%, #3b82f6 100%)'
}

const wordListIcon = (name: string) => {
  const icons: Record<string, string> = {
    default: '🌸',
    shanghai: '🗼',
    cet6: '📘',
    gre: '🏛️',
    toefl: '🗽',
    ielts: '🇬🇧',
  }
  return icons[name] || '📗'
}

// 统计进度
const totalProgress = computed(() => {
  if (!stats.value) return 0
  const total = stats.value.targetNew + stats.value.targetReview
  const done = stats.value.todayNew + stats.value.todayReviewed
  if (total === 0) return 100
  return Math.min(100, Math.round((done / total) * 100))
})

const checkCelebration = () => {
  if (!stats.value) return
  const allDone = stats.value.todayNew >= stats.value.targetNew && stats.value.todayReviewed >= stats.value.targetReview
  if (allDone && stats.value.targetNew + stats.value.targetReview > 0 && !stampModalVisible.value) {
    stampModalVisible.value = true
    playKalimbaChime('stamp')
  }
}

watch(stats, () => { checkCelebration() })

// 路由与数据拉取
const fetchWordListDetails = async () => {
  try {
    const lists: { word_list: string; count: number }[] = await api.get('/words/word-lists')
    const details: WordListDetail[] = []
    for (const wl of lists) {
      const s = await api.get(`/words/stats?word_list=${encodeURIComponent(wl.word_list)}`)
      details.push({ word_list: wl.word_list, count: wl.count, stats: s })
    }
    const orderMap: Record<string, number> = {
      shanghai: 1,
      default: 2,
      cet6: 3,
      ielts: 4,
      toefl: 5,
      gre: 6,
    }
    details.sort((a, b) => (orderMap[a.word_list] || 99) - (orderMap[b.word_list] || 99))
    wordLists.value = details
  } catch { /* silent */ }
}

const fetchStats = async () => {
  try {
    const params: Record<string, string> = {}
    if (selectedWordList.value) params.word_list = selectedWordList.value
    const query = Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''
    const data = await api.get(`/words/stats${query}`)
    stats.value = data
    dailyConfig.value.target_new = data.targetNew
    dailyConfig.value.target_review = data.targetReview
  } catch {
    ElMessage.error('加载统计失败')
  }
}

const fetchWords = async () => {
  loading.value = true
  try {
    if (studyMode.value === 'due') {
      const params = new URLSearchParams()
      if (selectedWordList.value) params.set('word_list', selectedWordList.value)
      if (shuffled.value) params.set('shuffle', 'true')
      const queryString = params.toString() ? `?${params.toString()}` : ''
      const data = await api.get(`/words/due${queryString}`)
      const combined = [...data.due, ...data.newWords]
      const seen = new Set<number>()
      words.value = combined.filter((w: Word) => {
        if (seen.has(w.id)) return false
        seen.add(w.id)
        return true
      })
    } else {
      const params: Record<string, string> = {}
      if (searchQuery.value) params.search = searchQuery.value
      if (filterMastery.value >= 0) params.mastery = String(filterMastery.value)
      if (selectedWordList.value) params.word_list = selectedWordList.value
      if (shuffled.value) params.shuffle = 'true'
      const query = Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''
      words.value = await api.get(`/words${query}`)
    }
    if (shuffled.value) shuffleWords()
    currentIndex.value = 0
    flipped.value = false
    onWordChanged()
  } catch {
    ElMessage.error('加载单词失败')
  } finally {
    loading.value = false
  }
}

const enterWordList = (name: string) => {
  selectedWordList.value = name
  view.value = 'study'
  studyMode.value = 'due'
  searchQuery.value = ''
  filterMastery.value = -1
  comboCount.value = 0
  router.replace({ query: { ...route.query, list: name, mode: studySubMode.value } })
  fetchStats()
  fetchWords()
}

const backToList = () => {
  stopListeningTour()
  view.value = 'list'
  selectedWordList.value = ''
  words.value = []
  stats.value = null
  router.replace({ query: {} })
  fetchWordListDetails()
}

watch(studySubMode, (newMode) => {
  if (view.value === 'study') {
    router.replace({ query: { ...route.query, mode: newMode } })
  }
})

// 单词切换时统一初始化模式状态
const onWordChanged = () => {
  flipped.value = false
  quizAnswered.value = false
  spellingInput.value = ''
  spellingHintRevealed.value = 1
  spellingShowAnswer.value = false

  if (autoPlayAudio.value && currentWord.value && studySubMode.value !== 'listening') {
    setTimeout(() => playPronunciation(), 250)
  }

  // 极速四选一模式：生成 4 个选项
  if (studySubMode.value === 'quiz') {
    generateQuizOptions()
  }

  // 语法拼写模式：自动聚焦输入框
  if (studySubMode.value === 'spelling') {
    nextTick(() => {
      spellingInputRef.value?.focus()
    })
  }
}

const shuffleWords = () => {
  const arr = [...words.value]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  words.value = arr
  currentIndex.value = 0
}

const toggleShuffle = () => {
  shuffled.value = !shuffled.value
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('study_word_shuffle', shuffled.value ? '1' : '0')
  }
  fetchWords()
}

const refreshBatch = () => {
  playKalimbaChime('combo')
  ElMessage.success({
    message: '已从全库重新抽取一组高频考纲词汇 ✨',
    duration: 2000,
  })
  fetchWords()
}

const flipCard = () => {
  flipped.value = !flipped.value
  if (flipped.value && autoPlayAudio.value && currentWord.value) {
    playPronunciation()
  }
}

const nextWord = () => {
  if (currentIndex.value < words.value.length - 1) {
    currentIndex.value++
    onWordChanged()
  } else {
    ElMessage.success('本组单词已全部学完 🎉')
    checkCelebration()
  }
}

const prevWord = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    onWordChanged()
  }
}

// 认识 / 掌握（答对）
const markRemember = async () => {
  if (!currentWord.value) return
  try {
    await api.put(`/words/${currentWord.value.id}/remember`)
    comboCount.value++
    if (comboCount.value > maxCombo.value) maxCombo.value = comboCount.value

    // 连击特效触发
    comboAnimating.value = true
    setTimeout(() => { comboAnimating.value = false }, 500)

    if (comboCount.value >= 3) {
      playKalimbaChime('combo')
    } else {
      playKalimbaChime('success')
    }

    await fetchStats()
    if (studyMode.value === 'due') {
      words.value = words.value.filter((_, i) => i !== currentIndex.value)
      if (currentIndex.value >= words.value.length) currentIndex.value = Math.max(0, words.value.length - 1)
      onWordChanged()
    } else {
      nextWord()
    }
  } catch {
    ElMessage.error('操作失败')
  }
}

// 不认识 / 遗忘（答错）
const markForget = async () => {
  if (!currentWord.value) return
  try {
    await api.put(`/words/${currentWord.value.id}/forget`)
    comboCount.value = 0 // 连击归零
    playKalimbaChime('error')
    await fetchStats()
    nextWord()
  } catch {
    ElMessage.error('操作失败')
  }
}

// ==========================================
// 模式二：🎯 极速四选一 (Speed Quiz)
// ==========================================
const generateQuizOptions = () => {
  if (!currentWord.value || words.value.length === 0) return
  const current = currentWord.value
  const pool = words.value.filter(w => w.id !== current.id)

  // 随机取 3 个干扰项
  const distractors: string[] = []
  const shuffledPool = [...pool].sort(() => 0.5 - Math.random())
  for (let i = 0; i < Math.min(3, shuffledPool.length); i++) {
    distractors.push(shuffledPool[i].meaning)
  }

  // 补齐 4 个
  while (distractors.length < 3) {
    distractors.push('其他含义')
  }

  const allTexts = [current.meaning, ...distractors].sort(() => 0.5 - Math.random())
  quizOptions.value = allTexts.map(text => ({
    text,
    isCorrect: text === current.meaning,
    state: 'default'
  }))
}

const handleQuizSelect = (opt: QuizOption) => {
  if (quizAnswered.value) return
  quizAnswered.value = true

  if (opt.isCorrect) {
    opt.state = 'correct'
    markRemember()
  } else {
    opt.state = 'wrong'
    // 找出正确项标绿
    const correctOpt = quizOptions.value.find(o => o.isCorrect)
    if (correctOpt) correctOpt.state = 'correct'
    markForget()
  }
}

// ==========================================
// 模式三：✏️ 语法填空拼写盲盒 (Spelling)
// ==========================================
// 挖空例句：支持词形变体并智能挖空为高考语篇填空格式
const clozeExample = computed(() => {
  if (!currentWord.value?.example_en) return ''
  const w = currentWord.value.word
  const formsObj = parsedForms.value || {}
  const formsList = Object.values(formsObj).filter((v): v is string => typeof v === 'string' && !!v)
  const allVariants = [w, ...formsList]
  const escaped = [...new Set(allVariants)]
    .sort((a, b) => b.length - a.length)
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const reg = new RegExp(`\\b(${escaped.join('|')}|${w}[a-z]{0,4})\\b`, 'gi')
  return currentWord.value.example_en.replace(reg, (match) => {
    const revealed = match.slice(0, Math.min(match.length, spellingHintRevealed.value))
    const hidden = '_'.repeat(Math.max(2, match.length - revealed.length))
    return `[ ${revealed}${hidden} ]`
  })
})

const revealMoreHint = () => {
  if (!currentWord.value) return
  if (spellingHintRevealed.value < currentWord.value.word.length) {
    spellingHintRevealed.value++
  }
}

const toggleShowAnswer = () => {
  spellingShowAnswer.value = !spellingShowAnswer.value
}

const checkSpelling = () => {
  if (!currentWord.value) return
  const input = spellingInput.value.trim().toLowerCase()
  const target = currentWord.value.word.trim().toLowerCase()

  if (input === target) {
    playKalimbaChime('success')
    markRemember()
  } else {
    spellingErrorShake.value = true
    playKalimbaChime('error')
    setTimeout(() => { spellingErrorShake.value = false }, 600)
  }
}

// ==========================================
// 模式四：🎧 晚安磨耳朵 (Listening Tour)
// ==========================================
const startListeningTour = () => {
  isListeningPlaying.value = true
  playListeningStep()
}

const stopListeningTour = () => {
  isListeningPlaying.value = false
  if (listeningTimer) {
    clearTimeout(listeningTimer)
    listeningTimer = null
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}

const playListeningStep = () => {
  if (!isListeningPlaying.value || !currentWord.value) return

  // 1. 播放单词美音
  playPronunciation(currentWord.value.word, 'us')

  // 2. 1.2秒后朗读中文释义
  listeningTimer = setTimeout(() => {
    if (!isListeningPlaying.value) return
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(currentWord.value.meaning)
      u.lang = 'zh-CN'
      u.rate = 0.9
      u.onend = () => {
        // 3. 中文读完后朗读例句
        listeningTimer = setTimeout(() => {
          if (!isListeningPlaying.value) return
          if (currentWord.value.example_en) {
            playSentence(currentWord.value.example_en)
          }
          // 4. 例句后 2.5 秒跳至下一词
          listeningTimer = setTimeout(() => {
            if (!isListeningPlaying.value) return
            if (currentIndex.value < words.value.length - 1) {
              currentIndex.value++
              onWordChanged()
              playListeningStep()
            } else {
              stopListeningTour()
              ElMessage.success('磨耳朵收听完毕 🌙 晚安好梦！')
            }
          }, 3000)
        }, 600)
      }
      window.speechSynthesis.speak(u)
    }
  }, 1400)
}

// 切换模式处理
const switchSubMode = (newMode: StudySubMode) => {
  if (studySubMode.value === 'listening' && newMode !== 'listening') {
    stopListeningTour()
  }
  studySubMode.value = newMode
  onWordChanged()
}

// 快捷键支持
const handleKeydown = (e: KeyboardEvent) => {
  if (view.value !== 'study' || studySubMode.value === 'table') return
  if (addDialogVisible.value || configDialogVisible.value || stampModalVisible.value) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      prevWord()
      break
    case 'ArrowRight':
      e.preventDefault()
      nextWord()
      break
    case ' ':
      e.preventDefault()
      if (studySubMode.value === 'card') flipCard()
      break
    case '1':
      e.preventDefault()
      markForget()
      break
    case '2':
      e.preventDefault()
      markRemember()
      break
  }
}

// 单词管理
const addWord = async () => {
  if (!newWord.value.word || !newWord.value.meaning) return
  try {
    await api.post('/words', { ...newWord.value, word_list: newWord.value.word_list || selectedWordList.value })
    newWord.value = { word: '', phonetic: '', meaning: '', example_en: '', example_cn: '', word_list: '' }
    addDialogVisible.value = false
    await fetchStats()
    await fetchWords()
    ElMessage.success('添加成功 ✨')
  } catch {
    ElMessage.error('添加失败')
  }
}

const updateDailyConfig = async () => {
  try {
    await api.put('/words/daily-config', dailyConfig.value)
    configDialogVisible.value = false
    await fetchStats()
    ElMessage.success('目标设置已保存 🎯')
  } catch {
    ElMessage.error('更新失败')
  }
}

const removeWord = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要从词库中移除此单词吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    await api.del(`/words/${id}`)
    await fetchStats()
    await fetchWords()
    ElMessage.success('已删除')
  } catch { /* cancel */ }
}

onMounted(() => {
  fetchWordListDetails()
  fetchStats()
  document.addEventListener('keydown', handleKeydown)

  if (route.query.list) {
    const listName = String(route.query.list)
    if (route.query.mode && ['card', 'quiz', 'spelling', 'listening', 'table'].includes(String(route.query.mode))) {
      studySubMode.value = route.query.mode as StudySubMode
    }
    enterWordList(listName)
  }
})

onUnmounted(() => {
  stopListeningTour()
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="word-card-page">
    <!-- 阶段一：词汇表选择书架 (Word Lists Hub) -->
    <template v-if="view === 'list'">
      <div class="page-header">
        <div class="header-badge">📖 Vocabulary Studio · 智词工坊</div>
        <h2 class="header-title">英语单词手帐</h2>
        <p class="header-subtitle">艾宾浩斯智能记忆阶梯 · 高考考点精细拆解</p>
      </div>

      <div v-if="wordLists.length === 0" class="wl-loading-container">
        <div class="word-loading-spinner-halo">
          <span class="word-loading-emblem">📖</span>
        </div>
        <div class="word-loading-title">正在下载官方多语种词库书架...</div>
        <div class="word-loading-desc">正在同步高考核心、考纲拓展、四六级、托福、雅思与 GRE 精选词库</div>
        <div class="word-loading-bar-wrap">
          <div class="word-loading-bar-inner"></div>
        </div>
      </div>
      <div v-else class="wl-grid">
        <div
          v-for="wl in wordLists"
          :key="wl.word_list"
          class="wl-card"
          :style="{ background: wordListColor(wl.word_list) }"
          @click="enterWordList(wl.word_list)"
        >
          <div class="wl-card-top">
            <span class="wl-icon">{{ wordListIcon(wl.word_list) }}</span>
            <span class="wl-pill">{{ wl.count }} 词</span>
          </div>
          <div class="wl-name">{{ wordListLabel(wl.word_list) }}</div>
          <div class="wl-stats">
            <span class="wl-stat-item">🌱 待学 {{ wl.stats.newCount }}</span>
            <span class="wl-stat-item">🌿 掌握中 {{ wl.stats.learningCount }}</span>
            <span class="wl-stat-item">🍎 已熟记 {{ wl.stats.masteredCount }}</span>
          </div>
          <div class="wl-footer">
            <span v-if="wl.stats.dueCount > 0" class="wl-due-badge">🔥 今日待复习 {{ wl.stats.dueCount }} 词</span>
            <span v-else class="wl-done-badge">✨ 今日任务已达成</span>
            <span class="wl-arrow">➔</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 阶段二：单词互动工作台 (Interactive Vocabulary Studio) -->
    <template v-else>
      <!-- 顶部轻盈导航栏 -->
      <div class="study-nav-bar">
        <el-button text @click="backToList" :icon="ArrowLeft" class="back-btn">
          返回词库
        </el-button>

        <div class="study-nav-title">
          <span class="nav-icon">{{ wordListIcon(selectedWordList) }}</span>
          <span class="nav-text">{{ wordListLabel(selectedWordList) }}</span>
        </div>

        <!-- 连击 Combo 能量气泡 -->
        <div class="combo-bubble" :class="{ 'is-active': comboCount >= 2, 'pulse': comboAnimating }">
          <span class="combo-fire">🔥</span>
          <span class="combo-num">{{ comboCount }}</span>
          <span class="combo-label">COMBO</span>
        </div>

        <div class="nav-tools">
          <el-button size="small" @click="addDialogVisible = true" :icon="Plus" round>添加新词</el-button>
          <el-button size="small" @click="configDialogVisible = true" :icon="Setting" round>每日目标</el-button>
        </div>
      </div>

      <!-- 每日进度手帐胶囊条 -->
      <div v-if="stats" class="daily-progress-strip">
        <div class="strip-item main-ring">
          <div class="ring-mini-text">{{ totalProgress }}%</div>
          <div class="strip-label">今日达成</div>
        </div>
        <div class="strip-divider"></div>
        <div class="strip-item">
          <div class="strip-val">🔥 {{ stats.streak }}</div>
          <div class="strip-label">连续打卡</div>
        </div>
        <div class="strip-item">
          <div class="strip-val">{{ stats.todayStudied }} 词</div>
          <div class="strip-label">今日已背</div>
        </div>
        <div class="strip-item">
          <div class="strip-val">🌱 {{ stats.todayNew }}/{{ stats.targetNew }}</div>
          <div class="strip-label">新词指标</div>
        </div>
        <div class="strip-item">
          <div class="strip-val">🌿 {{ stats.todayReviewed }}/{{ stats.targetReview }}</div>
          <div class="strip-label">复习指标</div>
        </div>
      </div>

      <!-- 核心模式切换工作台 -->
      <div class="mode-capsule-bar">
        <div class="mode-pills">
          <button
            class="mode-pill-btn"
            :class="{ active: studySubMode === 'card' }"
            @click="switchSubMode('card')"
          >
            <span>✨ 手帐卡片</span>
          </button>
          <button
            class="mode-pill-btn"
            :class="{ active: studySubMode === 'quiz' }"
            @click="switchSubMode('quiz')"
          >
            <span>🎯 极速四选一</span>
          </button>
          <button
            class="mode-pill-btn"
            :class="{ active: studySubMode === 'spelling' }"
            @click="switchSubMode('spelling')"
          >
            <span>✏️ 拼写填空</span>
          </button>
          <button
            class="mode-pill-btn"
            :class="{ active: studySubMode === 'listening' }"
            @click="switchSubMode('listening')"
          >
            <span>🎧 晚安磨耳朵</span>
          </button>
          <button
            class="mode-pill-btn"
            :class="{ active: studySubMode === 'table' }"
            @click="switchSubMode('table')"
          >
            <span>📋 词汇清单</span>
          </button>
        </div>

        <!-- 辅助开关 -->
        <div class="mode-aux-actions">
          <button
            class="aux-btn"
            :class="{ active: shuffled }"
            @click="toggleShuffle"
            :title="shuffled ? '当前为真正全库乱序，点击切换考纲顺序' : '当前为考纲顺序，点击切换全库乱序'"
          >
            <el-icon size="14"><Sort /></el-icon>
            <span>{{ shuffled ? '🔀 真正乱序' : '🔤 考纲顺序' }}</span>
          </button>
          <button
            v-if="shuffled"
            class="aux-btn refresh-batch-btn"
            @click="refreshBatch"
            title="从全库重新随机抽取一组词汇"
          >
            <el-icon size="14"><Refresh /></el-icon>
            <span>换一批</span>
          </button>
          <button
            class="aux-btn"
            :class="{ active: autoPlayAudio }"
            @click="autoPlayAudio = !autoPlayAudio"
            title="换词时自动朗读"
          >
            <el-icon size="14"><Microphone /></el-icon>
            <span>发音</span>
          </button>
          <button
            class="aux-btn"
            @click="studyMode = studyMode === 'due' ? 'all' : 'due'; fetchWords()"
            :class="{ active: studyMode === 'due' }"
          >
            <el-icon size="14"><RefreshRight /></el-icon>
            <span>{{ studyMode === 'due' ? '今日待复习' : '全部词库' }}</span>
          </button>
        </div>
      </div>

      <!-- 模式一：✨ 治愈手帐卡片 (Flashcard 2.0) -->
      <div v-if="studySubMode === 'card' && words.length > 0" class="stage-card-mode">
        <div class="handbook-card-container" @click="flipCard">
          <div class="handbook-card" :class="{ flipped: flipped }">
            <!-- 卡片正面 -->
            <div class="card-face card-front">
              <div class="card-washi-tape"></div>
              <div class="card-header-row">
                <span class="plant-stage-badge" :class="currentPlant.badgeClass">
                  {{ currentPlant.emoji }} {{ currentPlant.label }}
                </span>
                <div class="accent-selector" @click.stop>
                  <button
                    class="accent-btn"
                    :class="{ active: preferredAccent === 'us' }"
                    @click="preferredAccent = 'us'; playPronunciation(currentWord?.word, 'us')"
                  >
                    🇺🇸 美
                  </button>
                  <button
                    class="accent-btn"
                    :class="{ active: preferredAccent === 'uk' }"
                    @click="preferredAccent = 'uk'; playPronunciation(currentWord?.word, 'uk')"
                  >
                    🇬🇧 英
                  </button>
                </div>
              </div>

              <div class="card-hero-word">
                <div class="word-text">{{ currentWord?.word }}</div>
                <div v-if="syllableDisplay && syllableDisplay !== currentWord?.word" class="word-syllable">
                  {{ syllableDisplay }}
                </div>
              </div>

              <div class="card-phonetic-row" @click.stop="playPronunciation()">
                <span class="phonetic-text">{{ currentWord?.phonetic }}</span>
                <span class="audio-wave-icon">🔊</span>
              </div>

              <div class="card-front-footer">
                <span class="flip-hint-pill">空格键翻面 · 点击查看手帐考点 🌸</span>
              </div>
            </div>

            <!-- 卡片反面 (手帐考点便签) -->
            <div class="card-face card-back" @click.stop>
              <div class="card-washi-tape"></div>
              <div class="back-scroll-content">
                <!-- 核心释义大高光 -->
                <div class="back-meaning-box">
                  <div class="back-meaning-text">{{ currentWord?.meaning }}</div>
                </div>

                <!-- 高考真题例句 (支持整句朗读) -->
                <div v-if="currentWord?.example_en" class="back-example-card">
                  <div class="example-en-line">
                    <span>{{ currentWord.example_en }}</span>
                    <button class="speak-sentence-btn" @click="playSentence(currentWord.example_en)" title="朗读例句">
                      🔊
                    </button>
                  </div>
                  <div class="example-cn-line">{{ currentWord.example_cn }}</div>
                </div>

                <!-- 考点便签一：🌸 词形变化家族 (Forms Family) -->
                <div v-if="parsedForms" class="exam-note-block">
                  <div class="note-label">🌸 高考常考变形家族</div>
                  <div class="forms-capsule-grid">
                    <div v-if="parsedForms.past" class="form-pill">
                      <span class="form-tag">过去式</span>
                      <span class="form-val">{{ parsedForms.past }}</span>
                    </div>
                    <div v-if="parsedForms.past_participle" class="form-pill">
                      <span class="form-tag">过分</span>
                      <span class="form-val">{{ parsedForms.past_participle }}</span>
                    </div>
                    <div v-if="parsedForms.present_participle" class="form-pill">
                      <span class="form-tag">现分</span>
                      <span class="form-val">{{ parsedForms.present_participle }}</span>
                    </div>
                    <div v-if="parsedForms.noun" class="form-pill">
                      <span class="form-tag">名词</span>
                      <span class="form-val">{{ parsedForms.noun }}</span>
                    </div>
                    <div v-if="parsedForms.plural" class="form-pill">
                      <span class="form-tag">复数</span>
                      <span class="form-val">{{ parsedForms.plural }}</span>
                    </div>
                  </div>
                </div>

                <!-- 考点便签二：⚡ 高频重点搭配 (Collocations) -->
                <div v-if="parsedCollocations?.length" class="exam-note-block">
                  <div class="note-label">⚡ 写作与阅读常考搭配</div>
                  <div class="collocations-list">
                    <div v-for="c in parsedCollocations" :key="c.phrase" class="collocation-bubble">
                      <span class="coll-phrase">{{ c.phrase }}</span>
                      <span class="coll-meaning">{{ c.meaning }}</span>
                    </div>
                  </div>
                </div>

                <!-- 考点便签三：💡 词根拆解与易混辨析 -->
                <div v-if="parsedEtymology || parsedDistinction?.length" class="exam-note-block">
                  <div class="note-label">💡 巧记公式与完形易混</div>
                  <div v-if="parsedEtymology" class="etymology-formula">
                    <span class="formula-icon">🧩</span>
                    <span class="formula-text">{{ parsedEtymology }}</span>
                  </div>
                  <div v-if="parsedDistinction?.length" class="distinction-twins">
                    <div v-for="d in parsedDistinction" :key="d.word" class="twin-item">
                      <span class="twin-word">vs. {{ d.word }}</span>
                      <span class="twin-diff">{{ d.diff }}</span>
                    </div>
                  </div>
                </div>

                <!-- 考点便签四：🌿 高分同义替换 -->
                <div v-if="parsedSynonyms?.length || parsedAntonyms?.length" class="synonyms-bar">
                  <div v-if="parsedSynonyms?.length" class="syn-group">
                    <span class="syn-tag">写作提分同义</span>
                    <span class="syn-words">{{ parsedSynonyms.join(' · ') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部大按键操作行 -->
        <div class="card-action-bar">
          <button class="action-btn prev-btn" @click="prevWord" :disabled="currentIndex === 0">
            <el-icon><ArrowLeft /></el-icon>
            <span>上一个</span>
          </button>
          <button class="action-btn forget-btn" @click="markForget">
            <el-icon><Close /></el-icon>
            <span>没记住 (1)</span>
          </button>
          <button class="action-btn remember-btn" @click="markRemember">
            <el-icon><Check /></el-icon>
            <span>记住了 ✨ (2)</span>
          </button>
          <button class="action-btn next-btn" @click="nextWord">
            <span>下一个</span>
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>

        <div class="card-index-indicator">
          <span>{{ currentIndex + 1 }} / {{ words.length }}</span>
          <span class="sub-indicator">· 按键盘 1 没记住，2 记住了</span>
        </div>
      </div>

      <!-- 模式二：🎯 极速四选一 (Speed Quiz) -->
      <div v-else-if="studySubMode === 'quiz' && words.length > 0" class="stage-quiz-mode">
        <div class="quiz-card">
          <div class="quiz-top">
            <span class="quiz-badge">🎯 考前极速过词</span>
            <span class="quiz-progress">{{ currentIndex + 1 }} / {{ words.length }}</span>
          </div>

          <div class="quiz-target-word">
            <div class="quiz-word">{{ currentWord?.word }}</div>
            <div class="quiz-phonetic" @click="playPronunciation()">
              <span>{{ currentWord?.phonetic }}</span>
              <span class="audio-wave-icon">🔊</span>
            </div>
          </div>

          <!-- 四个选项 -->
          <div class="quiz-options-grid">
            <button
              v-for="(opt, idx) in quizOptions"
              :key="idx"
              class="quiz-opt-btn"
              :class="{
                'is-correct': opt.state === 'correct',
                'is-wrong': opt.state === 'wrong'
              }"
              @click="handleQuizSelect(opt)"
              :disabled="quizAnswered"
            >
              <span class="opt-prefix">{{ ['A', 'B', 'C', 'D'][idx] }}</span>
              <span class="opt-text">{{ opt.text }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 模式三：✏️ 语法填空拼写盲盒 (Spelling & Cloze) -->
      <div v-else-if="studySubMode === 'spelling' && words.length > 0" class="stage-spelling-mode">
        <div class="spelling-card" :class="{ 'shake': spellingErrorShake }">
          <div class="spelling-top">
            <span class="spelling-badge">✏️ 高考短文改错与语法填空默写</span>
            <span class="quiz-progress">{{ currentIndex + 1 }} / {{ words.length }}</span>
          </div>

          <!-- 中文含义提示 -->
          <div class="spelling-meaning">
            {{ currentWord?.meaning }}
          </div>

          <!-- 语境例句挖空 -->
          <div v-if="clozeExample" class="spelling-cloze-box">
            <div class="cloze-sentence">{{ clozeExample }}</div>
            <div class="cloze-cn">{{ currentWord?.example_cn }}</div>
          </div>

          <!-- 输入拼写框 -->
          <div class="spelling-input-wrap">
            <input
              ref="spellingInputRef"
              v-model="spellingInput"
              type="text"
              class="spelling-native-input"
              :placeholder="`首字母提示: ${currentWord?.word.slice(0, spellingHintRevealed)}... (共 ${currentWord?.word.length} 字母)`"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              @keydown.enter="checkSpelling"
            />
            <button class="spelling-submit-btn" @click="checkSpelling">
              <span>提交 (Enter)</span>
            </button>
          </div>

          <!-- 提示辅助小工具 -->
          <div class="spelling-helper-row">
            <button class="helper-link-btn" @click="revealMoreHint">
              💡 提示下一字母 ({{ spellingHintRevealed }}/{{ currentWord?.word.length }})
            </button>
            <button class="helper-link-btn" @click="toggleShowAnswer">
              👁️ {{ spellingShowAnswer ? currentWord?.word : '看一眼答案' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 模式四：🎧 晚安磨耳朵 (Listening Tour) -->
      <div v-else-if="studySubMode === 'listening' && words.length > 0" class="stage-listening-mode">
        <div class="listening-card">
          <div class="listening-pulse-stage">
            <div class="breathing-ring" :class="{ 'is-playing': isListeningPlaying }">
              <span class="breathing-icon">🌙</span>
            </div>
          </div>

          <div class="listening-word">{{ currentWord?.word }}</div>
          <div class="listening-phonetic">{{ currentWord?.phonetic }}</div>
          <div class="listening-meaning">{{ currentWord?.meaning }}</div>

          <div v-if="currentWord?.example_en" class="listening-sentence-box">
            <div class="sentence-en">{{ currentWord.example_en }}</div>
            <div class="sentence-cn">{{ currentWord.example_cn }}</div>
          </div>

          <div class="listening-ctrls">
            <button
              v-if="!isListeningPlaying"
              class="listen-play-btn start"
              @click="startListeningTour"
            >
              <span>开始沉浸磨耳朵 🎧</span>
            </button>
            <button
              v-else
              class="listen-play-btn stop"
              @click="stopListeningTour"
            >
              <span>暂停收听</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 模式五：📋 词汇清单列表 (Table Mode) -->
      <div v-else-if="studySubMode === 'table'" class="stage-table-mode">
        <el-table :data="words" stripe v-loading="loading" class="word-table" max-height="520">
          <el-table-column label="" width="50">
            <template #default="{ row }">{{ plantStage(row.mastery_level).emoji }}</template>
          </el-table-column>
          <el-table-column prop="word" label="单词" width="140">
            <template #default="{ row }">
              <b style="color: #6366f1; cursor: pointer" @click="playPronunciation(row.word)">
                {{ row.word }} 🔊
              </b>
            </template>
          </el-table-column>
          <el-table-column prop="phonetic" label="音标" width="140" />
          <el-table-column prop="meaning" label="释义" min-width="180" />
          <el-table-column prop="review_count" label="复习次数" width="90" align="center" />
          <el-table-column label="阶段" width="110" align="center">
            <template #default="{ row }">
              <el-tag size="small" round>{{ plantStage(row.mastery_level, row.interval_days).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button size="small" type="danger" text @click="removeWord(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 首次载入 / 数据同步中加载提示 -->
      <div v-else-if="loading && words.length === 0" class="word-loading-state-box">
        <div class="word-loading-spinner-halo">
          <span class="word-loading-emblem">⏳</span>
        </div>
        <div class="word-loading-title">正在下载并装载最新官方词库...</div>
        <div class="word-loading-desc">
          涵盖高中考纲、词形变形、搭配例句与四选一真题库。<br>
          首次进入需同步数据，完成后将离线缓存在您的本地设备中，后续秒开！
        </div>
        <div class="word-loading-bar-wrap">
          <div class="word-loading-bar-inner"></div>
        </div>
      </div>

      <!-- 暂无单词提示 -->
      <div v-else-if="words.length === 0 && !loading" class="empty-state-box">
        <div class="empty-icon">🌸</div>
        <div class="empty-title">太棒了！当前待背单词已全部扫清 ✨</div>
        <el-button type="primary" round @click="studyMode = 'all'; filterMastery = -1; fetchWords()">
          浏览全部单词库
        </el-button>
      </div>
    </template>

    <!-- 每日通关战报手帐卡片 (Daily Stamp Card) -->
    <el-dialog
      v-model="stampModalVisible"
      width="460px"
      :show-close="false"
      class="stamp-dialog"
    >
      <div class="stamp-postcard">
        <div class="postcard-washi-tape"></div>
        <div class="postcard-header">
          <div class="postcard-sub">DAILY VOCABULARY GOAL ACHIEVED</div>
          <div class="postcard-title">今日单词打卡达成！🌸</div>
        </div>

        <!-- 可爱的火漆印章 -->
        <div class="vintage-stamp">
          <div class="stamp-inner">
            <div class="stamp-star">★</div>
            <div class="stamp-word">PASSED</div>
            <div class="stamp-sub">斩词成功</div>
          </div>
        </div>

        <div class="postcard-stats-grid">
          <div class="p-stat-item">
            <div class="p-stat-val">{{ stats?.todayStudied || 0 }}</div>
            <div class="p-stat-label">今日斩获</div>
          </div>
          <div class="p-stat-item">
            <div class="p-stat-val">{{ maxCombo }}</div>
            <div class="p-stat-label">最高连击🔥</div>
          </div>
          <div class="p-stat-item">
            <div class="p-stat-val">{{ stats?.streak || 1 }} 天</div>
            <div class="p-stat-label">连续打卡</div>
          </div>
        </div>

        <div class="postcard-quote">
          “ {{ currentQuote }} ”
        </div>
      </div>

      <template #footer>
        <el-button type="primary" size="large" round style="width: 100%" @click="stampModalVisible = false">
          太棒啦，明天继续发光！✨
        </el-button>
      </template>
    </el-dialog>

    <!-- 每日目标设置弹窗 -->
    <el-dialog v-model="configDialogVisible" title="🎯 每日单词背诵目标" width="380px">
      <el-form label-width="110px">
        <el-form-item label="每日新词">
          <el-input-number v-model="dailyConfig.target_new" :min="5" :max="100" :step="5" />
          <span class="unit-text">个</span>
        </el-form-item>
        <el-form-item label="每日复习">
          <el-input-number v-model="dailyConfig.target_review" :min="10" :max="200" :step="10" />
          <span class="unit-text">个</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="updateDailyConfig">保存目标</el-button>
      </template>
    </el-dialog>

    <!-- 添加单词弹窗 -->
    <el-dialog v-model="addDialogVisible" title="➕ 添加新单词到手帐" width="460px">
      <el-form label-width="80px">
        <el-form-item label="单词" required>
          <el-input v-model="newWord.word" placeholder="例如: accomplish" />
        </el-form-item>
        <el-form-item label="音标">
          <el-input v-model="newWord.phonetic" placeholder="例如: /əˈkʌmplɪʃ/" />
        </el-form-item>
        <el-form-item label="中文释义" required>
          <el-input v-model="newWord.meaning" placeholder="例如: v. 完成，实现" />
        </el-form-item>
        <el-form-item label="英文例句">
          <el-input v-model="newWord.example_en" type="textarea" :rows="2" placeholder="英文高考真题例句" />
        </el-form-item>
        <el-form-item label="例句翻译">
          <el-input v-model="newWord.example_cn" type="textarea" :rows="2" placeholder="中文对应翻译" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addWord">添加词条</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.word-card-page {
  max-width: 920px;
  margin: 0 auto;
  padding-bottom: 40px;
}

/* 阶段一：词汇表书架 */
.page-header {
  text-align: center;
  margin-bottom: 28px;
}

.header-badge {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 20px;
  background: rgba(167, 139, 250, 0.15);
  color: #8b5cf6;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.header-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin-bottom: 6px;
}

.header-subtitle {
  font-size: 13px;
  color: var(--text-sub, #64748b);
}

.wl-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 1024px) {
  .wl-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .wl-grid {
    grid-template-columns: 1fr;
  }
}

.wl-card {
  border-radius: 20px;
  padding: 24px;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.wl-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.16);
}

.wl-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.wl-icon { font-size: 32px; }
.wl-pill {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.wl-name {
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 14px;
}

.wl-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  margin-bottom: 16px;
  background: rgba(0, 0, 0, 0.1);
  padding: 6px 10px;
  border-radius: 10px;
}

.wl-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  font-size: 12px;
  font-weight: 600;
}

.wl-due-badge {
  background: #f59e0b;
  color: #fff;
  padding: 2px 8px;
  border-radius: 6px;
}

.wl-done-badge {
  color: rgba(255, 255, 255, 0.9);
}

/* 阶段二：学习工作台顶栏 */
.study-nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.back-btn {
  font-weight: 600;
  color: var(--text-regular, #64748b);
}

.study-nav-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

/* 连击 Combo 能量气泡 */
.combo-bubble {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 20px;
  background: var(--bg-card-secondary, #f1f5f9);
  border: 1px solid var(--border-subtle, #e2e8f0);
  color: var(--text-sub, #94a3b8);
  font-size: 12px;
  font-weight: 700;
  transition: all 0.25s ease;
}

.combo-bubble.is-active {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
}

.combo-bubble.pulse {
  transform: scale(1.18);
}

.combo-num {
  font-size: 14px;
  font-weight: 800;
}

/* 每日进度手帐胶囊条 */
.daily-progress-strip {
  display: flex;
  align-items: center;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 16px;
  padding: 10px 18px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  overflow-x: auto;
  gap: 16px;
}

.strip-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.strip-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.strip-label {
  font-size: 11px;
  color: var(--text-sub, #94a3b8);
}

.strip-divider {
  width: 1px;
  height: 24px;
  background: var(--border-subtle, #e2e8f0);
}

.main-ring .ring-mini-text {
  font-size: 15px;
  font-weight: 800;
  color: #8b5cf6;
}

/* 模式选择胶囊条 */
.mode-capsule-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.mode-pills {
  display: flex;
  gap: 6px;
  background: var(--bg-card, #ffffff);
  padding: 4px;
  border-radius: 14px;
  border: 1px solid var(--border-subtle, #e2e8f0);
}

.mode-pill-btn {
  border: none;
  background: transparent;
  padding: 6px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-regular, #64748b);
  transition: all 0.2s;
}

.mode-pill-btn.active {
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  color: #fff;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}

.mode-aux-actions {
  display: flex;
  gap: 8px;
}

.aux-btn {
  border: 1px solid var(--border-subtle, #e2e8f0);
  background: var(--bg-card, #ffffff);
  border-radius: 10px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-regular, #64748b);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.aux-btn.active {
  border-color: #8b5cf6;
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
}

/* 模式一：✨ 治愈手帐卡片 3D 翻转容器 */
.stage-card-mode {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.handbook-card-container {
  width: 100%;
  max-width: 580px;
  height: 440px;
  perspective: 1200px;
  margin-bottom: 24px;
  cursor: pointer;
}

.handbook-card {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 24px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.07);
}

.handbook-card.flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 24px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
}

/* 和纸胶带装饰 */
.card-washi-tape {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 110px;
  height: 24px;
  background: rgba(244, 114, 182, 0.35);
  border-left: 2px dashed rgba(244, 114, 182, 0.6);
  border-right: 2px dashed rgba(244, 114, 182, 0.6);
  z-index: 10;
}

/* 正面样式 */
.card-front {
  padding: 32px 36px;
  justify-content: space-between;
  align-items: center;
  background: radial-gradient(circle at 50% 20%, rgba(244, 114, 182, 0.08) 0%, var(--bg-card) 70%);
}

.card-header-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plant-stage-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stage-seed {
  background: rgba(34, 197, 94, 0.12);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.stage-sprout {
  background: rgba(6, 182, 212, 0.12);
  color: #0891b2;
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.stage-bloom {
  background: rgba(236, 72, 153, 0.12);
  color: #db2777;
  border: 1px solid rgba(236, 72, 153, 0.25);
}

.stage-fruit {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

html.dark .stage-seed {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.35);
}

html.dark .stage-sprout {
  background: rgba(6, 182, 212, 0.2);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.35);
}

html.dark .stage-bloom {
  background: rgba(236, 72, 153, 0.2);
  color: #f472b6;
  border-color: rgba(244, 114, 182, 0.35);
}

html.dark .stage-fruit {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.35);
}

.accent-selector {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px;
  border-radius: 8px;
}

html.dark .accent-selector {
  background: rgba(255, 255, 255, 0.08);
}

.accent-btn {
  border: none;
  background: transparent;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub, #64748b);
  cursor: pointer;
}

.accent-btn.active {
  background: #fff;
  color: #8b5cf6;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

html.dark .accent-btn.active {
  background: rgba(139, 92, 246, 0.35);
  color: #c084fc;
}

.card-hero-word {
  text-align: center;
}

.word-text {
  font-size: 52px;
  font-weight: 800;
  letter-spacing: -1px;
  color: var(--text-main, #0f172a);
  line-height: 1.1;
  margin-bottom: 6px;
}

.word-syllable {
  font-size: 14px;
  font-weight: 600;
  color: #8b5cf6;
  letter-spacing: 2px;
}

.card-phonetic-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 20px;
  background: var(--bg-card-secondary, #f8fafc);
  border: 1px solid var(--border-subtle, #e2e8f0);
  cursor: pointer;
  transition: all 0.2s;
}

.card-phonetic-row:hover {
  border-color: #8b5cf6;
  transform: scale(1.05);
}

.phonetic-text {
  font-size: 16px;
  color: var(--text-regular, #475569);
  font-family: 'Lucida Sans', sans-serif;
}

.audio-wave-icon {
  font-size: 14px;
}

.flip-hint-pill {
  font-size: 12px;
  color: var(--text-sub, #94a3b8);
}

/* 反面样式 (手帐便签) */
.card-back {
  transform: rotateY(180deg);
  padding: 28px 24px;
}

.back-scroll-content {
  overflow-y: auto;
  height: 100%;
  padding-right: 6px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.back-meaning-box {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(244, 114, 182, 0.08) 100%);
  border-radius: 14px;
  padding: 12px 16px;
}

.back-meaning-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.back-example-card {
  background: var(--bg-card-secondary, #f8fafc);
  border-left: 3px solid #8b5cf6;
  border-radius: 10px;
  padding: 10px 14px;
}

.example-en-line {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  line-height: 1.5;
  margin-bottom: 4px;
}

.speak-sentence-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  padding: 0 4px;
  opacity: 0.7;
}

.speak-sentence-btn:hover { opacity: 1; }

.example-cn-line {
  font-size: 12px;
  color: var(--text-sub, #64748b);
}

/* 考点手帐小卡 */
.exam-note-block {
  background: var(--bg-card-secondary, #f8fafc);
  border-radius: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border-subtle, #e2e8f0);
}

.note-label {
  font-size: 12px;
  font-weight: 700;
  color: #ec4899;
  margin-bottom: 8px;
}

.forms-capsule-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.form-pill {
  display: inline-flex;
  align-items: center;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 6px;
  font-size: 11px;
  overflow: hidden;
}

.form-tag {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
  padding: 2px 6px;
  font-weight: 600;
}

.form-val {
  padding: 2px 6px;
  color: var(--text-main, #334155);
}

.collocations-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.collocation-bubble {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card, #fff);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
}

.coll-phrase {
  font-weight: 700;
  color: #8b5cf6;
}

.coll-meaning {
  color: var(--text-regular, #475569);
}

.etymology-formula {
  font-size: 12px;
  color: var(--text-regular, #334155);
  background: var(--bg-card, #fff);
  padding: 6px 10px;
  border-radius: 8px;
  margin-bottom: 6px;
}

.distinction-twins {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.twin-item {
  font-size: 11px;
  background: var(--bg-card, #fff);
  padding: 4px 8px;
  border-radius: 6px;
}

.twin-word {
  font-weight: 700;
  color: #f59e0b;
  margin-right: 6px;
}

.twin-diff {
  color: var(--text-sub, #64748b);
}

.synonyms-bar {
  font-size: 12px;
  background: var(--bg-card-secondary, #f8fafc);
  padding: 8px 12px;
  border-radius: 8px;
}

.syn-tag {
  color: #10b981;
  font-weight: 700;
  margin-right: 8px;
}

.syn-words {
  color: var(--text-regular, #475569);
}

/* 底部操作按钮行 */
.card-action-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 580px;
  margin-bottom: 12px;
}

.action-btn {
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  padding: 12px 24px;
  border-radius: 24px;
  transition: all 0.25s;
}

.forget-btn {
  background: linear-gradient(135deg, #f43f5e, #fb7185);
  color: #fff;
  box-shadow: 0 4px 14px rgba(244, 63, 94, 0.35);
}

.forget-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(244, 63, 94, 0.45);
}

.remember-btn {
  background: linear-gradient(135deg, #10b981, #34d399);
  color: #fff;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}

.remember-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(16, 185, 129, 0.45);
}

.prev-btn, .next-btn {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  color: var(--text-regular, #64748b);
  padding: 12px 18px;
}

.prev-btn:hover, .next-btn:hover {
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.card-index-indicator {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub, #94a3b8);
}

.sub-indicator {
  font-weight: 400;
  font-size: 11px;
  margin-left: 6px;
}

/* 模式二：🎯 极速四选一 (Quiz) */
.stage-quiz-mode {
  display: flex;
  justify-content: center;
}

.quiz-card {
  width: 100%;
  max-width: 580px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 24px;
  padding: 32px 28px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
}

.quiz-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.quiz-badge {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 12px;
}

.quiz-progress {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub, #94a3b8);
}

.quiz-target-word {
  text-align: center;
  margin-bottom: 32px;
}

.quiz-word {
  font-size: 46px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  line-height: 1.1;
  margin-bottom: 8px;
}

.quiz-phonetic {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-sub, #64748b);
  cursor: pointer;
  font-size: 15px;
}

.quiz-options-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quiz-opt-btn {
  border: 1px solid var(--border-subtle, #e2e8f0);
  background: var(--bg-card-secondary, #f8fafc);
  padding: 14px 18px;
  border-radius: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  transition: all 0.2s;
  text-align: left;
}

.quiz-opt-btn:hover {
  border-color: #8b5cf6;
  transform: translateX(4px);
}

.quiz-opt-btn.is-correct {
  background: #ecfdf5 !important;
  border-color: #10b981 !important;
  color: #059669 !important;
}

.quiz-opt-btn.is-wrong {
  background: #fff1f2 !important;
  border-color: #f43f5e !important;
  color: #e11d48 !important;
}

.opt-prefix {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

/* 模式三：✏️ 拼写填空 (Spelling) */
.stage-spelling-mode {
  display: flex;
  justify-content: center;
}

.spelling-card {
  width: 100%;
  max-width: 580px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 24px;
  padding: 32px 28px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.spelling-card.shake {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}

.spelling-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.spelling-badge {
  background: rgba(244, 114, 182, 0.15);
  color: #db2777;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 12px;
}

.spelling-meaning {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  text-align: center;
  margin-bottom: 24px;
}

.spelling-cloze-box {
  background: var(--bg-card-secondary, #f8fafc);
  border-left: 3px solid #db2777;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 24px;
}

.cloze-sentence {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  line-height: 1.6;
  margin-bottom: 6px;
}

.cloze-cn {
  font-size: 12px;
  color: var(--text-sub, #64748b);
}

.spelling-input-wrap {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.spelling-native-input {
  flex: 1;
  border: 2px solid var(--border-subtle, #e2e8f0);
  background: var(--bg-card-secondary, #f8fafc);
  border-radius: 14px;
  padding: 12px 18px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  -webkit-text-fill-color: var(--text-main, #0f172a);
  letter-spacing: 1px;
  outline: none;
  transition: all 0.2s;
}

.spelling-native-input:focus {
  border-color: #db2777;
  box-shadow: 0 0 0 3px rgba(219, 39, 119, 0.15);
}

.spelling-submit-btn {
  border: none;
  background: linear-gradient(135deg, #db2777, #f43f5e);
  color: #fff;
  font-weight: 700;
  padding: 0 20px;
  border-radius: 14px;
  cursor: pointer;
}

.spelling-helper-row {
  display: flex;
  justify-content: space-between;
}

.helper-link-btn {
  border: none;
  background: transparent;
  font-size: 12px;
  color: #8b5cf6;
  cursor: pointer;
  font-weight: 600;
}

/* 模式四：🎧 晚安磨耳朵 (Listening) */
.stage-listening-mode {
  display: flex;
  justify-content: center;
}

.listening-card {
  width: 100%;
  max-width: 580px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 24px;
  padding: 44px 28px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
}

.listening-pulse-stage {
  display: flex;
  justify-content: center;
  margin-bottom: 28px;
}

.breathing-ring {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38px;
  transition: all 0.5s ease;
}

.breathing-ring.is-playing {
  animation: breathe 2.4s infinite ease-in-out;
  background: rgba(139, 92, 246, 0.2);
  box-shadow: 0 0 24px rgba(139, 92, 246, 0.4);
}

@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.18); opacity: 1; }
}

.listening-word {
  font-size: 42px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin-bottom: 8px;
}

.listening-phonetic {
  font-size: 16px;
  color: #8b5cf6;
  margin-bottom: 14px;
}

.listening-meaning {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-main, #334155);
  margin-bottom: 24px;
}

.listening-sentence-box {
  background: var(--bg-card-secondary, #f8fafc);
  border-radius: 14px;
  padding: 14px 20px;
  margin-bottom: 32px;
}

.sentence-en {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  margin-bottom: 6px;
}

.sentence-cn {
  font-size: 12px;
  color: var(--text-sub, #64748b);
}

.listen-play-btn {
  border: none;
  cursor: pointer;
  padding: 14px 38px;
  border-radius: 28px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  transition: all 0.2s;
}

.listen-play-btn.start {
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.35);
}

.listen-play-btn.stop {
  background: #64748b;
}

/* 每日通关战报手帐卡片 (Postcard Stamp) */
.stamp-postcard {
  position: relative;
  background: #fff;
  border-radius: 20px;
  padding: 28px 24px 20px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}

.postcard-washi-tape {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 24px;
  background: rgba(244, 114, 182, 0.4);
  border-left: 2px dashed rgba(244, 114, 182, 0.7);
  border-right: 2px dashed rgba(244, 114, 182, 0.7);
}

.postcard-sub {
  font-size: 11px;
  font-weight: 700;
  color: #f43f5e;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.postcard-title {
  font-size: 20px;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 20px;
}

/* 可爱火漆复古印章 */
.vintage-stamp {
  width: 96px;
  height: 96px;
  border: 3px double #f43f5e;
  border-radius: 50%;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(-12deg);
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.05);
  box-shadow: 0 0 0 4px rgba(244, 63, 94, 0.15);
}

.stamp-inner {
  text-align: center;
}

.stamp-star { font-size: 12px; }
.stamp-word {
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 2px;
}
.stamp-sub {
  font-size: 10px;
  font-weight: 600;
}

.postcard-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  background: #fdf2f8;
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 18px;
}

.p-stat-val {
  font-size: 18px;
  font-weight: 800;
  color: #db2777;
}

.p-stat-label {
  font-size: 11px;
  color: #9d174d;
}

.postcard-quote {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  line-height: 1.6;
  padding: 0 10px;
}

.unit-text {
  margin-left: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.empty-state-box {
  text-align: center;
  padding: 48px 20px;
}

.empty-icon {
  font-size: 44px;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  margin-bottom: 16px;
}

/* 暗色模式专属深阶接管 (Cyber Night) */
:global(html.dark) .card-face,
:global(html.dark) .quiz-card,
:global(html.dark) .spelling-card,
:global(html.dark) .listening-card {
  background-color: #131b2e !important;
  border-color: #26334a !important;
}

:global(html.dark) .card-front {
  background: radial-gradient(circle at 50% 20%, rgba(139, 92, 246, 0.15) 0%, #131b2e 70%) !important;
}

:global(html.dark) .exam-note-block,
:global(html.dark) .back-meaning-box,
:global(html.dark) .back-example-card,
:global(html.dark) .spelling-cloze-box,
:global(html.dark) .listening-sentence-box {
  background-color: #1a233a !important;
  border-color: #26334a !important;
}

:global(html.dark) .quiz-opt-btn,
:global(html.dark) .form-pill,
:global(html.dark) .collocation-bubble,
:global(html.dark) .etymology-formula,
:global(html.dark) .twin-item {
  background-color: #232f4b !important;
  border-color: #26334a !important;
  color: #f8fafc !important;
}

:global(html.dark) .spelling-native-input {
  background-color: #1a233a !important;
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
  border-color: #26334a !important;
}

:global(html.dark) .stamp-postcard {
  background-color: #131b2e !important;
  color: #f8fafc !important;
}

:global(html.dark) .postcard-title {
  color: #f8fafc !important;
}

:global(html.dark) .postcard-stats-grid {
  background-color: #1a233a !important;
}

:global(html.dark) .postcard-quote {
  color: #e2e8f0 !important;
}

:global(html.dark) .stage-seed {
  background: rgba(34, 197, 94, 0.2) !important;
  color: #4ade80 !important;
  border: 1px solid rgba(74, 222, 128, 0.3) !important;
}

:global(html.dark) .stage-sprout {
  background: rgba(6, 182, 212, 0.2) !important;
  color: #38bdf8 !important;
  border: 1px solid rgba(56, 189, 248, 0.3) !important;
}

:global(html.dark) .stage-bloom {
  background: rgba(236, 72, 153, 0.2) !important;
  color: #f472b6 !important;
  border: 1px solid rgba(244, 114, 182, 0.3) !important;
}

:global(html.dark) .stage-fruit {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #fbbf24 !important;
  border: 1px solid rgba(251, 191, 36, 0.3) !important;
}

:global(html.dark) .accent-selector {
  background: #1a233a !important;
  border: 1px solid #26334a !important;
}

:global(html.dark) .accent-btn {
  color: #94a3b8 !important;
}

:global(html.dark) .accent-btn.active {
  background: rgba(168, 85, 247, 0.3) !important;
  color: #c084fc !important;
}

:global(html.dark) .phonetic-badge {
  background: rgba(168, 85, 247, 0.15) !important;
  border-color: rgba(168, 85, 247, 0.3) !important;
  color: #c084fc !important;
}

:global(html.dark) .card-hint-text {
  color: #94a3b8 !important;
}

/* 初始加载状态美化 */
.word-loading-state-box,
.wl-loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 24px;
  background: var(--bg-card, #ffffff);
  border-radius: 20px;
  border: 1px solid var(--border-color, #e2e8f0);
  box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.08);
  margin: 20px auto;
  max-width: 560px;
}

.word-loading-spinner-halo {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.2));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  position: relative;
  animation: halo-pulse 2s infinite ease-in-out;
}

.word-loading-emblem {
  font-size: 32px;
  animation: emblem-rotate 3s infinite linear;
}

.word-loading-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin-bottom: 8px;
  letter-spacing: -0.2px;
}

.word-loading-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary, #64748b);
  max-width: 440px;
  margin-bottom: 20px;
}

.word-loading-bar-wrap {
  width: 200px;
  height: 4px;
  border-radius: 2px;
  background: rgba(99, 102, 241, 0.12);
  overflow: hidden;
  position: relative;
}

.word-loading-bar-inner {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 40%;
  border-radius: 2px;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  animation: bar-slide 1.5s infinite ease-in-out;
}

@keyframes halo-pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 14px rgba(99, 102, 241, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
}

@keyframes emblem-rotate {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(15deg); }
  75% { transform: rotate(-15deg); }
  100% { transform: rotate(0deg); }
}

@keyframes bar-slide {
  0% { left: -40%; }
  100% { left: 100%; }
}

</style>
