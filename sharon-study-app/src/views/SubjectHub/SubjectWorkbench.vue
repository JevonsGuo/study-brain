<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  SUBJECT_METAS,
  getTopicsForSubject,
  getBooksForSubject,
  type GaokaoTopic
} from '../../utils/gaokaoTopics'
import { subjectEmojis } from '../../utils/subjects'
import RichQuestionEditor from '../../components/RichQuestionEditor.vue'
import KnowledgeDrawer from './components/KnowledgeDrawer.vue'
import {
  ArrowLeft,
  Reading,
  Notebook,
  Plus,
  RefreshRight,
  Search,
  Star,
  StarFilled,
  Check,
  Edit,
  Delete,
  VideoPlay,
  Hide,
  View,
  FolderOpened,
  Folder,
  Right
} from '@element-plus/icons-vue'

const props = defineProps<{
  subject: string
}>()

const route = useRoute()
const router = useRouter()

// -------------------------------------------------------------
// 1. 工作台 Tab 切换管理 (核心考点库 vs 错题靶向本)
// -------------------------------------------------------------
const activeTab = ref<'knowledge' | 'wrong-book'>('knowledge')

const syncTabFromRoute = () => {
  const queryTab = route.query.tab as string
  if (queryTab === 'wrong-book' || queryTab === 'knowledge') {
    activeTab.value = queryTab
  } else {
    activeTab.value = 'knowledge'
  }
}

const switchTab = (tab: 'knowledge' | 'wrong-book') => {
  activeTab.value = tab
  router.replace({
    query: {
      ...route.query,
      tab
    }
  })
}

const backToHall = () => {
  router.push('/subjects')
}

// -------------------------------------------------------------
// 2. 数据定义与加载
// -------------------------------------------------------------
interface KnowledgePoint {
  id: number
  subject: string
  grade: string
  book: string
  chapter: string
  title: string
  content: string
  key_formulas: string
  tips: string
  visual_desc: string
  video_url: string
  sort_order: number
}

interface WrongItem {
  id: number
  subject: string
  question: string
  reason: string
  mastery_status: 'unmastered' | 'learning' | 'mastered'
  review_count: number
  knowledge_point_id?: number | null
  knowledge_title?: string
  knowledge_chapter?: string
  created_at: string
}

interface LearningResource {
  id: number
  subject: string
  category: string
  name: string
  desc: string
  url: string
  sort_order: number
}

const points = ref<KnowledgePoint[]>([])
const wrongItems = ref<WrongItem[]>([])
const resources = ref<LearningResource[]>([])

const loadingPoints = ref(false)
const loadingWrong = ref(false)

const loadAllData = async () => {
  loadingPoints.value = true
  loadingWrong.value = true
  try {
    const [pRes, wRes, rRes] = await Promise.all([
      api.get(`/knowledge?subject=${encodeURIComponent(props.subject)}`),
      api.get(`/wrong-items?subject=${encodeURIComponent(props.subject)}`),
      api.get(`/learning-resources?subject=${encodeURIComponent(props.subject)}`)
    ])
    points.value = (pRes as KnowledgePoint[]) || []
    wrongItems.value = (wRes as WrongItem[]) || []
    resources.value = (rRes as LearningResource[]) || []

    // 默认考点展开
    expandedPointIds.value = new Set(points.value.map(p => p.id))
  } catch (err) {
    console.error('Failed to load subject data', err)
  } finally {
    loadingPoints.value = false
    loadingWrong.value = false
  }
}

// -------------------------------------------------------------
// 3. 知识点模块相关逻辑
// -------------------------------------------------------------
const starredPointIds = ref<Set<number>>(new Set())
const masteredPointIds = ref<Set<number>>(new Set())
const expandedPointIds = ref<Set<number>>(new Set())
const expandedWrongOnPointIds = ref<Set<number>>(new Set())

const filterDimension = ref<'topic' | 'book'>('topic')
const activeTopicId = ref<string>('all')
const activeBook = ref<string>('all')
const topicFilterStatus = ref<'all' | 'starred' | 'mastered' | 'unmastered'>('all')
const knowledgeSearchQuery = ref('')

const loadLocalStatuses = () => {
  try {
    const rawStarred = localStorage.getItem('sharon_starred_points')
    if (rawStarred) starredPointIds.value = new Set(JSON.parse(rawStarred))
    const rawMastered = localStorage.getItem('sharon_mastered_points')
    if (rawMastered) masteredPointIds.value = new Set(JSON.parse(rawMastered))
  } catch (e) {
    console.error('Failed to load local statuses', e)
  }
}

const toggleStar = (id: number) => {
  if (starredPointIds.value.has(id)) starredPointIds.value.delete(id)
  else starredPointIds.value.add(id)
  localStorage.setItem('sharon_starred_points', JSON.stringify(Array.from(starredPointIds.value)))
}

const toggleMastered = (id: number) => {
  if (masteredPointIds.value.has(id)) masteredPointIds.value.delete(id)
  else masteredPointIds.value.add(id)
  localStorage.setItem('sharon_mastered_points', JSON.stringify(Array.from(masteredPointIds.value)))
}

const togglePointExpand = (id: number) => {
  if (expandedPointIds.value.has(id)) expandedPointIds.value.delete(id)
  else expandedPointIds.value.add(id)
}

const toggleWrongOnPoint = (id: number) => {
  if (expandedWrongOnPointIds.value.has(id)) expandedWrongOnPointIds.value.delete(id)
  else expandedWrongOnPointIds.value.add(id)
}

const subjectTopics = computed<GaokaoTopic[]>(() => {
  return getTopicsForSubject(props.subject, points.value)
})

const topicPointCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const t of subjectTopics.value) {
    counts[t.id] = points.value.filter(p => t.match(p)).length
  }
  return counts
})

const subjectBooks = computed(() => {
  return getBooksForSubject(points.value)
})

const starredCount = computed(() => points.value.filter(p => starredPointIds.value.has(p.id)).length)
const masteredCount = computed(() => points.value.filter(p => masteredPointIds.value.has(p.id)).length)
const unmasteredCount = computed(() => points.value.filter(p => !masteredPointIds.value.has(p.id)).length)

const areAllPointsExpanded = computed(() => {
  return filteredPoints.value.length > 0 && filteredPoints.value.every(p => expandedPointIds.value.has(p.id))
})

const toggleExpandAll = () => {
  if (areAllPointsExpanded.value) {
    expandedPointIds.value = new Set()
  } else {
    expandedPointIds.value = new Set(points.value.map(p => p.id))
  }
}

const activeTopicObj = computed(() => {
  if (activeTopicId.value === 'all') return null
  return subjectTopics.value.find(t => t.id === activeTopicId.value)
})

// 过滤后的知识点列表
const filteredPoints = computed(() => {
  let list = points.value

  // 1. 专题/分册维度过滤
  if (filterDimension.value === 'topic') {
    if (activeTopicId.value !== 'all' && activeTopicObj.value) {
      list = list.filter(p => activeTopicObj.value!.match(p))
    }
  } else {
    if (activeBook.value !== 'all') {
      list = list.filter(p => p.book === activeBook.value)
    }
  }

  // 2. 状态过滤
  if (topicFilterStatus.value === 'starred') {
    list = list.filter(p => starredPointIds.value.has(p.id))
  } else if (topicFilterStatus.value === 'mastered') {
    list = list.filter(p => masteredPointIds.value.has(p.id))
  } else if (topicFilterStatus.value === 'unmastered') {
    list = list.filter(p => !masteredPointIds.value.has(p.id))
  }

  // 3. 搜索过滤
  if (knowledgeSearchQuery.value.trim()) {
    const q = knowledgeSearchQuery.value.trim().toLowerCase()
    list = list.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.key_formulas.toLowerCase().includes(q) ||
      p.chapter.toLowerCase().includes(q)
    )
  }

  return list
})

// 考点关联的错题列表辅助映射
const wrongItemsByPointId = computed(() => {
  const map = new Map<number, WrongItem[]>()
  for (const item of wrongItems.value) {
    if (item.knowledge_point_id) {
      const cur = map.get(item.knowledge_point_id) || []
      cur.push(item)
      map.set(item.knowledge_point_id, cur)
    }
  }
  return map
})

// 按考点重点库专题归集的考点列表 (供错题关联和筛选使用，摆脱教材章节束缚)
const topicGroupedPoints = computed(() => {
  const topics = subjectTopics.value
  const result: Array<{ id: string; name: string; points: KnowledgePoint[] }> = []
  const assigned = new Set<number>()

  for (const topic of topics) {
    const matched = points.value.filter(p => !assigned.has(p.id) && topic.match(p))
    if (matched.length > 0) {
      matched.forEach(p => assigned.add(p.id))
      result.push({
        id: topic.id,
        name: topic.name,
        points: matched
      })
    }
  }

  const remaining = points.value.filter(p => !assigned.has(p.id))
  if (remaining.length > 0) {
    result.push({
      id: 'other',
      name: '核心考点归集',
      points: remaining
    })
  }

  return result
})

// 公式与文本渲染
const renderMathAndText = (text: string): string => {
  if (!text) return ''
  let result = text.replace(/\n/g, '<br/>')
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false })
    } catch {
      return `$$${formula}$$`
    }
  })
  result = result.replace(/\$([^\$]+?)\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false })
    } catch {
      return `$${formula}$`
    }
  })
  return result
}

// B站视频嵌入弹窗
const videoModalVisible = ref(false)
const currentVideoTitle = ref('')
const currentVideoEmbedUrl = ref('')

const getBilibiliEmbedUrl = (url: string): string => {
  const bvMatch = url.match(/\/(BV[\w]+)/)
  if (bvMatch) return `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&autoplay=0`
  const avMatch = url.match(/\/av(\d+)/)
  if (avMatch) return `https://player.bilibili.com/player.html?aid=${avMatch[1]}&autoplay=0`
  return ''
}

const openVideoPreview = (title: string, url: string) => {
  const embed = getBilibiliEmbedUrl(url)
  if (embed) {
    currentVideoTitle.value = title
    currentVideoEmbedUrl.value = embed
    videoModalVisible.value = true
  } else {
    window.open(url, '_blank')
  }
}

// 考点弹窗与编辑
const pointDialogVisible = ref(false)
const pointDialogTitle = ref('添加考点')
const editingPoint = ref<KnowledgePoint | null>(null)
const pointForm = ref({
  subject: props.subject,
  grade: '高三',
  book: '高考专题拓展',
  chapter: '',
  title: '',
  content: '',
  key_formulas: '',
  tips: '',
  visual_desc: '',
  video_url: '',
  sort_order: 0
})

const openAddPoint = () => {
  editingPoint.value = null
  pointDialogTitle.value = `添加考点 (${props.subject})`
  pointForm.value = {
    subject: props.subject,
    grade: '高三',
    book: '高考专题拓展',
    chapter: activeTopicObj.value ? activeTopicObj.value.name : '核心考点归集',
    title: '',
    content: '',
    key_formulas: '',
    tips: '',
    visual_desc: '',
    video_url: '',
    sort_order: points.value.length + 1
  }
  pointDialogVisible.value = true
}

const openEditPoint = (p: KnowledgePoint) => {
  editingPoint.value = p
  pointDialogTitle.value = `编辑考点: ${p.title}`
  pointForm.value = {
    subject: p.subject,
    grade: p.grade || '高三',
    book: p.book || '',
    chapter: p.chapter || '',
    title: p.title,
    content: p.content || '',
    key_formulas: p.key_formulas || '',
    tips: p.tips || '',
    visual_desc: p.visual_desc || '',
    video_url: p.video_url || '',
    sort_order: p.sort_order || 0
  }
  pointDialogVisible.value = true
}

const savePoint = async () => {
  if (!pointForm.value.title.trim()) {
    ElMessage.warning('请输入考点标题')
    return
  }
  try {
    if (editingPoint.value) {
      await api.put(`/knowledge/${editingPoint.value.id}`, pointForm.value)
      ElMessage.success('考点已更新')
    } else {
      await api.post('/knowledge', pointForm.value)
      ElMessage.success('考点已添加')
    }
    pointDialogVisible.value = false
    await loadAllData()
  } catch {
    ElMessage.error('保存失败')
  }
}

const deletePoint = async (p: KnowledgePoint) => {
  try {
    await ElMessageBox.confirm(`确定要删除考点【${p.title}】吗？`, '删除确认', { type: 'warning' })
    await api.del(`/knowledge/${p.id}`)
    ElMessage.success('考点已删除')
    await loadAllData()
  } catch {
    // cancelled
  }
}

// -------------------------------------------------------------
// 4. 错题本模块相关逻辑
// -------------------------------------------------------------
const wrongFilterStatus = ref('')
const wrongSearchQuery = ref('')
const wrongKpFilter = ref<number | null>(null)
const blindTestMode = ref(false)
const revealedMap = ref<Record<number, boolean>>({})
const expandedWrongMap = ref<Record<number, boolean>>({})

// 考点即时抽屉状态
const drawerVisible = ref(false)
const drawerPointId = ref<number | null>(null)

const openDrawer = (id: number) => {
  drawerPointId.value = id
  drawerVisible.value = true
}

// 错题统计数据
const wrongStats = computed(() => {
  const total = wrongItems.value.length
  const unmastered = wrongItems.value.filter(i => i.mastery_status === 'unmastered').length
  const learning = wrongItems.value.filter(i => i.mastery_status === 'learning').length
  const mastered = wrongItems.value.filter(i => i.mastery_status === 'mastered').length
  const rate = total > 0 ? Math.round((mastered / total) * 100) : 0
  return { total, unmastered, learning, mastered, rate }
})

// 过滤后的错题
const filteredWrongItems = computed(() => {
  let list = wrongItems.value

  // 1. 掌握状态
  if (wrongFilterStatus.value) {
    list = list.filter(i => i.mastery_status === wrongFilterStatus.value)
  }

  // 2. 考点过滤
  if (wrongKpFilter.value) {
    list = list.filter(i => i.knowledge_point_id === wrongKpFilter.value)
  }

  // 3. 关键词过滤
  if (wrongSearchQuery.value.trim()) {
    const q = wrongSearchQuery.value.trim().toLowerCase()
    list = list.filter(i =>
      i.question.toLowerCase().includes(q) ||
      i.reason.toLowerCase().includes(q) ||
      (i.knowledge_title && i.knowledge_title.toLowerCase().includes(q))
    )
  }

  return list
})

// 录入与编辑错题
const addDialogVisible = ref(false)
const editDialogVisible = ref(false)
const submittingWrong = ref(false)

const wrongForm = ref({
  id: 0,
  subject: props.subject,
  question: '',
  reason: '',
  mastery_status: 'unmastered' as 'unmastered' | 'learning' | 'mastered',
  review_count: 0,
  knowledge_point_id: null as number | null
})

const openAddWrongDialog = (presetKpId?: number | null) => {
  wrongForm.value = {
    id: 0,
    subject: props.subject,
    question: '',
    reason: '',
    mastery_status: 'unmastered',
    review_count: 0,
    knowledge_point_id: presetKpId || null
  }
  addDialogVisible.value = true
}

const openEditWrong = (item: WrongItem) => {
  wrongForm.value = {
    id: item.id,
    subject: item.subject,
    question: item.question,
    reason: item.reason,
    mastery_status: item.mastery_status,
    review_count: item.review_count || 0,
    knowledge_point_id: item.knowledge_point_id || null
  }
  editDialogVisible.value = true
}

const saveWrongItem = async (isEdit: boolean) => {
  const textCheck = wrongForm.value.question.replace(/<[^>]+>/g, '').trim()
  const hasImg = /<img/i.test(wrongForm.value.question)
  if (!textCheck && !hasImg) {
    ElMessage.warning('题目内容不能为空')
    return
  }

  submittingWrong.value = true
  try {
    if (isEdit) {
      await api.put(`/wrong-items/${wrongForm.value.id}`, {
        subject: wrongForm.value.subject,
        question: wrongForm.value.question.trim(),
        reason: wrongForm.value.reason.trim() || '未注明原因',
        mastery_status: wrongForm.value.mastery_status,
        review_count: wrongForm.value.review_count,
        knowledge_point_id: wrongForm.value.knowledge_point_id
      })
      editDialogVisible.value = false
      ElMessage.success('错题修改成功')
    } else {
      await api.post('/wrong-items', {
        subject: wrongForm.value.subject,
        question: wrongForm.value.question.trim(),
        reason: wrongForm.value.reason.trim() || '未注明原因',
        mastery_status: wrongForm.value.mastery_status,
        review_count: wrongForm.value.review_count,
        knowledge_point_id: wrongForm.value.knowledge_point_id
      })
      addDialogVisible.value = false
      ElMessage.success('错题录入成功')
    }
    await loadAllData()
  } catch (err) {
    ElMessage.error('保存错题失败')
  } finally {
    submittingWrong.value = false
  }
}

const updateWrongStatus = async (item: WrongItem, newStatus: 'unmastered' | 'learning' | 'mastered') => {
  if (item.mastery_status === newStatus) return
  try {
    await api.put(`/wrong-items/${item.id}`, {
      mastery_status: newStatus,
      review_count: (item.review_count || 0) + 1
    })
    item.mastery_status = newStatus
    item.review_count = (item.review_count || 0) + 1
    ElMessage.success('状态已更新')
  } catch {
    ElMessage.error('更新失败')
  }
}

const removeWrongItem = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这道错题记录吗？', '删除确认', { type: 'warning' })
    await api.del(`/wrong-items/${id}`)
    ElMessage.success('已删除错题')
    await loadAllData()
  } catch {
    // cancelled
  }
}

const toggleWrongFold = (id: number) => {
  expandedWrongMap.value[id] = !expandedWrongMap.value[id]
}

const expandAllWrong = () => {
  filteredWrongItems.value.forEach(i => { expandedWrongMap.value[i.id] = true })
}

const collapseAllWrong = () => {
  expandedWrongMap.value = {}
}

// 快速原因预设
const reasonPresets = ['计算失误', '审题不清', '概念模糊', '公式记错', '缺乏思路', '忽略隐含条件', '步骤不规范']
const appendReason = (tag: string) => {
  if (!wrongForm.value.reason) {
    wrongForm.value.reason = tag
  } else if (!wrongForm.value.reason.includes(tag)) {
    wrongForm.value.reason += `、${tag}`
  }
}

// 切换学科时自动重载
watch(
  () => props.subject,
  () => {
    loadLocalStatuses()
    loadAllData()
    wrongFilterStatus.value = ''
    wrongSearchQuery.value = ''
    wrongKpFilter.value = null
    knowledgeSearchQuery.value = ''
    activeTopicId.value = 'all'
    activeBook.value = 'all'
    filterDimension.value = 'topic'
  },
  { immediate: true }
)

watch(
  () => route.query.tab,
  () => {
    syncTabFromRoute()
  },
  { immediate: true }
)

onMounted(() => {
  loadLocalStatuses()
  loadAllData()
})
</script>

<template>
  <div class="workbench-container">
    <!-- 顶栏：返回大厅 + 学科快速切换 + Tab 切换器 + 录入快捷按钮 -->
    <header class="workbench-top-nav">
      <div class="nav-left">
        <button class="back-btn" @click="backToHall" title="返回学科中心">
          <el-icon><ArrowLeft /></el-icon>
          <span>学科中心</span>
        </button>

        <div class="subject-brand">
          <span class="subject-emoji">{{ subjectEmojis[subject] || '📚' }}</span>
          <h2 class="subject-title">{{ subject }}</h2>
          <span class="subject-badge">{{ SUBJECT_METAS[subject]?.edition || '高考标准' }}</span>
        </div>
      </div>

      <div class="nav-right">
        <!-- 核心 Segmented Tab 切换器 -->
        <div class="segmented-tabs">
          <button
            type="button"
            class="seg-tab-btn"
            :class="{ active: activeTab === 'knowledge' }"
            @click="switchTab('knowledge')"
          >
            <el-icon><Reading /></el-icon>
            <span>考点重点库 ({{ points.length }})</span>
          </button>
          <button
            type="button"
            class="seg-tab-btn"
            :class="{ active: activeTab === 'wrong-book' }"
            @click="switchTab('wrong-book')"
          >
            <el-icon><Notebook /></el-icon>
            <span>错题靶向本 ({{ wrongItems.length }})</span>
          </button>
        </div>

        <!-- 快速录入操作 -->
        <el-button
          v-if="activeTab === 'wrong-book'"
          type="primary"
          size="default"
          :icon="Plus"
          class="record-btn"
          @click="openAddWrongDialog()"
        >
          录入错题
        </el-button>
        <el-button
          v-else
          type="primary"
          size="default"
          :icon="Plus"
          class="record-btn"
          @click="openAddPoint()"
        >
          添加考点
        </el-button>

        <el-button
          :icon="RefreshRight"
          circle
          size="default"
          @click="loadAllData"
          title="刷新数据"
        />
      </div>
    </header>

    <!-- ======================================================== -->
    <!-- TAB 1: 核心考点重点库                                     -->
    <!-- ======================================================== -->
    <div v-if="activeTab === 'knowledge'" class="knowledge-tab-content" v-loading="loadingPoints">
      <!-- 核心考点重点标签面板 (全量平铺展开，免去横向挪动，按严格序号排好) -->
      <div class="topics-tags-panel">
        <!-- 标签顶栏：维度切换与说明 -->
        <div class="tag-panel-header">
          <div class="header-left">
            <span class="panel-icon">🏷️</span>
            <span class="panel-title">核心考点标签筛选</span>
            <span class="panel-hint">
              共 {{ filterDimension === 'topic' ? subjectTopics.length : subjectBooks.length }} 个{{ filterDimension === 'topic' ? '核心专题' : '教材分册' }} · 全部平铺直接点击筛选
            </span>
          </div>

          <div class="header-right">
            <!-- 维度切换：高考核心专题 vs 官方教材分册 -->
            <div class="dimension-switch">
              <button
                class="dim-btn"
                :class="{ active: filterDimension === 'topic' }"
                @click="filterDimension = 'topic'; activeBook = 'all'"
              >
                🎯 按高考专题
              </button>
              <button
                class="dim-btn"
                :class="{ active: filterDimension === 'book' }"
                @click="filterDimension = 'book'; activeTopicId = 'all'"
              >
                📚 按教材分册
              </button>
            </div>

            <!-- 显式重置按钮 -->
            <button
              v-if="activeTopicId !== 'all' || activeBook !== 'all' || topicFilterStatus !== 'all' || knowledgeSearchQuery"
              class="reset-filter-btn"
              @click="activeTopicId = 'all'; activeBook = 'all'; topicFilterStatus = 'all'; knowledgeSearchQuery = ''"
            >
              <el-icon><RefreshRight /></el-icon>
              重置全部
            </button>
          </div>
        </div>

        <!-- 标签平铺流 (全部放出来，flex-wrap: wrap，按严格顺序排好) -->
        <div class="tags-cloud-container">
          <!-- 维度 1: 按高考核心专题 -->
          <template v-if="filterDimension === 'topic'">
            <button
              class="topic-tag-pill all-pill"
              :class="{ active: activeTopicId === 'all' }"
              @click="activeTopicId = 'all'"
            >
              <span class="tag-icon">🌟</span>
              <span class="tag-name">全部专题</span>
              <span class="tag-count">{{ points.length }}</span>
            </button>

            <button
              v-for="t in subjectTopics"
              :key="t.id"
              class="topic-tag-pill"
              :class="{ active: activeTopicId === t.id }"
              :style="activeTopicId === t.id ? { '--active-color': t.color } : {}"
              @click="activeTopicId = t.id"
            >
              <span class="tag-icon">{{ t.icon }}</span>
              <span class="tag-name">{{ t.shortName || t.name }}</span>
              <span class="tag-count">{{ topicPointCounts[t.id] || 0 }}</span>
            </button>
          </template>

          <!-- 维度 2: 按教材分册 -->
          <template v-else>
            <button
              class="topic-tag-pill all-pill"
              :class="{ active: activeBook === 'all' }"
              @click="activeBook = 'all'"
            >
              <span class="tag-icon">🌟</span>
              <span class="tag-name">全部分册</span>
              <span class="tag-count">{{ points.length }}</span>
            </button>

            <button
              v-for="b in subjectBooks"
              :key="b.book"
              class="topic-tag-pill"
              :class="{ active: activeBook === b.book }"
              @click="activeBook = b.book"
            >
              <span class="tag-icon">📘</span>
              <span class="tag-name">{{ b.book }}</span>
              <span class="tag-count">{{ b.count }}</span>
            </button>
          </template>
        </div>

        <!-- 底栏控制条：掌握状态过滤 + 快速搜索 + 展开/折叠 -->
        <div class="tag-panel-footer">
          <div class="footer-left">
            <el-radio-group v-model="topicFilterStatus" size="small" class="status-radio-group">
              <el-radio-button value="all">全部 ({{ points.length }})</el-radio-button>
              <el-radio-button value="starred">⭐️ 重点 ({{ starredCount }})</el-radio-button>
              <el-radio-button value="mastered">✅ 已掌握 ({{ masteredCount }})</el-radio-button>
              <el-radio-button value="unmastered">🔴 待攻克 ({{ unmasteredCount }})</el-radio-button>
            </el-radio-group>
          </div>

          <div class="footer-right">
            <el-input
              v-model="knowledgeSearchQuery"
              placeholder="搜索考点/公式/关键词..."
              size="small"
              :prefix-icon="Search"
              clearable
              class="search-box"
            />
            <button class="expand-all-btn" @click="toggleExpandAll">
              <el-icon><Reading /></el-icon>
              {{ areAllPointsExpanded ? '折叠全部' : '展开全部' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 考点卡片流 -->
      <div class="points-stream">
        <div
          v-for="p in filteredPoints"
          :key="p.id"
          class="knowledge-card"
          :class="{ 'is-mastered': masteredPointIds.has(p.id) }"
        >
          <!-- 考点头部行 -->
          <div class="card-top-row">
            <div class="point-meta-left">
              <span class="core-point-badge">🎯 核心考点</span>
              <h3
                class="point-title"
                @click="togglePointExpand(p.id)"
                style="cursor: pointer"
                :title="expandedPointIds.has(p.id) ? '点击折叠考点详情' : '点击展开考点详情'"
              >
                {{ p.title }}
              </h3>
            </div>

            <div class="point-actions-right">
              <!-- 关联错题徽章 (深度联动核心！) -->
              <div
                v-if="wrongItemsByPointId.get(p.id)?.length"
                class="linked-wrong-badge"
                :class="{
                  has_unmastered: wrongItemsByPointId.get(p.id)?.some(w => w.mastery_status === 'unmastered')
                }"
                @click="toggleWrongOnPoint(p.id)"
                :title="expandedWrongOnPointIds.has(p.id) ? '收起关联错题' : '展开查看关联错题'"
              >
                <span>🎯 关联 {{ wrongItemsByPointId.get(p.id)?.length }} 道错题</span>
                <span class="unmastered-dot" v-if="wrongItemsByPointId.get(p.id)?.some(w => w.mastery_status === 'unmastered')">🔴 需复习</span>
                <span class="mastered-dot" v-else>🟢 全攻克</span>
              </div>
              <div
                v-else
                class="linked-wrong-empty"
                @click="openAddWrongDialog(p.id)"
                title="为此考点录入实战错题"
              >
                <span>+ 挂载错题</span>
              </div>

              <!-- 标星 & 掌握 -->
              <button
                class="action-icon-btn"
                :class="{ starred: starredPointIds.has(p.id) }"
                @click="toggleStar(p.id)"
                title="标星重点"
              >
                <el-icon><component :is="starredPointIds.has(p.id) ? StarFilled : Star" /></el-icon>
              </button>

              <button
                class="action-icon-btn"
                :class="{ mastered: masteredPointIds.has(p.id) }"
                @click="toggleMastered(p.id)"
                title="掌握状态"
              >
                <el-icon><Check /></el-icon>
              </button>

              <button class="action-icon-btn" @click="openEditPoint(p)" title="编辑考点">
                <el-icon><Edit /></el-icon>
              </button>

              <button class="action-icon-btn delete-btn" @click="deletePoint(p)" title="删除考点">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>

          <!-- 展开主体 -->
          <div v-show="expandedPointIds.has(p.id)" class="point-body-content">
            <!-- 核心公式 -->
            <div v-if="p.key_formulas" class="point-block formula-block">
              <span class="block-title">📐 核心公式与定理</span>
              <div class="math-content" v-html="renderMathAndText(p.key_formulas)"></div>
            </div>

            <!-- 解析与定义 -->
            <div v-if="p.content" class="point-block content-block">
              <span class="block-title">📖 知识精析</span>
              <div class="math-content" v-html="renderMathAndText(p.content)"></div>
            </div>

            <!-- 避坑指南 Tips -->
            <div v-if="p.tips" class="point-block tips-block">
              <span class="block-title">💡 避坑大招 & 易错点</span>
              <div class="math-content" v-html="renderMathAndText(p.tips)"></div>
            </div>

            <!-- 具象模型 -->
            <div v-if="p.visual_desc" class="point-block visual-block">
              <span class="block-title">🧠 具象模型</span>
              <div class="visual-text">{{ p.visual_desc }}</div>
            </div>

            <!-- B 站微课 -->
            <div v-if="p.video_url" class="point-video-row">
              <el-button
                type="danger"
                size="small"
                plain
                :icon="VideoPlay"
                @click="openVideoPreview(p.title, p.video_url)"
              >
                🎬 观看 B 站名师精讲微课
              </el-button>
            </div>

            <!-- 关联错题就地自测与展开区 -->
            <div
              v-if="expandedWrongOnPointIds.has(p.id) && wrongItemsByPointId.get(p.id)?.length"
              class="point-linked-wrong-panel"
            >
              <div class="panel-header">
                <span class="panel-title">📝 关联错题检视 ({{ wrongItemsByPointId.get(p.id)?.length }} 道)</span>
                <el-button
                  size="small"
                  type="primary"
                  link
                  @click="openAddWrongDialog(p.id)"
                >
                  + 继续添加这道考点的错题
                </el-button>
              </div>

              <div class="linked-wrong-list">
                <div
                  v-for="w in wrongItemsByPointId.get(p.id)"
                  :key="w.id"
                  class="linked-wrong-card"
                >
                  <div class="wrong-card-top">
                    <span
                      class="wrong-status-pill"
                      :class="w.mastery_status"
                    >
                      {{ w.mastery_status === 'mastered' ? '🟢 已掌握' : w.mastery_status === 'learning' ? '🟡 练习中' : '🔴 待攻克' }}
                    </span>
                    <span class="wrong-reason">错因：{{ w.reason }}</span>
                    <el-button
                      size="small"
                      link
                      type="primary"
                      @click="switchTab('wrong-book'); wrongSearchQuery = w.reason"
                    >
                      前往错题本攻克 →
                    </el-button>
                  </div>
                  <div class="wrong-question-snippet" v-html="w.question"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredPoints.length === 0" class="empty-points">
          <span>暂无符合条件的考点</span>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 2: 错题靶向本                                         -->
    <!-- ======================================================== -->
    <div v-else class="wrong-tab-content" v-loading="loadingWrong">
      <!-- 顶部战况卡片 -->
      <div class="wrong-dashboard">
        <div class="stat-capsules">
          <div
            class="stat-capsule"
            :class="{ active: wrongFilterStatus === '' }"
            @click="wrongFilterStatus = ''"
          >
            <span class="num">{{ wrongStats.total }}</span>
            <span class="lbl">全部错题</span>
          </div>
          <div
            class="stat-capsule unmastered"
            :class="{ active: wrongFilterStatus === 'unmastered' }"
            @click="wrongFilterStatus = 'unmastered'"
          >
            <span class="num">{{ wrongStats.unmastered }}</span>
            <span class="lbl">🔴 待攻克</span>
          </div>
          <div
            class="stat-capsule learning"
            :class="{ active: wrongFilterStatus === 'learning' }"
            @click="wrongFilterStatus = 'learning'"
          >
            <span class="num">{{ wrongStats.learning }}</span>
            <span class="lbl">🟡 练习中</span>
          </div>
          <div
            class="stat-capsule mastered"
            :class="{ active: wrongFilterStatus === 'mastered' }"
            @click="wrongFilterStatus = 'mastered'"
          >
            <span class="num">{{ wrongStats.mastered }}</span>
            <span class="lbl">🟢 已掌握</span>
          </div>
        </div>

        <div class="wrong-progress-box">
          <div class="prog-info">
            <span>{{ subject }} 错题消灭率</span>
            <span class="prog-rate">{{ wrongStats.rate }}%</span>
          </div>
          <el-progress
            :percentage="wrongStats.rate"
            :stroke-width="8"
            :color="wrongStats.rate >= 80 ? '#10b981' : wrongStats.rate >= 50 ? '#3b82f6' : '#f59e0b'"
            :show-text="false"
          />
        </div>
      </div>

      <!-- 过滤工具栏 -->
      <div class="wrong-toolbar">
        <el-radio-group v-model="wrongFilterStatus" size="small">
          <el-radio-button value="">全部 ({{ wrongStats.total }})</el-radio-button>
          <el-radio-button value="unmastered">待攻克 ({{ wrongStats.unmastered }})</el-radio-button>
          <el-radio-button value="learning">练习中 ({{ wrongStats.learning }})</el-radio-button>
          <el-radio-button value="mastered">已掌握 ({{ wrongStats.mastered }})</el-radio-button>
        </el-radio-group>

        <!-- 关联考点筛选器 -->
        <el-select
          v-model="wrongKpFilter"
          placeholder="按考点重点筛选..."
          size="small"
          clearable
          filterable
          class="kp-filter-select"
        >
          <el-option-group
            v-for="group in topicGroupedPoints"
            :key="group.id"
            :label="group.name"
          >
            <el-option
              v-for="p in group.points"
              :key="p.id"
              :label="p.title"
              :value="p.id"
            />
          </el-option-group>
        </el-select>

        <div class="toolbar-right">
          <!-- 考前盲测模式 -->
          <div class="blind-switch">
            <el-switch
              v-model="blindTestMode"
              size="small"
              inline-prompt
              :active-icon="Hide"
              :inactive-icon="View"
            />
            <span class="switch-lbl">🙈 考前盲测模式</span>
          </div>

          <el-button size="small" :icon="FolderOpened" @click="expandAllWrong">展开</el-button>
          <el-button size="small" :icon="Folder" @click="collapseAllWrong">折叠</el-button>

          <el-input
            v-model="wrongSearchQuery"
            placeholder="搜索错题、错因..."
            size="small"
            :prefix-icon="Search"
            clearable
            class="wrong-search"
          />
        </div>
      </div>

      <!-- 错题卡片列表 -->
      <div class="wrong-list">
        <div
          v-for="item in filteredWrongItems"
          :key="item.id"
          class="wrong-card"
          :class="{ 'is-mastered': item.mastery_status === 'mastered' }"
        >
          <div class="wrong-card-header" @click="toggleWrongFold(item.id)">
            <div class="header-main-left">
              <!-- 掌握状态指示徽章 -->
              <span class="status-indicator-tag" :class="item.mastery_status">
                {{ item.mastery_status === 'mastered' ? '🟢 已掌握' : item.mastery_status === 'learning' ? '🟡 练习中' : '🔴 待攻克' }}
              </span>

              <!-- 关联知识点微标 (点击滑出抽屉速查！) -->
              <div
                v-if="item.knowledge_point_id"
                class="point-link-chip"
                @click.stop="openDrawer(item.knowledge_point_id)"
                title="点击从右侧滑出该考点公式与名师微课"
              >
                <el-icon><Reading /></el-icon>
                <span>考点：{{ item.knowledge_title || '考点速查' }}</span>
                <el-icon class="link-arrow"><Right /></el-icon>
              </div>
              <div
                v-else
                class="point-link-empty"
                @click.stop="openEditWrong(item)"
                title="为此题关联核心考点"
              >
                <span>+ 关联考点</span>
              </div>

              <!-- 错因标签 -->
              <span v-if="!blindTestMode || revealedMap[item.id]" class="reason-tag">
                错因：{{ item.reason }}
              </span>
            </div>

            <div class="header-main-right">
              <span class="review-badge">复习 {{ item.review_count || 0 }} 次</span>

              <button class="action-btn" @click.stop="openEditWrong(item)" title="编辑错题">
                <el-icon><Edit /></el-icon>
              </button>
              <button class="action-btn delete" @click.stop="removeWrongItem(item.id)" title="删除错题">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>

          <!-- 展开内容区 -->
          <div v-show="expandedWrongMap[item.id] !== false" class="wrong-card-body">
            <!-- 题干正文 (支持富文本与KaTeX) -->
            <div class="question-content" v-html="renderMathAndText(item.question)"></div>

            <!-- 盲测模式遮罩控制 -->
            <div v-if="blindTestMode" class="blind-cover-bar">
              <span v-if="!revealedMap[item.id]" class="blind-hint">已开启考前盲测，错因已隐藏</span>
              <el-button
                size="small"
                type="warning"
                plain
                @click="revealedMap[item.id] = !revealedMap[item.id]"
              >
                {{ revealedMap[item.id] ? '隐藏错因' : '揭晓错因与解析' }}
              </el-button>
            </div>

            <!-- 底部状态快捷更新栏 -->
            <div class="status-quick-bar">
              <span class="bar-title">标记当前掌握状态：</span>
              <div class="status-btn-group">
                <button
                  class="status-btn"
                  :class="{ active: item.mastery_status === 'unmastered' }"
                  @click="updateWrongStatus(item, 'unmastered')"
                >
                  🔴 待攻克
                </button>
                <button
                  class="status-btn"
                  :class="{ active: item.mastery_status === 'learning' }"
                  @click="updateWrongStatus(item, 'learning')"
                >
                  🟡 练习中
                </button>
                <button
                  class="status-btn"
                  :class="{ active: item.mastery_status === 'mastered' }"
                  @click="updateWrongStatus(item, 'mastered')"
                >
                  🟢 已攻克
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredWrongItems.length === 0" class="empty-wrong">
          <span>暂无符合条件的错题记录</span>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 弹窗与抽屉                                                -->
    <!-- ======================================================== -->

    <!-- 1. 考点速查右侧滑出抽屉 -->
    <KnowledgeDrawer
      v-model="drawerVisible"
      :point-id="drawerPointId"
      @open-video="openVideoPreview($event.title, $event.url)"
    />

    <!-- 2. B站微课内嵌播放弹窗 -->
    <el-dialog
      v-model="videoModalVisible"
      :title="`微课精讲: ${currentVideoTitle}`"
      width="800px"
      destroy-on-close
    >
      <div class="video-iframe-container">
        <iframe
          :src="currentVideoEmbedUrl"
          scrolling="no"
          border="0"
          frameborder="no"
          framespacing="0"
          allowfullscreen="true"
          class="video-iframe"
        ></iframe>
      </div>
    </el-dialog>

    <!-- 3. 新增/编辑错题弹窗 -->
    <el-dialog
      v-model="addDialogVisible"
      title="录入新错题"
      width="680px"
      destroy-on-close
    >
      <el-form :model="wrongForm" label-width="80px">
        <el-form-item label="所属科目">
          <el-input :model-value="props.subject" disabled />
        </el-form-item>

        <el-form-item label="关联考点">
          <el-select
            v-model="wrongForm.knowledge_point_id"
            placeholder="从考点重点库选择考点 (支持搜索，可留空)"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option-group
              v-for="group in topicGroupedPoints"
              :key="group.id"
              :label="group.name"
            >
              <el-option
                v-for="p in group.points"
                :key="p.id"
                :label="p.title"
                :value="p.id"
              />
            </el-option-group>
          </el-select>
        </el-form-item>

        <el-form-item label="题目内容" required>
          <RichQuestionEditor v-model="wrongForm.question" placeholder="输入题目文字或粘贴题目截图..." />
        </el-form-item>

        <el-form-item label="错因分析">
          <div class="reason-preset-row">
            <span
              v-for="tag in reasonPresets"
              :key="tag"
              class="preset-chip"
              @click="appendReason(tag)"
            >
              + {{ tag }}
            </span>
          </div>
          <el-input
            v-model="wrongForm.reason"
            type="textarea"
            :rows="2"
            placeholder="分析做错原因与解题盲区..."
          />
        </el-form-item>

        <el-form-item label="掌握状态">
          <el-radio-group v-model="wrongForm.mastery_status">
            <el-radio value="unmastered">🔴 待攻克</el-radio>
            <el-radio value="learning">🟡 练习中</el-radio>
            <el-radio value="mastered">🟢 已掌握</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submittingWrong" @click="saveWrongItem(false)">
          保存错题
        </el-button>
      </template>
    </el-dialog>

    <!-- 4. 编辑错题弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑错题"
      width="680px"
      destroy-on-close
    >
      <el-form :model="wrongForm" label-width="80px">
        <el-form-item label="关联考点">
          <el-select
            v-model="wrongForm.knowledge_point_id"
            placeholder="从考点重点库选择考点"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option-group
              v-for="group in topicGroupedPoints"
              :key="group.id"
              :label="group.name"
            >
              <el-option
                v-for="p in group.points"
                :key="p.id"
                :label="p.title"
                :value="p.id"
              />
            </el-option-group>
          </el-select>
        </el-form-item>

        <el-form-item label="题目内容" required>
          <RichQuestionEditor v-model="wrongForm.question" />
        </el-form-item>

        <el-form-item label="错因分析">
          <el-input v-model="wrongForm.reason" type="textarea" :rows="2" />
        </el-form-item>

        <el-form-item label="掌握状态">
          <el-radio-group v-model="wrongForm.mastery_status">
            <el-radio value="unmastered">🔴 待攻克</el-radio>
            <el-radio value="learning">🟡 练习中</el-radio>
            <el-radio value="mastered">🟢 已掌握</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submittingWrong" @click="saveWrongItem(true)">
          更新错题
        </el-button>
      </template>
    </el-dialog>

    <!-- 5. 考点添加/编辑弹窗 -->
    <el-dialog
      v-model="pointDialogVisible"
      :title="pointDialogTitle"
      width="640px"
      destroy-on-close
    >
      <el-form :model="pointForm" label-width="90px">
        <el-form-item label="考点标题" required>
          <el-input v-model="pointForm.title" placeholder="如：集合的概念与表示方法" />
        </el-form-item>
        <el-form-item label="所属教材">
          <el-input v-model="pointForm.book" placeholder="如：必修第一册" />
        </el-form-item>
        <el-form-item label="所属章节">
          <el-input v-model="pointForm.chapter" placeholder="如：1.1 集合初步" />
        </el-form-item>
        <el-form-item label="核心公式">
          <el-input
            v-model="pointForm.key_formulas"
            type="textarea"
            :rows="3"
            placeholder="支持 KaTeX LaTeX 公式，如 $A \subseteq B$"
          />
        </el-form-item>
        <el-form-item label="考点精析">
          <el-input v-model="pointForm.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="避坑指南">
          <el-input v-model="pointForm.tips" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="思维模型">
          <el-input v-model="pointForm.visual_desc" placeholder="具象思维图景" />
        </el-form-item>
        <el-form-item label="B站视频">
          <el-input v-model="pointForm.video_url" placeholder="https://www.bilibili.com/video/BV..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pointDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePoint">保存考点</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.workbench-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1400px;
  margin: 0 auto;
  padding-bottom: 40px;
}

/* 顶栏 */
.workbench-top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 12px 18px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  gap: 16px;
  flex-wrap: wrap;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.04);
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #334155);
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #2563eb;
}

.subject-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.subject-emoji {
  font-size: 22px;
}

.subject-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.subject-badge {
  font-size: 11px;
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 核心 Segmented Tab */
.segmented-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.05);
  padding: 3px;
  border-radius: 10px;
  gap: 4px;
}

.seg-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  transition: all 0.2s;
}

.seg-tab-btn:hover {
  color: var(--text-main, #0f172a);
}

.seg-tab-btn.active {
  background: #ffffff;
  color: #2563eb;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);
  font-weight: 700;
}

.record-btn {
  font-weight: 600;
  border-radius: 8px;
}

/* ========================================================= */
/* TAB 1: 考点样式                                           */
/* ========================================================= */
.knowledge-tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.topics-tags-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 14px 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.tag-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--border-color, #e2e8f0);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.panel-icon {
  font-size: 15px;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.panel-hint {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dimension-switch {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.dim-btn {
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  transition: all 0.2s;
}

.dim-btn.active {
  background: #ffffff;
  color: #2563eb;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.reset-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #fed7aa;
  background: #fff7ed;
  color: #ea580c;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-filter-btn:hover {
  background: #ffedd5;
}

.tags-cloud-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 2px 0;
}

.topic-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-page, #f8fafc);
  border-radius: 20px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-regular, #334155);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.topic-tag-pill:hover {
  border-color: #3b82f6;
  color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.12);
}

.topic-tag-pill.active {
  background: var(--active-color, #2563eb);
  border-color: var(--active-color, #2563eb);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
  transform: translateY(-1px);
}

.topic-tag-pill.all-pill.active {
  background: #2563eb;
  border-color: #2563eb;
}

.tag-icon {
  font-size: 13px;
  line-height: 1;
}

.tag-name {
  font-size: 12px;
}

.tag-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-muted, #64748b);
  font-weight: 600;
  transition: all 0.2s;
}

.topic-tag-pill.active .tag-count {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.tag-panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color, #e2e8f0);
}

.footer-left {
  display: flex;
  align-items: center;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.expand-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  transition: all 0.2s;
}

.expand-all-btn:hover {
  border-color: #3b82f6;
  color: #2563eb;
}

.search-box {
  width: 190px;
}

.points-stream {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.knowledge-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.2s;
}

.knowledge-card.is-mastered {
  border-left: 4px solid #10b981;
}

.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.point-meta-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.core-point-badge {
  font-size: 11px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.point-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.point-actions-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 考点与错题深度联动徽标 */
.linked-wrong-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(59, 130, 246, 0.08);
  color: #2563eb;
  cursor: pointer;
  border: 1px solid rgba(59, 130, 246, 0.2);
  transition: all 0.2s;
}

.linked-wrong-badge.has_unmastered {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.25);
}

.linked-wrong-badge:hover {
  transform: scale(1.03);
}

.linked-wrong-empty {
  font-size: 11px;
  color: #94a3b8;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px dashed #cbd5e1;
  cursor: pointer;
}

.linked-wrong-empty:hover {
  color: #3b82f6;
  border-color: #3b82f6;
}

.action-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
}

.action-icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #0f172a;
}

.action-icon-btn.starred {
  color: #f59e0b;
  border-color: #f59e0b;
}

.action-icon-btn.mastered {
  color: #10b981;
  border-color: #10b981;
}

.action-icon-btn.delete-btn:hover {
  color: #ef4444;
  border-color: #ef4444;
}

.point-body-content {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.point-block {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
}

.block-title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
}

.formula-block {
  background: rgba(59, 130, 246, 0.04);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.formula-block .block-title {
  color: #2563eb;
}

.content-block {
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid var(--border-color, #e2e8f0);
}

.tips-block {
  background: rgba(245, 158, 11, 0.05);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.tips-block .block-title {
  color: #d97706;
}

.visual-block {
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.visual-block .block-title {
  color: #059669;
}

.point-video-row {
  display: flex;
  justify-content: flex-end;
}

/* 考点下方展开关联错题列表 */
.point-linked-wrong-panel {
  background: rgba(239, 68, 68, 0.03);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 12px;
  font-weight: 700;
  color: #dc2626;
}

.linked-wrong-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.linked-wrong-card {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wrong-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
}

.wrong-status-pill {
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}

.wrong-status-pill.unmastered {
  color: #dc2626;
  background: #fee2e2;
}

.wrong-status-pill.learning {
  color: #d97706;
  background: #fef3c7;
}

.wrong-status-pill.mastered {
  color: #16a34a;
  background: #dcfce7;
}

.wrong-reason {
  color: #64748b;
}

.wrong-question-snippet {
  font-size: 12px;
  color: #1e293b;
  max-height: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-points,
.empty-wrong {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
  background: var(--bg-card, #ffffff);
  border-radius: 12px;
}

/* ========================================================= */
/* TAB 2: 错题本样式                                         */
/* ========================================================= */
.wrong-tab-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wrong-dashboard {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.stat-capsules {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.stat-capsule {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
  cursor: pointer;
  background: var(--bg-page, #f8fafc);
  transition: all 0.2s;
}

.stat-capsule:hover,
.stat-capsule.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.stat-capsule .num {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}

.stat-capsule .lbl {
  font-size: 11px;
  color: #64748b;
}

.wrong-progress-box {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prog-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main, #334155);
}

.wrong-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  padding: 8px 14px;
  flex-wrap: wrap;
}

.kp-filter-select {
  width: 220px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.blind-switch {
  display: flex;
  align-items: center;
  gap: 6px;
}

.switch-lbl {
  font-size: 12px;
  color: #64748b;
}

.wrong-search {
  width: 170px;
}

.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wrong-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

.wrong-card.is-mastered {
  border-left: 4px solid #10b981;
}

.wrong-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-card, #ffffff);
  border-bottom: 1px solid var(--border-color, #f1f5f9);
  cursor: pointer;
  gap: 12px;
}

.header-main-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-indicator-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
}

.status-indicator-tag.unmastered {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.status-indicator-tag.learning {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}

.status-indicator-tag.mastered {
  background: #ecfdf5;
  color: #15803d;
  border: 1px solid #a7f3d0;
}

/* 错题上的考点速查微标 */
.point-link-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.12));
  color: #1d4ed8;
  border: 1px solid rgba(59, 130, 246, 0.25);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.point-link-chip:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.22));
  transform: translateY(-1px);
}

.point-link-chip .link-arrow {
  font-size: 10px;
}

.point-link-empty {
  font-size: 11px;
  color: #94a3b8;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px dashed #cbd5e1;
  cursor: pointer;
}

.point-link-empty:hover {
  color: #3b82f6;
  border-color: #3b82f6;
}

.reason-tag {
  font-size: 11px;
  color: #64748b;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 8px;
  border-radius: 4px;
}

.header-main-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.review-badge {
  font-size: 11px;
  color: #64748b;
}

.action-btn {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #0f172a;
}

.action-btn.delete:hover {
  color: #ef4444;
  border-color: #ef4444;
}

.wrong-card-body {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-main, #1e293b);
}

.blind-cover-bar {
  background: rgba(245, 158, 11, 0.08);
  border: 1px dashed #f59e0b;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.blind-hint {
  font-size: 12px;
  color: #b45309;
}

.status-quick-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--border-color, #f1f5f9);
  flex-wrap: wrap;
  gap: 8px;
}

.bar-title {
  font-size: 12px;
  color: #64748b;
}

.status-btn-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-btn {
  border: 1px solid var(--border-color, #e2e8f0);
  background: transparent;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
}

.status-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

.status-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  font-weight: 600;
}

.reason-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.preset-chip {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.04);
  color: #64748b;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-chip:hover {
  background: #eff6ff;
  color: #2563eb;
}

.video-iframe-container {
  position: relative;
  width: 100%;
  height: 480px;
}

.video-iframe {
  width: 100%;
  height: 100%;
  border-radius: 8px;
}

/* 暗色模式适配 */
:global(.dark) .workbench-top-nav,
:global(.dark) .topics-tags-panel,
:global(.dark) .knowledge-card,
:global(.dark) .wrong-dashboard,
:global(.dark) .wrong-toolbar,
:global(.dark) .wrong-card,
:global(.dark) .wrong-card-header {
  background: #131b2e;
  border-color: #1e293b;
}

:global(.dark) .tag-panel-header,
:global(.dark) .tag-panel-footer {
  border-color: #1e293b;
}

:global(.dark) .panel-title {
  color: #f8fafc;
}

:global(.dark) .dimension-switch {
  background: rgba(255, 255, 255, 0.08);
}

:global(.dark) .dim-btn.active {
  background: #1e293b;
  color: #60a5fa;
}

:global(.dark) .reset-filter-btn {
  background: rgba(234, 88, 12, 0.15);
  border-color: rgba(234, 88, 12, 0.3);
  color: #fb923c;
}

:global(.dark) .topic-tag-pill {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

:global(.dark) .topic-tag-pill:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-color: #3b82f6;
}

:global(.dark) .topic-tag-pill.active {
  background: var(--active-color, #3b82f6);
  border-color: var(--active-color, #3b82f6);
  color: #ffffff;
}

:global(.dark) .topic-tag-pill.all-pill.active {
  background: #2563eb;
  border-color: #2563eb;
}

:global(.dark) .tag-count {
  background: rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}

:global(.dark) .expand-all-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

:global(.dark) .expand-all-btn:hover {
  border-color: #3b82f6;
  color: #60a5fa;
}

:global(.dark) .subject-title,
:global(.dark) .point-title {
  color: #f8fafc;
}

:global(.dark) .back-btn {
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
}

:global(.dark) .seg-tab-btn.active {
  background: #1e293b;
  color: #60a5fa;
}

:global(.dark) .formula-block {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(59, 130, 246, 0.3);
}

:global(.dark) .content-block {
  background: #0b1120;
  border-color: #1e293b;
}

:global(.dark) .question-content {
  color: #f1f5f9;
}

:global(.dark) .point-link-chip {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}

:global(.dark) .linked-wrong-card {
  background: #0b1120;
  border-color: #1e293b;
}

:global(.dark) .wrong-question-snippet {
  color: #e2e8f0;
}
</style>
