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
  Search, Plus, Edit, Delete, VideoPlay,
  FolderOpened, Compass, TopRight, ArrowLeft,
  Collection
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

// 模式控制：'shelf' (教材书架) | 'reader' (沉浸式阅读器)
const currentMode = ref<'shelf' | 'reader'>('shelf')

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

// 2. 知识点数据
const points = ref<KnowledgePoint[]>([])
const loadingPoints = ref(false)
const searchQuery = ref('')
const expandedPointIds = ref<Set<number>>(new Set())

// 3. 统计数据（学科、分册、章节考点计数）
const subjectCounts = ref<Record<string, number>>({})
const bookCounts = ref<Record<string, number>>({})
const chapterCounts = ref<Record<string, number>>({})

// 4. 学习资源与抽屉
const resources = ref<LearningResource[]>([])
const resourceDrawerVisible = ref(false)
const resourceManageMode = ref(false)
const resourceDialogVisible = ref(false)
const resourceDialogTitle = ref('添加学习资源')
const editingResource = ref<LearningResource | null>(null)
const resourceForm = ref({ category: 'video', name: '', desc: '', url: '' })

// 5. 知识点弹窗表单
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

// 6. B站视频内嵌预览弹窗
const videoModalVisible = ref(false)
const currentVideoTitle = ref('')
const currentVideoEmbedUrl = ref('')

// 书架展示的分册列表（按筛选年级）
const filteredBooks = computed<TextbookBook[]>(() => {
  if (!currentCatalog.value) return []
  if (shelfGradeFilter.value === '全部') {
    return currentCatalog.value.books
  }
  return currentCatalog.value.books.filter(b => b.grade === shelfGradeFilter.value)
})

// 按年级分组的教材列表（在书架中整齐展示）
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

// 当前阅读器展示的知识点
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
      p.content.toLowerCase().includes(q) ||
      p.key_formulas.toLowerCase().includes(q) ||
      p.tips.toLowerCase().includes(q) ||
      p.visual_desc.toLowerCase().includes(q)
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

// 切换学科（书架上）
const handleSelectSubject = (subjectName: string) => {
  if (activeSubject.value === subjectName) return
  activeSubject.value = subjectName
  shelfGradeFilter.value = '全部'
  const catalog = getSubjectCatalog(subjectName)
  activeBook.value = catalog && catalog.books.length > 0 ? catalog.books[0].name : ''
  activeChapter.value = '全部'
  searchQuery.value = ''
  fetchSubjectKnowledge()
  fetchResources()
  router.replace({ path: `/knowledge/${encodeURIComponent(subjectName)}` })
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
    path: `/knowledge/${encodeURIComponent(activeSubject.value)}`
  })
}

// 数据请求
const fetchSubjectKnowledge = async () => {
  loadingPoints.value = true
  try {
    const res = await api.get(`/knowledge?subject=${encodeURIComponent(activeSubject.value)}`)
    points.value = res as KnowledgePoint[]

    expandedPointIds.value = new Set(
      points.value.filter(p => p.book === activeBook.value).map(p => p.id)
    )

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

const toggleAllExpand = () => {
  const currentIds = displayPoints.value.map(p => p.id)
  const allExpanded = currentIds.every(id => expandedPointIds.value.has(id))
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
    ElMessage.error('操作失败')
  }
}

const removeResource = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除该学习资源吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    await api.del(`/learning-resources/${id}`)
    await fetchResources()
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

// 路由监听与同步
const syncStateFromRoute = () => {
  const paramSubject = route.params.subject as string
  const paramBook = route.params.book as string

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
  } else {
    currentMode.value = 'shelf'
  }
}

watch(
  () => [route.params.subject, route.params.book],
  () => {
    syncStateFromRoute()
    fetchSubjectKnowledge()
    fetchResources()
  }
)

onMounted(async () => {
  syncStateFromRoute()
  await fetchGlobalStats()
  await fetchSubjectKnowledge()
  await fetchResources()
})
</script>

<template>
  <div class="knowledge-container">
    <!-- ======================================================== -->
    <!-- 阶段一：教材书架视图 (Shelf View)                        -->
    <!-- ======================================================== -->
    <div v-if="currentMode === 'shelf'" class="shelf-layout">
      <!-- 左侧科目导航 -->
      <aside class="shelf-sidebar">
        <div class="shelf-brand">
          <div class="brand-tag">上海新高考</div>
          <h2 class="brand-title">高中教材库</h2>
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
            <span v-if="subjectCounts[sub.subject]" class="sub-badge">
              {{ subjectCounts[sub.subject] }}
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

            <!-- 学习资源抽屉按钮 -->
            <el-button
              type="primary"
              plain
              class="resource-trigger-btn"
              :icon="Compass"
              @click="resourceDrawerVisible = true"
            >
              学习资源 ({{ resources.length }})
            </el-button>
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

                <!-- 矢量拟真封面兜底模式 -->
                <div v-else class="cover-inner" :class="activeSubject">
                  <!-- 顶部署名 -->
                  <div class="cover-top-row">
                    <span class="national-tag">普通高中教科书</span>
                    <span class="audited-badge">2020新课标</span>
                  </div>

                  <!-- 主标题与分册 -->
                  <div class="cover-title-block">
                    <div class="cover-subject-name">{{ activeSubject }}</div>
                    <div class="cover-book-name">{{ book.name }}</div>
                  </div>

                  <!-- 封面中央艺术/几何图样 -->
                  <div class="cover-art-zone">
                    <div class="art-pattern-box" :class="[activeSubject, book.grade]">
                      <!-- 数学几何抽象线框 -->
                      <svg v-if="activeSubject === '数学'" viewBox="0 0 100 100" class="vector-art">
                        <polygon points="50,15 85,35 85,70 50,90 15,70 15,35" fill="none" stroke="currentColor" stroke-width="1.8" />
                        <line x1="50" y1="15" x2="50" y2="90" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3,3" />
                        <line x1="15" y1="35" x2="85" y2="70" stroke="currentColor" stroke-width="1.2" />
                        <line x1="85" y1="35" x2="15" y2="70" stroke="currentColor" stroke-width="1.2" />
                        <circle cx="50" cy="52" r="14" fill="none" stroke="currentColor" stroke-width="1.5" />
                      </svg>
                      <!-- 物理原子轨道 -->
                      <svg v-else-if="activeSubject === '物理'" viewBox="0 0 100 100" class="vector-art">
                        <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(30 50 50)" />
                        <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(-30 50 50)" />
                        <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(90 50 50)" />
                        <circle cx="50" cy="50" r="6" fill="currentColor" />
                      </svg>
                      <!-- 化学分子结构 -->
                      <svg v-else-if="activeSubject === '化学'" viewBox="0 0 100 100" class="vector-art">
                        <polygon points="50,20 76,35 76,65 50,80 24,65 24,35" fill="none" stroke="currentColor" stroke-width="2" />
                        <circle cx="50" cy="20" r="4" fill="currentColor" />
                        <circle cx="76" cy="35" r="4" fill="currentColor" />
                        <circle cx="76" cy="65" r="4" fill="currentColor" />
                        <circle cx="50" cy="80" r="4" fill="currentColor" />
                        <circle cx="24" cy="65" r="4" fill="currentColor" />
                        <circle cx="24" cy="35" r="4" fill="currentColor" />
                      </svg>
                      <!-- 默认学科书籍图标 -->
                      <div v-else class="emoji-art">{{ currentCatalog?.emoji }}</div>
                    </div>
                  </div>

                  <!-- 封面副标题 -->
                  <div class="cover-subtitle">{{ book.subtitle }}</div>

                  <!-- 封面底部出版单位 -->
                  <div class="cover-bottom-row">
                    <span class="publisher-name">{{ currentCatalog?.publisher }}</span>
                    <span class="edition-label">{{ currentCatalog?.edition.split(' ')[0] }}</span>
                  </div>
                </div>

                <!-- 考点收录进度角标 -->
                <div class="cover-pts-badge" :class="{ 'has-points': bookCounts[book.name] }">
                  <span v-if="bookCounts[book.name]">{{ bookCounts[book.name] }} 考点已录入</span>
                  <span v-else>目录规划全 · 待录入</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>

    <!-- ======================================================== -->
    <!-- 阶段二：具体教材专心阅读视图 (Reader View)               -->
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

          <!-- 新增考点 -->
          <el-button
            type="primary"
            :icon="Plus"
            @click="openAddPointDialog()"
          >
            新增知识点
          </el-button>

          <!-- 抽屉触发按钮 -->
          <el-button
            type="warning"
            plain
            :icon="Compass"
            class="drawer-trigger-btn"
            @click="resourceDrawerVisible = true"
          >
            学习资源 ({{ resources.length }})
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
            placeholder="公式定理（如 $$a^2+b^2 \\ge 2ab$$）"
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
            placeholder="生动的视觉化图景记忆联想"
          />
        </el-form-item>

        <el-form-item label="视频链接">
          <el-input
            v-model="pointForm.video_url"
            placeholder="B站精讲地址 (https://www.bilibili.com/video/BV...)"
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
            删除此知识点
          </el-button>
          <div v-else></div>
          <div class="footer-action-btns">
            <el-button @click="pointDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="savePoint">保存考点</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 学习资源编辑弹窗 -->
    <el-dialog
      v-model="resourceDialogVisible"
      :title="resourceDialogTitle"
      width="500px"
      destroy-on-close
    >
      <el-form :model="resourceForm" label-width="80px">
        <el-form-item label="分类" required>
          <el-select v-model="resourceForm.category" style="width: 100%">
            <el-option label="🎬 视频精解" value="video" />
            <el-option label="📝 在线刷题 & 组卷" value="practice" />
            <el-option label="🔧 互动仿真与工具" value="tool" />
          </el-select>
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
.knowledge-container {
  height: calc(100vh - 64px);
  overflow: hidden;
  background: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
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
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.shelf-brand {
  padding: 18px 16px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.brand-tag {
  font-size: 11px;
  color: #64748b;
  letter-spacing: 0.5px;
}

.brand-title {
  margin: 4px 0 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
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
  background: #f8fafc;
}

.shelf-header {
  padding: 20px 28px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
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
  color: #0f172a;
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
  color: #64748b;
}

.subject-description {
  margin: 6px 0 0;
  font-size: 13px;
  color: #64748b;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 14px;
}

.grade-filter-segmented {
  display: flex;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 8px;
}

.segmented-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.segmented-btn.active {
  background: #ffffff;
  color: #0f172a;
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
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
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
  color: #475569;
}

.crumb-subject {
  font-weight: 700;
  color: #0f172a;
}

.crumb-sep {
  color: #cbd5e1;
}

.crumb-book {
  color: #2563eb;
  font-weight: 700;
}

.crumb-chapter {
  color: #64748b;
}

.reader-points-badge {
  font-size: 12px;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 4px;
  color: #475569;
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
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.chapter-sidebar-header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid #f1f5f9;
}

.book-title-tag {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.chapter-nav-label {
  font-size: 11px;
  color: #94a3b8;
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
  color: #334155;
  transition: all 0.12s;
}

.chapter-nav-btn:hover {
  background: #f1f5f9;
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
  background: #f8fafc;
}

.chapter-nav-btn.is-chapter-title {
  font-weight: 700;
  color: #0f172a;
  background: #f1f5f9;
  margin-top: 6px;
  border: 1px solid #e2e8f0;
}

.chapter-nav-btn.is-chapter-title:first-of-type {
  margin-top: 0;
}

.chapter-nav-btn.is-section-leaf {
  padding-left: 22px;
  color: #475569;
}

.ch-icon {
  font-size: 14px;
  color: #94a3b8;
}

.leaf-dot {
  color: #94a3b8;
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
  color: #64748b;
}

/* 右侧宽屏卡片主体 */
.reader-main-content {
  flex: 1;
  overflow-y: auto;
  background: #f8fafc;
}

.content-scroll-container {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px 28px 60px;
}

.active-chapter-banner {
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
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
  color: #0f172a;
}

.active-count-tag {
  font-size: 12px;
  color: #64748b;
}

.points-card-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 宽屏单卡片 */
.wide-point-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  overflow: hidden;
}

.wide-point-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 10px -2px rgba(0, 0, 0, 0.08);
}

.card-head {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: #ffffff;
  user-select: none;
}

.card-head:hover {
  background: #fafafa;
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
  color: #1e293b;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.caret-toggle-btn {
  border: none;
  background: transparent;
  color: #94a3b8;
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
  border-top: 1px solid #f1f5f9;
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
  color: #334155;
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
  color: #334155;
}

.formula-content-render {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #8b5cf6;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.8;
  color: #1e293b;
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
