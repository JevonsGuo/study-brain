<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { ElMessage, ElMessageBox, ElImageViewer } from 'element-plus'
import {
  Plus,
  Search,
  Delete,
  Edit,
  RefreshRight,
  ArrowDown,
  ArrowRight,
  Back,
  Check,
  View,
  Hide,
  FolderOpened,
  Folder,
  Picture as PictureIcon,
  WarningFilled,
  Right
} from '@element-plus/icons-vue'
import { subjectEmojis } from '../../utils/subjects'
import RichQuestionEditor from '../../components/RichQuestionEditor.vue'

interface WrongItem {
  id: number
  subject: string
  question: string
  reason: string
  mastery_status: 'unmastered' | 'learning' | 'mastered'
  review_count: number
  created_at: string
}

const route = useRoute()
const router = useRouter()

const wrongItems = ref<WrongItem[]>([])
const loading = ref(false)
const submitting = ref(false)

// 当前选中的学科（从路由参数中读取）
const currentSubject = computed(() => {
  return (route.params.subject as string) || ''
})

// 状态过滤 (全部 / 待攻克 / 练习中 / 已掌握)
const filterStatus = ref('')
const searchQuery = ref('')

// 分页状态
const currentPage = ref(1)
const pageSize = ref(10)

// 考前盲测模式（隐藏错因与解析）
const blindTestMode = ref(false)
const revealedMap = ref<Record<number, boolean>>({})

// 卡片折叠展开状态 (默认全折叠，高度只有 50px，信息密度高)
const expandedMap = ref<Record<number, boolean>>({})

// 严格按高考主次分类顺序排版：
// 第一排：语文、数学、英语
// 第二排：物理、化学、生物
// 第三排：历史、地理、政治
const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

// 学科科幻代号
const subjectCodeMap: Record<string, string> = {
  语文: 'CHN-01',
  数学: 'MTH-02',
  英语: 'ENG-03',
  物理: 'PHY-04',
  化学: 'CHM-05',
  生物: 'BIO-06',
  历史: 'HIS-07',
  地理: 'GEO-08',
  政治: 'POL-09'
}

// 学科英文名映射
const subjectEnMap: Record<string, string> = {
  语文: 'Chinese',
  数学: 'Mathematics',
  英语: 'English',
  物理: 'Physics',
  化学: 'Chemistry',
  生物: 'Biology',
  历史: 'History',
  地理: 'Geography',
  政治: 'Politics'
}

// 学科科技感主题视觉映射 (Cyber Tech HUD 质感，亮色/暗色双套体系)
const subjectThemeMap: Record<
  string,
  {
    gradient: string
    cardBg: string
    darkCardBg: string
    accent: string
    neon: string
    border: string
    darkBorder: string
    glow: string
  }
> = {
  语文: {
    gradient: 'linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)',
    cardBg: 'linear-gradient(145deg, #faf5ff 0%, #f3e8ff 50%, #ede9fe 100%)',
    darkCardBg: 'linear-gradient(145deg, #1e1333 0%, #17142b 50%, #111528 100%)',
    accent: '#7c3aed',
    neon: '#c084fc',
    border: '#ddd6fe',
    darkBorder: 'rgba(192, 132, 252, 0.32)',
    glow: 'rgba(124, 58, 237, 0.35)'
  },
  数学: {
    gradient: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
    cardBg: 'linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
    darkCardBg: 'linear-gradient(145deg, #0b1e36 0%, #0d233e 50%, #101c30 100%)',
    accent: '#0284c7',
    neon: '#38bdf8',
    border: '#bae6fd',
    darkBorder: 'rgba(56, 189, 248, 0.32)',
    glow: 'rgba(2, 132, 199, 0.35)'
  },
  英语: {
    gradient: 'linear-gradient(90deg, #db2777 0%, #f472b6 100%)',
    cardBg: 'linear-gradient(145deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)',
    darkCardBg: 'linear-gradient(145deg, #2b1021 0%, #241324 50%, #161528 100%)',
    accent: '#db2777',
    neon: '#f472b6',
    border: '#fbcfe8',
    darkBorder: 'rgba(244, 114, 182, 0.32)',
    glow: 'rgba(219, 39, 119, 0.35)'
  },
  物理: {
    gradient: 'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)',
    cardBg: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
    darkCardBg: 'linear-gradient(145deg, #2a1b08 0%, #241c12 50%, #171822 100%)',
    accent: '#d97706',
    neon: '#fbbf24',
    border: '#fde68a',
    darkBorder: 'rgba(251, 191, 36, 0.32)',
    glow: 'rgba(217, 119, 6, 0.35)'
  },
  化学: {
    gradient: 'linear-gradient(90deg, #059669 0%, #34d399 100%)',
    cardBg: 'linear-gradient(145deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)',
    darkCardBg: 'linear-gradient(145deg, #08241b 0%, #0c2621 50%, #101c24 100%)',
    accent: '#059669',
    neon: '#34d399',
    border: '#a7f3d0',
    darkBorder: 'rgba(52, 211, 153, 0.32)',
    glow: 'rgba(5, 150, 105, 0.35)'
  },
  生物: {
    gradient: 'linear-gradient(90deg, #16a34a 0%, #4ade80 100%)',
    cardBg: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)',
    darkCardBg: 'linear-gradient(145deg, #0a2516 0%, #0e271c 50%, #112022 100%)',
    accent: '#16a34a',
    neon: '#4ade80',
    border: '#bbf7d0',
    darkBorder: 'rgba(74, 222, 128, 0.32)',
    glow: 'rgba(22, 163, 74, 0.35)'
  },
  历史: {
    gradient: 'linear-gradient(90deg, #b45309 0%, #f59e0b 100%)',
    cardBg: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 50%, #fed7aa 100%)',
    darkCardBg: 'linear-gradient(145deg, #271609 0%, #221a15 50%, #171822 100%)',
    accent: '#b45309',
    neon: '#f59e0b',
    border: '#fed7aa',
    darkBorder: 'rgba(245, 158, 11, 0.32)',
    glow: 'rgba(180, 83, 9, 0.35)'
  },
  地理: {
    gradient: 'linear-gradient(90deg, #0891b2 0%, #22d3ee 100%)',
    cardBg: 'linear-gradient(145deg, #ecfeff 0%, #cffafe 50%, #a5f3fc 100%)',
    darkCardBg: 'linear-gradient(145deg, #09222b 0%, #0d262e 50%, #101c2a 100%)',
    accent: '#0891b2',
    neon: '#22d3ee',
    border: '#a5f3fc',
    darkBorder: 'rgba(34, 211, 238, 0.32)',
    glow: 'rgba(8, 145, 178, 0.35)'
  },
  政治: {
    gradient: 'linear-gradient(90deg, #e11d48 0%, #fb7185 100%)',
    cardBg: 'linear-gradient(145deg, #fff1f2 0%, #ffe4e6 50%, #fecdd3 100%)',
    darkCardBg: 'linear-gradient(145deg, #2c0e18 0%, #23121d 50%, #161524 100%)',
    accent: '#e11d48',
    neon: '#fb7185',
    border: '#fecdd3',
    darkBorder: 'rgba(251, 113, 133, 0.32)',
    glow: 'rgba(225, 29, 72, 0.35)'
  }
}

// 快速原因标签
const reasonPresets = ['计算失误', '审题不清', '概念模糊', '公式记错', '缺乏思路', '忽略隐含条件', '步骤不规范']

// 新增错题弹窗
const addDialogVisible = ref(false)
const newItem = ref({
  subject: '数学',
  question: '',
  reason: '',
  mastery_status: 'unmastered' as const
})

// 编辑错题弹窗
const editDialogVisible = ref(false)
const editForm = ref({
  id: 0,
  subject: '',
  question: '',
  reason: '',
  mastery_status: 'unmastered' as 'unmastered' | 'learning' | 'mastered',
  review_count: 0
})

// 大图画廊灯箱查看器状态
const viewerVisible = ref(false)
const viewerUrlList = ref<string[]>([])
const viewerIndex = ref(0)

// 掌握状态映射配置
const statusConfig = {
  unmastered: { label: '待攻克', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: '🔴' },
  learning: { label: '练习中', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '🟡' },
  mastered: { label: '已掌握', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', icon: '🟢' }
}

// 全局总览统计 (阶段一门户用)
const overallStats = computed(() => {
  const total = wrongItems.value.length
  const unmastered = wrongItems.value.filter((i) => i.mastery_status === 'unmastered').length
  const learning = wrongItems.value.filter((i) => i.mastery_status === 'learning').length
  const mastered = wrongItems.value.filter((i) => i.mastery_status === 'mastered').length
  const rate = total > 0 ? Math.round((mastered / total) * 100) : 0
  return { total, unmastered, learning, mastered, rate }
})

// 单学科统计 (阶段二单科页用)
const currentSubjectStats = computed(() => {
  if (!currentSubject.value) return { total: 0, unmastered: 0, learning: 0, mastered: 0, rate: 0 }
  return getSubjectStats(currentSubject.value)
})

// 获取单个学科统计指标
const getSubjectStats = (subj: string) => {
  const items = wrongItems.value.filter((i) => i.subject === subj)
  const total = items.length
  const unmastered = items.filter((i) => i.mastery_status === 'unmastered').length
  const learning = items.filter((i) => i.mastery_status === 'learning').length
  const mastered = items.filter((i) => i.mastery_status === 'mastered').length
  const rate = total > 0 ? Math.round((mastered / total) * 100) : 0
  return { total, unmastered, learning, mastered, rate }
}

// 筛选单科下的错题列表
const filteredItems = computed(() => {
  if (!currentSubject.value) return []
  return wrongItems.value.filter((item) => {
    const matchSubject = item.subject === currentSubject.value
    const matchStatus = !filterStatus.value || item.mastery_status === filterStatus.value
    const matchSearch =
      !searchQuery.value.trim() ||
      item.question.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.reason.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchSubject && matchStatus && matchSearch
  })
})

// 分页数据
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredItems.value.slice(start, start + pageSize.value)
})

const fetchWrongItems = async () => {
  loading.value = true
  try {
    wrongItems.value = await api.get('/wrong-items')
  } catch (e: unknown) {
    ElMessage.error('加载错题失败: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

const selectedSubjectAnim = ref('')
const isTransitioning = ref(false)

// 导航：进入学科错题集 (原地中心 180° 翻转 -> 放大至全屏淡化消失 -> 错题内容平滑淡入)
const selectSubject = (subj: string) => {
  if (isTransitioning.value) return
  isTransitioning.value = true
  selectedSubjectAnim.value = subj
  // 原地翻转约 370ms，反面就绪后以极其丝滑的平缓镜头向前放大至全屏消散；在 680ms 切换路由接力淡入
  setTimeout(() => {
    router.push(`/wrong-book/${encodeURIComponent(subj)}`)
    setTimeout(() => {
      selectedSubjectAnim.value = ''
      isTransitioning.value = false
    }, 500)
  }, 680)
}

// 导航：返回学科门户 (平滑过渡收回)
const backToHub = () => {
  if (isTransitioning.value) return
  isTransitioning.value = true
  router.push('/wrong-book')
  setTimeout(() => {
    isTransitioning.value = false
  }, 380)
}

// 折叠展开控制
const toggleExpand = (id: number) => {
  expandedMap.value[id] = !expandedMap.value[id]
}

const expandAll = () => {
  paginatedItems.value.forEach((item) => {
    expandedMap.value[item.id] = true
  })
}

const collapseAll = () => {
  expandedMap.value = {}
}

// 清除搜索词和状态过滤
const clearSearchAndFilter = () => {
  searchQuery.value = ''
  filterStatus.value = ''
}

// 原地切换错题掌握状态
const updateItemStatus = async (item: WrongItem, newStatus: 'unmastered' | 'learning' | 'mastered') => {
  if (item.mastery_status === newStatus) return
  const oldStatus = item.mastery_status
  item.mastery_status = newStatus
  try {
    await api.put(`/wrong-items/${item.id}`, { mastery_status: newStatus })
    ElMessage.success(`已标记为「${statusConfig[newStatus].label}」`)
  } catch {
    item.mastery_status = oldStatus
    ElMessage.error('状态更新失败')
  }
}

// 复习次数自增
const incrementReview = async (item: WrongItem) => {
  const newCount = (item.review_count || 0) + 1
  item.review_count = newCount
  try {
    await api.put(`/wrong-items/${item.id}`, { review_count: newCount })
    ElMessage.success(`复习打卡成功！这道题已累计复习 ${newCount} 次`)
  } catch {
    item.review_count -= 1
    ElMessage.error('打卡记录失败')
  }
}

// 盲测揭晓
const revealReason = (id: number) => {
  revealedMap.value[id] = true
}

// 快速点选错因标签
const selectPresetReason = (tag: string, target: 'new' | 'edit' = 'new') => {
  const form = target === 'new' ? newItem.value : editForm.value
  if (!form.reason) {
    form.reason = tag
  } else if (!form.reason.includes(tag)) {
    form.reason += `、${tag}`
  }
}

// 打开录入弹窗 (若在单科视图下，学科自动锁定)
const openAddDialog = (presetSubj?: string) => {
  newItem.value = {
    subject: presetSubj || currentSubject.value || '数学',
    question: '',
    reason: '',
    mastery_status: 'unmastered'
  }
  addDialogVisible.value = true
}

// 提交录入
const addWrongItem = async () => {
  if (!newItem.value.subject) {
    ElMessage.warning('请先选择错题所属科目')
    return
  }

  const textCheck = newItem.value.question.replace(/<[^>]+>/g, '').trim()
  const hasImg = /<img/i.test(newItem.value.question)
  if (!textCheck && !hasImg) {
    ElMessage.warning('请填写题目文字或插入错题截图')
    return
  }

  const finalReason = newItem.value.reason.trim() || '待分析/未注明原因'

  submitting.value = true
  try {
    await api.post('/wrong-items', {
      subject: newItem.value.subject,
      question: newItem.value.question.trim(),
      reason: finalReason,
      mastery_status: newItem.value.mastery_status
    })
    addDialogVisible.value = false
    await fetchWrongItems()
    ElMessage.success('错题录入成功！')
  } catch (e: unknown) {
    ElMessage.error('添加失败: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    submitting.value = false
  }
}

// 打开编辑弹窗
const openEdit = (item: WrongItem) => {
  editForm.value = {
    id: item.id,
    subject: item.subject,
    question: item.question,
    reason: item.reason,
    mastery_status: item.mastery_status || 'unmastered',
    review_count: item.review_count || 0
  }
  editDialogVisible.value = true
}

// 保存编辑
const saveEdit = async () => {
  const textCheck = editForm.value.question.replace(/<[^>]+>/g, '').trim()
  const hasImg = /<img/i.test(editForm.value.question)
  if (!textCheck && !hasImg) {
    ElMessage.warning('题目内容不能为空')
    return
  }

  try {
    await api.put(`/wrong-items/${editForm.value.id}`, {
      subject: editForm.value.subject,
      question: editForm.value.question.trim(),
      reason: editForm.value.reason.trim() || '待分析/未注明原因',
      mastery_status: editForm.value.mastery_status,
      review_count: editForm.value.review_count
    })
    editDialogVisible.value = false
    await fetchWrongItems()
    ElMessage.success('修改成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

// 删除错题（严格二次确认）
const removeItem = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这道错题记录吗？删除后不可恢复。', '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    await api.del(`/wrong-items/${id}`)
    await fetchWrongItems()
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

// 提取折叠时的第一行作为标题
const getSummaryText = (raw: string) => {
  if (!raw) return '（无文字题干）'

  // 1. 将 HTML 块级标签和换行符标准化为 \n
  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '') // 移除所有 HTML 标签
    .replace(/!\[(.*?)\]\([^)]+\)/g, '') // 移除 Markdown 图片
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

  // 2. 按行拆分，获取第一行非空文字
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length > 0) {
    const firstLine = lines[0]
    return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine
  }

  // 3. 若无文本但含图片
  if (/<img/i.test(raw) || /!\[(.*?)\]\(.*?\)/.test(raw)) {
    return '📷 错题图片（点击展开查看卷面）'
  }

  return '（空题目）'
}

// 判断题目是否含有图片
const hasImageAttachment = (raw: string) => {
  return /<img/i.test(raw) || /!\[(.*?)\]\(.*?\)/.test(raw)
}

// 格式化与兼容渲染题干 HTML
const renderQuestionHtml = (raw: string) => {
  if (!raw) return ''
  let processed = raw

  // 1. 兼容历史 Markdown 图片格式
  const imgRegex = /!\[(.*?)\]\((data:image\/[^;]+;base64,[^)]+|https?:\/\/[^)]+)\)/g
  processed = processed.replace(imgRegex, (_match, _alt, src) => {
    return `<div class="rich-img-wrapper" style="text-align: left; margin: 8px 0;"><img src="${src}" class="rich-question-img" style="width: 50%; max-width: 100%; border-radius: 6px; cursor: zoom-in;" alt="错题图" /></div>`
  })

  // 2. 清洗历史未闭合的残破 Base64 截断文本
  processed = processed.replace(/!\[(.*?)\]\(data:image\/[a-zA-Z0-9+/=,;:_-]*/g, '')

  // 3. 纯文本换行转换为 <br>
  const isHtml = /<[a-z][\s\S]*>/i.test(processed)
  if (!isHtml) {
    processed = processed.replace(/\n/g, '<br>')
  }

  return processed
}

// 点击卡片中的图片，弹出全屏高清画廊
const handleCardClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target && target.tagName === 'IMG') {
    const currentSrc = (target as HTMLImageElement).src
    const cardEl = target.closest('.foldable-card')
    const allImgs = cardEl ? Array.from(cardEl.querySelectorAll('img')).map((img) => img.src) : [currentSrc]
    viewerUrlList.value = allImgs
    viewerIndex.value = Math.max(0, allImgs.indexOf(currentSrc))
    viewerVisible.value = true
  }
}

// 切换学科或路由时重置分页与过滤
watch(
  () => currentSubject.value,
  () => {
    currentPage.value = 1
    filterStatus.value = ''
    searchQuery.value = ''
    expandedMap.value = {}
  }
)

onMounted(fetchWrongItems)
</script>

<template>
  <div class="wrong-book-page">
    <Transition name="stage-transition" mode="out-in">
      <!-- ======================================================== -->
      <!-- 阶段一：学科错题门户视图 (Subject Hub)                    -->
      <!-- ======================================================== -->
      <div v-if="!currentSubject" key="hub" class="subject-hub-view">
        <!-- 顶栏：标题 + 核心录入大按钮 -->
        <div class="page-top-header">
          <div class="title-left-col">
            <h2 class="page-title">📝 错题集录 · 学科专区</h2>
            <span class="sub-counter">专科专治 · 靶向逐个消灭薄弱盲区 · 考前冲刺满分利器</span>
          </div>

          <div class="top-action-cluster">
            <el-button
              type="primary"
              size="large"
              :icon="Plus"
              class="prominent-add-btn"
              @click="openAddDialog()"
            >
              录入新错题
            </el-button>
            <el-button
              :icon="RefreshRight"
              circle
              size="default"
              class="refresh-btn"
              @click="fetchWrongItems"
              title="刷新列表"
            />
          </div>
        </div>

        <!-- 全科总览统计卡片 -->
        <div class="hub-overall-banner">
          <div class="overall-stat-group">
            <div class="stat-pill-item">
              <span class="stat-pill-label">全科总错题</span>
              <span class="stat-pill-val">{{ overallStats.total }}</span>
            </div>
            <div class="stat-pill-item unmastered-pill">
              <span class="stat-pill-label">🔴 待攻克</span>
              <span class="stat-pill-val">{{ overallStats.unmastered }}</span>
            </div>
            <div class="stat-pill-item learning-pill">
              <span class="stat-pill-label">🟡 练习中</span>
              <span class="stat-pill-val">{{ overallStats.learning }}</span>
            </div>
            <div class="stat-pill-item mastered-pill">
              <span class="stat-pill-label">🟢 已掌握</span>
              <span class="stat-pill-val">{{ overallStats.mastered }}</span>
            </div>
          </div>

          <div class="overall-progress-box">
            <div class="progress-title-line">
              <span>综合攻克进度</span>
              <span class="rate-bold">{{ overallStats.rate }}%</span>
            </div>
            <el-progress
              :percentage="overallStats.rate"
              :stroke-width="8"
              :color="overallStats.rate >= 80 ? '#10b981' : overallStats.rate >= 50 ? '#3b82f6' : '#f59e0b'"
              :show-text="false"
            />
          </div>
        </div>

        <!-- 9 大学科错题本卡片网格 (严格 3x3 布局，科技 HUD 风格) -->
        <div
          class="subject-grid-layout"
          :class="{ 'has-launching': !!selectedSubjectAnim }"
          v-loading="loading"
        >
          <div
            v-for="s in subjects"
            :key="s"
            class="subject-book-card"
            :class="{ 'is-flipped': selectedSubjectAnim === s }"
            :style="{
              '--card-light-bg': subjectThemeMap[s]?.cardBg || '#ffffff',
              '--card-dark-bg': subjectThemeMap[s]?.darkCardBg || '#131b2e',
              '--card-light-border': subjectThemeMap[s]?.border || '#e2e8f0',
              '--card-dark-border': subjectThemeMap[s]?.darkBorder || '#1e293b',
              '--card-glow': subjectThemeMap[s]?.glow || 'rgba(0,0,0,0.08)',
              '--card-accent': subjectThemeMap[s]?.accent || '#3b82f6',
              '--card-neon': subjectThemeMap[s]?.neon || '#38bdf8'
            }"
            @click="selectSubject(s)"
          >
            <div class="card-3d-flipper">
              <!-- 正面 (Front Face)：学科概览与指标 -->
              <div class="card-face card-face-front cyber-card">
                <!-- 科技流光能量顶部横条 -->
                <div
                  class="card-color-stripe"
                  :style="{ background: subjectThemeMap[s]?.gradient || '#3b82f6' }"
                />

                <div class="card-inner-body">
                  <!-- 科技 HUD 状态条 (编号 + 呼吸灯) -->
                  <div class="card-hud-topline">
                    <span class="hud-code">{{ subjectCodeMap[s] || 'SUBJ-00' }}</span>
                    <span class="hud-status-indicator">
                      <span class="pulse-dot" />
                      ONLINE
                    </span>
                  </div>

                  <div class="card-head-row">
                    <div class="subject-meta">
                      <span class="subject-emoji">{{ subjectEmojis[s] || '📚' }}</span>
                      <div class="subject-names">
                        <h3 class="subject-cn">{{ s }}</h3>
                        <span class="subject-en">{{ subjectEnMap[s] || 'Subject' }}</span>
                      </div>
                    </div>

                    <!-- 错题总数科技 HUD 徽标 -->
                    <div class="total-count-badge">
                      <span class="count-num">
                        {{ getSubjectStats(s).total }}
                      </span>
                      <span class="count-unit">ITEMS</span>
                    </div>
                  </div>

                  <!-- 科技能量槽进度条 -->
                  <div class="card-progress-section">
                    <div class="progress-label-row">
                      <span class="prog-caption">MASTERY RATE</span>
                      <span class="prog-val">
                        {{ getSubjectStats(s).rate }}%
                      </span>
                    </div>
                    <div class="cyber-progress-track">
                      <div
                        class="cyber-progress-fill"
                        :style="{
                          width: `${getSubjectStats(s).rate}%`,
                          background: subjectThemeMap[s]?.gradient || '#3b82f6'
                        }"
                      />
                    </div>
                  </div>

                  <!-- 状态分布微型胶囊 (三态全覆盖：待攻克、练习中、已攻克) -->
                  <div class="card-status-badges">
                    <span class="sub-status-pill unmastered">
                      🔴 {{ getSubjectStats(s).unmastered }} 待攻克
                    </span>
                    <span class="sub-status-pill learning">
                      🟡 {{ getSubjectStats(s).learning }} 练习中
                    </span>
                    <span class="sub-status-pill mastered">
                      🟢 {{ getSubjectStats(s).mastered }} 已攻克
                    </span>
                  </div>

                  <!-- 底部进入操作引导 (科技终端风格) -->
                  <div class="card-enter-action">
                    <span class="enter-text">INITIALIZE // 接入{{ s }}错题库</span>
                    <el-icon class="enter-icon"><Right /></el-icon>
                  </div>
                </div>
              </div>

              <!-- 反面 (Back Face)：错题库载入接入舱视图 -->
              <div class="card-face card-face-back cyber-card">
                <!-- 顶部流光色带 -->
                <div
                  class="card-color-stripe"
                  :style="{ background: subjectThemeMap[s]?.gradient || '#3b82f6' }"
                />

                <div class="card-back-body">
                  <!-- 顶部 HUD：终端连接状态 -->
                  <div class="card-hud-topline">
                    <span class="hud-code">TERMINAL // {{ subjectCodeMap[s] || 'SEC-00' }}</span>
                    <span class="hud-status-indicator back-syncing">
                      <span class="pulse-dot active" />
                      LINKING
                    </span>
                  </div>

                  <!-- 中部：学科徽记发光环与错题库就绪状态 -->
                  <div class="card-back-hero">
                    <div class="back-avatar-ring">
                      <span class="back-hero-emoji">{{ subjectEmojis[s] || '📚' }}</span>
                      <div class="back-ring-halo" />
                    </div>
                    <div class="back-hero-text">
                      <h3 class="back-subject-title">{{ s }} · 错题库</h3>
                      <p class="back-subject-sub">WORKBENCH MOUNTED</p>
                    </div>
                  </div>

                  <!-- 动态高能注入槽 -->
                  <div class="card-back-loader">
                    <div class="back-loader-info">
                      <span class="loader-label">ARCHIVE DECRYPT</span>
                      <span class="loader-status">100% READY</span>
                    </div>
                    <div class="back-loader-track">
                      <div
                        class="back-loader-fill"
                        :style="{ background: subjectThemeMap[s]?.gradient || '#3b82f6' }"
                      />
                    </div>
                  </div>

                  <!-- 底部提示文字 -->
                  <div class="card-back-footer">
                    <span class="back-foot-text">DECRYPTING ARCHIVES...</span>
                    <span class="back-foot-cue">即刻进入专区 &gt;&gt;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 阶段二：单学科沉浸式错题集录 (Subject Focused View)       -->
    <!-- ======================================================== -->
    <div v-else key="focused" class="subject-focused-view">
      <!-- 沉浸式顶栏：返回按钮 + 当前学科标题 + 指标胶囊 + 录入按钮 -->
      <div class="focused-top-header">
        <div class="header-left-cluster">
          <el-button
            :icon="Back"
            size="default"
            class="back-hub-btn"
            @click="backToHub"
          >
            返回学科专区
          </el-button>

          <div class="subject-title-box">
            <span class="focused-emoji">{{ subjectEmojis[currentSubject] || '📚' }}</span>
            <h2 class="focused-title">{{ currentSubject }} 错题集录</h2>
          </div>
        </div>

        <div class="header-right-cluster">
          <el-button
            type="primary"
            size="large"
            :icon="Plus"
            class="prominent-add-btn"
            @click="openAddDialog(currentSubject)"
          >
            录入 {{ currentSubject }} 错题
          </el-button>
          <el-button
            :icon="RefreshRight"
            circle
            size="default"
            class="refresh-btn"
            @click="fetchWrongItems"
            title="刷新列表"
          />
        </div>
      </div>

      <!-- 单科战况看板 (极简无噪) -->
      <div class="single-subject-dashboard">
        <div class="dashboard-stats-grid">
          <div
            class="stat-capsule"
            :class="{ active: filterStatus === '' }"
            @click="filterStatus = ''"
          >
            <span class="stat-num">{{ currentSubjectStats.total }}</span>
            <span class="stat-name">全部错题</span>
          </div>

          <div
            class="stat-capsule unmastered-stat"
            :class="{ active: filterStatus === 'unmastered' }"
            @click="filterStatus = 'unmastered'"
          >
            <span class="stat-num">{{ currentSubjectStats.unmastered }}</span>
            <span class="stat-name">🔴 待攻克</span>
          </div>

          <div
            class="stat-capsule learning-stat"
            :class="{ active: filterStatus === 'learning' }"
            @click="filterStatus = 'learning'"
          >
            <span class="stat-num">{{ currentSubjectStats.learning }}</span>
            <span class="stat-name">🟡 练习中</span>
          </div>

          <div
            class="stat-capsule mastered-stat"
            :class="{ active: filterStatus === 'mastered' }"
            @click="filterStatus = 'mastered'"
          >
            <span class="stat-num">{{ currentSubjectStats.mastered }}</span>
            <span class="stat-name">🟢 已掌握</span>
          </div>
        </div>

        <div class="dashboard-progress-area">
          <div class="progress-info-row">
            <span class="progress-title">{{ currentSubject }}攻克进度</span>
            <span class="progress-percent">{{ currentSubjectStats.rate }}%</span>
          </div>
          <el-progress
            :percentage="currentSubjectStats.rate"
            :stroke-width="8"
            :color="currentSubjectStats.rate >= 80 ? '#10b981' : currentSubjectStats.rate >= 50 ? '#3b82f6' : '#f59e0b'"
            :show-text="false"
          />
        </div>
      </div>

      <!-- 单科纯净过滤与控制工具条 (彻底移除了跨学科切换栏) -->
      <div class="focused-filter-toolbar">
        <!-- 状态快捷单选 -->
        <el-radio-group v-model="filterStatus" size="small" class="status-toggle-group">
          <el-radio-button value="">全部 ({{ currentSubjectStats.total }})</el-radio-button>
          <el-radio-button value="unmastered">🔴 待攻克 ({{ currentSubjectStats.unmastered }})</el-radio-button>
          <el-radio-button value="learning">🟡 练习中 ({{ currentSubjectStats.learning }})</el-radio-button>
          <el-radio-button value="mastered">🟢 已掌握 ({{ currentSubjectStats.mastered }})</el-radio-button>
        </el-radio-group>

        <!-- 右侧交互控件群 -->
        <div class="control-right-cluster">
          <!-- 考前盲测模式开关 -->
          <div class="blind-switch-wrap" :class="{ 'is-active': blindTestMode }">
            <el-switch
              v-model="blindTestMode"
              size="small"
              inline-prompt
              :active-icon="Hide"
              :inactive-icon="View"
            />
            <span class="blind-switch-label">🙈 考前盲测模式</span>
          </div>

          <!-- 全部展开/折叠 -->
          <div class="fold-btns">
            <el-button
              size="small"
              :icon="FolderOpened"
              @click="expandAll"
              title="全部展开当前页"
            >
              展开
            </el-button>
            <el-button
              size="small"
              :icon="Folder"
              @click="collapseAll"
              title="全部折叠当前页"
            >
              折叠
            </el-button>
          </div>

          <!-- 关键词搜索框 -->
          <el-input
            v-model="searchQuery"
            placeholder="搜索题目、错因关键词..."
            :prefix-icon="Search"
            clearable
            size="small"
            class="search-input-box"
          />
        </div>
      </div>

      <!-- 错题紧凑折叠列表 -->
      <div class="wrong-items-container" v-loading="loading">
        <div
          v-for="item in paginatedItems"
          :key="item.id"
          class="foldable-card"
          :class="{
            'is-expanded': expandedMap[item.id],
            [`status-${item.mastery_status || 'unmastered'}`]: true
          }"
        >
          <!-- 紧凑单行行头 (高度 50px，信息密度高) -->
          <div class="card-compact-row" @click="toggleExpand(item.id)">
            <div class="row-left-info">
              <!-- 展开/折叠指示箭头 -->
              <el-icon class="expand-arrow-icon">
                <ArrowDown v-if="expandedMap[item.id]" />
                <ArrowRight v-else />
              </el-icon>

              <!-- 掌握状态药丸 (原地点击切换) -->
              <el-dropdown trigger="click" @click.stop>
                <span
                  class="status-pill"
                  :style="{
                    color: statusConfig[item.mastery_status || 'unmastered'].color,
                    backgroundColor: statusConfig[item.mastery_status || 'unmastered'].bg,
                    borderColor: statusConfig[item.mastery_status || 'unmastered'].border
                  }"
                >
                  {{ statusConfig[item.mastery_status || 'unmastered'].icon }}
                  {{ statusConfig[item.mastery_status || 'unmastered'].label }}
                  <el-icon class="pill-down-icon"><ArrowDown /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="updateItemStatus(item, 'unmastered')">
                      🔴 设为待攻克
                    </el-dropdown-item>
                    <el-dropdown-item @click="updateItemStatus(item, 'learning')">
                      🟡 设为练习中
                    </el-dropdown-item>
                    <el-dropdown-item @click="updateItemStatus(item, 'mastered')">
                      🟢 设为已掌握
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <!-- 题干一行摘要 -->
              <span class="summary-text" :title="getSummaryText(item.question)">
                {{ getSummaryText(item.question) }}
              </span>

              <!-- 是否含图片的小标识 -->
              <span
                v-if="hasImageAttachment(item.question)"
                class="has-img-badge"
                title="含卷面截图"
              >
                <el-icon><PictureIcon /></el-icon> 图
              </span>
            </div>

            <div class="row-right-actions" @click.stop>
              <!-- 错因标签 -->
              <span v-if="item.reason" class="reason-summary-tag">
                {{ item.reason.length > 12 ? item.reason.slice(0, 12) + '...' : item.reason }}
              </span>

              <span class="date-tag">{{ item.created_at?.split(' ')[0] }}</span>

              <el-button
                size="small"
                type="primary"
                link
                :icon="Edit"
                @click="openEdit(item)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                type="danger"
                link
                :icon="Delete"
                @click="removeItem(item.id)"
              >
                删除
              </el-button>
            </div>
          </div>

          <!-- 展开后的完整详情区域 -->
          <transition name="expand">
            <div v-if="expandedMap[item.id]" class="card-detail-body">
              <!-- 完整的所见即所得图文排版 -->
              <div
                class="full-question-box rich-card-body"
                @click="handleCardClick"
                v-html="renderQuestionHtml(item.question)"
              />

              <!-- 错因分析区域 (盲测模式下进行磨砂遮挡) -->
              <div class="detail-reason-container">
                <div
                  v-if="blindTestMode && !revealedMap[item.id]"
                  class="blind-overlay-box"
                >
                  <div class="blind-notice">
                    <el-icon class="blind-icon"><WarningFilled /></el-icon>
                    <span>🙈 考前盲测中：错因分析已隐藏，请先在草稿纸上独立重做思考！</span>
                  </div>
                  <el-button
                    type="warning"
                    size="small"
                    plain
                    :icon="View"
                    @click="revealReason(item.id)"
                  >
                    揭晓错因与反思
                  </el-button>
                </div>

                <div v-else class="revealed-reason-content">
                  <div class="reason-header-line">
                    <span class="reason-caption">💡 错因归因与解题反思</span>
                    <span v-if="blindTestMode" class="revealed-tag">（已揭晓）</span>
                  </div>
                  <div class="reason-text-desc">{{ item.reason }}</div>
                </div>
              </div>

              <!-- 卡片底部生命周期流转与打卡工具条 -->
              <div class="card-lifecycle-toolbar">
                <div class="status-change-buttons">
                  <span class="change-label">切换掌握状态：</span>
                  <el-button
                    size="small"
                    :type="item.mastery_status === 'unmastered' ? 'danger' : 'default'"
                    plain
                    @click="updateItemStatus(item, 'unmastered')"
                  >
                    🔴 待攻克
                  </el-button>
                  <el-button
                    size="small"
                    :type="item.mastery_status === 'learning' ? 'warning' : 'default'"
                    plain
                    @click="updateItemStatus(item, 'learning')"
                  >
                    🟡 练习中
                  </el-button>
                  <el-button
                    size="small"
                    :type="item.mastery_status === 'mastered' ? 'success' : 'default'"
                    plain
                    @click="updateItemStatus(item, 'mastered')"
                  >
                    🟢 已掌握
                  </el-button>
                </div>

                <div class="review-counter-actions">
                  <span class="review-times-badge">
                    已复习 <b>{{ item.review_count || 0 }}</b> 次
                  </span>
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    :icon="Check"
                    @click="incrementReview(item)"
                  >
                    重做打卡 +1
                  </el-button>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- 空状态：区分搜索/过滤无匹配 vs 真正无错题 -->
        <div v-if="filteredItems.length === 0 && !loading" class="empty-state-box">
          <!-- 场景 A: 搜索或状态过滤无匹配结果 -->
          <template v-if="searchQuery.trim() || filterStatus">
            <div class="empty-emoji">🔍</div>
            <p class="empty-title">未找到匹配的错题</p>
            <p class="empty-desc">
              <span v-if="searchQuery.trim()">没有找到包含关键词 “<b>{{ searchQuery }}</b>” 的错题，</span>
              <span v-else>当前状态下没有符合条件的错题，</span>
              可以尝试更换关键词或重置筛选。
            </p>
            <el-button size="default" @click="clearSearchAndFilter">
              清除搜索与筛选条件
            </el-button>
          </template>

          <!-- 场景 B: 当前学科确实还没有任何错题记录 -->
          <template v-else>
            <div class="empty-emoji">🌱</div>
            <p class="empty-title">当前还没有 {{ currentSubject }} 错题</p>
            <p class="empty-desc">考前把错题消灭在平时，点击下方按钮开始录入第一道 {{ currentSubject }} 错题吧！</p>
            <el-button type="primary" :icon="Plus" @click="openAddDialog(currentSubject)">
              立刻录入 {{ currentSubject }} 错题
            </el-button>
          </template>
        </div>
      </div>

      <!-- 底部分页器 -->
      <div v-if="filteredItems.length > 0" class="pagination-footer-bar">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 15, 25, 50]"
          :total="filteredItems.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </div>
    </Transition>

    <!-- ======================================================== -->
    <!-- 录入新错题弹层 (所见即所得富文本)                         -->
    <!-- ======================================================== -->
    <el-dialog
      v-model="addDialogVisible"
      :title="`✏️ 录入${currentSubject ? currentSubject : ''}错题`"
      width="720px"
      destroy-on-close
      class="wrong-dialog-modal"
    >
      <el-form label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="学科科目" required>
              <el-select v-model="newItem.subject" placeholder="选择科目" style="width: 100%">
                <el-option
                  v-for="s in subjects"
                  :key="s"
                  :label="`${subjectEmojis[s] || '📚'} ${s}`"
                  :value="s"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="当前掌握状态">
              <el-select v-model="newItem.mastery_status" style="width: 100%">
                <el-option label="🔴 待攻克（刚做错，急需复盘）" value="unmastered" />
                <el-option label="🟡 练习中（已看过解析，待二刷）" value="learning" />
                <el-option label="🟢 已掌握（思路通畅，已攻克）" value="mastered" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="题目内容 (所见即所得图文排版)" required>
          <RichQuestionEditor
            v-model="newItem.question"
            min-height="220px"
            placeholder="在此输入题干文字... 💡光标停在任意行按 Ctrl+V / Cmd+V 可精准插入截图；点击图片可调节尺寸"
          />
        </el-form-item>

        <el-form-item label="错因快捷标签 (点击一键填入)">
          <div class="preset-tag-list">
            <el-tag
              v-for="preset in reasonPresets"
              :key="preset"
              class="clickable-tag"
              size="small"
              type="info"
              effect="plain"
              @click="selectPresetReason(preset, 'new')"
            >
              + {{ preset }}
            </el-tag>
          </div>
        </el-form-item>

        <el-form-item label="错误原因与解题反思">
          <el-input
            v-model="newItem.reason"
            type="textarea"
            :rows="2"
            placeholder="分析考场丢分原因、遗漏条件或避坑思路（留空将自动标为待分析）"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="modal-footer-btns">
          <el-button @click="addDialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :icon="Plus"
            @click="addWrongItem"
          >
            保存并收录
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- ======================================================== -->
    <!-- 编辑错题弹层                                             -->
    <!-- ======================================================== -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑错题"
      width="720px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="学科科目" required>
              <el-select v-model="editForm.subject" style="width: 100%">
                <el-option
                  v-for="s in subjects"
                  :key="s"
                  :label="`${subjectEmojis[s] || '📚'} ${s}`"
                  :value="s"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="掌握状态">
              <el-select v-model="editForm.mastery_status" style="width: 100%">
                <el-option label="🔴 待攻克" value="unmastered" />
                <el-option label="🟡 练习中" value="learning" />
                <el-option label="🟢 已掌握" value="mastered" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="题目内容 (所见即所得图文排版)" required>
          <RichQuestionEditor
            v-model="editForm.question"
            min-height="220px"
          />
        </el-form-item>

        <el-form-item label="错因分析">
          <el-input
            v-model="editForm.reason"
            type="textarea"
            :rows="2"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="modal-footer-btns">
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveEdit">保存修改</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 全屏大图画廊灯箱组件 -->
    <el-image-viewer
      v-if="viewerVisible"
      :url-list="viewerUrlList"
      :initial-index="viewerIndex"
      @close="viewerVisible = false"
    />
  </div>
</template>

<style scoped>
.wrong-book-page {
  padding: 24px 28px 60px;
  max-width: 1160px;
  margin: 0 auto;
}

/* 顶栏 */
.page-top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.title-left-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.sub-counter {
  font-size: 13px;
  color: #64748b;
}

.top-action-cluster {
  display: flex;
  align-items: center;
  gap: 12px;
}

.prominent-add-btn {
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.28);
  transition: all 0.2s;
}

.prominent-add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.36);
}

.refresh-btn {
  color: #64748b;
}

/* ========================================================== */
/* 阶段一：学科错题门户 (Subject Hub)                          */
/* ========================================================== */
.hub-overall-banner {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 12px;
  padding: 18px 24px;
  margin-bottom: 28px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  flex-wrap: wrap;
  transition: var(--theme-transition);
}

.overall-stat-group {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.stat-pill-item {
  display: flex;
  flex-direction: column;
  padding: 6px 16px;
  background: var(--bg-card-secondary, #f8fafc);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 8px;
  min-width: 80px;
  transition: var(--theme-transition);
}

.stat-pill-label {
  font-size: 11px;
  color: var(--text-sub, #64748b);
  font-weight: 600;
}

.stat-pill-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.unmastered-pill { background: #fef2f2; border-color: #fecaca; }
.unmastered-pill .stat-pill-label { color: #dc2626; }
.unmastered-pill .stat-pill-val { color: #b91c1c; }

.learning-pill { background: #fffbeb; border-color: #fde68a; }
.learning-pill .stat-pill-label { color: #d97706; }
.learning-pill .stat-pill-val { color: #b45309; }

.mastered-pill { background: #ecfdf5; border-color: #a7f3d0; }
.mastered-pill .stat-pill-label { color: #059669; }
.mastered-pill .stat-pill-val { color: #047857; }

.overall-progress-box {
  flex: 1;
  min-width: 240px;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-title-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
}

.rate-bold {
  font-weight: 800;
  color: #0f172a;
}

/* 9大学科卡片网格 (严格 3x3 排版：一排语数英，二排物化生，三排史地政) */
.subject-grid-layout {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 1024px) {
  .subject-grid-layout {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .subject-grid-layout {
    grid-template-columns: 1fr;
  }
}

.subject-book-card {
  perspective: 1200px;
  height: 250px;
  background: transparent;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  position: relative;
  padding: 0;
  transition: z-index 0.3s ease;
}

.card-3d-flipper {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform-origin: 50% 50% 0;
  transition: transform 0.55s cubic-bezier(0.34, 1.25, 0.64, 1);
  border-radius: 14px;
}

/* 正常状态下轻微悬停上浮 */
.subject-book-card:hover:not(.is-flipped) .card-3d-flipper {
  transform: translateY(-6px) scale(1.01);
}

.subject-book-card:hover:not(.is-flipped) .card-face-front {
  box-shadow: 0 16px 36px var(--card-glow, rgba(0, 0, 0, 0.12));
}

html.dark .subject-book-card:hover:not(.is-flipped) .card-face-front {
  box-shadow: 0 16px 36px var(--card-glow, rgba(0, 0, 0, 0.45)), 0 0 20px var(--card-dark-border, rgba(59, 130, 246, 0.3)) !important;
}

/* 点击卡片时的电影级动效：原地中心 180° 翻转 -> 极其丝滑平缓放大至全屏消散 (纯 GPU 合成，0 卡顿) */
.subject-book-card.is-flipped {
  z-index: 120;
}

.subject-book-card.is-flipped .card-3d-flipper {
  will-change: transform, opacity;
  animation: cardFlipAndBurst 0.88s cubic-bezier(0.25, 1, 0.4, 1) forwards !important;
}

@keyframes cardFlipAndBurst {
  0% {
    transform: rotateY(0deg) scale(1);
    opacity: 1;
  }
  40% {
    /* 约 350ms：以几何中心沉稳翻转 180°，反面错题库连接舱完整展现，略微悬停让用户看清 */
    transform: rotateY(-180deg) scale(1.05);
    opacity: 1;
  }
  65% {
    /* 约 570ms：平滑向前破屏推进，持续保持高帧率流畅放大 */
    transform: rotateY(-180deg) scale(1.6);
    opacity: 0.85;
  }
  100% {
    /* 约 880ms：平滑舒展放大至全屏视野，伴随柔和淡出 */
    transform: rotateY(-180deg) scale(2.5);
    opacity: 0;
  }
}

/* 正面与反面通用面板 (均绝对定位贴合容器，彻底杜绝网格多占位计算 Bug) */
.card-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 14px;
  overflow: hidden;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform-origin: 50% 50% 0;
  background: var(--card-light-bg, #ffffff);
  border: 1px solid var(--card-light-border, #e2e8f0);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.03);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

html.dark .card-face {
  background: var(--card-dark-bg, #131b2e) !important;
  border-color: var(--card-dark-border, #1e293b) !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45) !important;
}

/* 正面 (Front Face) */
.card-face-front {
  transform: rotateY(0deg);
  z-index: 2;
}

/* 反面 (Back Face)：错题库接入舱视图 */
.card-face-back {
  transform: rotateY(180deg);
  z-index: 1;
  box-shadow: 0 24px 50px var(--card-glow, rgba(59, 130, 246, 0.45)), 0 0 25px var(--card-neon, #38bdf8) !important;
}

/* 当有卡片被点击时，网格内其他卡片平滑隐退，全屏焦点完全留给当前放大卡片 */
.subject-grid-layout.has-launching .subject-book-card:not(.is-flipped) {
  opacity: 0;
  transform: scale(0.94);
  transition: opacity 0.35s ease, transform 0.35s ease;
  pointer-events: none;
}

/* 反面内部细节排版 */
.card-back-body {
  padding: 16px 20px 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  gap: 12px;
}

.hud-status-indicator.back-syncing {
  color: #10b981;
}

.pulse-dot.active {
  background: #10b981 !important;
  animation: pulseGlowGreen 1.2s infinite;
}

@keyframes pulseGlowGreen {
  0% { transform: scale(0.9); opacity: 0.7; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
  50% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 8px 3px rgba(16, 185, 129, 0.4); }
  100% { transform: scale(0.9); opacity: 0.7; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.card-back-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 4px 0;
}

.back-avatar-ring {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.85);
  border: 1.5px solid var(--card-accent, #3b82f6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px var(--card-glow, rgba(59, 130, 246, 0.25));
  flex-shrink: 0;
}

html.dark .back-avatar-ring {
  background: rgba(15, 23, 42, 0.75);
  border-color: var(--card-neon, #38bdf8);
}

.back-hero-emoji {
  font-size: 28px;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15));
}

.back-ring-halo {
  position: absolute;
  inset: -4px;
  border-radius: 17px;
  border: 1px dashed var(--card-neon, #38bdf8);
  opacity: 0.75;
  animation: spinHalo 10s linear infinite;
}

@keyframes spinHalo {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.back-hero-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.back-subject-title {
  margin: 0;
  font-size: 19px;
  font-weight: 900;
  color: var(--card-accent, #3b82f6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

html.dark .back-subject-title {
  color: var(--card-neon, #60a5fa) !important;
}

.back-subject-sub {
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.08em;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.card-back-loader {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 8px 12px;
  border-radius: 8px;
}

html.dark .card-back-loader {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(255, 255, 255, 0.08);
}

.back-loader-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-weight: 700;
  color: #64748b;
}

.loader-status {
  color: #10b981;
  font-weight: 800;
}

.back-loader-track {
  width: 100%;
  height: 6px;
  background: rgba(203, 213, 225, 0.4);
  border-radius: 3px;
  overflow: hidden;
}

.back-loader-fill {
  width: 100%;
  height: 100%;
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.back-loader-fill::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent);
  animation: loaderShimmer 1.2s infinite;
}

@keyframes loaderShimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.card-back-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  font-weight: 700;
  border-top: 1px dashed rgba(203, 213, 225, 0.6);
  padding-top: 10px;
  color: #64748b;
}

html.dark .card-back-footer {
  border-top-color: rgba(255, 255, 255, 0.12);
}

.back-foot-cue {
  color: var(--card-accent, #3b82f6);
  font-weight: 800;
}

html.dark .back-foot-cue {
  color: var(--card-neon, #60a5fa) !important;
}

/* 两阶段视图切换全局过渡动效 (Vue Transition) */
.stage-transition-enter-active {
  transition: opacity 0.48s cubic-bezier(0.16, 1, 0.3, 1), transform 0.48s cubic-bezier(0.16, 1, 0.3, 1);
}

.stage-transition-leave-active {
  transition: opacity 0.2s ease;
}

/* 进入单科库时：平滑舒展放大并淡入，与前置卡片消融完美接力 */
.stage-transition-enter-from {
  opacity: 0;
  transform: scale(0.97);
}

/* 离开学科专区时：自然淡出 */
.stage-transition-leave-to {
  opacity: 0;
}

.cyber-card {
  position: relative;
}

.cyber-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 20px 20px 0;
  border-color: transparent var(--card-accent, #3b82f6) transparent transparent;
  opacity: 0.65;
  transition: opacity 0.2s;
}


.card-color-stripe {
  height: 5px;
  width: 100%;
}

.card-inner-body {
  padding: 16px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

/* 科技 HUD 顶栏 */
.card-hud-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, 'Roboto Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
  padding-bottom: 2px;
  border-bottom: 1px dashed rgba(203, 213, 225, 0.6);
}

.hud-code {
  opacity: 0.85;
}

.hud-status-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
  letter-spacing: 0.05em;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  background: var(--card-accent, #3b82f6);
  animation: pulseGlow 1.8s infinite;
}

html.dark .pulse-dot {
  background: var(--card-neon, #60a5fa) !important;
}

@keyframes pulseGlow {
  0% { transform: scale(0.9); opacity: 0.7; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); }
  50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 6px 2px rgba(59, 130, 246, 0.3); }
  100% { transform: scale(0.9); opacity: 0.7; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}

.card-head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subject-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.subject-emoji {
  font-size: 32px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
}

.subject-names {
  display: flex;
  flex-direction: column;
}

.subject-cn {
  margin: 0;
  font-size: 19px;
  font-weight: 900;
  letter-spacing: -0.01em;
  color: var(--card-accent, #3b82f6);
  transition: color 0.2s;
}

html.dark .subject-cn {
  color: var(--card-neon, #60a5fa) !important;
}

.subject-en {
  font-size: 10px;
  color: #64748b;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

/* 错题总数科技 HUD 徽标 */
.total-count-badge {
  text-align: right;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(8px);
  padding: 4px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.count-num {
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, 'Roboto Mono', Menlo, monospace;
  color: var(--card-accent, #3b82f6);
}

html.dark .count-num {
  color: var(--card-neon, #60a5fa) !important;
}

.count-unit {
  display: block;
  font-size: 9px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.06em;
  margin-top: 2px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

/* 科技高能槽进度条 */
.card-progress-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.progress-label-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.04em;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.prog-val {
  font-weight: 900;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: var(--card-accent, #3b82f6);
}

html.dark .prog-val {
  color: var(--card-neon, #60a5fa) !important;
}

.cyber-progress-track {
  width: 100%;
  height: 7px;
  background: rgba(203, 213, 225, 0.4);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.cyber-progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.card-status-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sub-status-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2.5px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.06);
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.sub-status-pill.unmastered { color: #dc2626; border-color: #fecaca; }
.sub-status-pill.learning { color: #d97706; border-color: #fde68a; }
.sub-status-pill.mastered { color: #059669; border-color: #a7f3d0; }

html.dark .sub-status-pill.unmastered { color: #f87171 !important; border-color: rgba(239, 68, 68, 0.3) !important; }
html.dark .sub-status-pill.learning { color: #fbbf24 !important; border-color: rgba(245, 158, 11, 0.3) !important; }
html.dark .sub-status-pill.mastered { color: #34d399 !important; border-color: rgba(16, 185, 129, 0.3) !important; }

.card-enter-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  font-size: 11px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, 'Roboto Mono', monospace;
  letter-spacing: 0.04em;
  border-top: 1px dashed rgba(203, 213, 225, 0.6);
  padding-top: 10px;
  margin-top: 4px;
  color: var(--card-accent, #3b82f6);
  transition: all 0.2s;
}

html.dark .card-enter-action {
  color: var(--card-neon, #60a5fa) !important;
  border-top-color: rgba(255, 255, 255, 0.12) !important;
}

.enter-icon {
  transition: transform 0.2s;
}

.subject-book-card:hover .enter-icon {
  transform: translateX(4px);
}

/* 暗色模式下卡片 HUD 细节高光与对比度反转 */
html.dark .card-hud-topline {
  color: #94a3b8;
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

html.dark .subject-en {
  color: #94a3b8;
}

html.dark .total-count-badge {
  background: rgba(15, 23, 42, 0.75);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

html.dark .count-unit {
  color: #94a3b8;
}

html.dark .progress-label-row {
  color: #94a3b8;
}

html.dark .cyber-progress-track {
  background: rgba(255, 255, 255, 0.12);
}

html.dark .sub-status-pill {
  background: rgba(15, 23, 42, 0.7);
  border-color: rgba(255, 255, 255, 0.1);
}

/* ========================================================== */
/* 阶段二：单学科沉浸式错题集录 (Subject Focused View)         */
/* ========================================================== */
.focused-top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.header-left-cluster {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-hub-btn {
  font-weight: 600;
  color: var(--text-sub, #475569);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.back-hub-btn:hover {
  transform: translateX(-3px);
  color: #2563eb !important;
  background: var(--bg-card-secondary, #eff6ff) !important;
}

.back-hub-btn:active {
  transform: translateX(-6px) scale(0.96);
}

.subject-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.focused-emoji {
  font-size: 26px;
}

.focused-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.header-right-cluster {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 单科指标看板 */
.single-subject-dashboard {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 12px;
  padding: 14px 20px;
  margin-bottom: 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  transition: var(--theme-transition);
}

.dashboard-stats-grid {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.stat-capsule {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.stat-capsule:hover {
  background: var(--bg-card-secondary, #f8fafc);
  border-color: var(--border-regular, #cbd5e1);
}

.stat-capsule.active {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.stat-num {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.stat-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub, #64748b);
}

.unmastered-stat.active { border-color: #ef4444; background: #fef2f2; }
.learning-stat.active { border-color: #f59e0b; background: #fffbeb; }
.mastered-stat.active { border-color: #10b981; background: #ecfdf5; }

.dashboard-progress-area {
  flex: 1;
  min-width: 200px;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-title {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}

.progress-percent {
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
}

/* 单科纯净过滤工具条 */
.focused-filter-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.status-toggle-group {
  flex-shrink: 0;
}

.control-right-cluster {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.blind-switch-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  transition: all 0.2s;
}

.blind-switch-wrap.is-active {
  background: #fffbeb;
  border-color: #fde68a;
  color: #b45309;
}

.blind-switch-label {
  user-select: none;
}

.fold-btns {
  display: flex;
  gap: 4px;
}

.search-input-box {
  width: 220px;
}

/* 错题紧凑卡片列表 */
.wrong-items-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.foldable-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: all 0.18s ease;
}

.foldable-card:hover {
  border-color: var(--border-regular, #cbd5e1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.foldable-card.is-expanded {
  border-color: #93c5fd;
  box-shadow: 0 6px 18px rgba(59, 130, 246, 0.08);
}

.card-compact-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  background: var(--bg-card, #ffffff);
  user-select: none;
  gap: 16px;
  transition: var(--theme-transition);
}

.card-compact-row:hover {
  background: var(--bg-card-secondary, #f8fafc);
}

.row-left-info {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  flex: 1;
}

.expand-arrow-icon {
  font-size: 13px;
  color: var(--text-sub, #94a3b8);
  flex-shrink: 0;
  transition: transform 0.2s;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.status-pill:hover {
  opacity: 0.85;
}

.pill-down-icon {
  font-size: 10px;
  margin-left: 2px;
}

.summary-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.has-img-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.row-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.reason-summary-tag {
  font-size: 11px;
  color: #be123c;
  background: #fff1f2;
  border: 1px solid #ffe4e6;
  padding: 2px 6px;
  border-radius: 4px;
}

.date-tag {
  font-size: 11px;
  color: #94a3b8;
}

.card-detail-body {
  padding: 16px 20px 20px;
  border-top: 1px solid var(--border-subtle, #f1f5f9);
  background: var(--bg-card-secondary, #fafbfc);
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: var(--theme-transition);
}

.full-question-box {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.rich-card-body {
  font-size: 15px;
  color: var(--text-main, #1e293b);
  line-height: 1.75;
  word-break: break-word;
}

:deep(.rich-card-body p) {
  margin: 4px 0;
}

:deep(.rich-card-body img) {
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  cursor: zoom-in;
  transition: transform 0.15s, box-shadow 0.15s;
}

:deep(.rich-card-body img:hover) {
  transform: scale(1.01);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.detail-reason-container {
  border-radius: 8px;
  overflow: hidden;
}

.revealed-reason-content {
  background: #fff1f2;
  border: 1px solid #ffe4e6;
  border-left: 4px solid #f43f5e;
  border-radius: 8px;
  padding: 12px 16px;
}

.reason-header-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.reason-caption {
  font-size: 11px;
  font-weight: 800;
  color: #be123c;
  text-transform: uppercase;
}

.revealed-tag {
  font-size: 11px;
  color: #9f1239;
}

.reason-text-desc {
  font-size: 13px;
  color: #881337;
  line-height: 1.6;
  white-space: pre-wrap;
}

.blind-overlay-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.blind-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.blind-icon {
  color: #f59e0b;
  font-size: 15px;
}

.card-lifecycle-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  gap: 12px;
  flex-wrap: wrap;
}

.status-change-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.change-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.review-counter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-times-badge {
  font-size: 12px;
  color: #475569;
}

.review-times-badge b {
  color: #2563eb;
  font-size: 14px;
}

.pagination-footer-bar {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.empty-state-box {
  text-align: center;
  padding: 60px 20px;
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  margin-top: 10px;
}

.empty-emoji {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.empty-desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: #64748b;
}

.preset-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.clickable-tag {
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}

.clickable-tag:hover {
  border-color: #3b82f6;
  color: #2563eb;
  background: #eff6ff;
}

.modal-footer-btns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
