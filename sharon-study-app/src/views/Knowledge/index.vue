<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  SHANGHAI_TEXTBOOK_CATALOG,
  getSubjectCatalog,
  type SubjectTextbook,
  type TextbookBook
} from '../../utils/textbookCatalog'
import {
  getTopicsForSubject,
  type GaokaoTopic
} from '../../utils/gaokaoTopics'
import {
  Search, Plus, Edit, Delete, VideoPlay,
  FolderOpened, Compass, TopRight, ArrowLeft,
  Collection, Star, StarFilled, Check,
  Reading, Aim, RefreshRight
} from '@element-plus/icons-vue'

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

interface LearningResource {
  id: number
  subject: string
  category: string
  name: string
  desc: string
  url: string
  sort_order: number
}

const route = useRoute()
const router = useRouter()

// 模式控制：'topics' (高考核心专题归集) | 'shelf' (教材书架) | 'reader' (沉浸式阅读器)
const currentMode = ref<'topics' | 'shelf' | 'reader'>('topics')

// 1. 学科与分册状态
const activeSubject = ref('数学')
const currentCatalog = computed<SubjectTextbook | undefined>(() => {
  return getSubjectCatalog(activeSubject.value)
})

// 书架年级筛选（全部 / 高一 / 高二 / 高三）
const shelfGradeFilter = ref<'全部' | '高一' | '高二' | '高三'>('全部')

// 阅读器当前选中的教材与章节
const activeBook = ref('必修第一册')
const activeChapter = ref('全部')

// 2. 专题归集状态
const activeTopicId = ref<string>('all')
const topicFilterStatus = ref<'all' | 'starred' | 'mastered' | 'unmastered'>('all')
const starredPointIds = ref<Set<number>>(new Set())
const masteredPointIds = ref<Set<number>>(new Set())

// 3. 知识点全量数据
const points = ref<KnowledgePoint[]>([])
const loadingPoints = ref(false)
const searchQuery = ref('')
const expandedPointIds = ref<Set<number>>(new Set())

// 4. 统计数据（学科、分册、章节考点计数）
const subjectCounts = ref<Record<string, number>>({})
const bookCounts = ref<Record<string, number>>({})
const chapterCounts = ref<Record<string, number>>({})

// 5. 学习资源与抽屉
const resources = ref<LearningResource[]>([])
const resourceDrawerVisible = ref(false)
const resourceManageMode = ref(false)
const resourceDialogVisible = ref(false)
const resourceDialogTitle = ref('添加学习资源')
const editingResource = ref<LearningResource | null>(null)
const resourceForm = ref({ category: 'video', name: '', desc: '', url: '' })

// 6. 知识点弹窗表单
const pointDialogVisible = ref(false)
const pointDialogTitle = ref('添加知识点')
const editingPoint = ref<KnowledgePoint | null>(null)
const pointForm = ref({
  subject: '',
  grade: '',
  book: '',
  chapter: '',
  title: '',
  content: '',
  key_formulas: '',
  tips: '',
  visual_desc: '',
  video_url: '',
  sort_order: 0
})

// 7. B站视频内嵌预览弹窗
const videoModalVisible = ref(false)
const currentVideoTitle = ref('')
const currentVideoEmbedUrl = ref('')

// 本地持久化：标星与掌握状态
const loadPersistedStatuses = () => {
  try {
    const rawStarred = localStorage.getItem('sharon_starred_points')
    if (rawStarred) {
      starredPointIds.value = new Set(JSON.parse(rawStarred))
    }
    const rawMastered = localStorage.getItem('sharon_mastered_points')
    if (rawMastered) {
      masteredPointIds.value = new Set(JSON.parse(rawMastered))
    }
  } catch (e) {
    console.error('Failed to parse persisted point statuses', e)
  }
}

const toggleStar = (id: number) => {
  if (starredPointIds.value.has(id)) {
    starredPointIds.value.delete(id)
  } else {
    starredPointIds.value.add(id)
  }
  localStorage.setItem('sharon_starred_points', JSON.stringify(Array.from(starredPointIds.value)))
}

const toggleMastered = (id: number) => {
  if (masteredPointIds.value.has(id)) {
    masteredPointIds.value.delete(id)
  } else {
    masteredPointIds.value.add(id)
  }
  localStorage.setItem('sharon_mastered_points', JSON.stringify(Array.from(masteredPointIds.value)))
}

// 当前学科的高考核心专题列表
const currentSubjectTopics = computed<GaokaoTopic[]>(() => {
  return getTopicsForSubject(activeSubject.value, points.value)
})

const activeTopicObj = computed<GaokaoTopic | null>(() => {
  if (activeTopicId.value === 'all') return null
  return currentSubjectTopics.value.find(t => t.id === activeTopicId.value) || null
})

const getPointTopic = (p: KnowledgePoint): GaokaoTopic | undefined => {
  return currentSubjectTopics.value.find(t => t.match(p))
}

const getTopicPointCount = (topicId: string): number => {
  if (topicId === 'all') return points.value.length
  const topic = currentSubjectTopics.value.find(t => t.id === topicId)
  if (!topic) return 0
  return points.value.filter(p => topic.match(p)).length
}

const starredCount = computed(() => {
  return points.value.filter(p => starredPointIds.value.has(p.id)).length
})

const masteredCount = computed(() => {
  return points.value.filter(p => masteredPointIds.value.has(p.id)).length
})

const unmasteredCount = computed(() => {
  return Math.max(0, points.value.length - masteredCount.value)
})

// 高考核心专题模式下展示的知识点
const thematicDisplayPoints = computed<KnowledgePoint[]>(() => {
  let list = points.value

  // 1. 专题筛选
  if (activeTopicId.value !== 'all') {
    const topic = currentSubjectTopics.value.find(t => t.id === activeTopicId.value)
    if (topic) {
      list = list.filter(p => topic.match(p))
    }
  }

  // 2. 状态筛选 (标星 / 掌握)
  if (topicFilterStatus.value === 'starred') {
    list = list.filter(p => starredPointIds.value.has(p.id))
  } else if (topicFilterStatus.value === 'mastered') {
    list = list.filter(p => masteredPointIds.value.has(p.id))
  } else if (topicFilterStatus.value === 'unmastered') {
    list = list.filter(p => !masteredPointIds.value.has(p.id))
  }

  // 3. 关键词过滤
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.content && p.content.toLowerCase().includes(q)) ||
      (p.key_formulas && p.key_formulas.toLowerCase().includes(q)) ||
      (p.tips && p.tips.toLowerCase().includes(q)) ||
      (p.visual_desc && p.visual_desc.toLowerCase().includes(q)) ||
      (p.chapter && p.chapter.toLowerCase().includes(q)) ||
      (p.book && p.book.toLowerCase().includes(q))
    )
  }

  return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
})

// 书架展示的分册列表（按筛选年级）
const filteredBooks = computed<TextbookBook[]>(() => {
  if (!currentCatalog.value) return []
  if (shelfGradeFilter.value === '全部') {
    return currentCatalog.value.books
  }
  return currentCatalog.value.books.filter(b => b.grade === shelfGradeFilter.value)
})

// 按年级分组的教材列表
const groupedBooksByGrade = computed(() => {
  const books = filteredBooks.value
  const grades: Array<{ grade: '高一' | '高二' | '高三'; title: string; books: TextbookBook[] }> = []
  const order: Array<'高一' | '高二' | '高三'> = ['高一', '高二', '高三']
  for (const g of order) {
    const list = books.filter(b => b.grade === g)
    if (list.length > 0) {
      grades.push({ grade: g, title: `${g}年级教材`, books: list })
    }
  }
  return grades
})

// 当前选中的教材分册对象
const currentBookObj = computed<TextbookBook | undefined>(() => {
  if (!currentCatalog.value) return undefined
  return currentCatalog.value.books.find(b => b.name === activeBook.value)
})

// 当前教材分册的章节列表
const currentChapters = computed<string[]>(() => {
  const set = new Set<string>()
  if (currentBookObj.value?.chapters) {
    currentBookObj.value.chapters.forEach(ch => set.add(ch))
  }
  points.value.forEach(p => {
    if (p.book === activeBook.value && p.chapter) {
      set.add(p.chapter)
    }
  })
  return Array.from(set)
})

const isChapterHeader = (ch: string): boolean => {
  return ch.startsWith('第') && ch.includes('章')
}

const getChapterCount = (ch: string): number => {
  if (isChapterHeader(ch)) {
    const m = ch.match(/第(\d+)章/)
    if (m) {
      const prefix = `${m[1]}.`
      return points.value.filter(p => p.book === activeBook.value && (p.chapter.startsWith(prefix) || p.chapter.includes(ch))).length
    }
    return points.value.filter(p => p.book === activeBook.value && p.chapter === ch).length
  }
  return chapterCounts.value[`${activeBook.value}__${ch}`] || 0
}

// 阅读器模式展示的知识点
const displayPoints = computed<KnowledgePoint[]>(() => {
  let list = points.value.filter(p => p.book === activeBook.value)

  if (activeChapter.value !== '全部') {
    const ch = activeChapter.value
    if (isChapterHeader(ch)) {
      const m = ch.match(/第(\d+)章/)
      if (m) {
        const prefix = `${m[1]}.`
        list = list.filter(p => p.chapter.startsWith(prefix) || p.chapter.includes(ch))
      } else {
        list = list.filter(p => p.chapter.includes(ch) || p.chapter === ch)
      }
    } else {
      list = list.filter(p => p.chapter === ch)
    }
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.content && p.content.toLowerCase().includes(q)) ||
      (p.key_formulas && p.key_formulas.toLowerCase().includes(q)) ||
      (p.tips && p.tips.toLowerCase().includes(q)) ||
      (p.visual_desc && p.visual_desc.toLowerCase().includes(q))
    )
  }

  return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
})

// 资源分类
const categoryLabel: Record<string, string> = {
  video: '🎬 视频精解',
  practice: '📝 在线刷题 & 组卷',
  tool: '🔧 互动仿真与工具'
}

const groupedResources = computed(() => {
  const groups: { category: string; label: string; items: LearningResource[] }[] = []
  const map = new Map<string, LearningResource[]>()
  for (const r of resources.value) {
    const list = map.get(r.category)
    if (list) list.push(r)
    else map.set(r.category, [r])
  }
  const order = ['video', 'practice', 'tool']
  for (const cat of order) {
    const items = map.get(cat)
    if (items && items.length) {
      groups.push({ category: cat, label: categoryLabel[cat] || cat, items })
    }
  }
  return groups
})

// 切换学科
const handleSelectSubject = (subjectName: string) => {
  if (activeSubject.value === subjectName) return
  activeSubject.value = subjectName
  activeTopicId.value = 'all'
  shelfGradeFilter.value = '全部'
  const catalog = getSubjectCatalog(subjectName)
  activeBook.value = catalog && catalog.books.length > 0 ? catalog.books[0].name : ''
  activeChapter.value = '全部'
  searchQuery.value = ''
  fetchSubjectKnowledge()
  fetchResources()
  router.replace({
    path: `/knowledge/${encodeURIComponent(subjectName)}`,
    query: currentMode.value === 'shelf' ? { mode: 'shelf' } : { mode: 'topics' }
  })
}

// 模式切换
const switchToTopics = () => {
  currentMode.value = 'topics'
  router.replace({
    path: `/knowledge/${encodeURIComponent(activeSubject.value)}`,
    query: { mode: 'topics' }
  })
}

const switchToShelf = () => {
  currentMode.value = 'shelf'
  router.replace({
    path: `/knowledge/${encodeURIComponent(activeSubject.value)}`,
    query: { mode: 'shelf' }
  })
}

// 点击某本书进入专心阅读模式
const openBookReader = (bookName: string) => {
  activeBook.value = bookName
  activeChapter.value = '全部'
  currentMode.value = 'reader'
  expandedPointIds.value = new Set(
    points.value.filter(p => p.book === bookName).map(p => p.id)
  )
  router.push({
    path: `/knowledge/${encodeURIComponent(activeSubject.value)}/${encodeURIComponent(bookName)}`
  })
}

// 返回教材书架
const backToShelf = () => {
  currentMode.value = 'shelf'
  router.push({
    path: `/knowledge/${encodeURIComponent(activeSubject.value)}`,
    query: { mode: 'shelf' }
  })
}

// 数据请求
const fetchSubjectKnowledge = async () => {
  loadingPoints.value = true
  try {
    const res = await api.get(`/knowledge?subject=${encodeURIComponent(activeSubject.value)}`)
    points.value = res as KnowledgePoint[]

    // 默认全部展开
    expandedPointIds.value = new Set(points.value.map(p => p.id))

    const bCounts: Record<string, number> = {}
    const cCounts: Record<string, number> = {}
    points.value.forEach(p => {
      if (p.book) bCounts[p.book] = (bCounts[p.book] || 0) + 1
      if (p.book && p.chapter) {
        const key = `${p.book}__${p.chapter}`
        cCounts[key] = (cCounts[key] || 0) + 1
      }
    })
    bookCounts.value = bCounts
    chapterCounts.value = cCounts
  } catch (err) {
    console.error('加载知识点失败', err)
  } finally {
    loadingPoints.value = false
  }
}

const fetchGlobalStats = async () => {
  try {
    const data = await api.get('/knowledge/subjects')
    const sCounts: Record<string, number> = {}
    if (data.books && Array.isArray(data.books)) {
      data.books.forEach((b: { subject: string; count: number }) => {
        sCounts[b.subject] = (sCounts[b.subject] || 0) + b.count
      })
    }
    subjectCounts.value = sCounts
  } catch {
    // silent
  }
}

const fetchResources = async () => {
  try {
    const res = await api.get(`/learning-resources?subject=${encodeURIComponent(activeSubject.value)}`)
    resources.value = res as LearningResource[]
  } catch {
    // silent
  }
}

// 展开/收起
const togglePointExpand = (id: number) => {
  if (expandedPointIds.value.has(id)) {
    expandedPointIds.value.delete(id)
  } else {
    expandedPointIds.value.add(id)
  }
}

const toggleAllThematicExpand = () => {
  const currentIds = thematicDisplayPoints.value.map(p => p.id)
  const allExpanded = currentIds.length > 0 && currentIds.every(id => expandedPointIds.value.has(id))
  if (allExpanded) {
    currentIds.forEach(id => expandedPointIds.value.delete(id))
  } else {
    currentIds.forEach(id => expandedPointIds.value.add(id))
  }
}

const toggleAllExpand = () => {
  const currentIds = displayPoints.value.map(p => p.id)
  const allExpanded = currentIds.length > 0 && currentIds.every(id => expandedPointIds.value.has(id))
  if (allExpanded) {
    currentIds.forEach(id => expandedPointIds.value.delete(id))
  } else {
    currentIds.forEach(id => expandedPointIds.value.add(id))
  }
}

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

// 视频预览
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

// 知识点新增/编辑
const openAddPointDialog = (defaultChapter?: string) => {
  editingPoint.value = null
  pointDialogTitle.value = `添加知识点 (${activeSubject.value} · ${activeBook.value})`
  pointForm.value = {
    subject: activeSubject.value,
    grade: currentBookObj.value?.grade || '高一',
    book: activeBook.value,
    chapter: defaultChapter || (activeChapter.value !== '全部' ? activeChapter.value : (currentBookObj.value?.chapters[0] || '')),
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

const openEditPointDialog = (p: KnowledgePoint) => {
  editingPoint.value = p
  pointDialogTitle.value = `编辑知识点: ${p.title}`
  pointForm.value = {
    subject: p.subject,
    grade: p.grade || currentBookObj.value?.grade || '高一',
    book: p.book || activeBook.value,
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
    ElMessage.warning('请输入知识点标题')
    return
  }
  try {
    if (editingPoint.value) {
      await api.put(`/knowledge/${editingPoint.value.id}`, pointForm.value)
      ElMessage.success('知识点已更新')
    } else {
      await api.post('/knowledge', pointForm.value)
      ElMessage.success('知识点已添加')
    }
    pointDialogVisible.value = false
    await fetchSubjectKnowledge()
    await fetchGlobalStats()
  } catch {
    ElMessage.error('保存失败')
  }
}

const deletePoint = async (p: KnowledgePoint) => {
  try {
    await ElMessageBox.confirm(`确定要删除知识点「${p.title}」吗？删除后不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    await api.del(`/knowledge/${p.id}`)
    ElMessage.success('删除成功')
    pointDialogVisible.value = false
    await fetchSubjectKnowledge()
    await fetchGlobalStats()
  } catch {
    // cancelled
  }
}

// 资源新增/编辑
const openAddResource = () => {
  editingResource.value = null
  resourceDialogTitle.value = `添加学习资源 (${activeSubject.value})`
  resourceForm.value = { category: 'video', name: '', desc: '', url: '' }
  resourceDialogVisible.value = true
}

const openEditResource = (r: LearningResource) => {
  editingResource.value = r
  resourceDialogTitle.value = '编辑学习资源'
  resourceForm.value = { category: r.category, name: r.name, desc: r.desc, url: r.url }
  resourceDialogVisible.value = true
}

const saveResource = async () => {
  if (!resourceForm.value.name || !resourceForm.value.url) {
    ElMessage.warning('请填写资源名称和链接')
    return
  }
  try {
    if (editingResource.value) {
      await api.put(`/learning-resources/${editingResource.value.id}`, {
        subject: activeSubject.value,
        ...resourceForm.value
      })
      ElMessage.success('修改成功')
    } else {
      await api.post('/learning-resources', {
        subject: activeSubject.value,
        ...resourceForm.value
      })
      ElMessage.success('添加成功')
    }
    resourceDialogVisible.value = false
    await fetchResources()
  } catch {
    ElMessage.error('保存失败')
  }
}

const removeResource = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除该学习资源吗？', '提示', { type: 'warning' })
    await api.del(`/learning-resources/${id}`)
    ElMessage.success('删除成功')
    await fetchResources()
  } catch {
    // cancelled
  }
}

// 路由监听与同步
const syncStateFromRoute = () => {
  const paramSubject = route.params.subject as string | undefined
  const paramBook = route.params.book as string | undefined
  const queryMode = route.query.mode as string | undefined

  if (paramSubject) {
    const sub = decodeURIComponent(paramSubject)
    if (SHANGHAI_TEXTBOOK_CATALOG.some(s => s.subject === sub)) {
      activeSubject.value = sub
    }
  }

  if (paramBook) {
    const b = decodeURIComponent(paramBook)
    activeBook.value = b
    currentMode.value = 'reader'
  } else if (queryMode === 'shelf') {
    currentMode.value = 'shelf'
  } else if (queryMode === 'topics') {
    currentMode.value = 'topics'
  } else {
    currentMode.value = 'topics'
  }
}

watch(
  () => [route.params.subject, route.params.book, route.query.mode],
  () => {
    syncStateFromRoute()
    fetchSubjectKnowledge()
    fetchResources()
  }
)

onMounted(async () => {
  loadPersistedStatuses()
  syncStateFromRoute()
  await fetchGlobalStats()
  await fetchSubjectKnowledge()
  await fetchResources()
})
</script>

<template>
  <div class="knowledge-container">
    <!-- ======================================================== -->
    <!-- 全局顶层模式切换与功能栏                                 -->
    <!-- ======================================================== -->
    <header class="knowledge-global-navbar">
      <div class="nav-brand-section">
        <div class="brand-badge">上海新高考</div>
        <h1 class="brand-title">全科知识重点归集</h1>
      </div>

      <!-- 视图模式切换器 -->
      <div class="global-view-switcher">
        <button
          class="switcher-tab-btn"
          :class="{ active: currentMode === 'topics' }"
          @click="switchToTopics"
        >
          <el-icon><Aim /></el-icon>
          <span>🎯 高考核心专题归集</span>
        </button>
        <button
          class="switcher-tab-btn"
          :class="{ active: currentMode === 'shelf' || currentMode === 'reader' }"
          @click="switchToShelf"
        >
          <el-icon><Reading /></el-icon>
          <span>📚 教材分册阅读</span>
        </button>
      </div>

      <div class="global-nav-actions">
        <!-- 学习资源抽屉按钮 -->
        <el-button
          type="warning"
          plain
          :icon="Compass"
          class="global-action-btn"
          @click="resourceDrawerVisible = true"
        >
          学习资源 ({{ resources.length }})
        </el-button>

        <!-- 新增考点按钮 -->
        <el-button
          type="primary"
          :icon="Plus"
          class="global-action-btn primary"
          @click="openAddPointDialog()"
        >
          新增知识点
        </el-button>
      </div>
    </header>

    <!-- ======================================================== -->
    <!-- 视图一：高考核心专题归集 (Topics View)                    -->
    <!-- ======================================================== -->
    <div v-if="currentMode === 'topics'" class="topics-layout">
      <!-- 1. 学科横向切换栏 -->
      <div class="topics-subject-bar">
        <div class="subject-chips-scroll">
          <button
            v-for="sub in SHANGHAI_TEXTBOOK_CATALOG"
            :key="sub.subject"
            class="topic-subject-chip"
            :class="{ active: activeSubject === sub.subject }"
            @click="handleSelectSubject(sub.subject)"
          >
            <span class="sub-emoji">{{ sub.emoji }}</span>
            <span class="sub-name">{{ sub.subject }}</span>
            <span class="sub-count-tag">
              {{ activeSubject === sub.subject ? points.length : (subjectCounts[sub.subject] || 0) }}
            </span>
          </button>
        </div>
      </div>

      <!-- 2. 专题主体工作区 -->
      <div class="topics-main-area">
        <!-- 专题筛选胶囊列表 -->
        <div class="topics-pills-row">
          <button
            class="topic-pill-btn all-pill"
            :class="{ active: activeTopicId === 'all' }"
            @click="activeTopicId = 'all'"
          >
            <span class="pill-icon">🌟</span>
            <span class="pill-name">全部专题</span>
            <span class="pill-badge">{{ points.length }}</span>
          </button>

          <button
            v-for="t in currentSubjectTopics"
            :key="t.id"
            class="topic-pill-btn"
            :class="{ active: activeTopicId === t.id }"
            :style="activeTopicId === t.id ? { borderColor: t.color, background: t.bgGradient } : {}"
            @click="activeTopicId = t.id"
          >
            <span class="pill-icon">{{ t.icon }}</span>
            <span class="pill-name">{{ t.shortName }}</span>
            <span class="pill-badge" :style="{ color: t.color }">{{ getTopicPointCount(t.id) }}</span>
          </button>
        </div>

        <!-- 专题导读横幅 -->
        <div class="topic-overview-banner" :style="activeTopicObj ? { background: activeTopicObj.bgGradient } : {}">
          <div class="banner-left">
            <div class="banner-header-line">
              <span class="banner-icon">{{ activeTopicObj ? activeTopicObj.icon : '📐' }}</span>
              <h2 class="banner-title">
                {{ activeTopicObj ? activeTopicObj.name : `${activeSubject} · 上海高中三年核心知识重点全景归集` }}
              </h2>
              <span v-if="activeTopicObj" class="banner-tag" :style="{ background: activeTopicObj.color, color: '#fff' }">
                {{ activeTopicObj.tag }}
              </span>
            </div>
            <p class="banner-desc">
              {{ activeTopicObj ? activeTopicObj.desc : `以高考大纲与沪教版新课标为基准，系统梳理三年核心考点、高分解题模型与提分大招，现已收录 ${points.length} 个核心要点。` }}
            </p>
          </div>

          <div class="banner-right">
            <div class="mastery-summary-card">
              <div class="progress-labels">
                <span class="label-text">掌握进度</span>
                <span class="progress-num">{{ masteredCount }} / {{ points.length }} ({{ points.length ? Math.round(masteredCount / points.length * 100) : 0 }}%)</span>
              </div>
              <div class="mini-progress-track">
                <div
                  class="mini-progress-bar"
                  :style="{ width: `${points.length ? Math.round(masteredCount / points.length * 100) : 0}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 控制工具栏 (搜索、状态筛选、展开收起) -->
        <div class="thematic-control-bar">
          <div class="control-left">
            <!-- 状态过滤单选组 -->
            <div class="status-filter-group">
              <button
                class="status-btn"
                :class="{ active: topicFilterStatus === 'all' }"
                @click="topicFilterStatus = 'all'"
              >
                全部 ({{ activeTopicId === 'all' ? points.length : getTopicPointCount(activeTopicId) }})
              </button>
              <button
                class="status-btn"
                :class="{ active: topicFilterStatus === 'starred' }"
                @click="topicFilterStatus = 'starred'"
              >
                ⭐️ 重点标记 ({{ starredCount }})
              </button>
              <button
                class="status-btn"
                :class="{ active: topicFilterStatus === 'mastered' }"
                @click="topicFilterStatus = 'mastered'"
              >
                ✅ 已掌握 ({{ masteredCount }})
              </button>
              <button
                class="status-btn"
                :class="{ active: topicFilterStatus === 'unmastered' }"
                @click="topicFilterStatus = 'unmastered'"
              >
                ⏳ 待巩固 ({{ unmasteredCount }})
              </button>
            </div>
          </div>

          <div class="control-right">
            <el-input
              v-model="searchQuery"
              placeholder="搜索考点、公式定理、解题大招..."
              :prefix-icon="Search"
              clearable
              class="thematic-search-input"
            />

            <el-button class="tool-btn" @click="toggleAllThematicExpand">
              {{ thematicDisplayPoints.every(p => expandedPointIds.has(p.id)) ? '全部收起' : '全部展开' }}
            </el-button>
          </div>
        </div>

        <!-- 考点卡片流 -->
        <div v-loading="loadingPoints" class="thematic-cards-scroll">
          <div v-if="thematicDisplayPoints.length > 0" class="thematic-cards-stack">
            <article
              v-for="p in thematicDisplayPoints"
              :key="p.id"
              class="thematic-point-card"
              :class="{
                expanded: expandedPointIds.has(p.id),
                is_mastered: masteredPointIds.has(p.id),
                is_starred: starredPointIds.has(p.id)
              }"
            >
              <!-- 卡片头部 -->
              <div class="t-card-head" @click="togglePointExpand(p.id)">
                <div class="t-head-left">
                  <div class="t-tag-badges">
                    <span
                      v-if="getPointTopic(p)"
                      class="t-topic-badge"
                      :style="{ color: getPointTopic(p)?.color, background: getPointTopic(p)?.bgGradient }"
                    >
                      {{ getPointTopic(p)?.icon }} {{ getPointTopic(p)?.shortName }}
                    </span>
                    <span class="t-book-badge">{{ p.book }} · {{ p.chapter }}</span>
                  </div>
                  <h3 class="t-card-title">{{ p.title }}</h3>
                </div>

                <div class="t-head-actions" @click.stop>
                  <!-- 标星按钮 -->
                  <button
                    class="icon-action-btn star-btn"
                    :class="{ active: starredPointIds.has(p.id) }"
                    title="标记为重点"
                    @click="toggleStar(p.id)"
                  >
                    <el-icon v-if="starredPointIds.has(p.id)" color="#f59e0b"><StarFilled /></el-icon>
                    <el-icon v-else><Star /></el-icon>
                  </button>

                  <!-- 掌握状态切换 -->
                  <button
                    class="mastery-toggle-btn"
                    :class="{ mastered: masteredPointIds.has(p.id) }"
                    @click="toggleMastered(p.id)"
                  >
                    <el-icon><Check /></el-icon>
                    <span>{{ masteredPointIds.has(p.id) ? '已掌握' : '待巩固' }}</span>
                  </button>

                  <!-- 视频讲解 -->
                  <el-button
                    v-if="p.video_url"
                    size="small"
                    type="success"
                    plain
                    :icon="VideoPlay"
                    class="video-btn"
                    @click="openVideoPreview(p.title, p.video_url)"
                  >
                    名师精讲
                  </el-button>

                  <!-- 编辑 -->
                  <el-button
                    size="small"
                    type="primary"
                    link
                    :icon="Edit"
                    @click="openEditPointDialog(p)"
                  >
                    编辑
                  </el-button>

                  <button
                    class="caret-toggle-btn"
                    :class="{ rotated: expandedPointIds.has(p.id) }"
                    @click="togglePointExpand(p.id)"
                  >
                    ▼
                  </button>
                </div>
              </div>

              <!-- 卡片内容区域 -->
              <div v-show="expandedPointIds.has(p.id)" class="t-card-body">
                <!-- 核心解析 -->
                <div v-if="p.content" class="box-section concept-box">
                  <div class="box-header">
                    <span class="bar blue"></span>
                    <span>📖 核心概念与考点解析</span>
                  </div>
                  <div class="box-inner-text" v-html="renderMathAndText(p.content)"></div>
                </div>

                <!-- 核心公式 -->
                <div v-if="p.key_formulas" class="box-section formula-box-wrap">
                  <div class="box-header">
                    <span class="bar purple"></span>
                    <span>⚡ 高考必备公式与重要定理 (KaTeX)</span>
                  </div>
                  <div class="formula-content-render" v-html="renderMathAndText(p.key_formulas)"></div>
                </div>

                <!-- 提分大招 Tips -->
                <div v-if="p.tips" class="box-section tips-box-wrap">
                  <div class="box-header">
                    <span class="bar amber"></span>
                    <span>💡 高考解题提分大招 & 避坑经验</span>
                  </div>
                  <div class="tips-content-text" v-html="renderMathAndText(p.tips)"></div>
                </div>

                <!-- 思维与几何图景 -->
                <div v-if="p.visual_desc" class="box-section visual-box-wrap">
                  <div class="box-header">
                    <span class="bar green"></span>
                    <span>📐 形象图景与思维建构</span>
                  </div>
                  <div class="visual-content-text" v-html="renderMathAndText(p.visual_desc)"></div>
                </div>
              </div>
            </article>
          </div>

          <!-- 空状态 -->
          <div v-else class="thematic-empty-box">
            <div class="empty-icon">🔍</div>
            <h3>未检索到匹配的高考考点</h3>
            <p>您可以更换专题、清除搜索词或点击右上角“新增知识点”补充考点。</p>
            <el-button
              type="primary"
              :icon="RefreshRight"
              @click="searchQuery = ''; activeTopicId = 'all'; topicFilterStatus = 'all'"
            >
              重置筛选条件
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 视图二：教材书架视图 (Shelf View)                        -->
    <!-- ======================================================== -->
    <div v-else-if="currentMode === 'shelf'" class="shelf-layout">
      <!-- 左侧科目导航 -->
      <aside class="shelf-sidebar">
        <div class="shelf-brand">
          <div class="brand-tag">上海新课标</div>
          <h2 class="brand-title">教材分册</h2>
        </div>

        <nav class="shelf-subject-list">
          <button
            v-for="sub in SHANGHAI_TEXTBOOK_CATALOG"
            :key="sub.subject"
            class="shelf-subject-btn"
            :class="{ active: activeSubject === sub.subject }"
            @click="handleSelectSubject(sub.subject)"
          >
            <span class="sub-emoji">{{ sub.emoji }}</span>
            <div class="sub-meta">
              <span class="sub-name">{{ sub.subject }}</span>
              <span class="sub-ed">{{ sub.edition.split(' ')[0] }}</span>
            </div>
            <span v-if="subjectCounts[sub.subject] || (activeSubject === sub.subject && points.length)" class="sub-badge">
              {{ activeSubject === sub.subject ? points.length : (subjectCounts[sub.subject] || 0) }}
            </span>
          </button>
        </nav>
      </aside>

      <!-- 右侧主书架区域 -->
      <main class="shelf-main">
        <!-- 顶层标头 -->
        <header class="shelf-header">
          <div class="header-info">
            <div class="subject-headline">
              <span class="headline-emoji">{{ currentCatalog?.emoji }}</span>
              <h1 class="headline-title">{{ activeSubject }}</h1>
              <span class="headline-edition">{{ currentCatalog?.edition }}</span>
              <span class="headline-publisher">{{ currentCatalog?.publisher }}</span>
            </div>
            <p class="subject-description">{{ currentCatalog?.desc }} · 全套上海高中课本分册</p>
          </div>

          <div class="header-tools">
            <!-- 年级筛选 -->
            <div class="grade-filter-segmented">
              <button
                v-for="g in (['全部', '高一', '高二', '高三'] as const)"
                :key="g"
                class="segmented-btn"
                :class="{ active: shelfGradeFilter === g }"
                @click="shelfGradeFilter = g"
              >
                {{ g }}
              </button>
            </div>
          </div>
        </header>

        <!-- 真实书架网格陈列 -->
        <div class="shelf-books-container">
          <section
            v-for="grp in groupedBooksByGrade"
            :key="grp.grade"
            class="grade-bookshelf-row"
          >
            <div class="shelf-grade-title">
              <span class="grade-pill" :class="grp.grade">{{ grp.title }}</span>
              <span class="grade-count-hint">共 {{ grp.books.length }} 册教科书</span>
            </div>

            <div class="books-grid">
              <!-- 实体书封面卡片 -->
              <div
                v-for="book in grp.books"
                :key="book.id"
                class="textbook-cover-card"
                @click="openBookReader(book.name)"
              >
                <!-- 书脊左侧立体折线阴影 -->
                <div class="book-spine"></div>

                <!-- 真实封面图片模式 -->
                <div v-if="book.coverImg" class="cover-real-wrapper">
                  <img
                    :src="book.coverImg"
                    :alt="`${activeSubject} ${book.name}`"
                    class="real-cover-image"
                  />
                  <div class="book-sheen-overlay"></div>
                </div>

                <!-- 精致几何设计封面模式 -->
                <div
                  v-else
                  class="cover-artistic-wrapper"
                  :style="{
                    background: book.coverColor || currentCatalog?.gradient || 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                  }"
                >
                  <!-- 书脊压线 -->
                  <div class="cover-spine-crease"></div>

                  <!-- 顶部版署栏 -->
                  <div class="artistic-top-bar">
                    <span class="pub-badge">{{ currentCatalog?.publisher || '上海教育出版社' }}</span>
                    <span class="std-badge">课标教材</span>
                  </div>

                  <!-- 几何装饰纹样 -->
                  <div class="artistic-pattern-canvas">
                    <div class="pattern-circle large"></div>
                    <div class="pattern-circle medium"></div>
                    <div class="pattern-rect"></div>
                    <span class="pattern-symbol">{{ currentCatalog?.emoji || '📐' }}</span>
                  </div>

                  <!-- 书名主视觉区 -->
                  <div class="artistic-title-block">
                    <div class="book-subject-tag">{{ activeSubject }}</div>
                    <h3 class="book-main-title">{{ book.name }}</h3>
                    <p class="book-sub-desc">{{ book.subtitle }}</p>
                  </div>

                  <!-- 底部信息栏 -->
                  <div class="artistic-bottom-bar">
                    <span class="grade-badge">{{ book.grade }}</span>
                    <span class="edition-code">{{ currentCatalog?.edition || '沪教版' }}</span>
                  </div>
                </div>

                <!-- 卡片下方信息与入库进度 -->
                <div class="book-card-info">
                  <div class="b-info-title">{{ book.name }}</div>
                  <div class="b-info-meta">
                    <span class="meta-tag">{{ book.grade }}</span>
                    <span class="meta-points-count">
                      收录 <strong>{{ bookCounts[book.name] || 0 }}</strong> 个考点
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>

    <!-- ======================================================== -->
    <!-- 视图三：具体教材专心阅读视图 (Reader View)               -->
    <!-- ======================================================== -->
    <div v-else class="reader-layout">
      <!-- 顶层阅读工作台导航条 -->
      <header class="reader-navbar">
        <div class="nav-left">
          <el-button
            class="back-shelf-btn"
            :icon="ArrowLeft"
            @click="backToShelf"
          >
            返回教材书架
          </el-button>

          <el-button
            class="to-topics-btn"
            :icon="Aim"
            type="primary"
            plain
            @click="switchToTopics"
          >
            切换到高考专题
          </el-button>

          <div class="reader-breadcrumb">
            <span class="crumb-subject">{{ activeSubject }}</span>
            <span class="crumb-sep">/</span>
            <span class="crumb-book">{{ activeBook }}</span>
            <span v-if="activeChapter !== '全部'" class="crumb-sep">/</span>
            <span v-if="activeChapter !== '全部'" class="crumb-chapter">{{ activeChapter }}</span>
          </div>

          <span class="reader-points-badge">
            共 <strong>{{ displayPoints.length }}</strong> 考点
          </span>
        </div>

        <div class="nav-right">
          <!-- 搜索框 -->
          <el-input
            v-model="searchQuery"
            placeholder="搜索概念、公式、小技巧..."
            :prefix-icon="Search"
            clearable
            class="reader-search-input"
          />

          <!-- 全部折叠/展开 -->
          <el-button @click="toggleAllExpand">
            展开/收起
          </el-button>
        </div>
      </header>

      <!-- 双栏阅读主体：左侧章节小节树 + 右侧宽屏卡片流 -->
      <div class="reader-split-body">
        <!-- 左侧章节小节栏 -->
        <aside class="reader-chapter-sidebar">
          <div class="chapter-sidebar-header">
            <div class="book-title-tag">{{ activeBook }}</div>
            <div class="chapter-nav-label">目录章节导航</div>
          </div>

          <div class="chapter-nav-scroll">
            <button
              class="chapter-nav-btn all-btn"
              :class="{ active: activeChapter === '全部' }"
              @click="activeChapter = '全部'"
            >
              <el-icon><Collection /></el-icon>
              <span>全部章节考点</span>
              <span class="badge-num">{{ points.filter(p => p.book === activeBook).length }}</span>
            </button>

            <div class="chapter-tree-list">
              <button
                v-for="ch in currentChapters"
                :key="ch"
                class="chapter-nav-btn"
                :class="{
                  active: activeChapter === ch,
                  'is-chapter-title': isChapterHeader(ch),
                  'is-section-leaf': !isChapterHeader(ch)
                }"
                @click="activeChapter = ch"
              >
                <el-icon v-if="isChapterHeader(ch)" class="ch-icon"><FolderOpened /></el-icon>
                <span v-else class="leaf-dot">•</span>
                <span class="ch-text">{{ ch }}</span>
                <span v-if="getChapterCount(ch) > 0" class="badge-num">
                  {{ getChapterCount(ch) }}
                </span>
              </button>
            </div>
          </div>
        </aside>

        <!-- 右侧宽屏主体内容卡片流 -->
        <main v-loading="loadingPoints" class="reader-main-content">
          <div class="content-scroll-container">
            <!-- 章节小结标题栏 -->
            <div class="active-chapter-banner">
              <div class="banner-title-row">
                <h2 class="active-title">
                  {{ activeChapter === '全部' ? `${activeBook} · 全部考点速查` : activeChapter }}
                </h2>
                <span class="active-count-tag">
                  共 {{ displayPoints.length }} 个知识点卡片
                </span>
              </div>
            </div>

            <!-- 考点卡片列表 -->
            <div v-if="displayPoints.length > 0" class="points-card-stack">
              <article
                v-for="p in displayPoints"
                :key="p.id"
                class="wide-point-card"
                :class="{ expanded: expandedPointIds.has(p.id) }"
              >
                <!-- 卡片头部 -->
                <div class="card-head" @click="togglePointExpand(p.id)">
                  <div class="head-left">
                    <span class="head-section-tag">{{ p.chapter }}</span>
                    <h3 class="head-title">{{ p.title }}</h3>
                  </div>

                  <div class="head-right" @click.stop>
                    <button
                      class="icon-action-btn star-btn"
                      :class="{ active: starredPointIds.has(p.id) }"
                      title="标记为重点"
                      @click="toggleStar(p.id)"
                    >
                      <el-icon v-if="starredPointIds.has(p.id)" color="#f59e0b"><StarFilled /></el-icon>
                      <el-icon v-else><Star /></el-icon>
                    </button>

                    <button
                      class="mastery-toggle-btn"
                      :class="{ mastered: masteredPointIds.has(p.id) }"
                      @click="toggleMastered(p.id)"
                    >
                      <el-icon><Check /></el-icon>
                      <span>{{ masteredPointIds.has(p.id) ? '已掌握' : '待巩固' }}</span>
                    </button>

                    <el-button
                      v-if="p.video_url"
                      size="small"
                      type="success"
                      plain
                      :icon="VideoPlay"
                      @click="openVideoPreview(p.title, p.video_url)"
                    >
                      名师精讲
                    </el-button>
                    <el-button
                      size="small"
                      type="primary"
                      link
                      :icon="Edit"
                      @click="openEditPointDialog(p)"
                    >
                      编辑
                    </el-button>
                    <button
                      class="caret-toggle-btn"
                      :class="{ rotated: expandedPointIds.has(p.id) }"
                      @click="togglePointExpand(p.id)"
                    >
                      ▼
                    </button>
                  </div>
                </div>

                <!-- 卡片内容体 -->
                <div v-show="expandedPointIds.has(p.id)" class="card-body-content">
                  <!-- 核心概念 -->
                  <div v-if="p.content" class="box-section concept-box">
                    <div class="box-header">
                      <span class="bar blue"></span>
                      <span>核心概念与要点解析</span>
                    </div>
                    <div class="box-inner-text" v-html="renderMathAndText(p.content)"></div>
                  </div>

                  <!-- 关键公式 (KaTeX) -->
                  <div v-if="p.key_formulas" class="box-section formula-box-wrap">
                    <div class="box-header">
                      <span class="bar purple"></span>
                      <span>核心公式与重要定理 (KaTeX)</span>
                    </div>
                    <div class="formula-content-render" v-html="renderMathAndText(p.key_formulas)"></div>
                  </div>

                  <!-- 解题避坑 Tips -->
                  <div v-if="p.tips" class="box-section tips-box-wrap">
                    <div class="box-header">
                      <span class="bar amber"></span>
                      <span>⚡ 解题小技巧与避坑指南</span>
                    </div>
                    <div class="tips-content-text" v-html="renderMathAndText(p.tips)"></div>
                  </div>

                  <!-- 形象思维图景 -->
                  <div v-if="p.visual_desc" class="box-section visual-box-wrap">
                    <div class="box-header">
                      <span class="bar green"></span>
                      <span>💡 形象记忆与思维图景</span>
                    </div>
                    <div class="visual-content-text" v-html="renderMathAndText(p.visual_desc)"></div>
                  </div>
                </div>
              </article>
            </div>

            <!-- 空状态 -->
            <div v-else class="reader-empty-box">
              <div class="empty-icon">{{ currentCatalog?.emoji }}</div>
              <h3>当前章节暂未录入考点</h3>
              <p>可以点击上方“新增知识点”或下方按钮录入本节内容。</p>
              <el-button
                type="primary"
                size="large"
                :icon="Plus"
                @click="openAddPointDialog(activeChapter !== '全部' ? activeChapter : '')"
              >
                录入当前小节知识点
              </el-button>
            </div>
          </div>
        </main>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 学习资源抽屉 (Learning Resources Drawer)                  -->
    <!-- ======================================================== -->
    <el-drawer
      v-model="resourceDrawerVisible"
      :title="`${activeSubject} · 学习资源与实用工具`"
      size="420px"
      direction="rtl"
      destroy-on-close
      class="learning-resource-drawer"
    >
      <div class="drawer-inner-container">
        <div class="drawer-top-action">
          <span class="resource-count-label">共 {{ resources.length }} 项学科精选资源</span>
          <div class="drawer-btn-group">
            <el-button
              size="small"
              type="primary"
              link
              @click="resourceManageMode = !resourceManageMode"
            >
              {{ resourceManageMode ? '完成' : '管理模式' }}
            </el-button>
            <el-button
              size="small"
              type="primary"
              :icon="Plus"
              @click="openAddResource"
            >
              添加资源
            </el-button>
          </div>
        </div>

        <div class="drawer-group-list">
          <div
            v-for="grp in groupedResources"
            :key="grp.category"
            class="drawer-category-group"
          >
            <div class="drawer-category-title">{{ grp.label }}</div>
            <div class="drawer-items-stack">
              <div
                v-for="r in grp.items"
                :key="r.id"
                class="drawer-resource-card"
              >
                <a :href="r.url" target="_blank" rel="noopener" class="drawer-res-link">
                  <div class="drawer-res-header">
                    <span class="drawer-res-name">{{ r.name }}</span>
                    <el-icon class="external-icon"><TopRight /></el-icon>
                  </div>
                  <p v-if="r.desc" class="drawer-res-desc">{{ r.desc }}</p>
                </a>

                <div v-if="resourceManageMode" class="drawer-res-actions">
                  <el-button size="small" link type="primary" @click="openEditResource(r)">编辑</el-button>
                  <el-button size="small" link type="danger" @click="removeResource(r.id)">删除</el-button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="resources.length === 0" class="drawer-empty-hint">
            <el-empty description="暂无该学科推荐资源" />
            <el-button type="primary" @click="openAddResource">+ 添加第一个学习资源</el-button>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 知识点新增/编辑弹窗 -->
    <el-dialog
      v-model="pointDialogVisible"
      :title="pointDialogTitle"
      width="720px"
      destroy-on-close
    >
      <el-form :model="pointForm" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="学科">
              <el-input v-model="pointForm.subject" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="教材分册">
              <el-input v-model="pointForm.book" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item label="所属小节" required>
              <el-select
                v-model="pointForm.chapter"
                filterable
                allow-create
                default-first-option
                placeholder="请选择或输入章节小节"
                style="width: 100%"
              >
                <el-option
                  v-for="ch in currentChapters"
                  :key="ch"
                  :label="ch"
                  :value="ch"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序号">
              <el-input-number v-model="pointForm.sort_order" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="考点标题" required>
          <el-input v-model="pointForm.title" placeholder="如：集合的概念与表示方法" />
        </el-form-item>

        <el-form-item label="核心概念">
          <el-input
            v-model="pointForm.content"
            type="textarea"
            :rows="4"
            placeholder="知识点详细解析（支持 LaTeX 公式）"
          />
        </el-form-item>

        <el-form-item label="核心公式">
          <el-input
            v-model="pointForm.key_formulas"
            type="textarea"
            :rows="3"
            placeholder="公式定理（如 $$a^2+b^2 \ge 2ab$$）"
          />
        </el-form-item>

        <el-form-item label="避坑指南">
          <el-input
            v-model="pointForm.tips"
            type="textarea"
            :rows="3"
            placeholder="解题经验、易错提示与注意事项"
          />
        </el-form-item>

        <el-form-item label="思维图景">
          <el-input
            v-model="pointForm.visual_desc"
            type="textarea"
            :rows="3"
            placeholder="几何或形象思维辅助记忆描述"
          />
        </el-form-item>

        <el-form-item label="B站视频">
          <el-input
            v-model="pointForm.video_url"
            placeholder="BV号或完整B站链接（如 https://www.bilibili.com/video/BV1xx411c7XN）"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="modal-footer-flex">
          <el-button
            v-if="editingPoint"
            type="danger"
            plain
            :icon="Delete"
            @click="deletePoint(editingPoint)"
          >
            删除此考点
          </el-button>
          <div v-else></div>

          <div class="footer-action-btns">
            <el-button @click="pointDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="savePoint">保存</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 资源新增/编辑弹窗 -->
    <el-dialog
      v-model="resourceDialogVisible"
      :title="resourceDialogTitle"
      width="540px"
      destroy-on-close
    >
      <el-form :model="resourceForm" label-width="80px">
        <el-form-item label="类别" required>
          <el-radio-group v-model="resourceForm.category">
            <el-radio-button label="video">视频</el-radio-button>
            <el-radio-button label="practice">刷题</el-radio-button>
            <el-radio-button label="tool">工具</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="resourceForm.name" placeholder="如：组卷网、互动模拟器" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="resourceForm.desc" placeholder="简要说明" />
        </el-form-item>
        <el-form-item label="链接 URL" required>
          <el-input v-model="resourceForm.url" placeholder="https://..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resourceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveResource">确定</el-button>
      </template>
    </el-dialog>

    <!-- B站视频弹窗 -->
    <el-dialog
      v-model="videoModalVisible"
      :title="currentVideoTitle"
      width="840px"
      destroy-on-close
    >
      <div class="video-iframe-wrapper">
        <iframe
          :src="currentVideoEmbedUrl"
          scrolling="no"
          border="0"
          frameborder="no"
          framespacing="0"
          allowfullscreen="true"
          class="video-iframe"
        />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>

/* ======================================================== */
/* 全局顶层模式切换导航条                                    */
/* ======================================================== */
.knowledge-global-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: var(--bg-card, #ffffff);
  border-bottom: 1px solid var(--border-subtle, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  z-index: 20;
}

.nav-brand-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-badge {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  color: #3b82f6;
  background: #eff6ff;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.brand-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.global-view-switcher {
  display: flex;
  align-items: center;
  background: var(--bg-page, #f1f5f9);
  padding: 4px;
  border-radius: 10px;
  gap: 4px;
}

.switcher-tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text-sub, #64748b);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.switcher-tab-btn:hover {
  color: var(--text-main, #0f172a);
}

.switcher-tab-btn.active {
  background: var(--bg-card, #ffffff);
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.global-nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ======================================================== */
/* 视图一：高考核心专题归集样式 (Topics View)                */
/* ======================================================== */
.topics-layout {
  display: flex;
  flex-direction: column;
  height: calc(100% - 53px);
  overflow: hidden;
}

/* 学科横向切换条 */
.topics-subject-bar {
  background: var(--bg-card, #ffffff);
  border-bottom: 1px solid var(--border-subtle, #e2e8f0);
  padding: 8px 24px;
}

.subject-chips-scroll {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
.subject-chips-scroll::-webkit-scrollbar {
  display: none;
}

.topic-subject-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid var(--border-subtle, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-main, #334155);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.topic-subject-chip:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #f8fafc;
}

.topic-subject-chip.active {
  background: #3b82f6;
  color: #ffffff;
  border-color: #3b82f6;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}

.topic-subject-chip.active .sub-count-tag {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.sub-count-tag {
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 10px;
  background: var(--bg-page, #f1f5f9);
  color: var(--text-sub, #64748b);
}

/* 专题工作区 */
.topics-main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 24px;
  gap: 12px;
}

/* 专题胶囊条 */
.topics-pills-row {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: thin;
}

.topic-pill-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-main, #1e293b);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.topic-pill-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.topic-pill-btn.active {
  border-width: 1.5px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.topic-pill-btn.all-pill.active {
  background: #1e293b;
  color: #ffffff;
  border-color: #1e293b;
}

.pill-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
}

.topic-pill-btn.all-pill.active .pill-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

/* 专题导读横幅 */
.topic-overview-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid rgba(59, 130, 246, 0.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.banner-left {
  flex: 1;
  max-width: 75%;
}

.banner-header-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.banner-icon {
  font-size: 20px;
}

.banner-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.banner-tag {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 6px;
}

.banner-desc {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--text-sub, #475569);
  line-height: 1.5;
}

.banner-right {
  min-width: 200px;
  display: flex;
  justify-content: flex-end;
}

.mastery-summary-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.85));
  backdrop-filter: blur(8px);
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  width: 180px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-main, #334155);
  margin-bottom: 6px;
}

.progress-num {
  color: #10b981;
}

.mini-progress-track {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.mini-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 控制工具栏 */
.thematic-control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.status-filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-card, #ffffff);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #e2e8f0);
}

.status-btn {
  border: none;
  background: transparent;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub, #64748b);
  cursor: pointer;
  transition: all 0.2s ease;
}

.status-btn:hover {
  color: var(--text-main, #0f172a);
}

.status-btn.active {
  background: var(--bg-page, #f1f5f9);
  color: #3b82f6;
  font-weight: 700;
}

.control-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.thematic-search-input {
  width: 260px;
}

/* 考点卡片流滚动区 */
.thematic-cards-scroll {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.thematic-cards-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 24px;
}

/* 专题卡片整体 */
.thematic-point-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.thematic-point-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.thematic-point-card.is_mastered {
  border-left: 4px solid #10b981;
}

.thematic-point-card.is_starred {
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.12);
}

/* 卡片头部 */
.t-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  cursor: pointer;
  background: var(--bg-card, #ffffff);
  user-select: none;
}

.t-card-head:hover {
  background: #fafafa;
}

.t-head-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.t-tag-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.t-topic-badge {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
}

.t-book-badge {
  font-size: 11.5px;
  color: var(--text-sub, #64748b);
  background: var(--bg-page, #f1f5f9);
  padding: 2px 7px;
  border-radius: 4px;
}

.t-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.t-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-action-btn {
  background: transparent;
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  color: #94a3b8;
  transition: all 0.2s ease;
}

.icon-action-btn:hover {
  border-color: #f59e0b;
  color: #f59e0b;
}

.icon-action-btn.star-btn.active {
  border-color: #f59e0b;
  background: #fef3c7;
}

.mastery-toggle-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle, #e2e8f0);
  background: transparent;
  color: var(--text-sub, #64748b);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mastery-toggle-btn:hover {
  border-color: #10b981;
  color: #10b981;
}

.mastery-toggle-btn.mastered {
  background: #ecfdf5;
  border-color: #10b981;
  color: #059669;
}

.caret-toggle-btn {
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 10px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.caret-toggle-btn.rotated {
  transform: rotate(180deg);
}

/* 卡片内容主体 */
.t-card-body {
  padding: 0 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: 1px solid var(--border-subtle, #f1f5f9);
}

.thematic-empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  background: var(--bg-card, #ffffff);
  border-radius: 12px;
  border: 1px dashed var(--border-subtle, #cbd5e1);
}

.thematic-empty-box .empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.thematic-empty-box h3 {
  margin: 0 0 8px;
  font-size: 17px;
  color: var(--text-main, #0f172a);
}

.thematic-empty-box p {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-sub, #64748b);
}

.to-topics-btn {
  margin-left: 8px;
}


.knowledge-container {
  height: calc(100vh - 64px);
  overflow: hidden;
  background: var(--bg-page, #f8fafc);
  color: var(--text-main, #0f172a);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  transition: var(--theme-transition);
}

/* ======================================================== */
/* 阶段一：教材书架样式 (Shelf View)                        */
/* ======================================================== */
.shelf-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* 左侧科目栏 */
.shelf-sidebar {
  width: 160px;
  min-width: 160px;
  background: var(--bg-card, #ffffff);
  border-right: 1px solid var(--border-subtle, #e2e8f0);
  display: flex;
  flex-direction: column;
  transition: var(--theme-transition);
}

.shelf-brand {
  padding: 18px 16px 14px;
  border-bottom: 1px solid var(--border-subtle, #f1f5f9);
}

.brand-tag {
  font-size: 11px;
  color: var(--text-sub, #64748b);
  letter-spacing: 0.5px;
}

.brand-title {
  margin: 4px 0 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.shelf-subject-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shelf-subject-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.shelf-subject-btn:hover {
  background: #f1f5f9;
}

.shelf-subject-btn.active {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.sub-emoji {
  font-size: 20px;
  line-height: 1;
}

.sub-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sub-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.shelf-subject-btn.active .sub-name {
  color: #1d4ed8;
}

.sub-ed {
  font-size: 11px;
  color: #94a3b8;
}

.sub-badge {
  font-size: 11px;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.shelf-subject-btn.active .sub-badge {
  background: #dbeafe;
  color: #1d4ed8;
}

/* 右侧主书架 */
.shelf-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-page, #f8fafc);
  transition: var(--theme-transition);
}

.shelf-header {
  padding: 20px 28px;
  background: var(--bg-card, #ffffff);
  border-bottom: 1px solid var(--border-subtle, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  transition: var(--theme-transition);
}

.subject-headline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.headline-emoji {
  font-size: 32px;
}

.headline-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.headline-edition {
  background: #eff6ff;
  color: #2563eb;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.headline-publisher {
  font-size: 13px;
  color: var(--text-sub, #64748b);
}

.subject-description {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-sub, #64748b);
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 14px;
}

.grade-filter-segmented {
  display: flex;
  background: var(--bg-card-secondary, #f1f5f9);
  padding: 3px;
  border-radius: 8px;
}

.segmented-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: var(--text-sub, #64748b);
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.segmented-btn.active {
  background: var(--bg-card, #ffffff);
  color: var(--text-main, #0f172a);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.resource-trigger-btn {
  font-weight: 600;
}

/* 书本网格 */
.shelf-books-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px 48px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.grade-bookshelf-row {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.shelf-grade-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.grade-pill {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
}

.grade-pill.高一 { background: #e0f2fe; color: #0369a1; }
.grade-pill.高二 { background: #fef3c7; color: #b45309; }
.grade-pill.高三 { background: #fee2e2; color: #b91c1c; }

.grade-count-hint {
  font-size: 12px;
  color: #94a3b8;
}

.books-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

/* ======================================================== */
/* 实体书质感卡片设计 (Real Textbook Cover Card)            */
/* ======================================================== */
.textbook-cover-card {
  position: relative;
  width: 195px;
  height: 275px;
  border-radius: 8px 12px 12px 8px;
  box-shadow: 
    0 10px 20px -5px rgba(0, 0, 0, 0.12),
    0 2px 6px -1px rgba(0, 0, 0, 0.08),
    -4px 0 8px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.165, 0.84, 0.44, 1);
  user-select: none;
  background: #ffffff;
  display: flex;
  overflow: hidden;
}

.textbook-cover-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 
    0 20px 30px -10px rgba(0, 0, 0, 0.2),
    0 8px 12px -2px rgba(0, 0, 0, 0.1),
    -6px 0 10px rgba(0, 0, 0, 0.08);
}

/* 书脊立体感阴影条 */
.book-spine {
  width: 10px;
  height: 100%;
  background: linear-gradient(to right, #94a3b8 0%, #cbd5e1 40%, rgba(255, 255, 255, 0.4) 60%, rgba(0, 0, 0, 0.12) 100%);
  box-shadow: inset 2px 0 3px rgba(0,0,0,0.15);
  flex-shrink: 0;
  z-index: 2;
}

/* 真实封面图片容器 */
.cover-real-wrapper {
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #f8fafc;
}

.real-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.textbook-cover-card:hover .real-cover-image {
  transform: scale(1.03);
}

.book-sheen-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  background: linear-gradient(
    105deg,
    rgba(255, 255, 255, 0.25) 0%,
    rgba(255, 255, 255, 0.05) 25%,
    rgba(0, 0, 0, 0.02) 60%,
    rgba(0, 0, 0, 0.08) 100%
  );
}

/* 封面内页 */
.cover-inner {
  flex: 1;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #fdfefe;
  position: relative;
  overflow: hidden;
}

/* 学科主题背景色调 */
.cover-inner.数学 {
  background: linear-gradient(150deg, #eff6ff 0%, #dbeafe 35%, #ffffff 100%);
  border-right: 1px solid #bfdbfe;
}
.cover-inner.物理 {
  background: linear-gradient(150deg, #fffbeb 0%, #fef3c7 35%, #ffffff 100%);
  border-right: 1px solid #fde68a;
}
.cover-inner.化学 {
  background: linear-gradient(150deg, #f0fdf4 0%, #dcfce7 35%, #ffffff 100%);
  border-right: 1px solid #bbf7d0;
}
.cover-inner.语文 {
  background: linear-gradient(150deg, #fdf2f8 0%, #fce7f3 35%, #ffffff 100%);
  border-right: 1px solid #fbcfe8;
}
.cover-inner.英语 {
  background: linear-gradient(150deg, #f5f3ff 0%, #ede9fe 35%, #ffffff 100%);
  border-right: 1px solid #ddd6fe;
}
.cover-inner.政治 {
  background: linear-gradient(150deg, #fff1f2 0%, #ffe4e6 35%, #ffffff 100%);
  border-right: 1px solid #fecdd3;
}
.cover-inner.历史 {
  background: linear-gradient(150deg, #fff7ed 0%, #ffedd5 35%, #ffffff 100%);
  border-right: 1px solid #fed7aa;
}
.cover-inner.地理 {
  background: linear-gradient(150deg, #f0fdfa 0%, #ccfbf1 35%, #ffffff 100%);
  border-right: 1px solid #99f6e4;
}
.cover-inner.生物 {
  background: linear-gradient(150deg, #f0fdf4 0%, #bbf7d0 35%, #ffffff 100%);
  border-right: 1px solid #86efac;
}

.cover-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.national-tag {
  font-size: 9px;
  font-weight: 700;
  color: #334155;
  letter-spacing: 0.8px;
}

.audited-badge {
  font-size: 8px;
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
  color: #64748b;
}

.cover-title-block {
  margin-top: 4px;
  text-align: center;
}

.cover-subject-name {
  font-size: 26px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: 4px;
  font-family: "Songti SC", "SimSun", "STSong", serif;
}

.cover-book-name {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
  margin-top: 2px;
}

/* 封面艺术矢量 */
.cover-art-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
}

.art-pattern-box {
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
}

.vector-art {
  width: 100%;
  height: 100%;
  opacity: 0.85;
}

.emoji-art {
  font-size: 40px;
}

.cover-subtitle {
  font-size: 9px;
  color: #64748b;
  text-align: center;
  line-height: 1.3;
  margin: 4px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cover-bottom-row {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.publisher-name {
  font-size: 9px;
  font-weight: 600;
  color: #475569;
}

.edition-label {
  font-size: 8px;
  color: #94a3b8;
}

/* 考点角标 */
.cover-pts-badge {
  position: absolute;
  top: 10px;
  right: -24px;
  background: #64748b;
  color: #ffffff;
  font-size: 8px;
  padding: 2px 24px;
  transform: rotate(45deg);
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  pointer-events: none;
  z-index: 3;
}

.cover-pts-badge.has-points {
  background: #10b981;
}

/* ======================================================== */
/* 阶段二：具体教材专心阅读视图 (Reader View)               */
/* ======================================================== */
.reader-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 顶栏 */
.reader-navbar {
  height: 56px;
  padding: 0 24px;
  background: var(--bg-card, #ffffff);
  border-bottom: 1px solid var(--border-subtle, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  transition: var(--theme-transition);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.back-shelf-btn {
  font-weight: 600;
}

.reader-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-sub, #475569);
}

.crumb-subject {
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.crumb-sep {
  color: var(--border-regular, #cbd5e1);
}

.crumb-book {
  color: #2563eb;
  font-weight: 700;
}

.crumb-chapter {
  color: var(--text-sub, #64748b);
}

.reader-points-badge {
  font-size: 12px;
  background: var(--bg-card-secondary, #f1f5f9);
  padding: 3px 8px;
  border-radius: 4px;
  color: var(--text-sub, #475569);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reader-search-input {
  width: 240px;
}

.drawer-trigger-btn {
  font-weight: 600;
}

/* 双栏阅读主体 */
.reader-split-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧章节目录 */
.reader-chapter-sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--bg-card, #ffffff);
  border-right: 1px solid var(--border-subtle, #e2e8f0);
  display: flex;
  flex-direction: column;
  transition: var(--theme-transition);
}

.chapter-sidebar-header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-subtle, #f1f5f9);
}

.book-title-tag {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main, #1e293b);
}

.chapter-nav-label {
  font-size: 11px;
  color: var(--text-sub, #94a3b8);
  margin-top: 2px;
}

.chapter-nav-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chapter-nav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  color: var(--text-regular, #334155);
  transition: all 0.12s;
}

.chapter-nav-btn:hover {
  background: var(--bg-card-secondary, #f1f5f9);
}

.chapter-nav-btn.active {
  background: #dbeafe !important;
  color: #1d4ed8 !important;
  font-weight: 600;
  border-color: #bfdbfe;
}

.chapter-nav-btn.all-btn {
  font-weight: 600;
  margin-bottom: 4px;
  background: var(--bg-card-secondary, #f8fafc);
}

.chapter-nav-btn.is-chapter-title {
  font-weight: 700;
  color: var(--text-main, #0f172a);
  background: var(--bg-card-secondary, #f1f5f9);
  margin-top: 6px;
  border: 1px solid var(--border-subtle, #e2e8f0);
}

.chapter-nav-btn.is-chapter-title:first-of-type {
  margin-top: 0;
}

.chapter-nav-btn.is-section-leaf {
  padding-left: 22px;
  color: var(--text-sub, #475569);
}

.ch-icon {
  font-size: 14px;
  color: var(--text-sub, #94a3b8);
}

.leaf-dot {
  color: var(--text-sub, #94a3b8);
  font-weight: bold;
}

.ch-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-num {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.05);
  padding: 0 5px;
  border-radius: 8px;
  color: var(--text-sub, #64748b);
}

/* 右侧宽屏卡片主体 */
.reader-main-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-page, #f8fafc);
  transition: var(--theme-transition);
}

.content-scroll-container {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px 28px 60px;
}

.active-chapter-banner {
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle, #e2e8f0);
}

.banner-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.active-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.active-count-tag {
  font-size: 12px;
  color: var(--text-sub, #64748b);
}

.points-card-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 宽屏单卡片 */
.wide-point-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  overflow: hidden;
}

.wide-point-card:hover {
  border-color: var(--border-regular, #cbd5e1);
  box-shadow: 0 4px 10px -2px rgba(0, 0, 0, 0.08);
}

.card-head {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: var(--bg-card, #ffffff);
  user-select: none;
  transition: var(--theme-transition);
}

.card-head:hover {
  background: var(--bg-card-secondary, #fafafa);
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.head-section-tag {
  font-size: 11px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
}

.head-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #1e293b);
}

.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.caret-toggle-btn {
  border: none;
  background: transparent;
  color: var(--text-sub, #94a3b8);
  font-size: 11px;
  cursor: pointer;
  padding: 4px;
  transition: transform 0.2s;
}

.caret-toggle-btn.rotated {
  transform: rotate(180deg);
}

.card-body-content {
  padding: 0 20px 20px;
  border-top: 1px solid var(--border-subtle, #f1f5f9);
}

.box-section {
  margin-top: 16px;
}

.box-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #334155);
  margin-bottom: 8px;
}

.bar {
  width: 3px;
  height: 12px;
  border-radius: 2px;
}

.bar.blue { background: #3b82f6; }
.bar.purple { background: #8b5cf6; }
.bar.amber { background: #f59e0b; }
.bar.green { background: #10b981; }

.box-inner-text {
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-regular, #334155);
}

.formula-content-render {
  background: var(--bg-card-secondary, #f8fafc);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-left: 3px solid #8b5cf6;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-main, #1e293b);
}

.formula-content-render :deep(.katex-display) {
  margin: 8px 0;
}

.tips-content-text {
  background: #fffbeb;
  border: 1px solid #fef3c7;
  border-left: 3px solid #f59e0b;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #92400e;
}

.visual-content-text {
  background: #f0fdf4;
  border: 1px solid #dcfce7;
  border-left: 3px solid #10b981;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #166534;
}

/* 空状态 */
.reader-empty-box {
  padding: 60px 20px;
  text-align: center;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-top: 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

/* ======================================================== */
/* 学习资源抽屉样式 (Drawer)                                */
/* ======================================================== */
.drawer-inner-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-top-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.resource-count-label {
  font-size: 12px;
  color: #64748b;
}

.drawer-group-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.drawer-category-title {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 8px;
}

.drawer-items-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-resource-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  padding: 10px 12px;
  transition: all 0.15s;
}

.drawer-resource-card:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}

.drawer-res-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.drawer-res-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-res-name {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.external-icon {
  font-size: 13px;
  color: #94a3b8;
}

.drawer-res-desc {
  font-size: 12px;
  color: #64748b;
  margin: 4px 0 0;
  line-height: 1.4;
}

.drawer-res-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
  border-top: 1px dashed #e2e8f0;
  padding-top: 6px;
}

.video-iframe-wrapper {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  height: 0;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.modal-footer-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-action-btns {
  display: flex;
  gap: 10px;
}
</style>
