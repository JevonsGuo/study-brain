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
  type SubjectTextbook
} from '../../utils/textbookCatalog'
import {
  SUBJECT_METAS,
  getTopicsForSubject,
  type SubjectMeta,
  type GaokaoTopic
} from '../../utils/gaokaoTopics'
import {
  Search, Plus, Edit, Delete, VideoPlay,
  Compass, TopRight, ArrowLeft, ArrowRight,
  Star, StarFilled, Check, RefreshRight
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

// 1. 视图层级判定：
// Level 1: !route.params.subject -> 展示全科学科大厅
// Level 2: route.params.subject -> 进入该学科的高考核心专题工作台
const isSubjectSelected = computed(() => Boolean(route.params.subject))
const activeSubject = ref('数学')

const currentCatalog = computed<SubjectTextbook | undefined>(() => {
  return getSubjectCatalog(activeSubject.value)
})

const currentSubjectMeta = computed<SubjectMeta | undefined>(() => {
  return SUBJECT_METAS[activeSubject.value]
})

// 2. 专题归集状态
const activeTopicId = ref<string>('all')
const topicFilterStatus = ref<'all' | 'starred' | 'mastered' | 'unmastered'>('all')
const starredPointIds = ref<Set<number>>(new Set())
const masteredPointIds = ref<Set<number>>(new Set())

// 3. 知识点数据
const allPoints = ref<KnowledgePoint[]>([])
const loadingPoints = ref(false)
const searchQuery = ref('')
const expandedPointIds = ref<Set<number>>(new Set())

// 4. 当前学科知识点列表
const subjectPoints = computed<KnowledgePoint[]>(() => {
  return allPoints.value.filter(p => p.subject === activeSubject.value)
})

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
const pointDialogTitle = ref('添加高考核心考点')
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
    const rawStarred = localStorage.getItem('study_starred_points') || localStorage.getItem('sharon_starred_points')
    if (rawStarred) {
      starredPointIds.value = new Set(JSON.parse(rawStarred))
    }
    const rawMastered = localStorage.getItem('study_mastered_points') || localStorage.getItem('sharon_mastered_points')
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
  localStorage.setItem('study_starred_points', JSON.stringify(Array.from(starredPointIds.value)))
}

const toggleMastered = (id: number) => {
  if (masteredPointIds.value.has(id)) {
    masteredPointIds.value.delete(id)
  } else {
    masteredPointIds.value.add(id)
  }
  localStorage.setItem('study_mastered_points', JSON.stringify(Array.from(masteredPointIds.value)))
}

// -------------------------------------------------------------
// Level 1: 全科学科大厅统计辅助函数
// -------------------------------------------------------------
const getSubjectPoints = (subName: string) => {
  return allPoints.value.filter(p => p.subject === subName)
}

const getSubjectTotalCount = (subName: string) => {
  return getSubjectPoints(subName).length
}

const getSubjectMasteredCount = (subName: string) => {
  const pts = getSubjectPoints(subName)
  return pts.filter(p => masteredPointIds.value.has(p.id)).length
}

const getSubjectMasteryPercent = (subName: string) => {
  const total = getSubjectTotalCount(subName)
  if (!total) return 0
  return Math.round((getSubjectMasteredCount(subName) / total) * 100)
}

const totalAllPoints = computed(() => allPoints.value.length)
const totalAllMastered = computed(() => allPoints.value.filter(p => masteredPointIds.value.has(p.id)).length)
const totalAllStarred = computed(() => allPoints.value.filter(p => starredPointIds.value.has(p.id)).length)

// -------------------------------------------------------------
// Level 2: 单科高考专题工作台计算属性
// -------------------------------------------------------------
const currentSubjectTopics = computed<GaokaoTopic[]>(() => {
  return getTopicsForSubject(activeSubject.value, subjectPoints.value)
})

const activeTopicObj = computed<GaokaoTopic | null>(() => {
  if (activeTopicId.value === 'all') return null
  return currentSubjectTopics.value.find(t => t.id === activeTopicId.value) || null
})

const getPointTopic = (p: KnowledgePoint): GaokaoTopic | undefined => {
  return currentSubjectTopics.value.find(t => t.match(p))
}

const getTopicPointCount = (topicId: string): number => {
  if (topicId === 'all') return subjectPoints.value.length
  const topic = currentSubjectTopics.value.find(t => t.id === topicId)
  if (!topic) return 0
  return subjectPoints.value.filter(p => topic.match(p)).length
}

const subjectStarredCount = computed(() => {
  return subjectPoints.value.filter(p => starredPointIds.value.has(p.id)).length
})

const subjectMasteredCount = computed(() => {
  return subjectPoints.value.filter(p => masteredPointIds.value.has(p.id)).length
})

const subjectUnmasteredCount = computed(() => {
  return Math.max(0, subjectPoints.value.length - subjectMasteredCount.value)
})

// 单科工作台下展示的考点列表（按专题、状态、关键词筛选）
const filteredSubjectPoints = computed<KnowledgePoint[]>(() => {
  let list = subjectPoints.value

  // 1. 专题过滤
  if (activeTopicId.value !== 'all') {
    const topic = currentSubjectTopics.value.find(t => t.id === activeTopicId.value)
    if (topic) {
      list = list.filter(p => topic.match(p))
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

// -------------------------------------------------------------
// 路由交互逻辑
// -------------------------------------------------------------
// 点击某学科卡片进入单科工作台
const enterSubject = (subjectName: string) => {
  activeSubject.value = subjectName
  activeTopicId.value = 'all'
  topicFilterStatus.value = 'all'
  searchQuery.value = ''
  fetchResources()
  router.push(`/knowledge/${encodeURIComponent(subjectName)}`)
}

// 返回全部学科大厅
const backToSubjectHall = () => {
  router.push('/knowledge')
}

// 快速切换至其他学科
const handleSwitchSubject = (subjectName: string) => {
  if (activeSubject.value === subjectName) return
  activeSubject.value = subjectName
  activeTopicId.value = 'all'
  topicFilterStatus.value = 'all'
  searchQuery.value = ''
  fetchResources()
  router.replace(`/knowledge/${encodeURIComponent(subjectName)}`)
}

// -------------------------------------------------------------
// API 数据请求
// -------------------------------------------------------------
const fetchAllKnowledge = async () => {
  loadingPoints.value = true
  try {
    const res = await api.get('/knowledge')
    allPoints.value = res as KnowledgePoint[]

    // 默认全部展开
    expandedPointIds.value = new Set(allPoints.value.map(p => p.id))
  } catch (err) {
    console.error('加载考点数据失败', err)
  } finally {
    loadingPoints.value = false
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
  const currentIds = filteredSubjectPoints.value.map(p => p.id)
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
const openAddPointDialog = () => {
  editingPoint.value = null
  pointDialogTitle.value = `添加考点 (${activeSubject.value})`
  pointForm.value = {
    subject: activeSubject.value,
    grade: '高三',
    book: '高考专题拓展',
    chapter: activeTopicObj.value ? activeTopicObj.value.name : '核心考点归集',
    title: '',
    content: '',
    key_formulas: '',
    tips: '',
    visual_desc: '',
    video_url: '',
    sort_order: subjectPoints.value.length + 1
  }
  pointDialogVisible.value = true
}

const openEditPointDialog = (p: KnowledgePoint) => {
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
    await fetchAllKnowledge()
  } catch {
    ElMessage.error('保存失败')
  }
}

const deletePoint = async (p: KnowledgePoint) => {
  try {
    await ElMessageBox.confirm(`确定要删除考点「${p.title}」吗？删除后不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    await api.del(`/knowledge/${p.id}`)
    ElMessage.success('删除成功')
    pointDialogVisible.value = false
    await fetchAllKnowledge()
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

// 同步路由状态
const syncStateFromRoute = () => {
  const paramSubject = route.params.subject as string | undefined
  if (paramSubject) {
    const sub = decodeURIComponent(paramSubject)
    if (SHANGHAI_TEXTBOOK_CATALOG.some(s => s.subject === sub)) {
      activeSubject.value = sub
    }
  }
}

watch(
  () => route.params.subject,
  () => {
    syncStateFromRoute()
    if (isSubjectSelected.value) {
      fetchResources()
    }
  }
)

onMounted(async () => {
  loadPersistedStatuses()
  syncStateFromRoute()
  await fetchAllKnowledge()
  if (isSubjectSelected.value) {
    await fetchResources()
  }
})
</script>

<template>
  <div class="knowledge-hub-container">
    <!-- ======================================================== -->
    <!-- Level 1: 全科学科大厅 (Subject Grid Hall)                -->
    <!-- ======================================================== -->
    <div v-if="!isSubjectSelected" class="hall-view-layout">
      <!-- 英雄标头 -->
      <header class="hall-hero-header">
        <div class="hall-hero-content">
          <div class="hall-badge">🎯 上海新高考</div>
          <h1 class="hall-hero-title">全科核心知识重点归集</h1>
          <p class="hall-hero-subtitle">
            以高考命题基准与新课标为核心 · 汇聚高中三年核心公式、提分大招与题型模型
          </p>

          <div class="hall-stats-bar">
            <div class="hall-stat-item">
              <span class="stat-num">{{ totalAllPoints }}</span>
              <span class="stat-lbl">已归集考点</span>
            </div>
            <div class="hall-stat-divider"></div>
            <div class="hall-stat-item">
              <span class="stat-num star">{{ totalAllStarred }}</span>
              <span class="stat-lbl">⭐️ 重点标记</span>
            </div>
            <div class="hall-stat-divider"></div>
            <div class="hall-stat-item">
              <span class="stat-num mastered">{{ totalAllMastered }}</span>
              <span class="stat-lbl">✅ 已掌握考点</span>
            </div>
            <div class="hall-stat-divider"></div>
            <div class="hall-stat-item">
              <span class="stat-num percent">
                {{ totalAllPoints ? Math.round((totalAllMastered / totalAllPoints) * 100) : 0 }}%
              </span>
              <span class="stat-lbl">总掌握率</span>
            </div>
          </div>
        </div>
      </header>

      <!-- 9 大学科网格卡片墙 -->
      <main class="hall-grid-container">
        <div class="subject-cards-grid">
          <div
            v-for="sub in SHANGHAI_TEXTBOOK_CATALOG"
            :key="sub.subject"
            class="subject-entry-card"
            @click="enterSubject(sub.subject)"
          >
            <!-- 卡片顶部彩色装饰条 -->
            <div
              class="card-top-accent"
              :style="{ background: SUBJECT_METAS[sub.subject]?.gradient || sub.gradient }"
            ></div>

            <div class="card-inner-body">
              <!-- 学科标题与徽标 -->
              <div class="card-header-row">
                <div class="subject-brand-group">
                  <span class="subject-big-emoji">{{ sub.emoji }}</span>
                  <div class="subject-title-meta">
                    <h2 class="subject-name">{{ sub.subject }}</h2>
                    <span class="subject-edition-tag">
                      {{ SUBJECT_METAS[sub.subject]?.edition || sub.edition }}
                    </span>
                  </div>
                </div>

                <div class="points-count-pill">
                  <strong>{{ getSubjectTotalCount(sub.subject) }}</strong> 考点
                </div>
              </div>

              <!-- 口号简介 -->
              <p class="subject-slogan">
                {{ SUBJECT_METAS[sub.subject]?.slogan || sub.desc }}
              </p>

              <!-- 重点专题预览标签云 -->
              <div class="preview-topics-cloud">
                <span
                  v-for="(tag, idx) in (SUBJECT_METAS[sub.subject]?.previewTopics || [])"
                  :key="idx"
                  class="preview-topic-tag"
                >
                  {{ tag }}
                </span>
              </div>

              <!-- 卡片底部掌握进度与进入箭头 -->
              <div class="card-bottom-footer">
                <div class="subject-mastery-progress">
                  <div class="progress-labels">
                    <span class="p-text">掌握进度</span>
                    <span class="p-val">
                      {{ getSubjectMasteredCount(sub.subject) }} / {{ getSubjectTotalCount(sub.subject) }}
                      ({{ getSubjectMasteryPercent(sub.subject) }}%)
                    </span>
                  </div>
                  <div class="p-track">
                    <div
                      class="p-bar"
                      :style="{
                        width: `${getSubjectMasteryPercent(sub.subject)}%`,
                        background: SUBJECT_METAS[sub.subject]?.color || '#3b82f6'
                      }"
                    ></div>
                  </div>
                </div>

                <div class="enter-action-btn">
                  <span>进入复习</span>
                  <el-icon><ArrowRight /></el-icon>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- ======================================================== -->
    <!-- Level 2: 单科高考核心专题工作台 (Subject Thematic Hub)     -->
    <!-- ======================================================== -->
    <div v-else class="subject-thematic-layout">
      <!-- 顶层工作台导航条 -->
      <header class="subject-navbar">
        <div class="nav-left">
          <!-- 返回学科大厅按钮 -->
          <button class="back-hall-btn" @click="backToSubjectHall">
            <el-icon><ArrowLeft /></el-icon>
            <span>全部科目</span>
          </button>

          <div class="nav-divider"></div>

          <!-- 面包屑与当前学科 -->
          <div class="subject-headline">
            <span class="headline-emoji">{{ currentCatalog?.emoji }}</span>
            <h1 class="headline-name">{{ activeSubject }}</h1>
            <span class="headline-edition">{{ currentSubjectMeta?.edition || currentCatalog?.edition }}</span>
          </div>

          <!-- 快速换科下拉胶囊 -->
          <div class="fast-subject-switcher">
            <button
              v-for="sub in SHANGHAI_TEXTBOOK_CATALOG"
              :key="sub.subject"
              class="mini-subject-chip"
              :class="{ active: activeSubject === sub.subject }"
              @click="handleSwitchSubject(sub.subject)"
            >
              {{ sub.emoji }} {{ sub.subject }}
            </button>
          </div>
        </div>

        <div class="nav-right">
          <!-- 学习资源抽屉按钮 -->
          <el-button
            type="warning"
            plain
            :icon="Compass"
            class="action-btn"
            @click="resourceDrawerVisible = true"
          >
            学习资源 ({{ resources.length }})
          </el-button>

          <!-- 新增考点按钮 -->
          <el-button
            type="primary"
            :icon="Plus"
            class="action-btn"
            @click="openAddPointDialog()"
          >
            新增知识点
          </el-button>
        </div>
      </header>

      <!-- 双栏工作台：左侧 10 大核心专题导航 + 右侧宽屏卡片流 -->
      <div class="thematic-split-body">
        <!-- 左侧 260px 专题导航侧边栏 -->
        <aside class="thematic-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-title">🎯 高考核心专题</div>
            <div class="sidebar-badge">共 {{ currentSubjectTopics.length }} 大专题</div>
          </div>

          <div class="sidebar-topics-scroll">
            <!-- 全部专题按钮 -->
            <button
              class="sidebar-topic-btn all-topics-btn"
              :class="{ active: activeTopicId === 'all' }"
              @click="activeTopicId = 'all'"
            >
              <div class="btn-left">
                <span class="t-icon">🌟</span>
                <span class="t-name">全部专题考点</span>
              </div>
              <span class="t-badge">{{ subjectPoints.length }}</span>
            </button>

            <!-- 核心专题列表 -->
            <div class="topics-menu-list">
              <button
                v-for="t in currentSubjectTopics"
                :key="t.id"
                class="sidebar-topic-btn"
                :class="{ active: activeTopicId === t.id }"
                :style="activeTopicId === t.id ? { borderLeftColor: t.color } : {}"
                @click="activeTopicId = t.id"
              >
                <div class="btn-left">
                  <span class="t-icon">{{ t.icon }}</span>
                  <div class="t-meta">
                    <span class="t-name">{{ t.shortName }}</span>
                    <span class="t-tag" :style="{ color: t.color }">{{ t.tag }}</span>
                  </div>
                </div>
                <span class="t-badge" :style="activeTopicId === t.id ? { background: t.color, color: '#fff' } : {}">
                  {{ getTopicPointCount(t.id) }}
                </span>
              </button>
            </div>
          </div>
        </aside>

        <!-- 右侧宽屏卡片流主体 -->
        <main v-loading="loadingPoints" class="thematic-content-main">
          <div class="main-scroll-container">
            <!-- 专题导读横幅 -->
            <div
              class="thematic-overview-banner"
              :style="activeTopicObj ? { background: activeTopicObj.bgGradient } : {}"
            >
              <div class="banner-left">
                <div class="banner-title-line">
                  <span class="banner-icon">{{ activeTopicObj ? activeTopicObj.icon : currentCatalog?.emoji }}</span>
                  <h2 class="banner-title">
                    {{ activeTopicObj ? activeTopicObj.name : `${activeSubject} · 上海高中三年核心考点归集通览` }}
                  </h2>
                  <span
                    v-if="activeTopicObj"
                    class="banner-tag"
                    :style="{ background: activeTopicObj.color, color: '#ffffff' }"
                  >
                    {{ activeTopicObj.tag }}
                  </span>
                </div>
                <p class="banner-desc">
                  {{ activeTopicObj ? activeTopicObj.desc : `${currentSubjectMeta?.slogan || ''} · 系统梳理高考核心概念、公式定理、解题提分大招与典型压轴模型。` }}
                </p>
              </div>

              <div class="banner-right">
                <div class="topic-mastery-card">
                  <div class="m-labels">
                    <span class="m-text">掌握进度</span>
                    <span class="m-num">
                      {{ subjectMasteredCount }} / {{ subjectPoints.length }}
                      ({{ subjectPoints.length ? Math.round((subjectMasteredCount / subjectPoints.length) * 100) : 0 }}%)
                    </span>
                  </div>
                  <div class="m-track">
                    <div
                      class="m-bar"
                      :style="{
                        width: `${subjectPoints.length ? Math.round((subjectMasteredCount / subjectPoints.length) * 100) : 0}%`
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 状态过滤与控制工具条 -->
            <div class="thematic-toolbar">
              <div class="toolbar-left">
                <!-- 状态过滤胶囊 -->
                <div class="status-segmented">
                  <button
                    class="status-tab"
                    :class="{ active: topicFilterStatus === 'all' }"
                    @click="topicFilterStatus = 'all'"
                  >
                    全部 ({{ activeTopicId === 'all' ? subjectPoints.length : getTopicPointCount(activeTopicId) }})
                  </button>
                  <button
                    class="status-tab"
                    :class="{ active: topicFilterStatus === 'starred' }"
                    @click="topicFilterStatus = 'starred'"
                  >
                    ⭐️ 重点标记 ({{ subjectStarredCount }})
                  </button>
                  <button
                    class="status-tab"
                    :class="{ active: topicFilterStatus === 'mastered' }"
                    @click="topicFilterStatus = 'mastered'"
                  >
                    ✅ 已掌握 ({{ subjectMasteredCount }})
                  </button>
                  <button
                    class="status-tab"
                    :class="{ active: topicFilterStatus === 'unmastered' }"
                    @click="topicFilterStatus = 'unmastered'"
                  >
                    ⏳ 待巩固 ({{ subjectUnmasteredCount }})
                  </button>
                </div>
              </div>

              <div class="toolbar-right">
                <el-input
                  v-model="searchQuery"
                  placeholder="搜索考点名称、公式、解题大招..."
                  :prefix-icon="Search"
                  clearable
                  class="thematic-search-input"
                />

                <el-button class="expand-toggle-btn" @click="toggleAllExpand">
                  {{ filteredSubjectPoints.every(p => expandedPointIds.has(p.id)) ? '全部收起' : '全部展开' }}
                </el-button>
              </div>
            </div>

            <!-- 考点卡片流 -->
            <div v-if="filteredSubjectPoints.length > 0" class="points-card-stack">
              <article
                v-for="p in filteredSubjectPoints"
                :key="p.id"
                class="wide-point-card"
                :class="{
                  expanded: expandedPointIds.has(p.id),
                  is_mastered: masteredPointIds.has(p.id),
                  is_starred: starredPointIds.has(p.id)
                }"
              >
                <!-- 卡片头部 -->
                <div class="card-head" @click="togglePointExpand(p.id)">
                  <div class="head-left">
                    <div class="head-badges">
                      <span
                        v-if="getPointTopic(p)"
                        class="topic-badge"
                        :style="{ color: getPointTopic(p)?.color, background: getPointTopic(p)?.bgGradient }"
                      >
                        {{ getPointTopic(p)?.icon }} {{ getPointTopic(p)?.shortName }}
                      </span>
                      <span v-if="p.book || p.chapter" class="source-badge">
                        {{ p.book }} {{ p.chapter ? '· ' + p.chapter : '' }}
                      </span>
                    </div>
                    <h3 class="head-title">{{ p.title }}</h3>
                  </div>

                  <div class="head-right" @click.stop>
                    <!-- 标星按钮 -->
                    <button
                      class="icon-action-btn star-btn"
                      :class="{ active: starredPointIds.has(p.id) }"
                      title="标记为高考重点"
                      @click="toggleStar(p.id)"
                    >
                      <el-icon v-if="starredPointIds.has(p.id)" color="#f59e0b"><StarFilled /></el-icon>
                      <el-icon v-else><Star /></el-icon>
                    </button>

                    <!-- 掌握切换按钮 -->
                    <button
                      class="mastery-toggle-btn"
                      :class="{ mastered: masteredPointIds.has(p.id) }"
                      @click="toggleMastered(p.id)"
                    >
                      <el-icon><Check /></el-icon>
                      <span>{{ masteredPointIds.has(p.id) ? '已掌握' : '待巩固' }}</span>
                    </button>

                    <!-- 视频名师精讲 -->
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

                    <!-- 编辑按钮 -->
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
                <div v-show="expandedPointIds.has(p.id)" class="card-body-content">
                  <!-- 核心概念解析 -->
                  <div v-if="p.content" class="box-section concept-box">
                    <div class="box-header">
                      <span class="bar blue"></span>
                      <span>📖 核心概念与考点解析</span>
                    </div>
                    <div class="box-inner-text" v-html="renderMathAndText(p.content)"></div>
                  </div>

                  <!-- 关键公式 (KaTeX) -->
                  <div v-if="p.key_formulas" class="box-section formula-box-wrap">
                    <div class="box-header">
                      <span class="bar purple"></span>
                      <span>⚡ 高考必备公式与重要定理 (KaTeX)</span>
                    </div>
                    <div class="formula-content-render" v-html="renderMathAndText(p.key_formulas)"></div>
                  </div>

                  <!-- 解题避坑 Tips -->
                  <div v-if="p.tips" class="box-section tips-box-wrap">
                    <div class="box-header">
                      <span class="bar amber"></span>
                      <span>💡 高考解题提分大招 & 避坑经验</span>
                    </div>
                    <div class="tips-content-text" v-html="renderMathAndText(p.tips)"></div>
                  </div>

                  <!-- 形象思维图景 -->
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
            <div v-else class="empty-result-box">
              <div class="empty-icon">🔍</div>
              <h3>未找到匹配的高考考点</h3>
              <p>您可以更换专题、清除搜索关键词或点击右上角“新增知识点”录入新考点。</p>
              <el-button
                type="primary"
                :icon="RefreshRight"
                @click="searchQuery = ''; activeTopicId = 'all'; topicFilterStatus = 'all'"
              >
                重置所有筛选
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
          <span class="resource-count-label">共 {{ resources.length }} 项精选资源</span>
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
            <el-form-item label="年级分册">
              <el-input v-model="pointForm.book" placeholder="如：选择性必修第一册" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item label="所属专题" required>
              <el-input v-model="pointForm.chapter" placeholder="如：第七章 解析几何" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序号">
              <el-input-number v-model="pointForm.sort_order" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="考点标题" required>
          <el-input v-model="pointForm.title" placeholder="如：圆锥曲线三大题型大招：点差法" />
        </el-form-item>

        <el-form-item label="核心概念">
          <el-input
            v-model="pointForm.content"
            type="textarea"
            :rows="4"
            placeholder="知识点详细解析（支持 LaTeX 公式 $$...$$）"
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

        <el-form-item label="提分大招">
          <el-input
            v-model="pointForm.tips"
            type="textarea"
            :rows="3"
            placeholder="解题经验、易错提示与高考提分大招"
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
.knowledge-hub-container {
  height: calc(100vh - 64px);
  overflow: hidden;
  background: var(--bg-page, #f8fafc);
  color: var(--text-main, #0f172a);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

/* ======================================================== */
/* Level 1: 全科学科大厅样式 (Hall View)                    */
/* ======================================================== */
.hall-view-layout {
  height: 100%;
  overflow-y: auto;
  padding: 24px 36px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.hall-hero-header {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 16px;
  padding: 32px 36px;
  color: #ffffff;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.12);
  position: relative;
  overflow: hidden;
}

.hall-hero-header::after {
  content: '📐';
  position: absolute;
  right: 40px;
  bottom: -20px;
  font-size: 140px;
  opacity: 0.06;
  pointer-events: none;
}

.hall-badge {
  display: inline-block;
  padding: 3px 10px;
  font-size: 11.5px;
  font-weight: 700;
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.15);
  border-radius: 6px;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.hall-hero-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.hall-hero-subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: #94a3b8;
  max-width: 680px;
  line-height: 1.6;
}

.hall-stats-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.hall-stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hall-stat-item .stat-num {
  font-size: 22px;
  font-weight: 800;
  color: #ffffff;
}

.hall-stat-item .stat-num.star {
  color: #fbbf24;
}

.hall-stat-item .stat-num.mastered {
  color: #34d399;
}

.hall-stat-item .stat-num.percent {
  color: #38bdf8;
}

.hall-stat-item .stat-lbl {
  font-size: 11.5px;
  color: #94a3b8;
}

.hall-stat-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.15);
}

/* 学科网格 */
.hall-grid-container {
  flex: 1;
}

.subject-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 1100px) {
  .subject-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .subject-cards-grid {
    grid-template-columns: 1fr;
  }
}

.subject-entry-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

@media (hover: hover) {
  .subject-entry-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
    border-color: #cbd5e1;
  }
}

.subject-entry-card:active {
  transform: scale(0.985);
}

.card-top-accent {
  height: 5px;
  width: 100%;
}

.card-inner-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.subject-brand-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.subject-big-emoji {
  font-size: 32px;
}

.subject-title-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.subject-name {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.subject-edition-tag {
  font-size: 11px;
  color: var(--text-sub, #64748b);
}

.points-count-pill {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
  background: #f1f5f9;
  color: #334155;
}

.points-count-pill strong {
  color: #2563eb;
  font-size: 14px;
}

.subject-slogan {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-sub, #64748b);
  line-height: 1.5;
}

.preview-topics-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
  flex: 1;
}

.preview-topic-tag {
  padding: 2px 8px;
  font-size: 11.5px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #475569;
}

.card-bottom-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
  gap: 12px;
}

.subject-mastery-progress {
  flex: 1;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 5px;
}

.progress-labels .p-text {
  color: #64748b;
}

.progress-labels .p-val {
  color: #0f172a;
}

.p-track {
  height: 6px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
}

.p-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.enter-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  color: #2563eb;
  padding: 6px 12px;
  border-radius: 6px;
  background: #eff6ff;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.subject-entry-card:hover .enter-action-btn {
  background: #2563eb;
  color: #ffffff;
}

/* ======================================================== */
/* Level 2: 单科高考核心专题工作台样式 (Subject View)        */
/* ======================================================== */
.subject-thematic-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 顶部导航条 */
.subject-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: var(--bg-card, #ffffff);
  border-bottom: 1px solid var(--border-subtle, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  z-index: 10;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.back-hall-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #cbd5e1);
  background: var(--bg-card, #ffffff);
  color: var(--text-main, #0f172a);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-hall-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.nav-divider {
  width: 1px;
  height: 20px;
  background: #e2e8f0;
}

.subject-headline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.headline-emoji {
  font-size: 22px;
}

.headline-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.headline-edition {
  font-size: 11.5px;
  color: var(--text-sub, #64748b);
  background: #f1f5f9;
  padding: 2px 7px;
  border-radius: 4px;
}

.fast-subject-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}

.mini-subject-chip {
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid var(--border-subtle, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: #475569;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.mini-subject-chip:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.mini-subject-chip.active {
  background: #3b82f6;
  color: #ffffff;
  border-color: #3b82f6;
  font-weight: 600;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 双栏工作台 */
.thematic-split-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧 260px 边栏 */
.thematic-sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--bg-card, #ffffff);
  border-right: 1px solid var(--border-subtle, #e2e8f0);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle, #f1f5f9);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.sidebar-badge {
  font-size: 11px;
  color: var(--text-sub, #64748b);
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
}

.sidebar-topics-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-topic-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.sidebar-topic-btn:hover {
  background: #f8fafc;
}

.sidebar-topic-btn.active {
  background: #f0f7ff;
  border: 1px solid #bfdbfe;
  border-left-width: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.btn-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.t-icon {
  font-size: 16px;
}

.t-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.t-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
}

.t-tag {
  font-size: 10.5px;
  font-weight: 600;
}

.t-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #64748b;
}

.all-topics-btn.active {
  border-left-color: #1e293b !important;
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.all-topics-btn.active .t-badge {
  background: #1e293b;
  color: #ffffff;
}

/* 右侧宽屏卡片流主体 */
.thematic-content-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.main-scroll-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 导读横幅 */
.thematic-overview-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid rgba(59, 130, 246, 0.15);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

.banner-left {
  flex: 1;
  max-width: 75%;
}

.banner-title-line {
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
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--text-sub, #475569);
  line-height: 1.5;
}

.banner-right {
  min-width: 190px;
}

.topic-mastery-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.m-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 5px;
}

.m-num {
  color: #10b981;
}

.m-track {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.m-bar {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 控制工具条 */
.thematic-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.status-segmented {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-card, #ffffff);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #e2e8f0);
}

.status-tab {
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

.status-tab:hover {
  color: var(--text-main, #0f172a);
}

.status-tab.active {
  background: var(--bg-page, #f1f5f9);
  color: #2563eb;
  font-weight: 700;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.thematic-search-input {
  width: 250px;
}

/* 考点卡片流 */
.points-card-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 24px;
}

.wide-point-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.wide-point-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.wide-point-card.is_mastered {
  border-left: 4px solid #10b981;
}

.wide-point-card.is_starred {
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.12);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  cursor: pointer;
  background: var(--bg-card, #ffffff);
  user-select: none;
}

.card-head:hover {
  background: #fafafa;
}

.head-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.head-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topic-badge {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
}

.source-badge {
  font-size: 11.5px;
  color: var(--text-sub, #64748b);
  background: #f1f5f9;
  padding: 2px 7px;
  border-radius: 4px;
}

.head-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.head-right {
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

/* 卡片内容区 */
.card-body-content {
  padding: 0 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: 1px solid var(--border-subtle, #f1f5f9);
}

.box-section {
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13.5px;
  line-height: 1.6;
}

.box-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 8px;
}

.bar {
  width: 4px;
  height: 14px;
  border-radius: 2px;
}

.bar.blue { background: #3b82f6; }
.bar.purple { background: #8b5cf6; }
.bar.amber { background: #f59e0b; }
.bar.green { background: #10b981; }

.concept-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.box-inner-text {
  color: #334155;
}

.formula-box-wrap {
  background: #fdf4ff;
  border: 1px solid #f0abfc;
}

.formula-content-render {
  color: #4a044e;
  font-family: "KaTeX_Main", "Times New Roman", serif;
  font-size: 14px;
}

.tips-box-wrap {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.tips-content-text {
  color: #78350f;
}

.visual-box-wrap {
  background: #ecfeff;
  border: 1px solid #a5f3fc;
}

.visual-content-text {
  color: #164e63;
}

.empty-result-box {
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

.empty-result-box .empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.empty-result-box h3 {
  margin: 0 0 8px;
  font-size: 17px;
  color: var(--text-main, #0f172a);
}

.empty-result-box p {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-sub, #64748b);
}

/* 抽屉样式 */
.drawer-inner-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.drawer-top-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 14px;
}

.resource-count-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.drawer-group-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-category-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
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
  padding: 10px 12px;
  background: #ffffff;
  transition: all 0.2s ease;
}

.drawer-resource-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.drawer-res-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.drawer-res-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer-res-name {
  font-size: 13px;
  font-weight: 600;
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
