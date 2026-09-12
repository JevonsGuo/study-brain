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
  ArrowRight,
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
  Right,
  TopRight,
  Tools,
  CopyDocument,
  FullScreen,
  Download
} from '@element-plus/icons-vue'
import { getVideoHubInfo, type VideoHubInfo } from '../../utils/videoSources'
import { useAppConfigStore } from '../../stores/appConfig'

const props = defineProps<{
  subject: string
}>()

const route = useRoute()
const router = useRouter()
const appConfig = useAppConfigStore()

// -------------------------------------------------------------
// 1. 工作台 Tab 切换管理 (核心考点库 vs 错题靶向本)
// -------------------------------------------------------------
const activeTab = ref<'knowledge' | 'wrong-book' | 'resources'>('knowledge')

const syncTabFromRoute = () => {
  const queryTab = route.query.tab as string
  if (queryTab === 'wrong-book' || queryTab === 'knowledge' || queryTab === 'resources') {
    activeTab.value = queryTab
  } else {
    activeTab.value = 'knowledge'
  }
}

const switchTab = (tab: 'knowledge' | 'wrong-book' | 'resources') => {
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
  user_note?: string
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

    // 默认考点与错题收起
    expandedPointIds.value = new Set()
    expandedWrongIds.value = new Set()
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
    const rawStarred = localStorage.getItem('study_starred_points') || localStorage.getItem('sharon_starred_points')
    if (rawStarred) starredPointIds.value = new Set(JSON.parse(rawStarred))
    const rawMastered = localStorage.getItem('study_mastered_points') || localStorage.getItem('sharon_mastered_points')
    if (rawMastered) masteredPointIds.value = new Set(JSON.parse(rawMastered))
  } catch (e) {
    console.error('Failed to load local statuses', e)
  }
}

const toggleStar = (id: number) => {
  if (starredPointIds.value.has(id)) starredPointIds.value.delete(id)
  else starredPointIds.value.add(id)
  localStorage.setItem('study_starred_points', JSON.stringify(Array.from(starredPointIds.value)))
}

const toggleMastered = (id: number) => {
  if (masteredPointIds.value.has(id)) masteredPointIds.value.delete(id)
  else masteredPointIds.value.add(id)
  localStorage.setItem('study_mastered_points', JSON.stringify(Array.from(masteredPointIds.value)))
}

const togglePointExpand = (id: number) => {
  if (expandedPointIds.value.has(id)) expandedPointIds.value.delete(id)
  else expandedPointIds.value.add(id)
}

const toggleWrongOnPoint = (id: number) => {
  if (expandedWrongOnPointIds.value.has(id)) expandedWrongOnPointIds.value.delete(id)
  else expandedWrongOnPointIds.value.add(id)
}

// 学生个人随堂笔记 (与官方考点分离的用户专属数据)
const editingNotePointId = ref<number | null>(null)
const tempNoteDraft = ref('')
const savingNote = ref(false)

const startEditNote = (p: KnowledgePoint) => {
  editingNotePointId.value = p.id
  tempNoteDraft.value = p.user_note || ''
}

const cancelEditNote = () => {
  editingNotePointId.value = null
  tempNoteDraft.value = ''
}

const saveStudentNote = async (p: KnowledgePoint) => {
  savingNote.value = true
  try {
    await api.put(`/knowledge/${p.id}/note`, { note: tempNoteDraft.value.trim() })
    p.user_note = tempNoteDraft.value.trim()
    editingNotePointId.value = null
    ElMessage.success('随堂笔记已保存')
  } catch (err) {
    console.error('Failed to save student note', err)
    ElMessage.error('保存笔记失败')
  } finally {
    savingNote.value = false
  }
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
    expandedPointIds.value = new Set(filteredPoints.value.map(p => p.id))
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

// 考点名师微课精选中心弹窗
const videoModalVisible = ref(false)
const currentVideoHub = ref<VideoHubInfo | null>(null)

const openVideoPreview = (
  pointOrTitle: KnowledgePoint | { title: string; subject?: string; chapter?: string; book?: string; url?: string; video_url?: string } | string,
  maybeUrl?: string
) => {
  let pObj: { title: string; subject: string; chapter?: string; book?: string; video_url?: string }

  if (typeof pointOrTitle === 'string') {
    pObj = {
      title: pointOrTitle,
      subject: props.subject,
      video_url: maybeUrl || ''
    }
  } else {
    pObj = {
      title: pointOrTitle.title,
      subject: ('subject' in pointOrTitle && pointOrTitle.subject) ? pointOrTitle.subject : props.subject,
      chapter: 'chapter' in pointOrTitle ? (pointOrTitle.chapter || '') : '',
      book: 'book' in pointOrTitle ? (pointOrTitle.book || '') : '',
      video_url: ('video_url' in pointOrTitle && pointOrTitle.video_url) ? pointOrTitle.video_url : ('url' in pointOrTitle ? (pointOrTitle.url || '') : '')
    }
  }

  currentVideoHub.value = getVideoHubInfo(pObj)
  videoModalVisible.value = true
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
    await appConfig.fetchVersion()
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
    await appConfig.fetchVersion()
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
const expandedWrongIds = ref<Set<number>>(new Set())

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
  if (expandedWrongIds.value.has(id)) {
    expandedWrongIds.value.delete(id)
  } else {
    expandedWrongIds.value.add(id)
  }
}

const areAllWrongExpanded = computed(() => {
  return filteredWrongItems.value.length > 0 && filteredWrongItems.value.every(i => expandedWrongIds.value.has(i.id))
})

const toggleExpandAllWrong = () => {
  if (areAllWrongExpanded.value) {
    expandedWrongIds.value = new Set()
  } else {
    expandedWrongIds.value = new Set(filteredWrongItems.value.map(i => i.id))
  }
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

// -------------------------------------------------------------
// 5. 学科工具箱与学习资源管理 (Tab 3)
// -------------------------------------------------------------
const resourceCategoryFilter = ref<'all' | 'tool' | 'practice' | 'video'>('all')
const resourceSearchQuery = ref('')

const resourceCategoryCounts = computed(() => {
  const counts = { all: resources.value.length, tool: 0, practice: 0, video: 0 }
  for (const r of resources.value) {
    if (r.category === 'tool') counts.tool++
    else if (r.category === 'practice') counts.practice++
    else if (r.category === 'video') counts.video++
  }
  return counts
})

const filteredResources = computed(() => {
  let list = resources.value
  if (resourceCategoryFilter.value !== 'all') {
    list = list.filter(r => r.category === resourceCategoryFilter.value)
  }
  if (resourceSearchQuery.value.trim()) {
    const q = resourceSearchQuery.value.trim().toLowerCase()
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.desc && r.desc.toLowerCase().includes(q)) ||
      r.url.toLowerCase().includes(q)
    )
  }
  return list
})

const getResourceDomain = (urlStr: string) => {
  try {
    const u = new URL(urlStr)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const getCategoryMeta = (cat: string) => {
  switch (cat) {
    case 'tool':
      return { label: '专属神器', icon: '🧰', badgeClass: 'tool-badge' }
    case 'practice':
      return { label: '权威题库', icon: '📝', badgeClass: 'practice-badge' }
    case 'video':
      return { label: '精选微课', icon: '🎬', badgeClass: 'video-badge' }
    default:
      return { label: '学习资源', icon: '🔗', badgeClass: 'default-badge' }
  }
}

const copyResourceUrl = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('已复制资源链接到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

// 在线内嵌试用 / 预览模态框
const previewModalVisible = ref(false)
const previewResource = ref<LearningResource | null>(null)

const isEmbedFriendly = (url: string) => {
  return /desmos\.com|geogebra\.org|ptable\.com|falstad\.com|molview\.org|nullschool\.net|stellarium-web\.org|worldmapper\.org|biodigital\.com/i.test(url)
}

const getEmbedUrl = (res: LearningResource) => {
  if (res.url.includes('geogebra.org/calculator')) {
    return 'https://www.geogebra.org/calculator'
  }
  return res.url
}

const openResourcePreview = (r: LearningResource) => {
  previewResource.value = r
  previewModalVisible.value = true
}

// 添加/编辑资源弹窗
const resourceDialogVisible = ref(false)
const resourceForm = ref({
  id: null as number | null,
  subject: props.subject,
  category: 'tool' as 'tool' | 'practice' | 'video',
  name: '',
  desc: '',
  url: '',
  sort_order: 10
})

const openAddResourceDialog = () => {
  resourceForm.value = {
    id: null,
    subject: props.subject,
    category: 'tool',
    name: '',
    desc: '',
    url: '',
    sort_order: resources.value.length + 1
  }
  resourceDialogVisible.value = true
}

const openEditResourceDialog = (r: LearningResource) => {
  resourceForm.value = {
    id: r.id,
    subject: r.subject,
    category: (r.category as any) || 'tool',
    name: r.name,
    desc: r.desc || '',
    url: r.url,
    sort_order: r.sort_order || 0
  }
  resourceDialogVisible.value = true
}

const saveResource = async () => {
  if (!resourceForm.value.name.trim() || !resourceForm.value.url.trim()) {
    ElMessage.warning('请填写资源名称和链接地址')
    return
  }
  try {
    if (resourceForm.value.id) {
      await api.put(`/learning-resources/${resourceForm.value.id}`, resourceForm.value)
      ElMessage.success('已更新学习资源')
    } else {
      await api.post('/learning-resources', resourceForm.value)
      ElMessage.success('已成功添加学习资源')
    }
    resourceDialogVisible.value = false
    await loadAllData()
    await appConfig.fetchVersion()
  } catch (err) {
    console.error('Failed to save resource', err)
    ElMessage.error('保存学习资源失败')
  }
}

const removeResource = async (r: LearningResource) => {
  try {
    await ElMessageBox.confirm(`确定要删除资源「${r.name}」吗？`, '删除确认', { type: 'warning' })
    await api.del(`/learning-resources/${r.id}`)
    ElMessage.success('已删除资源')
    await loadAllData()
    await appConfig.fetchVersion()
  } catch {
    // cancelled
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
    resourceCategoryFilter.value = 'all'
    resourceSearchQuery.value = ''
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
          <button
            type="button"
            class="seg-tab-btn"
            :class="{ active: activeTab === 'resources' }"
            @click="switchTab('resources')"
          >
            <el-icon><Tools /></el-icon>
            <span>学科工具箱 ({{ resources.length }})</span>
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
          v-else-if="activeTab === 'knowledge' && appConfig.isMaintenanceMode"
          type="primary"
          size="default"
          :icon="Plus"
          class="record-btn"
          @click="openAddPoint()"
        >
          添加考点
        </el-button>
        <el-button
          v-else-if="activeTab === 'resources' && appConfig.isMaintenanceMode"
          type="primary"
          size="default"
          :icon="Plus"
          class="record-btn"
          @click="openAddResourceDialog()"
        >
          推荐自选资源
        </el-button>

        <el-button
          v-if="appConfig.isMaintenanceMode"
          type="warning"
          plain
          size="default"
          :icon="Download"
          class="data-console-btn"
          @click="appConfig.showDataConsole = true"
        >
          📦 题库发布控制台
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
            <button
              class="expand-all-btn"
              @click="toggleExpandAll"
              :title="areAllPointsExpanded ? '点击收起全部考点' : '点击展开全部考点'"
            >
              <el-icon><component :is="areAllPointsExpanded ? Folder : FolderOpened" /></el-icon>
              <span>{{ areAllPointsExpanded ? '全部收起' : '全部展开' }}</span>
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
          <div class="card-top-row" @click="togglePointExpand(p.id)">
            <div class="point-meta-left">
              <el-icon class="fold-chevron" :class="{ 'is-expanded': expandedPointIds.has(p.id) }">
                <ArrowRight />
              </el-icon>
              <span class="core-point-badge">🎯 核心考点</span>
              <h3
                class="point-title"
                :title="expandedPointIds.has(p.id) ? '点击折叠考点详情' : '点击展开考点详情'"
              >
                {{ p.title }}
              </h3>
            </div>

            <div class="point-actions-right" @click.stop>
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

              <button
                v-if="appConfig.isMaintenanceMode"
                class="action-icon-btn"
                @click="openEditPoint(p)"
                title="编辑考点"
              >
                <el-icon><Edit /></el-icon>
              </button>

              <button
                v-if="appConfig.isMaintenanceMode"
                class="action-icon-btn delete-btn"
                @click="deletePoint(p)"
                title="删除考点"
              >
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

            <!-- 个人随堂笔记与避坑心得 (用户专属数据) -->
            <div class="point-block student-note-block">
              <div class="note-block-header">
                <span class="block-title">📝 我的随堂笔记 & 避坑心得</span>
                <el-button
                  v-if="editingNotePointId !== p.id"
                  size="small"
                  type="primary"
                  link
                  @click="startEditNote(p)"
                >
                  {{ p.user_note ? '✏️ 编辑笔记' : '+ 记下我的思路与易错心得' }}
                </el-button>
              </div>

              <!-- 编辑态 -->
              <div v-if="editingNotePointId === p.id" class="note-editor-box">
                <el-input
                  v-model="tempNoteDraft"
                  type="textarea"
                  :rows="3"
                  placeholder="写下你自己的理解、老师强调的特殊技巧或容易混淆的坑点..."
                  maxlength="1000"
                  show-word-limit
                />
                <div class="note-editor-actions">
                  <el-button size="small" @click="cancelEditNote">取消</el-button>
                  <el-button size="small" type="primary" :loading="savingNote" @click="saveStudentNote(p)">保存笔记</el-button>
                </div>
              </div>

              <!-- 显示态 -->
              <div v-else class="note-display-box">
                <div v-if="p.user_note" class="note-content-text">
                  {{ p.user_note }}
                </div>
                <div v-else class="note-empty-text">
                  暂无个人笔记，点击上方按钮记录你的思考与老师课堂点拨...
                </div>
              </div>
            </div>

            <!-- 考点名师微课精讲入口 -->
            <div class="point-video-row">
              <el-button
                type="danger"
                size="small"
                plain
                :icon="VideoPlay"
                @click="openVideoPreview(p)"
              >
                🎬 名师考点微课精讲
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

        <div v-if="loadingPoints && points.length === 0" class="workbench-loading-card">
          <div class="wb-loading-halo">
            <span class="wb-loading-emblem">📖</span>
          </div>
          <div class="wb-loading-title">正在下载【{{ subject }}】核心考点与重难点知识库...</div>
          <div class="wb-loading-sub">首次进入正在同步官方考点数据，请稍候...</div>
          <div class="wb-loading-bar-track">
            <div class="wb-loading-bar-thumb"></div>
          </div>
        </div>
        <div v-else-if="filteredPoints.length === 0" class="empty-points">
          <span>暂无符合条件的考点</span>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- TAB 2: 错题靶向本                                         -->
    <!-- ======================================================== -->
    <div v-else-if="activeTab === 'wrong-book'" class="wrong-tab-content" v-loading="loadingWrong">
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

          <button
            class="expand-all-btn"
            @click="toggleExpandAllWrong"
            :title="areAllWrongExpanded ? '点击收起全部错题' : '点击展开全部错题'"
          >
            <el-icon><component :is="areAllWrongExpanded ? Folder : FolderOpened" /></el-icon>
            <span>{{ areAllWrongExpanded ? '全部收起' : '全部展开' }}</span>
          </button>

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
              <el-icon class="fold-chevron" :class="{ 'is-expanded': expandedWrongIds.has(item.id) }">
                <ArrowRight />
              </el-icon>

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
          <div v-show="expandedWrongIds.has(item.id)" class="wrong-card-body">
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
    <!-- TAB 3: 学科工具箱与学习资源                               -->
    <!-- ======================================================== -->
    <div v-else-if="activeTab === 'resources'" class="resources-tab-content">
      <!-- 冻结顶栏：分类筛选 + 快速搜索 + 推荐添加 -->
      <div class="resource-toolbar">
        <div class="toolbar-left">
          <el-radio-group v-model="resourceCategoryFilter" size="default" class="category-radio-group">
            <el-radio-button value="all">
              🌟 全部神器 ({{ resourceCategoryCounts.all }})
            </el-radio-button>
            <el-radio-button value="tool">
              🧰 专属神器 ({{ resourceCategoryCounts.tool }})
            </el-radio-button>
            <el-radio-button value="practice">
              📝 权威题库 ({{ resourceCategoryCounts.practice }})
            </el-radio-button>
            <el-radio-button value="video">
              🎬 精选微课 ({{ resourceCategoryCounts.video }})
            </el-radio-button>
          </el-radio-group>
        </div>

        <div class="toolbar-right">
          <el-input
            v-model="resourceSearchQuery"
            placeholder="搜索工具、题库或资源关键词..."
            size="default"
            :prefix-icon="Search"
            clearable
            class="resource-search-input"
          />
          <el-button
            v-if="appConfig.isMaintenanceMode"
            type="primary"
            plain
            size="default"
            :icon="Plus"
            @click="openAddResourceDialog"
          >
            添加自选资源
          </el-button>
        </div>
      </div>

      <!-- 可滚动卡片流网格 (垂直滚动，顶栏完全冻结) -->
      <div class="resource-grid-wrapper">
        <div v-if="filteredResources.length > 0" class="resource-cards-grid">
          <div
            v-for="res in filteredResources"
            :key="res.id"
            class="resource-card"
            :class="`category-${res.category}`"
          >
            <!-- 卡片顶栏：分类徽章 + 来源域名 + 操作按钮 -->
            <div class="res-card-header">
              <div class="res-header-left">
                <span class="res-category-badge" :class="getCategoryMeta(res.category).badgeClass">
                  {{ getCategoryMeta(res.category).icon }} {{ getCategoryMeta(res.category).label }}
                </span>
                <span v-if="getResourceDomain(res.url)" class="res-domain-chip" :title="res.url">
                  {{ getResourceDomain(res.url) }}
                </span>
              </div>
              <div class="res-header-right">
                <button
                  class="res-icon-btn"
                  @click="copyResourceUrl(res.url)"
                  title="复制链接地址"
                >
                  <el-icon><CopyDocument /></el-icon>
                </button>
                <button
                  v-if="appConfig.isMaintenanceMode"
                  class="res-icon-btn"
                  @click="openEditResourceDialog(res)"
                  title="编辑"
                >
                  <el-icon><Edit /></el-icon>
                </button>
                <button
                  v-if="appConfig.isMaintenanceMode"
                  class="res-icon-btn delete-btn"
                  @click="removeResource(res)"
                  title="删除"
                >
                  <el-icon><Delete /></el-icon>
                </button>
              </div>
            </div>

            <!-- 卡片主体：资源名称 + 描述 -->
            <div class="res-card-body">
              <h3 class="res-title" :title="res.name">{{ res.name }}</h3>
              <p class="res-desc">{{ res.desc || '为高中学生打造的学科辅助精品资源与实用在线工具。' }}</p>
            </div>

            <!-- 卡片底栏：操作按钮组 -->
            <div class="res-card-footer">
              <!-- 在线嵌入试用 (若是交互工具) -->
              <button
                v-if="isEmbedFriendly(res.url)"
                class="res-btn-embed"
                @click="openResourcePreview(res)"
                title="在当前页面直接内嵌试用"
              >
                <el-icon><FullScreen /></el-icon>
                <span>在线试用</span>
              </button>

              <!-- 原站新窗口直达 -->
              <a
                :href="res.url"
                target="_blank"
                rel="noopener noreferrer"
                class="res-btn-direct"
                :title="`新窗口打开 ${res.name}`"
              >
                <span>🚀 原站直达</span>
                <el-icon><TopRight /></el-icon>
              </a>
            </div>
          </div>
        </div>

        <div v-else class="resource-empty">
          <div class="empty-icon">🧰</div>
          <p class="empty-text">未找到符合条件的学习资源或神器</p>
          <el-button type="primary" plain @click="resourceSearchQuery = ''; resourceCategoryFilter = 'all'">
            清空筛选
          </el-button>
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
      @open-video="openVideoPreview($event)"
    />

    <!-- 2. 考点微课精选中心弹窗 -->
    <el-dialog
      v-model="videoModalVisible"
      width="780px"
      destroy-on-close
      class="video-hub-dialog"
      :show-close="true"
    >
      <template #header>
        <div class="video-hub-header" v-if="currentVideoHub">
          <div class="hub-header-badge">🎬 高考名师考点微课精讲</div>
          <h3 class="hub-header-title">
            <span class="hub-sub-tag">【{{ currentVideoHub.subject }}】</span>
            {{ currentVideoHub.title }}
          </h3>
          <div v-if="currentVideoHub.book || currentVideoHub.chapter" class="hub-header-sub">
            <span>📚 所属章节：{{ currentVideoHub.book }} · {{ currentVideoHub.chapter }}</span>
          </div>
        </div>
      </template>

      <div class="video-hub-body" v-if="currentVideoHub">
        <!-- 权威平台直达卡片流 -->
        <div class="channel-cards-grid">
          <!-- 渠道 1: B 站名师精讲 (推荐首选) -->
          <div class="channel-card bili-card">
            <div class="channel-card-top">
              <div class="channel-brand">
                <span class="channel-icon">📺</span>
                <div>
                  <div class="channel-name-row">
                    <span class="channel-name">哔哩哔哩名师课堂</span>
                    <span class="channel-hot-tag">⭐ 强烈推荐</span>
                  </div>
                  <div class="channel-feature-tags">
                    <span class="feat-tag">1080P/4K 超清</span>
                    <span class="feat-tag">0.5~2.0x 倍速</span>
                    <span class="feat-tag">弹幕答疑</span>
                    <span class="feat-tag">原站免拦截</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="channel-recommend-teachers">
              <span class="teacher-lbl">🔥 推荐名师：</span>
              <span v-for="teacher in currentVideoHub.biliTeachers" :key="teacher" class="teacher-pill">
                {{ teacher }}
              </span>
            </div>

            <p class="channel-desc">
              {{ currentVideoHub.tips }} 聚合该考点播放量与点赞最高的名师公开课，原站原生播放体验最佳。
            </p>

            <a
              :href="currentVideoHub.bilibiliSearchUrl"
              target="_blank"
              class="channel-action-btn bili-btn"
            >
              <el-icon><VideoPlay /></el-icon>
              <span>在 B 站原站超清观看该考点精讲</span>
              <el-icon><TopRight /></el-icon>
            </a>
          </div>

          <!-- 渠道 2: 国家智慧教育平台 (教育部官方) -->
          <div class="channel-card smartedu-card">
            <div class="channel-card-top">
              <div class="channel-brand">
                <span class="channel-icon">🏛️</span>
                <div>
                  <div class="channel-name-row">
                    <span class="channel-name">国家中小学智慧教育平台</span>
                    <span class="channel-gov-tag">官方直属</span>
                  </div>
                  <div class="channel-feature-tags">
                    <span class="feat-tag">教育部官方</span>
                    <span class="feat-tag">统编教材同步</span>
                    <span class="feat-tag">零商业广告</span>
                    <span class="feat-tag">完全免费</span>
                  </div>
                </div>
              </div>
            </div>

            <p class="channel-desc">
              国家级公益性教育数字化云平台，教育部特级教师领衔录制，与统编教材新课标单元完全配套。
            </p>

            <a
              :href="currentVideoHub.smartEduUrl"
              target="_blank"
              class="channel-action-btn smartedu-btn"
            >
              <el-icon><Reading /></el-icon>
              <span>前往国家智慧教育云平台学习</span>
              <el-icon><TopRight /></el-icon>
            </a>
          </div>

          <!-- 渠道 3: 百度教育 / 题型微课 -->
          <div class="channel-card baidu-card">
            <div class="channel-card-top">
              <div class="channel-brand">
                <span class="channel-icon">🎓</span>
                <div>
                  <div class="channel-name-row">
                    <span class="channel-name">高考名校题型微课题解</span>
                    <span class="channel-sub-tag">拓展提分</span>
                  </div>
                  <div class="channel-feature-tags">
                    <span class="feat-tag">近五年高考真题</span>
                    <span class="feat-tag">解题大招</span>
                    <span class="feat-tag">避坑拆解</span>
                  </div>
                </div>
              </div>
            </div>

            <p class="channel-desc">
              聚合全国百强名校模拟题与高考真题针对该考点的模型题型拆解与易错坑点实战剖析。
            </p>

            <a
              :href="currentVideoHub.baiduSearchUrl"
              target="_blank"
              class="channel-action-btn baidu-btn"
            >
              <el-icon><Search /></el-icon>
              <span>搜索该考点高考题解微课</span>
              <el-icon><TopRight /></el-icon>
            </a>
          </div>
        </div>

        <!-- 如果配置了特选嵌入视频链接 -->
        <div v-if="currentVideoHub.hasDirectVideo" class="direct-embed-section">
          <div class="direct-section-header">
            <span class="section-title">📺 特选名师直链试播（已校对有效）</span>
            <a
              :href="currentVideoHub.directVideoUrl"
              target="_blank"
              class="origin-link-btn"
            >
              <el-icon><TopRight /></el-icon>
              <span>在原站全屏打开</span>
            </a>
          </div>

          <div class="video-iframe-container">
            <iframe
              :src="currentVideoHub.embedUrl"
              scrolling="no"
              border="0"
              frameborder="no"
              framespacing="0"
              allowfullscreen="true"
              referrerpolicy="no-referrer"
              sandbox="allow-top-navigation allow-same-origin allow-forms allow-scripts"
              class="video-iframe"
            ></iframe>
          </div>
          <div class="embed-hint-bar">
            <span>💡 提示：嵌入播放器受第三方防盗链限制可能黑屏或画质受限，点击右上角【在原站全屏打开】或上方【哔哩哔哩名师课堂】即可畅享 1080P 超清与倍速。</span>
          </div>
        </div>
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

    <!-- 6. 在线神器内嵌试用弹窗 -->
    <el-dialog
      v-model="previewModalVisible"
      width="90vw"
      top="4vh"
      destroy-on-close
      class="tool-preview-dialog"
      :show-close="true"
    >
      <template #header>
        <div class="tool-preview-header" v-if="previewResource">
          <div class="tool-preview-title-row">
            <span class="tool-preview-icon">💻</span>
            <span class="tool-preview-title">{{ previewResource.name }}</span>
            <span class="res-domain-chip">{{ getResourceDomain(previewResource.url) }}</span>
          </div>
          <div class="tool-preview-actions">
            <a
              :href="previewResource.url"
              target="_blank"
              rel="noopener noreferrer"
              class="open-external-link"
            >
              <span>新窗口全屏打开</span>
              <el-icon><TopRight /></el-icon>
            </a>
          </div>
        </div>
      </template>

      <div class="tool-preview-container" v-if="previewResource">
        <div class="tool-preview-hint-bar">
          <span>💡 提示：若部分原站因跨域安全策略阻止内嵌显示，请点击右上角「新窗口全屏打开」直接使用官方完整功能。</span>
        </div>
        <iframe
          :src="getEmbedUrl(previewResource)"
          class="tool-iframe"
          frameborder="0"
          allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        ></iframe>
      </div>
    </el-dialog>

    <!-- 7. 添加/编辑学习资源弹窗 -->
    <el-dialog
      v-model="resourceDialogVisible"
      :title="resourceForm.id ? '编辑学习资源' : '添加自选学习资源'"
      width="540px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="所属学科">
          <el-input :model-value="props.subject" disabled />
        </el-form-item>
        <el-form-item label="资源类型" required>
          <el-radio-group v-model="resourceForm.category">
            <el-radio value="tool">🧰 专属神器 (交互工具/沙盒)</el-radio>
            <el-radio value="practice">📝 权威题库 (组卷/模拟卷)</el-radio>
            <el-radio value="video">🎬 精选微课 (优质公开课)</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="资源名称" required>
          <el-input v-model="resourceForm.name" placeholder="例如：GeoGebra 动态几何、PhET 物理仿真..." />
        </el-form-item>
        <el-form-item label="链接地址 (URL)" required>
          <el-input v-model="resourceForm.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="核心特色 / 使用说明">
          <el-input
            v-model="resourceForm.desc"
            type="textarea"
            :rows="3"
            placeholder="简述该工具如何帮助高考学习，如：动态函数图像分析、历年真题精准组卷..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resourceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveResource">保存资源</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
:global(.app-main:has(.workbench-container)) {
  overflow-y: hidden;
}

.workbench-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 1400px;
  margin: 0 auto;
  height: calc(100vh - 48px);
  overflow: hidden;
}

/* 顶栏 */
.workbench-top-nav {
  flex-shrink: 0;
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
  gap: 14px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.topics-tags-panel {
  flex-shrink: 0;
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
  max-height: 120px;
  overflow-y: auto;
  scrollbar-width: thin;
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 6px;
  padding-bottom: 28px;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
}

.points-stream::-webkit-scrollbar,
.wrong-list::-webkit-scrollbar {
  width: 6px;
}

.points-stream::-webkit-scrollbar-thumb,
.wrong-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 4px;
}

.points-stream::-webkit-scrollbar-thumb:hover,
.wrong-list::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.6);
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
  cursor: pointer;
  user-select: none;
}

.fold-chevron {
  font-size: 13px;
  color: var(--text-muted, #94a3b8);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s;
  flex-shrink: 0;
}

.fold-chevron.is-expanded {
  transform: rotate(90deg);
  color: #2563eb;
}

.card-top-row:hover .fold-chevron,
.wrong-card-header:hover .fold-chevron {
  color: #2563eb;
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

.student-note-block {
  background: rgba(147, 51, 234, 0.04);
  border: 1px dashed rgba(147, 51, 234, 0.3);
}

.student-note-block .note-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.student-note-block .block-title {
  color: #7e22ce;
  margin-bottom: 0;
}

.student-note-block .note-editor-box {
  margin-top: 8px;
}

.student-note-block .note-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.student-note-block .note-display-box {
  font-size: 13px;
  line-height: 1.6;
}

.student-note-block .note-content-text {
  color: var(--text-main, #1e293b);
  white-space: pre-wrap;
  word-break: break-word;
}

.student-note-block .note-empty-text {
  color: var(--text-secondary, #94a3b8);
  font-style: italic;
  font-size: 12px;
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
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.wrong-dashboard {
  flex-shrink: 0;
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
  flex-shrink: 0;
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 6px;
  padding-bottom: 28px;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
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
  user-select: none;
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

.video-hub-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hub-header-badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #ef4444, #f97316);
  padding: 2px 8px;
  border-radius: 4px;
}

.hub-header-title {
  margin: 2px 0 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.hub-sub-tag {
  color: #2563eb;
}

.hub-header-sub {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.channel-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.channel-card {
  border-radius: 12px;
  padding: 14px 18px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s;
}

.channel-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.channel-card.bili-card {
  border-left: 5px solid #fb7299;
}

.channel-card.smartedu-card {
  border-left: 5px solid #0284c7;
}

.channel-card.baidu-card {
  border-left: 5px solid #f59e0b;
}

.channel-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.channel-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-icon {
  font-size: 26px;
  line-height: 1;
}

.channel-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.channel-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.channel-hot-tag {
  font-size: 11px;
  font-weight: 700;
  color: #e11d48;
  background: #ffe4e6;
  padding: 1px 6px;
  border-radius: 4px;
}

.channel-gov-tag {
  font-size: 11px;
  font-weight: 700;
  color: #0369a1;
  background: #e0f2fe;
  padding: 1px 6px;
  border-radius: 4px;
}

.channel-sub-tag {
  font-size: 11px;
  font-weight: 600;
  color: #d97706;
  background: #fef3c7;
  padding: 1px 6px;
  border-radius: 4px;
}

.channel-feature-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.feat-tag {
  font-size: 11px;
  color: var(--text-muted, #64748b);
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 6px;
  border-radius: 4px;
}

.channel-recommend-teachers {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
}

.teacher-lbl {
  font-weight: 600;
  color: #ea580c;
}

.teacher-pill {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #c2410c;
  padding: 1px 8px;
  border-radius: 12px;
  font-size: 11.5px;
  font-weight: 600;
}

.channel-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-sub, #475569);
  line-height: 1.5;
}

.channel-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
}

.channel-action-btn.bili-btn {
  background: linear-gradient(135deg, #fb7299, #f43f5e);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(251, 114, 153, 0.3);
}

.channel-action-btn.bili-btn:hover {
  background: linear-gradient(135deg, #f43f5e, #e11d48);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.45);
  transform: translateY(-1px);
}

.channel-action-btn.smartedu-btn {
  background: linear-gradient(135deg, #0284c7, #2563eb);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
}

.channel-action-btn.smartedu-btn:hover {
  background: linear-gradient(135deg, #0369a1, #1d4ed8);
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.45);
  transform: translateY(-1px);
}

.channel-action-btn.baidu-btn {
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-main, #334155);
  border: 1px solid var(--border-color, #cbd5e1);
}

.channel-action-btn.baidu-btn:hover {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #2563eb;
}

.direct-embed-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.direct-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.origin-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
}

.origin-link-btn:hover {
  text-decoration: underline;
}

.video-iframe-container {
  position: relative;
  width: 100%;
  height: 380px;
}

.video-iframe {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.embed-hint-bar {
  font-size: 11.5px;
  color: var(--text-muted, #64748b);
  background: var(--bg-page, #f8fafc);
  padding: 6px 10px;
  border-radius: 6px;
  line-height: 1.4;
}

/* 暗色模式适配 */
:global(.dark) .workbench-top-nav,
:global(.dark) .topics-tags-panel,
:global(.dark) .knowledge-card,
:global(.dark) .wrong-dashboard,
:global(.dark) .wrong-toolbar,
:global(.dark) .wrong-card,
:global(.dark) .wrong-card-header,
:global(.dark) .channel-card {
  background: #131b2e;
  border-color: #1e293b;
}

:global(.dark) .channel-name,
:global(.dark) .section-title,
:global(.dark) .hub-header-title {
  color: #f8fafc;
}

:global(.dark) .channel-desc {
  color: #94a3b8;
}

:global(.dark) .channel-action-btn.baidu-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
}

:global(.dark) .embed-hint-bar {
  background: rgba(255, 255, 255, 0.04);
  color: #94a3b8;
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

/* ========================================================= */
/* TAB 3: 学科工具箱与学习资源                               */
/* ========================================================= */
.resources-tab-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.resource-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 10px 16px;
  flex-wrap: wrap;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.category-radio-group :deep(.el-radio-button__inner) {
  font-weight: 600;
  padding: 8px 16px;
}

.resource-search-input {
  width: 260px;
}

.resource-grid-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.resource-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
  padding-bottom: 24px;
}

.resource-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.resource-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: transparent;
  transition: background 0.2s;
}

.resource-card.category-tool::before {
  background: linear-gradient(90deg, #10b981, #06b6d4);
}

.resource-card.category-practice::before {
  background: linear-gradient(90deg, #3b82f6, #6366f1);
}

.resource-card.category-video::before {
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}

.resource-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  border-color: #93c5fd;
}

.res-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.res-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.res-category-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
}

.tool-badge {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.practice-badge {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.video-badge {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.default-badge {
  background: rgba(100, 116, 139, 0.1);
  color: #475569;
  border: 1px solid rgba(100, 116, 139, 0.25);
}

.res-domain-chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #64748b;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 7px;
  border-radius: 5px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.res-icon-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.res-icon-btn:hover {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
}

.res-icon-btn.delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.res-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.res-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  line-height: 1.4;
}

.res-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted, #64748b);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.res-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #f1f5f9);
}

.res-btn-direct {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
  transition: all 0.2s;
}

.res-btn-direct:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.35);
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
}

.res-btn-embed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: rgba(16, 185, 129, 0.08);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.res-btn-embed:hover {
  background: rgba(16, 185, 129, 0.16);
  border-color: #059669;
  transform: translateY(-1px);
}

.resource-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  background: var(--bg-card, #ffffff);
  border: 1px dashed var(--border-color, #cbd5e1);
  border-radius: 16px;
}

.empty-icon {
  font-size: 40px;
}

.empty-text {
  font-size: 14px;
  color: var(--text-muted, #64748b);
  margin: 0;
}

/* 在线内嵌试用弹窗 */
.tool-preview-dialog :deep(.el-dialog__body) {
  padding: 0;
  height: 82vh;
  display: flex;
  flex-direction: column;
}

.tool-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 32px;
}

.tool-preview-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-preview-icon {
  font-size: 18px;
}

.tool-preview-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.open-external-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(37, 99, 235, 0.08);
  transition: all 0.2s;
}

.open-external-link:hover {
  background: rgba(37, 99, 235, 0.16);
}

.tool-preview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.tool-preview-hint-bar {
  padding: 8px 16px;
  background: #fef3c7;
  color: #92400e;
  font-size: 12px;
  font-weight: 500;
  border-bottom: 1px solid #fde68a;
  flex-shrink: 0;
}

.tool-iframe {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
}

/* 深色模式适配 */
:global(.dark) .resource-toolbar {
  background: #111827;
  border-color: #1f2937;
}

:global(.dark) .resource-card {
  background: #111827;
  border-color: #1f2937;
}

:global(.dark) .resource-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

:global(.dark) .res-title {
  color: #f8fafc;
}

:global(.dark) .res-domain-chip {
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
}

:global(.dark) .res-card-footer {
  border-top-color: #1f2937;
}

:global(.dark) .resource-empty {
  background: #111827;
  border-color: #1f2937;
}

:global(.dark) .tool-preview-hint-bar {
  background: #78350f;
  color: #fde68a;
  border-bottom-color: #92400e;
}

:global(.dark) .student-note-block {
  background: rgba(168, 85, 247, 0.08);
  border-color: rgba(168, 85, 247, 0.35);
}

:global(.dark) .student-note-block .block-title {
  color: #c084fc;
}

.workbench-loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 20px;
  background: var(--bg-card, #ffffff);
  border-radius: 18px;
  border: 1px solid var(--border-color, #e2e8f0);
  box-shadow: 0 4px 15px rgba(0,0,0,0.04);
  margin: 20px 0;
}

.wb-loading-halo {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  animation: halo-pulse 2s infinite ease-in-out;
}

.wb-loading-emblem {
  font-size: 28px;
}

.wb-loading-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin-bottom: 6px;
}

.wb-loading-sub {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  margin-bottom: 16px;
}

.wb-loading-bar-track {
  width: 180px;
  height: 4px;
  border-radius: 2px;
  background: rgba(99, 102, 241, 0.12);
  overflow: hidden;
  position: relative;
}

.wb-loading-bar-thumb {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(90deg, #6366f1, #3b82f6);
  border-radius: 2px;
  animation: bar-slide 1.5s infinite ease-in-out;
}

</style>
