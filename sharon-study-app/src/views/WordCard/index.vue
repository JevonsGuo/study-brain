<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { api } from '../../utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'

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

interface WordListOption {
  word_list: string
  count: number
}

interface WordListDetail {
  word_list: string
  count: number
  stats: { total: number; newCount: number; learningCount: number; masteredCount: number; dueCount: number }
}

const view = ref<'list' | 'study'>('list')
const words = ref<Word[]>([])
const stats = ref<Stats | null>(null)
const loading = ref(false)
const wordLists = ref<WordListDetail[]>([])

const selectedWordList = ref('')
const searchQuery = ref('')
const filterMastery = ref(-1)
const mode = ref<'card' | 'list'>('card')
const studyMode = ref<'all' | 'due'>('due')

const currentIndex = ref(0)
const flipped = ref(false)
const shuffled = ref(false)
const autoPlay = ref(false)
const autoAdvance = ref(true)
const celebrating = ref(false)

const addDialogVisible = ref(false)
const configDialogVisible = ref(false)
const collapseActive = ref<string>('')

const safeParse = <T>(json: string): T | null => {
  if (!json) return null
  try { return JSON.parse(json) as T } catch { return null }
}

const parsedForms = computed(() => safeParse<WordForms>(currentWord.value?.forms || ''))
const parsedSynonyms = computed(() => safeParse<string[]>(currentWord.value?.synonyms || ''))
const parsedAntonyms = computed(() => safeParse<string[]>(currentWord.value?.antonyms || ''))
const parsedCollocations = computed(() => safeParse<Collocation[]>(currentWord.value?.collocations || ''))
const parsedDistinction = computed(() => safeParse<DistinctionItem[]>(currentWord.value?.distinction || ''))
const parsedEtymology = computed(() => currentWord.value?.etymology || '')

const hasEnrichment = computed(() => {
  return !!parsedForms.value || !!parsedCollocations.value || !!parsedDistinction.value ||
    !!parsedSynonyms.value || !!parsedAntonyms.value || !!parsedEtymology.value
})

const formLabelMap: Record<string, string> = {
  past: '过去式',
  past_participle: '过去分词',
  present_participle: '现在分词',
  noun: '名词',
  plural: '复数',
  comparative: '比较级',
  superlative: '最高级',
  third_person: '第三人称',
}

const newWord = ref({ word: '', phonetic: '', meaning: '', example_en: '', example_cn: '', word_list: '' })
const dailyConfig = ref({ target_new: 20, target_review: 40 })

const swipeStartX = ref(0)
const swipeStartY = ref(0)
const swiping = ref(false)
const swipeDelta = ref(0)

const currentWord = computed(() => words.value[currentIndex.value])

const masteryIcon = (level: number) => {
  if (level === 0) return '🆕'
  if (level === 1) return '📖'
  return '✅'
}

const masteryLabel = (level: number) => {
  if (level === 0) return '新词'
  if (level === 1) return '学习中'
  return '已掌握'
}

const masteryTagType = (level: number) => {
  if (level === 0) return 'info'
  if (level === 1) return 'warning'
  return 'success'
}

const wordListLabel = (name: string) => {
  const labels: Record<string, string> = { default: '高考词汇', cet6: '六级词汇' }
  return labels[name] || name
}

const wordListColor = (name: string) => {
  const colors: Record<string, string> = {
    default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    cet6: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  }
  return colors[name] || 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
}

const wordListIcon = (name: string) => {
  const icons: Record<string, string> = { default: '📕', cet6: '📘' }
  return icons[name] || '📗'
}

const newProgress = computed(() => {
  if (!stats.value) return 0
  return Math.min(100, Math.round((stats.value.todayNew / stats.value.targetNew) * 100))
})

const reviewProgress = computed(() => {
  if (!stats.value) return 0
  return Math.min(100, Math.round((stats.value.todayReviewed / stats.value.targetReview) * 100))
})

const totalProgress = computed(() => {
  if (!stats.value) return 0
  const total = stats.value.targetNew + stats.value.targetReview
  const done = stats.value.todayNew + stats.value.todayReviewed
  if (total === 0) return 100
  return Math.min(100, Math.round((done / total) * 100))
})

const lastReviewText = computed(() => {
  if (!currentWord.value?.last_review) return ''
  const d = currentWord.value.last_review.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (d === today) return '今天复习过'
  const diff = Math.floor((new Date(today).getTime() - new Date(d).getTime()) / 86400000)
  return `${diff}天前复习`
})

const nextReviewText = computed(() => {
  if (!currentWord.value?.next_review) return ''
  const d = currentWord.value.next_review.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (d <= today) return '今天待复习'
  const diff = Math.floor((new Date(d).getTime() - new Date(today).getTime()) / 86400000)
  return `${diff}天后复习`
})

const checkCelebration = () => {
  if (!stats.value) return
  const allDone = stats.value.todayNew >= stats.value.targetNew && stats.value.todayReviewed >= stats.value.targetReview
  if (allDone && stats.value.targetNew + stats.value.targetReview > 0 && !celebrating.value) {
    celebrating.value = true
    setTimeout(() => { celebrating.value = false }, 3000)
  }
}

watch(stats, () => { checkCelebration() })

const fetchWordListDetails = async () => {
  try {
    const lists: WordListOption[] = await api.get('/words/word-lists')
    const details: WordListDetail[] = []
    for (const wl of lists) {
      const s = await api.get(`/words/stats?word_list=${encodeURIComponent(wl.word_list)}`)
      details.push({ word_list: wl.word_list, count: wl.count, stats: s })
    }
    wordLists.value = details
  } catch {
    // silent
  }
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
  } catch (e: unknown) {
    ElMessage.error('加载统计失败')
  }
}

const fetchWords = async () => {
  loading.value = true
  try {
    if (studyMode.value === 'due') {
      const wlParam = selectedWordList.value ? `word_list=${encodeURIComponent(selectedWordList.value)}` : ''
      const data = await api.get(`/words/due?${wlParam}`)
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
      const query = Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''
      words.value = await api.get(`/words${query}`)
    }
    if (shuffled.value) shuffleWords()
    currentIndex.value = 0
    flipped.value = false
  } catch (e: unknown) {
    ElMessage.error('加载失败')
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
  fetchStats()
  fetchWords()
}

const backToList = () => {
  view.value = 'list'
  selectedWordList.value = ''
  words.value = []
  stats.value = null
  fetchWordListDetails()
}

const searchWords = () => {
  studyMode.value = 'all'
  fetchWords()
}

const clearSearch = () => {
  searchQuery.value = ''
  filterMastery.value = -1
  studyMode.value = 'due'
  fetchWords()
}

const shuffleWords = () => {
  const arr = [...words.value]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  words.value = arr
  currentIndex.value = 0
  flipped.value = false
}

const toggleShuffle = () => {
  shuffled.value = !shuffled.value
  if (shuffled.value) {
    shuffleWords()
  } else {
    fetchWords()
  }
}

const flipCard = () => {
  flipped.value = !flipped.value
  collapseActive.value = ''
  if (flipped.value && autoPlay.value && currentWord.value) {
    speak(currentWord.value.word)
  }
}

const speak = (text: string) => {
  if (!window.speechSynthesis) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.85
  window.speechSynthesis.speak(utterance)
}

const nextWord = () => {
  flipped.value = false
  if (currentIndex.value < words.value.length - 1) {
    currentIndex.value++
  }
  if (autoPlay.value && currentWord.value) {
    setTimeout(() => speak(currentWord.value!.word), 300)
  }
}

const prevWord = () => {
  flipped.value = false
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const markRemember = async () => {
  if (!currentWord.value) return
  try {
    await api.put(`/words/${currentWord.value.id}/remember`)
    await fetchStats()
    if (studyMode.value === 'due') {
      words.value = words.value.filter((_, i) => i !== currentIndex.value)
      if (currentIndex.value >= words.value.length) currentIndex.value = Math.max(0, words.value.length - 1)
    } else {
      await fetchWords()
    }
    ElMessage.success('太棒了！继续加油 💪')
    if (autoAdvance.value) nextWord()
  } catch (e: unknown) {
    ElMessage.error('操作失败')
  }
}

const markForget = async () => {
  if (!currentWord.value) return
  try {
    await api.put(`/words/${currentWord.value.id}/forget`)
    await fetchStats()
    ElMessage.info('没关系，多复习几次就会了')
    if (autoAdvance.value) nextWord()
  } catch (e: unknown) {
    ElMessage.error('操作失败')
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (view.value !== 'study' || mode.value !== 'card') return
  if (addDialogVisible.value || configDialogVisible.value) return
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
      flipCard()
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

const onTouchStart = (e: TouchEvent) => {
  swipeStartX.value = e.touches[0].clientX
  swipeStartY.value = e.touches[0].clientY
  swiping.value = true
  swipeDelta.value = 0
}

const onTouchMove = (e: TouchEvent) => {
  if (!swiping.value) return
  const dx = e.touches[0].clientX - swipeStartX.value
  const dy = e.touches[0].clientY - swipeStartY.value
  if (Math.abs(dy) > Math.abs(dx)) { swiping.value = false; swipeDelta.value = 0; return }
  swipeDelta.value = dx
}

const onTouchEnd = () => {
  if (!swiping.value) return
  swiping.value = false
  const threshold = 60
  if (swipeDelta.value > threshold && flipped.value) {
    markRemember()
  } else if (swipeDelta.value < -threshold && flipped.value) {
    markForget()
  } else if (swipeDelta.value > threshold && !flipped.value) {
    prevWord()
  } else if (swipeDelta.value < -threshold && !flipped.value) {
    nextWord()
  }
  swipeDelta.value = 0
}

const addWord = async () => {
  if (!newWord.value.word || !newWord.value.meaning) return
  try {
    await api.post('/words', { ...newWord.value, word_list: newWord.value.word_list || selectedWordList.value })
    newWord.value = { word: '', phonetic: '', meaning: '', example_en: '', example_cn: '', word_list: '' }
    addDialogVisible.value = false
    await fetchStats()
    await fetchWords()
    ElMessage.success('添加成功')
  } catch (e: unknown) {
    ElMessage.error('添加失败')
  }
}

const updateDailyConfig = async () => {
  try {
    await api.put('/words/daily-config', dailyConfig.value)
    configDialogVisible.value = false
    await fetchStats()
    ElMessage.success('设置已更新')
  } catch (e: unknown) {
    ElMessage.error('更新失败')
  }
}

const removeWord = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要从词库中删除此单词吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    await api.del(`/words/${id}`)
    await fetchStats()
    await fetchWords()
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

onMounted(() => {
  fetchWordListDetails()
  fetchStats()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="word-card-page">
    <!-- 词汇表选择 -->
    <template v-if="view === 'list'">
      <div class="page-header">
        <h2>单词卡</h2>
      </div>
      <div class="wl-grid">
        <div
          v-for="wl in wordLists"
          :key="wl.word_list"
          class="wl-card"
          :style="{ background: wordListColor(wl.word_list) }"
          @click="enterWordList(wl.word_list)"
        >
          <div class="wl-icon">{{ wordListIcon(wl.word_list) }}</div>
          <div class="wl-name">{{ wordListLabel(wl.word_list) }}</div>
          <div class="wl-count">{{ wl.count }} 词</div>
          <div class="wl-stats">
            <span class="wl-stat-item">🆕 {{ wl.stats.newCount }}</span>
            <span class="wl-stat-item">📖 {{ wl.stats.learningCount }}</span>
            <span class="wl-stat-item">✅ {{ wl.stats.masteredCount }}</span>
          </div>
          <div v-if="wl.stats.dueCount > 0" class="wl-due">今日待复习 {{ wl.stats.dueCount }} 词</div>
          <div v-else class="wl-due wl-due-done">今日已复习完 ✨</div>
        </div>
      </div>
    </template>

    <!-- 词汇表学习 -->
    <template v-else>
      <div class="study-nav">
        <el-button text @click="backToList" :icon="'ArrowLeft'">返回词汇表</el-button>
        <div class="study-nav-title">
          <span class="study-nav-icon">{{ wordListIcon(selectedWordList) }}</span>
          {{ wordListLabel(selectedWordList) }}
        </div>
        <div class="study-nav-actions">
          <el-button size="small" @click="addDialogVisible = true" :icon="'Plus'">添加</el-button>
          <el-button size="small" @click="configDialogVisible = true" :icon="'Setting'">目标</el-button>
        </div>
      </div>

      <div v-if="stats" class="stats-bar">
        <div class="stats-item">
          <svg class="progress-ring" width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#e9ecef" stroke-width="4" />
            <circle cx="22" cy="22" r="18" fill="none" stroke="#409EFF" stroke-width="4"
              :stroke-dasharray="`${totalProgress * 1.13} 113`"
              stroke-linecap="round" transform="rotate(-90 22 22)" />
            <text x="22" y="22" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="#303133">
              {{ totalProgress }}%
            </text>
          </svg>
          <span class="stats-text">今日进度</span>
        </div>
        <div class="stats-item">
          <span class="stats-num streak">{{ stats.streak }}</span>
          <span class="stats-text">连续🔥</span>
        </div>
        <div class="stats-item">
          <span class="stats-num">{{ stats.todayStudied }}</span>
          <span class="stats-text">今日已学</span>
        </div>
        <div class="stats-item">
          <el-progress :percentage="newProgress" :stroke-width="6" :color="'#409EFF'" style="width:70px" />
          <span class="stats-text">新 {{ stats.todayNew }}/{{ stats.targetNew }}</span>
        </div>
        <div class="stats-item">
          <el-progress :percentage="reviewProgress" :stroke-width="6" :color="'#67C23A'" style="width:70px" />
          <span class="stats-text">复 {{ stats.todayReviewed }}/{{ stats.targetReview }}</span>
        </div>
        <div class="stats-item mastery-summary-compact">
          <span>🆕{{ stats.newCount }}</span>
          <span>📖{{ stats.learningCount }}</span>
          <span>✅{{ stats.masteredCount }}</span>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchQuery"
            placeholder="搜索单词/释义"
            :prefix-icon="'Search'"
            clearable
            style="width: 180px"
            @keyup.enter="searchWords"
            @clear="clearSearch"
          />
          <el-radio-group v-model="filterMastery" @change="studyMode = 'all'; fetchWords()" size="small">
            <el-radio-button :value="-1">全部</el-radio-button>
            <el-radio-button :value="0">🆕新词</el-radio-button>
            <el-radio-button :value="1">📖学习中</el-radio-button>
            <el-radio-button :value="2">✅已掌握</el-radio-button>
          </el-radio-group>
        </div>
        <div class="toolbar-right">
          <el-radio-group v-model="mode" size="small">
            <el-radio-button value="card">卡片</el-radio-button>
            <el-radio-button value="list">列表</el-radio-button>
          </el-radio-group>
          <el-button-group>
            <el-button :type="shuffled ? 'primary' : 'default'" size="small" @click="toggleShuffle" :icon="'Sort'">乱序</el-button>
            <el-button :type="autoPlay ? 'primary' : 'default'" size="small" @click="autoPlay = !autoPlay" :icon="'Microphone'">发音</el-button>
            <el-button :type="autoAdvance ? 'primary' : 'default'" size="small" @click="autoAdvance = !autoAdvance">自动</el-button>
          </el-button-group>
          <el-button size="small" @click="studyMode = 'due'; fetchWords()" type="warning" :icon="'RefreshRight'">今日任务</el-button>
        </div>
      </div>

      <!-- 庆祝动画 -->
      <transition name="celebrate">
        <div v-if="celebrating" class="celebration-overlay">
          <div class="celebration-content">
            <div class="celebration-emoji">🎉</div>
            <div class="celebration-text">今日任务全部完成！</div>
            <div class="celebration-sub">太棒了，明天继续加油！</div>
          </div>
        </div>
      </transition>

      <div v-if="mode === 'card' && words.length > 0" class="card-mode"
        @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
        <div class="flip-container" @click="flipCard">
          <div class="flip-card" :class="{ flipped: flipped }" :style="swiping ? { transform: `translateX(${swipeDelta * 0.3}px)` } : {}">
            <div class="flip-front">
              <div class="card-mastery-badge">{{ masteryIcon(currentWord?.mastery_level) }}</div>
              <div class="card-word">{{ currentWord?.word }}</div>
              <div class="card-phonetic">{{ currentWord?.phonetic }}</div>
              <div v-if="lastReviewText" class="card-review-info">{{ lastReviewText }}</div>
              <div class="card-hint">空格翻转 · ← → 切换 · 1不认识 2认识</div>
            </div>
            <div class="flip-back">
              <div class="card-mastery-badge">{{ masteryIcon(currentWord?.mastery_level) }}</div>
              <div class="card-meaning">{{ currentWord?.meaning }}</div>
              <div v-if="currentWord?.example_en" class="card-example">
                <div class="example-en">{{ currentWord.example_en }}</div>
                <div class="example-cn">{{ currentWord.example_cn }}</div>
              </div>
              <div v-if="hasEnrichment" class="card-enrichment" @click.stop>
                <el-collapse v-model="collapseActive" accordion>
                  <el-collapse-item v-if="parsedForms" name="forms" title="词形变化">
                    <div class="enrichment-forms">
                      <div v-for="(val, key) in parsedForms" :key="key" class="form-row">
                        <span class="form-label">{{ formLabelMap[key] || key }}</span>
                        <span class="form-value">{{ val }}</span>
                      </div>
                    </div>
                  </el-collapse-item>
                  <el-collapse-item v-if="parsedCollocations?.length" name="collocations" title="搭配">
                    <div class="enrichment-collocations">
                      <div v-for="c in parsedCollocations" :key="c.phrase" class="coll-row">
                        <span class="coll-phrase">{{ c.phrase }}</span>
                        <span class="coll-meaning">{{ c.meaning }}</span>
                      </div>
                    </div>
                  </el-collapse-item>
                  <el-collapse-item v-if="parsedDistinction?.length" name="distinction" title="易混辨析">
                    <div class="enrichment-distinction">
                      <div v-for="d in parsedDistinction" :key="d.word" class="dist-row">
                        <span class="dist-word">{{ d.word }}</span>
                        <span class="dist-diff">{{ d.diff }}</span>
                      </div>
                    </div>
                  </el-collapse-item>
                  <el-collapse-item v-if="parsedSynonyms?.length || parsedAntonyms?.length" name="synant" title="同义/反义">
                    <div class="enrichment-synant">
                      <div v-if="parsedSynonyms?.length" class="synant-group">
                        <span class="synant-label">同义</span>
                        <div class="synant-tags">
                          <span v-for="s in parsedSynonyms" :key="s" class="synant-tag synonym">{{ s }}</span>
                        </div>
                      </div>
                      <div v-if="parsedAntonyms?.length" class="synant-group">
                        <span class="synant-label">反义</span>
                        <div class="synant-tags">
                          <span v-for="a in parsedAntonyms" :key="a" class="synant-tag antonym">{{ a }}</span>
                        </div>
                      </div>
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </div>
              <div v-if="parsedEtymology" class="card-etymology">{{ parsedEtymology }}</div>
              <div v-if="nextReviewText" class="card-review-info">{{ nextReviewText }}</div>
              <div class="card-hint">← 滑不认识 · → 滑认识</div>
            </div>
          </div>
        </div>

        <div class="card-actions">
          <el-button @click="prevWord" :disabled="currentIndex === 0" :icon="'ArrowLeft'">上一个</el-button>
          <el-button type="danger" @click="markForget" :icon="'Close'">不认识</el-button>
          <el-button type="success" @click="markRemember" :icon="'Check'">认识</el-button>
          <el-button @click="nextWord" :disabled="currentIndex >= words.length - 1">
            下一个<el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
        <div class="card-progress">
          <span>{{ currentIndex + 1 }} / {{ words.length }}</span>
          <span v-if="currentWord" class="progress-mastery">
            {{ masteryLabel(currentWord.mastery_level) }}
            <span v-if="currentWord.review_count > 0">· {{ currentWord.review_count }}次</span>
            <span v-if="currentWord.interval_days > 0">· 间隔{{ currentWord.interval_days }}天</span>
          </span>
        </div>
      </div>

      <div v-else-if="mode === 'card' && words.length === 0 && !loading" class="empty-card">
        <el-empty description="暂无待学单词，太棒了！🎉" />
        <el-button type="primary" @click="studyMode = 'all'; filterMastery = -1; fetchWords()">浏览全部单词</el-button>
      </div>

      <div v-else-if="mode === 'list'" class="list-mode">
        <el-table :data="words" stripe v-loading="loading" class="word-table" max-height="520">
          <el-table-column label="" width="40">
            <template #default="{ row }">{{ masteryIcon(row.mastery_level) }}</template>
          </el-table-column>
          <el-table-column prop="word" label="单词" width="130" />
          <el-table-column prop="phonetic" label="音标" width="150" />
          <el-table-column prop="meaning" label="释义" width="160" />
          <el-table-column label="词形" width="140">
            <template #default="{ row }">
              <template v-if="row.forms">
                <span v-for="(val, key, idx) in safeParse<WordForms>(row.forms)" :key="key">
                  <template v-if="idx > 0">/</template>{{ val }}
                </span>
              </template>
              <span v-else class="no-example">—</span>
            </template>
          </el-table-column>
          <el-table-column label="例句">
            <template #default="{ row }">
              <div v-if="row.example_en" class="table-example">
                <div>{{ row.example_en }}</div>
                <div class="example-cn-text">{{ row.example_cn }}</div>
              </div>
              <span v-else class="no-example">—</span>
            </template>
          </el-table-column>
          <el-table-column label="掌握" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="masteryTagType(row.mastery_level)" size="small">{{ masteryLabel(row.mastery_level) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="review_count" label="复习" width="60" align="center" />
          <el-table-column label="操作" width="70">
            <template #default="{ row }">
              <el-button size="small" type="danger" text @click="removeWord(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <el-dialog v-model="addDialogVisible" title="添加单词" width="520px" destroy-on-close>
      <el-form @submit.prevent="addWord" label-width="90px">
        <el-form-item label="单词" required>
          <el-input v-model="newWord.word" placeholder="English word" />
        </el-form-item>
        <el-form-item label="音标">
          <el-input v-model="newWord.phonetic" placeholder="/əˈbændən/" />
        </el-form-item>
        <el-form-item label="释义" required>
          <el-input v-model="newWord.meaning" placeholder="v. 放弃；遗弃" />
        </el-form-item>
        <el-form-item label="英文例句">
          <el-input v-model="newWord.example_en" type="textarea" :rows="2" placeholder="He abandoned his old car." />
        </el-form-item>
        <el-form-item label="中文翻译">
          <el-input v-model="newWord.example_cn" type="textarea" :rows="2" placeholder="他丢弃了旧车。" />
        </el-form-item>
        <el-form-item label="词汇表">
          <el-select v-model="newWord.word_list" clearable placeholder="选择词汇表" style="width: 100%">
            <el-option v-for="wl in wordLists" :key="wl.word_list" :label="wordListLabel(wl.word_list)" :value="wl.word_list" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addWord">添加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="configDialogVisible" title="每日目标设置" width="400px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="每日新词">
          <el-input-number v-model="dailyConfig.target_new" :min="5" :max="100" />
        </el-form-item>
        <el-form-item label="每日复习">
          <el-input-number v-model="dailyConfig.target_review" :min="10" :max="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="updateDailyConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.word-card-page h2 {
  margin: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.wl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.wl-card {
  border-radius: 16px;
  padding: 28px 24px;
  color: #fff;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wl-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

.wl-icon {
  font-size: 36px;
  margin-bottom: 4px;
}

.wl-name {
  font-size: 22px;
  font-weight: 700;
}

.wl-count {
  font-size: 14px;
  opacity: 0.9;
}

.wl-stats {
  display: flex;
  gap: 12px;
  font-size: 13px;
  opacity: 0.85;
  margin-top: 4px;
}

.wl-due {
  font-size: 13px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 4px 12px;
  align-self: flex-start;
  margin-top: 4px;
}

.wl-due-done {
  background: rgba(255, 255, 255, 0.15);
}

.study-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.study-nav-title {
  font-size: 18px;
  font-weight: 600;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.study-nav-icon {
  font-size: 22px;
}

.study-nav-actions {
  display: flex;
  gap: 8px;
}

.stats-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 14px;
  background: #f5f7fa;
  border-radius: 10px;
  margin-bottom: 12px;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.progress-ring {
  flex-shrink: 0;
}

.stats-num {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.stats-num.streak {
  color: #e6a23c;
}

.stats-text {
  font-size: 11px;
  color: #909399;
}

.mastery-summary-compact {
  gap: 8px;
  font-size: 12px;
  margin-left: auto;
  color: #606266;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.flip-container {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  perspective: 1000px;
  cursor: pointer;
}

.flip-card {
  position: relative;
  width: 100%;
  height: 420px;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.flip-card.flipped {
  transform: rotateY(180deg);
}

.flip-front,
.flip-back {
  position: absolute;
  width: 100%;
  height: 420px;
  border-radius: 16px;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 32px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1);
}

.flip-back {
  overflow-y: auto;
  justify-content: flex-start;
  padding-top: 20px;
}

.flip-front {
  background: linear-gradient(135deg, #667eea 0%, #5a67d8 100%);
  color: #fff;
}

.flip-back {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  color: #fff;
  transform: rotateY(180deg);
}

.flip-back::-webkit-scrollbar {
  width: 4px;
}

.flip-back::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.flip-back::-webkit-scrollbar-track {
  background: transparent;
}

.card-mastery-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 22px;
}

.card-word {
  font-size: 38px;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.card-phonetic {
  font-size: 18px;
  opacity: 0.85;
  margin-bottom: 16px;
}

.card-review-info {
  font-size: 12px;
  opacity: 0.7;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 2px 10px;
  margin-bottom: 8px;
}

.card-meaning {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 14px;
  text-align: center;
}

.card-example {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 12px 18px;
  width: 100%;
  margin-bottom: 10px;
}

.example-en {
  font-size: 14px;
  line-height: 1.5;
  font-style: italic;
  margin-bottom: 4px;
}

.example-cn {
  font-size: 13px;
  opacity: 0.85;
  line-height: 1.4;
}

.card-hint {
  font-size: 11px;
  opacity: 0.45;
  margin-top: auto;
}

.card-enrichment {
  width: 100%;
  margin-bottom: 8px;
}

.card-enrichment :deep(.el-collapse) {
  --el-collapse-header-bg-color: rgba(255, 255, 255, 0.12);
  --el-collapse-content-bg-color: rgba(255, 255, 255, 0.08);
  --el-collapse-header-text-color: #fff;
  --el-collapse-content-text-color: rgba(255, 255, 255, 0.9);
  --el-collapse-header-height: 32px;
  border: none;
}

.card-enrichment :deep(.el-collapse-item__header) {
  font-size: 13px;
  padding: 0 10px;
  border-bottom-color: rgba(255, 255, 255, 0.15);
}

.card-enrichment :deep(.el-collapse-item__wrap) {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.card-enrichment :deep(.el-collapse-item__content) {
  padding: 8px 10px;
  font-size: 13px;
}

.enrichment-forms {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-label {
  font-size: 11px;
  opacity: 0.6;
}

.form-value {
  font-weight: 600;
}

.enrichment-collocations {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.coll-row {
  display: flex;
  gap: 8px;
}

.coll-phrase {
  font-weight: 600;
}

.coll-meaning {
  opacity: 0.8;
}

.enrichment-distinction {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dist-row {
  display: flex;
  gap: 8px;
}

.dist-word {
  font-weight: 600;
  white-space: nowrap;
}

.dist-diff {
  opacity: 0.85;
  line-height: 1.4;
}

.enrichment-synant {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.synant-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.synant-label {
  font-size: 12px;
  opacity: 0.7;
  white-space: nowrap;
  min-width: 28px;
}

.synant-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.synant-tag {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
}

.synant-tag.antonym {
  background: rgba(255, 200, 200, 0.25);
}

.card-etymology {
  width: 100%;
  font-size: 12px;
  opacity: 0.75;
  text-align: center;
  padding: 4px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  margin-top: 4px;
}

.card-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}

.card-progress {
  text-align: center;
  color: #909399;
  margin-top: 8px;
  font-size: 13px;
}

.progress-mastery {
  margin-left: 10px;
  font-size: 12px;
}

.empty-card {
  text-align: center;
  padding: 40px 0;
}

.celebration-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
}

.celebration-content {
  text-align: center;
  color: #fff;
  animation: celebrationPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.celebration-emoji {
  font-size: 72px;
  animation: celebrationBounce 0.6s ease infinite alternate;
}

.celebration-text {
  font-size: 28px;
  font-weight: 700;
  margin-top: 12px;
}

.celebration-sub {
  font-size: 16px;
  opacity: 0.8;
  margin-top: 8px;
}

.celebrate-enter-active {
  animation: celebrationPop 0.5s;
}

.celebrate-leave-active {
  animation: celebrationPop 0.3s reverse;
}

@keyframes celebrationPop {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes celebrationBounce {
  from { transform: translateY(0); }
  to { transform: translateY(-12px); }
}

.table-example {
  line-height: 1.5;
}

.example-cn-text {
  color: #999;
  font-size: 13px;
}

.no-example {
  color: #ccc;
}

.word-table {
  width: 100%;
}

@media (min-width: 768px) {
  .flip-container {
    max-width: 520px;
  }
}

@media (min-width: 1200px) {
  .flip-container {
    max-width: 600px;
  }
}
</style>
