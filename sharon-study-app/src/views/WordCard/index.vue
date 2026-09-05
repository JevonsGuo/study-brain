<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../../utils/api'
import { ElMessage } from 'element-plus'

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

const words = ref<Word[]>([])
const allWords = ref<Word[]>([])
const stats = ref<Stats | null>(null)
const loading = ref(false)
const wordLists = ref<WordListOption[]>([])
const selectedWordList = ref('')

const searchQuery = ref('')
const filterMastery = ref(-1)
const mode = ref<'card' | 'list'>('card')
const studyMode = ref<'all' | 'due'>('due')

const currentIndex = ref(0)
const flipped = ref(false)
const shuffled = ref(false)
const autoPlay = ref(false)

const addDialogVisible = ref(false)
const configDialogVisible = ref(false)

const newWord = ref({ word: '', phonetic: '', meaning: '', example_en: '', example_cn: '', word_list: '' })
const dailyConfig = ref({ target_new: 20, target_review: 40 })

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

const newProgress = computed(() => {
  if (!stats.value) return 0
  const s = stats.value
  return Math.min(100, Math.round((s.todayNew / s.targetNew) * 100))
})

const reviewProgress = computed(() => {
  if (!stats.value) return 0
  const s = stats.value
  return Math.min(100, Math.round((s.todayReviewed / s.targetReview) * 100))
})

const fetchWordLists = async () => {
  try {
    wordLists.value = await api.get('/words/word-lists')
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
    const wlParam = selectedWordList.value ? `&word_list=${encodeURIComponent(selectedWordList.value)}` : ''
    if (studyMode.value === 'due') {
      const data = await api.get(`/words/due?${wlParam.slice(1)}`)
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

const fetchAllWords = async () => {
  try {
    const params: Record<string, string> = {}
    if (selectedWordList.value) params.word_list = selectedWordList.value
    const query = Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''
    allWords.value = await api.get(`/words${query}`)
  } catch {
    // silent
  }
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

const onWordListChange = () => {
  currentIndex.value = 0
  flipped.value = false
  fetchStats()
  fetchWords()
  fetchAllWords()
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
  } catch (e: unknown) {
    ElMessage.error('操作失败')
  }
}

const markForget = async () => {
  if (!currentWord.value) return
  try {
    await api.put(`/words/${currentWord.value.id}/forget`)
    await fetchStats()
    nextWord()
    ElMessage.info('没关系，多复习几次就会了')
  } catch (e: unknown) {
    ElMessage.error('操作失败')
  }
}

const addWord = async () => {
  if (!newWord.value.word || !newWord.value.meaning) return
  try {
    await api.post('/words', newWord.value)
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
    await api.del(`/words/${id}`)
    await fetchStats()
    await fetchWords()
    ElMessage.success('已删除')
  } catch (e: unknown) {
    ElMessage.error('删除失败')
  }
}

onMounted(() => {
  fetchWordLists()
  fetchStats()
  fetchWords()
  fetchAllWords()
})
</script>

<template>
  <div class="word-card-page">
    <div class="page-header">
      <h2>单词卡</h2>
      <div class="header-actions">
        <el-button type="primary" @click="addDialogVisible = true" :icon="'Plus'">添加单词</el-button>
        <el-button @click="configDialogVisible = true" :icon="'Setting'">目标设置</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="stats-row" v-if="stats">
      <el-col :xs="8" :sm="4">
        <el-card shadow="never" class="stat-card streak-card">
          <div class="stat-value">{{ stats.streak }}</div>
          <div class="stat-label">连续天数 🔥</div>
        </el-card>
      </el-col>
      <el-col :xs="8" :sm="5">
        <el-card shadow="never" class="stat-card">
          <div class="stat-value">{{ stats.todayStudied }}</div>
          <div class="stat-label">今日已学</div>
        </el-card>
      </el-col>
      <el-col :xs="8" :sm="5">
        <el-card shadow="never" class="stat-card">
          <el-progress :percentage="newProgress" :stroke-width="8" :color="'#409EFF'" />
          <div class="stat-label">新词 {{ stats.todayNew }}/{{ stats.targetNew }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="5">
        <el-card shadow="never" class="stat-card">
          <el-progress :percentage="reviewProgress" :stroke-width="8" :color="'#67C23A'" />
          <div class="stat-label">复习 {{ stats.todayReviewed }}/{{ stats.targetReview }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="5">
        <el-card shadow="never" class="stat-card">
          <div class="mastery-summary">
            <span class="mastery-item">🆕 {{ stats.newCount }}</span>
            <span class="mastery-item">📖 {{ stats.learningCount }}</span>
            <span class="mastery-item">✅ {{ stats.masteredCount }}</span>
          </div>
          <div class="stat-label">掌握情况（共{{ stats.total }}词）</div>
        </el-card>
      </el-col>
    </el-row>

    <div class="toolbar">
      <div class="toolbar-left">
        <el-select
          v-model="selectedWordList"
          placeholder="词汇表"
          clearable
          style="width: 150px"
          @change="onWordListChange"
        >
          <el-option label="全部词汇表" value="" />
          <el-option
            v-for="wl in wordLists"
            :key="wl.word_list"
            :label="`${wl.word_list} (${wl.count})`"
            :value="wl.word_list"
          />
        </el-select>
        <el-input
          v-model="searchQuery"
          placeholder="搜索单词/释义/例句"
          :prefix-icon="'Search'"
          clearable
          style="width: 240px"
          @keyup.enter="searchWords"
          @clear="clearSearch"
        />
        <el-radio-group v-model="filterMastery" @change="studyMode = 'all'; fetchWords()" size="small">
          <el-radio-button :value="-1">全部</el-radio-button>
          <el-radio-button :value="0">🆕 新词</el-radio-button>
          <el-radio-button :value="1">📖 学习中</el-radio-button>
          <el-radio-button :value="2">✅ 已掌握</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar-right">
        <el-radio-group v-model="mode" size="small">
          <el-radio-button value="card">卡片</el-radio-button>
          <el-radio-button value="list">列表</el-radio-button>
        </el-radio-group>
        <el-button-group>
          <el-button :type="shuffled ? 'primary' : 'default'" size="small" @click="toggleShuffle" :icon="'Sort'">
            乱序
          </el-button>
          <el-button :type="autoPlay ? 'primary' : 'default'" size="small" @click="autoPlay = !autoPlay" :icon="'Microphone'">
            发音
          </el-button>
        </el-button-group>
        <el-button size="small" @click="studyMode = 'due'; fetchWords()" type="warning" :icon="'RefreshRight'">
          今日任务
        </el-button>
      </div>
    </div>

    <div v-if="mode === 'card' && words.length > 0" class="card-mode">
      <div class="flip-container" @click="flipCard">
        <div class="flip-card" :class="{ flipped: flipped }">
          <div class="flip-front">
            <div class="card-mastery-badge">{{ masteryIcon(currentWord?.mastery_level) }}</div>
            <div class="card-word">{{ currentWord?.word }}</div>
            <div class="card-phonetic">{{ currentWord?.phonetic }}</div>
            <div class="card-hint">点击翻转查看释义</div>
          </div>
          <div class="flip-back">
            <div class="card-mastery-badge">{{ masteryIcon(currentWord?.mastery_level) }}</div>
            <div class="card-meaning">{{ currentWord?.meaning }}</div>
            <div v-if="currentWord?.example_en" class="card-example">
              <div class="example-en">{{ currentWord.example_en }}</div>
              <div class="example-cn">{{ currentWord.example_cn }}</div>
            </div>
            <div class="card-hint">点击翻回正面</div>
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
          <span v-if="currentWord.review_count > 0">· 已复习{{ currentWord.review_count }}次</span>
          <span v-if="currentWord.interval_days > 0">· 间隔{{ currentWord.interval_days }}天</span>
        </span>
      </div>
    </div>

    <div v-else-if="mode === 'card' && words.length === 0 && !loading" class="empty-card">
      <el-empty description="暂无待学单词，太棒了！🎉" />
      <el-button type="primary" @click="studyMode = 'all'; filterMastery = -1; fetchWords()">浏览全部单词</el-button>
    </div>

    <div v-else-if="mode === 'list'" class="list-mode">
      <el-table :data="words" stripe v-loading="loading" class="word-table" max-height="600">
        <el-table-column label="" width="40">
          <template #default="{ row }">
            {{ masteryIcon(row.mastery_level) }}
          </template>
        </el-table-column>
        <el-table-column prop="word" label="单词" width="130" />
        <el-table-column prop="word_list" label="词汇表" width="100" />
        <el-table-column prop="phonetic" label="音标" width="160" />
        <el-table-column prop="meaning" label="释义" width="160" />
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
            <el-tag :type="masteryTagType(row.mastery_level)" size="small">
              {{ masteryLabel(row.mastery_level) }}
            </el-tag>
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
            <el-option
              v-for="wl in wordLists"
              :key="wl.word_list"
              :label="wl.word_list"
              :value="wl.word_list"
            />
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
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  text-align: center;
  padding: 4px 0;
}

.stat-card :deep(.el-card__body) {
  padding: 12px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.streak-card .stat-value {
  color: #e6a23c;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.mastery-summary {
  display: flex;
  justify-content: center;
  gap: 10px;
  font-size: 15px;
}

.mastery-item {
  font-weight: 500;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.flip-container {
  width: 440px;
  max-width: 100%;
  margin: 0 auto;
  perspective: 1000px;
  cursor: pointer;
}

.flip-card {
  position: relative;
  width: 100%;
  min-height: 280px;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.flip-card.flipped {
  transform: rotateY(180deg);
}

.flip-front,
.flip-back {
  position: absolute;
  width: 100%;
  min-height: 280px;
  border-radius: 16px;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
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

.card-mastery-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  font-size: 24px;
}

.card-word {
  font-size: 40px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: 1px;
}

.card-phonetic {
  font-size: 20px;
  opacity: 0.85;
  margin-bottom: 24px;
}

.card-meaning {
  font-size: 26px;
  font-weight: 600;
  margin-bottom: 20px;
  text-align: center;
}

.card-example {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 14px 20px;
  width: 100%;
  margin-bottom: 16px;
}

.example-en {
  font-size: 15px;
  line-height: 1.6;
  font-style: italic;
  margin-bottom: 6px;
}

.example-cn {
  font-size: 14px;
  opacity: 0.85;
  line-height: 1.5;
}

.card-hint {
  font-size: 13px;
  opacity: 0.5;
  margin-top: auto;
}

.card-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}

.card-progress {
  text-align: center;
  color: #909399;
  margin-top: 12px;
  font-size: 14px;
}

.progress-mastery {
  margin-left: 12px;
  font-size: 13px;
}

.empty-card {
  text-align: center;
  padding: 40px 0;
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
</style>
