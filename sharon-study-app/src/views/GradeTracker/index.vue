<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import { subjectEmojis } from '../../utils/subjects'
import {
  Plus,
  Edit,
  Delete,
  Search,
  Aim,
  RefreshRight
} from '@element-plus/icons-vue'

interface Grade {
  id: number
  subject: string
  exam: string
  score: number
  full_score: number
  date: string
}

interface GoalItem {
  target_score: number
  target_full_score: number
}

const router = useRouter()
const grades = ref<Grade[]>([])
const goals = ref<Record<string, GoalItem>>({})
const loading = ref(false)

const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他']
const coreSubjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
const activeTab = ref('overview')

// 暗色模式实时响应机制
const isDark = ref(document.documentElement.classList.contains('dark'))
let themeObserver: MutationObserver | null = null

onMounted(() => {
  themeObserver = new MutationObserver(() => {
    const darkNow = document.documentElement.classList.contains('dark')
    if (darkNow !== isDark.value) {
      isDark.value = darkNow
      nextTick(() => renderCharts())
    }
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  fetchData()
})

onUnmounted(() => {
  if (themeObserver) themeObserver.disconnect()
})

// 弹窗控制
const showGradeDialog = ref(false)
const gradeDialogMode = ref<'single' | 'batch'>('single')
const editingGradeId = ref<number | null>(null)

const singleForm = ref({
  subject: '数学',
  exam: '',
  score: 100,
  full_score: 150,
  date: new Date().toISOString().split('T')[0]
})

// 批量录入表单
const batchForm = ref({
  exam: '',
  date: new Date().toISOString().split('T')[0],
  items: coreSubjects.map(s => ({
    subject: s,
    score: null as number | null,
    full_score: (s === '语文' || s === '数学' || s === '英语') ? 150 : 100
  }))
})

// 目标分设置弹窗
const showGoalsDialog = ref(false)
const goalsForm = ref<Record<string, { score: number; full_score: number }>>({})

// 单科详细弹窗
const showSubjectDialog = ref(false)
const activeSubjectStat = ref<{
  subject: string
  avg: number
  max: number
  min: number
  count: number
  trend: number
  latest: Grade
  latestPct: number
} | null>(null)

// 趋势视图模式：单科折线 vs 大考总分走势
const trendViewMode = ref<'subject' | 'overall'>('subject')

// 明细页筛选状态
const filterSubject = ref('全部')
const searchExam = ref('')
const sortOrder = ref('date_desc')

// 配色映射
const subjectColors: Record<string, string> = {
  '语文': '#8b5cf6', '数学': '#3b82f6', '英语': '#ec4899',
  '物理': '#f59e0b', '化学': '#10b981', '生物': '#14b8a6',
  '历史': '#d97706', '地理': '#06b6d4', '政治': '#e11d48',
  '其他': '#64748b'
}

// 亮色卡片浅雅渐变
const subjectLightGradients: Record<string, string> = {
  '语文': 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
  '数学': 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
  '英语': 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
  '物理': 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
  '化学': 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
  '生物': 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
  '历史': 'linear-gradient(135deg, #fffbeb 0%, #fed7aa 100%)',
  '地理': 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
  '政治': 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
  '其他': 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
}

// 暗色卡片深邃微光渐变 (与错题本体系统一)
const subjectDarkGradients: Record<string, string> = {
  '语文': 'linear-gradient(145deg, #24143a 0%, #1a152d 50%, #111424 100%)',
  '数学': 'linear-gradient(145deg, #0f2347 0%, #131f38 50%, #0d1627 100%)',
  '英语': 'linear-gradient(145deg, #38122a 0%, #261325 50%, #171324 100%)',
  '物理': 'linear-gradient(145deg, #33220a 0%, #261c12 50%, #191624 100%)',
  '化学': 'linear-gradient(145deg, #092e22 0%, #102322 50%, #0e1724 100%)',
  '生物': 'linear-gradient(145deg, #092c2c 0%, #112328 50%, #0e1624 100%)',
  '历史': 'linear-gradient(145deg, #331d0d 0%, #281a17 50%, #181524 100%)',
  '地理': 'linear-gradient(145deg, #0b2938 0%, #122130 50%, #0e1626 100%)',
  '政治': 'linear-gradient(145deg, #330f1d 0%, #271321 50%, #181524 100%)',
  '其他': 'linear-gradient(145deg, #182030 0%, #131b2a 50%, #0d131f 100%)'
}

// 数据拉取
const fetchData = async () => {
  loading.value = true
  try {
    const [gradesData, goalsData] = await Promise.all([
      api.get('/grades'),
      api.get('/grades/goals').catch(() => ({}))
    ])
    grades.value = gradesData
    goals.value = goalsData || {}
    await nextTick()
    renderCharts()
  } catch {
    ElMessage.error('数据加载失败')
  } finally {
    loading.value = false
  }
}

// 辅助计算
const getScorePct = (grade: Grade) => Math.round((grade.score / grade.full_score) * 1000) / 10

const sortedGrades = computed(() => {
  return [...grades.value].sort((a, b) => a.date.localeCompare(b.date))
})

// 明细页筛选与排序列表
const filteredAndSortedGrades = computed(() => {
  let list = [...grades.value]

  // 科目筛选
  if (filterSubject.value !== '全部') {
    list = list.filter(g => g.subject === filterSubject.value)
  }

  // 考试搜索
  if (searchExam.value.trim()) {
    const q = searchExam.value.trim().toLowerCase()
    list = list.filter(g => g.exam.toLowerCase().includes(q))
  }

  // 排序
  list.sort((a, b) => {
    if (sortOrder.value === 'date_desc') return b.date.localeCompare(a.date) || b.id - a.id
    if (sortOrder.value === 'date_asc') return a.date.localeCompare(b.date) || a.id - b.id
    const pctA = getScorePct(a)
    const pctB = getScorePct(b)
    if (sortOrder.value === 'pct_desc') return pctB - pctA
    if (sortOrder.value === 'pct_asc') return pctA - pctB
    return 0
  })

  return list
})

// 明细页当前筛选小计
const detailSummaryStats = computed(() => {
  const list = filteredAndSortedGrades.value
  if (list.length === 0) return { count: 0, avgPct: 0, maxScore: 0, minScore: 0 }
  const pcts = list.map(g => getScorePct(g))
  const avgPct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length * 10) / 10
  const maxScore = Math.max(...pcts)
  const minScore = Math.min(...pcts)
  return { count: list.length, avgPct, maxScore, minScore }
})

// 各科统计汇总
const subjectStats = computed(() => {
  const map: Record<string, { pcts: number[]; latest?: Grade; count: number }> = {}
  for (const g of sortedGrades.value) {
    if (!map[g.subject]) map[g.subject] = { pcts: [], count: 0 }
    map[g.subject].pcts.push(getScorePct(g))
    map[g.subject].latest = g
    map[g.subject].count++
  }

  const result: Array<{
    subject: string
    avg: number
    max: number
    min: number
    count: number
    trend: number
    latest: Grade
    latestPct: number
  }> = []

  for (const [subject, data] of Object.entries(map)) {
    const avg = data.pcts.reduce((a, b) => a + b, 0) / data.pcts.length
    const max = Math.max(...data.pcts)
    const min = Math.min(...data.pcts)
    let trend = 0
    if (data.pcts.length >= 2) {
      const recent = data.pcts.slice(-3)
      const earlier = data.pcts.slice(0, -3)
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
      const earlierAvg = earlier.length > 0 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : recentAvg
      trend = Math.round((recentAvg - earlierAvg) * 10) / 10
    }
    result.push({
      subject,
      avg: Math.round(avg * 10) / 10,
      max: Math.round(max * 10) / 10,
      min: Math.round(min * 10) / 10,
      count: data.count,
      trend,
      latest: data.latest!,
      latestPct: data.pcts[data.pcts.length - 1],
    })
  }

  // 按照预设科目排布
  result.sort((a, b) => {
    const idxA = subjects.indexOf(a.subject)
    const idxB = subjects.indexOf(b.subject)
    return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99)
  })

  return result
})

// 全局总览概括指标
const overallStats = computed(() => {
  if (grades.value.length === 0) return null
  const pcts = grades.value.map(g => getScorePct(g))
  return {
    total: grades.value.length,
    avgPct: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length * 10) / 10,
    maxPct: Math.round(Math.max(...pcts) * 10) / 10,
    minPct: Math.round(Math.min(...pcts) * 10) / 10,
  }
})

// 按场次聚合的大考总分走势
const examTotalSessions = computed(() => {
  const sessionMap: Record<string, { exam: string; date: string; totalScore: number; totalFull: number; items: Grade[] }> = {}
  for (const g of sortedGrades.value) {
    const key = `${g.date}__${g.exam}`
    if (!sessionMap[key]) {
      sessionMap[key] = { exam: g.exam, date: g.date, totalScore: 0, totalFull: 0, items: [] }
    }
    sessionMap[key].totalScore += g.score
    sessionMap[key].totalFull += g.full_score
    sessionMap[key].items.push(g)
  }

  return Object.values(sessionMap).map(s => ({
    exam: s.exam,
    date: s.date,
    totalScore: Math.round(s.totalScore * 10) / 10,
    totalFull: s.totalFull,
    pct: Math.round((s.totalScore / s.totalFull) * 1000) / 10,
    subjectCount: s.items.length,
    items: s.items
  })).sort((a, b) => a.date.localeCompare(b.date))
})

const trendText = (t: number) => t > 0 ? `↑${t}%` : t < 0 ? `↓${Math.abs(t)}%` : '→0%'
const trendTag = (t: number) => t > 2 ? 'success' : t < -2 ? 'danger' : 'info'

const getGradeLevel = (pct: number) => {
  if (pct >= 90) return { text: '优秀', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' }
  if (pct >= 80) return { text: '良好', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' }
  if (pct >= 70) return { text: '中等', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' }
  if (pct >= 60) return { text: '及格', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' }
  return { text: '待冲刺', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' }
}

const getBarStyle = (grade: Grade) => {
  const pct = (grade.score / grade.full_score) * 100
  const color = pct >= 90 ? '#10b981' : pct >= 75 ? '#3b82f6' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return { width: pct + '%', background: color }
}

// 目标分差距计算辅助
const getSubjectGoalGap = (subject: string, currentScore: number) => {
  const goal = goals.value[subject]
  if (!goal || !goal.target_score) return null
  const diff = Math.round((currentScore - goal.target_score) * 10) / 10
  const isReached = diff >= 0
  return {
    target: goal.target_score,
    targetFull: goal.target_full_score || 150,
    targetPct: Math.round((goal.target_score / (goal.target_full_score || 150)) * 1000) / 10,
    diff,
    isReached
  }
}

// 打开录入弹窗
const openAddDialog = () => {
  editingGradeId.value = null
  gradeDialogMode.value = 'single'
  singleForm.value = {
    subject: '数学',
    exam: '',
    score: 100,
    full_score: 150,
    date: new Date().toISOString().split('T')[0]
  }
  showGradeDialog.value = true
}

// 打开编辑弹窗
const openEditDialog = (row: Grade) => {
  editingGradeId.value = row.id
  gradeDialogMode.value = 'single'
  singleForm.value = {
    subject: row.subject,
    exam: row.exam,
    score: row.score,
    full_score: row.full_score,
    date: row.date
  }
  showGradeDialog.value = true
}

// 提交单科成绩 (新增或修改)
const submitSingleGrade = async () => {
  if (!singleForm.value.subject || !singleForm.value.exam || !singleForm.value.date) {
    ElMessage.warning('请填写完整的考试名称和日期')
    return
  }
  try {
    if (editingGradeId.value) {
      // 修改
      await api.put(`/grades/${editingGradeId.value}`, singleForm.value)
      ElMessage.success('成绩已更新')
    } else {
      // 新增
      await api.post('/grades', singleForm.value)
      ElMessage.success('录入成功')
    }
    showGradeDialog.value = false
    await fetchData()
  } catch {
    ElMessage.error(editingGradeId.value ? '修改失败' : '录入失败')
  }
}

// 提交大考批量录入
const submitBatchGrades = async () => {
  if (!batchForm.value.exam.trim() || !batchForm.value.date) {
    ElMessage.warning('请填写考试名称与考试日期')
    return
  }
  const validItems = batchForm.value.items.filter(i => i.score !== null && !isNaN(Number(i.score)))
  if (validItems.length === 0) {
    ElMessage.warning('请至少填入一门科目的成绩')
    return
  }

  try {
    await api.post('/grades/batch', {
      exam: batchForm.value.exam.trim(),
      date: batchForm.value.date,
      items: validItems
    })
    ElMessage.success(`成功批量录入 ${validItems.length} 门科目成绩！`)
    showGradeDialog.value = false
    // 重置
    batchForm.value.exam = ''
    batchForm.value.items.forEach(i => (i.score = null))
    await fetchData()
  } catch {
    ElMessage.error('批量录入失败')
  }
}

// 删除成绩
const removeGrade = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这条成绩记录吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    await api.del(`/grades/${id}`)
    await fetchData()
    ElMessage.success('已删除记录')
  } catch {
    // cancelled
  }
}

// 打开目标分配置弹窗
const openGoalsDialog = () => {
  const init: Record<string, { score: number; full_score: number }> = {}
  for (const s of coreSubjects) {
    const existing = goals.value[s]
    const defaultFull = (s === '语文' || s === '数学' || s === '英语') ? 150 : 100
    init[s] = {
      score: existing?.target_score ?? (defaultFull * 0.8),
      full_score: existing?.target_full_score ?? defaultFull
    }
  }
  goalsForm.value = init
  showGoalsDialog.value = true
}

// 保存目标分
const saveGoals = async () => {
  try {
    const payload: Record<string, GoalItem> = {}
    for (const [s, val] of Object.entries(goalsForm.value)) {
      payload[s] = {
        target_score: Number(val.score),
        target_full_score: Number(val.full_score)
      }
    }
    goals.value = await api.put('/grades/goals', payload)
    showGoalsDialog.value = false
    ElMessage.success('各科目标分已保存')
    nextTick(renderCharts)
  } catch {
    ElMessage.error('保存目标分失败')
  }
}

// 直通错题本专区
const jumpToWrongBook = (subj: string) => {
  showSubjectDialog.value = false
  router.push(`/wrong-book/${encodeURIComponent(subj)}`)
}

// 打开单科详情分析弹窗
const openSubjectDetail = (stat: typeof activeSubjectStat.value) => {
  activeSubjectStat.value = stat
  showSubjectDialog.value = true
  nextTick(() => renderSubjectTrendChart())
}

const activeSubjectGrades = computed(() => {
  if (!activeSubjectStat.value) return []
  return sortedGrades.value.filter(g => g.subject === activeSubjectStat.value!.subject)
})

// ==========================================
// ECharts 响应式绘制体系 (支持深浅实时自适应)
// ==========================================
let trendChart: echarts.ECharts | null = null
let radarChart: echarts.ECharts | null = null
let barChart: echarts.ECharts | null = null
let subjectTrendChart: echarts.ECharts | null = null

const getChartThemeTokens = () => {
  const dark = isDark.value
  return {
    textColor: dark ? '#94a3b8' : '#64748b',
    titleColor: dark ? '#f1f5f9' : '#0f172a',
    axisLineColor: dark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0',
    splitLineColor: dark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(226, 232, 240, 0.7)',
    tooltipBg: dark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
    tooltipBorder: dark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0',
    tooltipTextColor: dark ? '#f8fafc' : '#0f172a',
    legendColor: dark ? '#cbd5e1' : '#475569'
  }
}

const renderCharts = () => {
  renderTrendChart()
  renderRadarChart()
  renderBarChart()
}

// 渲染走势图（支持单科趋势与大考总分走势）
const renderTrendChart = () => {
  const el = document.getElementById('trend-chart')
  if (!el || grades.value.length === 0) return
  if (trendChart) trendChart.dispose()
  trendChart = echarts.init(el)

  const tokens = getChartThemeTokens()

  if (trendViewMode.value === 'overall') {
    // 渲染大考总分走势图
    const sessions = examTotalSessions.value
    trendChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipTextColor, fontSize: 12 },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const s = sessions[params[0].dataIndex]
          if (!s) return ''
          let html = `<div style="font-weight:700;margin-bottom:6px;">${s.date} · ${s.exam}</div>`
          html += `<div style="color:#f59e0b;font-weight:800;font-size:14px;margin-bottom:6px;">综合总分: ${s.totalScore} / ${s.totalFull} (得分率: ${s.pct}%)</div>`
          html += '<div style="font-size:11px;color:#94a3b8;border-top:1px dashed #475569;padding-top:4px;">各科得分分解：</div>'
          for (const item of s.items) {
            html += `<div style="font-size:11px;display:flex;justify-content:space-between;gap:12px;"><span>${subjectEmojis[item.subject] || ''} ${item.subject}:</span><b>${item.score}/${item.full_score}</b></div>`
          }
          return html
        }
      },
      grid: { top: 40, left: 55, right: 30, bottom: 35 },
      xAxis: {
        type: 'category',
        data: sessions.map(s => `${s.date.slice(5)}\n${s.exam}`),
        axisLabel: { color: tokens.textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      yAxis: {
        type: 'value',
        min: 40,
        max: 100,
        axisLabel: { color: tokens.textColor, fontSize: 11, formatter: '{value}%' },
        axisLine: { lineStyle: { color: tokens.axisLineColor } },
        splitLine: { lineStyle: { color: tokens.splitLineColor, type: 'dashed' } }
      },
      series: [{
        name: '大考总得分率',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 10,
        data: sessions.map(s => s.pct),
        lineStyle: { width: 3.5, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b', shadowBlur: 10, shadowColor: 'rgba(245, 158, 11, 0.5)' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 158, 11, 0.35)' },
            { offset: 1, color: 'rgba(245, 158, 11, 0.02)' }
          ])
        },
        markPoint: {
          data: [
            { type: 'max', name: '最高大考', itemStyle: { color: '#10b981' } },
            { type: 'min', name: '最低大考', itemStyle: { color: '#ef4444' } }
          ]
        }
      }]
    })
  } else {
    // 渲染各门单科折线图
    const subjectMap: Record<string, Array<{ date: string; pct: number; exam: string; score: number; full: number }>> = {}
    for (const g of sortedGrades.value) {
      if (!subjectMap[g.subject]) subjectMap[g.subject] = []
      subjectMap[g.subject].push({
        date: g.date,
        pct: getScorePct(g),
        exam: g.exam,
        score: g.score,
        full: g.full_score
      })
    }

    const series = Object.entries(subjectMap).map(([subject, data]) => ({
      name: subject,
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      data: data.map(d => [d.date, d.pct]),
      lineStyle: { width: 2.2 },
      itemStyle: { color: subjectColors[subject] || '#64748b' }
    }))

    trendChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        textStyle: { color: tokens.tooltipTextColor, fontSize: 12 },
        formatter: (params: Array<{ seriesName: string; value: [string, number] }>) => {
          let html = `<b style="display:block;margin-bottom:4px;">${params[0].value[0]}</b>`
          for (const p of params) {
            html += `<div style="display:flex;justify-content:space-between;gap:12px;"><span>${p.seriesName}:</span><b style="color:${subjectColors[p.seriesName] || '#fff'}">${p.value[1]}%</b></div>`
          }
          return html
        }
      },
      legend: {
        top: 0,
        textStyle: { color: tokens.legendColor, fontSize: 11 }
      },
      grid: { top: 45, left: 50, right: 25, bottom: 30 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        axisLabel: { color: tokens.textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: tokens.axisLineColor } }
      },
      yAxis: {
        type: 'value',
        min: 40,
        max: 100,
        axisLabel: { color: tokens.textColor, fontSize: 11, formatter: '{value}%' },
        axisLine: { lineStyle: { color: tokens.axisLineColor } },
        splitLine: { lineStyle: { color: tokens.splitLineColor, type: 'dashed' } }
      },
      series
    })
  }
}

// 渲染雷达图 (包含实际平均线 + 目标黄金对比线)
const renderRadarChart = () => {
  const el = document.getElementById('radar-chart')
  if (!el || subjectStats.value.length === 0) return
  if (radarChart) radarChart.dispose()
  radarChart = echarts.init(el)

  const tokens = getChartThemeTokens()
  const stats = subjectStats.value
  const indicator = stats.map(s => ({ name: s.subject, max: 100 }))

  // 目标分得分率数组
  const goalValues = stats.map(s => {
    const g = goals.value[s.subject]
    return g ? Math.round((g.target_score / (g.target_full_score || 150)) * 1000) / 10 : 80
  })

  radarChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: tokens.tooltipBg,
      borderColor: tokens.tooltipBorder,
      textStyle: { color: tokens.tooltipTextColor }
    },
    legend: {
      top: 0,
      textStyle: { color: tokens.legendColor, fontSize: 12 },
      data: ['平均得分率 (实考)', '目标得分率 (冲刺)']
    },
    radar: {
      indicator,
      radius: '65%',
      axisName: {
        fontSize: 12,
        color: tokens.legendColor,
        fontWeight: 600
      },
      axisLine: { lineStyle: { color: tokens.axisLineColor } },
      splitLine: { lineStyle: { color: tokens.splitLineColor } },
      splitArea: {
        areaStyle: {
          color: isDark.value
            ? ['rgba(15, 23, 42, 0.4)', 'rgba(30, 41, 59, 0.3)']
            : ['rgba(241, 245, 249, 0.4)', 'rgba(255, 255, 255, 0.4)']
        }
      }
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: stats.map(s => s.avg),
          name: '平均得分率 (实考)',
          areaStyle: { color: 'rgba(59, 130, 246, 0.32)' },
          lineStyle: { color: '#3b82f6', width: 2.5 },
          itemStyle: { color: '#3b82f6' }
        },
        {
          value: goalValues,
          name: '目标得分率 (冲刺)',
          lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
          itemStyle: { color: '#f59e0b' },
          areaStyle: { color: 'rgba(245, 158, 11, 0.1)' }
        }
      ]
    }]
  })
}

// 渲染柱状对比图
const renderBarChart = () => {
  const el = document.getElementById('bar-chart')
  if (!el || subjectStats.value.length === 0) return
  if (barChart) barChart.dispose()
  barChart = echarts.init(el)

  const tokens = getChartThemeTokens()
  const stats = subjectStats.value

  barChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tokens.tooltipBg,
      borderColor: tokens.tooltipBorder,
      textStyle: { color: tokens.tooltipTextColor },
      formatter: (params: Array<{ seriesName: string; value: number; name: string }>) => {
        let html = `<b>${params[0].name}</b><br/>`
        for (const p of params) html += `${p.seriesName}: <b>${p.value}%</b><br/>`
        return html
      }
    },
    legend: {
      top: 0,
      textStyle: { color: tokens.legendColor, fontSize: 12 }
    },
    grid: { top: 45, left: 50, right: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: stats.map(s => s.subject),
      axisLabel: { color: tokens.textColor, fontSize: 12 },
      axisLine: { lineStyle: { color: tokens.axisLineColor } }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: tokens.textColor, fontSize: 11, formatter: '{value}%' },
      axisLine: { lineStyle: { color: tokens.axisLineColor } },
      splitLine: { lineStyle: { color: tokens.splitLineColor, type: 'dashed' } }
    },
    series: [
      {
        name: '最高',
        type: 'bar',
        barWidth: 12,
        data: stats.map(s => s.max),
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: '平均',
        type: 'bar',
        barWidth: 12,
        data: stats.map(s => s.avg),
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: '最低',
        type: 'bar',
        barWidth: 12,
        data: stats.map(s => s.min),
        itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] }
      }
    ]
  })
}

// 渲染单科弹窗趋势折线
const renderSubjectTrendChart = () => {
  const el = document.getElementById('subject-trend-chart')
  if (!el || !activeSubjectStat.value) return
  if (subjectTrendChart) subjectTrendChart.dispose()
  subjectTrendChart = echarts.init(el)

  const tokens = getChartThemeTokens()
  const sg = activeSubjectGrades.value
  const color = subjectColors[activeSubjectStat.value.subject] || '#3b82f6'

  subjectTrendChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tokens.tooltipBg,
      borderColor: tokens.tooltipBorder,
      textStyle: { color: tokens.tooltipTextColor },
      formatter: (params: Array<{ value: number; axisValue: string; dataIndex: number }>) => {
        const p = params[0]
        const g = sg[p.dataIndex]
        return `<b>${p.axisValue}</b><br/>得分率: <b>${p.value}%</b>${g ? ` (${g.score}/${g.full_score})` : ''}`
      }
    },
    grid: { top: 25, left: 45, right: 25, bottom: 25 },
    xAxis: {
      type: 'category',
      data: sg.map(g => g.date),
      axisLabel: { color: tokens.textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: tokens.axisLineColor } }
    },
    yAxis: {
      type: 'value',
      min: 40,
      max: 100,
      axisLabel: { color: tokens.textColor, fontSize: 11, formatter: '{value}%' },
      axisLine: { lineStyle: { color: tokens.axisLineColor } },
      splitLine: { lineStyle: { color: tokens.splitLineColor, type: 'dashed' } }
    },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      data: sg.map(g => getScorePct(g)),
      lineStyle: { width: 3, color },
      itemStyle: { color },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: color + '55' },
          { offset: 1, color: color + '05' }
        ])
      },
      markLine: {
        silent: true,
        data: [{
          yAxis: activeSubjectStat.value.avg,
          name: '平均',
          lineStyle: { color, type: 'dashed' },
          label: { formatter: `均${activeSubjectStat.value.avg}%`, color: tokens.textColor }
        }]
      }
    }]
  })
}

watch(activeTab, () => nextTick(renderCharts))
watch(trendViewMode, () => nextTick(renderTrendChart))

window.addEventListener('resize', () => {
  trendChart?.resize()
  radarChart?.resize()
  barChart?.resize()
  subjectTrendChart?.resize()
})
</script>

<template>
  <div class="grade-tracker-page">
    <!-- 顶部操作栏 -->
    <div class="page-header">
      <div class="header-titles">
        <h2>📊 成绩追踪与学情洞察</h2>
        <span class="header-sub">记录大考与单科测验 · 动态追踪得分率走向 · 锁定目标冲刺短板</span>
      </div>
      <div class="header-actions">
        <el-button
          :icon="Aim"
          class="goal-btn"
          @click="openGoalsDialog"
        >
          🎯 设定目标分
        </el-button>
        <el-button
          type="primary"
          :icon="Plus"
          class="prominent-add-btn"
          @click="openAddDialog"
        >
          录入考试成绩
        </el-button>
        <el-button
          :icon="RefreshRight"
          circle
          class="refresh-btn"
          @click="fetchData"
          title="刷新数据"
        />
      </div>
    </div>

    <!-- 顶部统揽 4 大指标卡 -->
    <div v-if="overallStats" class="stats-overview">
      <div class="stat-card total">
        <div class="stat-value">{{ overallStats.total }}</div>
        <div class="stat-label">考试场次记录</div>
      </div>
      <div class="stat-card avg">
        <div class="stat-value">{{ overallStats.avgPct }}%</div>
        <div class="stat-label">综合平均得分率</div>
      </div>
      <div class="stat-card best">
        <div class="stat-value">{{ overallStats.maxPct }}%</div>
        <div class="stat-label">历史峰值得分率</div>
      </div>
      <div class="stat-card weak">
        <div class="stat-value">{{ overallStats.minPct }}%</div>
        <div class="stat-label">历史低值得分率</div>
      </div>
    </div>

    <!-- 主选项卡 -->
    <el-tabs v-model="activeTab" class="main-tabs">
      <!-- 1. 科目概览 -->
      <el-tab-pane label="科目概览" name="overview">
        <div v-if="subjectStats.length === 0" class="empty-hint">
          <el-empty description="暂无成绩数据，请点击右上角录入考试成绩" />
        </div>
        <div v-else class="subject-cards">
          <div
            v-for="s in subjectStats"
            :key="s.subject"
            class="subject-stat-card"
            :style="{ background: isDark ? (subjectDarkGradients[s.subject] || '#131b2e') : (subjectLightGradients[s.subject] || '#ffffff') }"
            @click="openSubjectDetail(s)"
          >
            <div class="card-top">
              <div class="card-emoji">{{ subjectEmojis[s.subject] || '📚' }}</div>
              <div class="card-subject-name">
                <span class="subject-cn">{{ s.subject }}</span>
                <span class="subject-count-tag">{{ s.count }} 场记录</span>
              </div>
              <el-tag :type="trendTag(s.trend)" size="small" class="trend-tag" effect="dark">
                {{ trendText(s.trend) }}
              </el-tag>
            </div>

            <div class="card-score-row">
              <div class="card-big-score" :style="{ color: getGradeLevel(s.latestPct).color }">
                {{ s.latestPct }}%
              </div>
              <div class="card-score-detail">
                <div class="latest-score-line">
                  最近: <b>{{ s.latest.score }}</b>/{{ s.latest.full_score }}分
                </div>
                <div class="card-exam-name">{{ s.latest.exam }}</div>
              </div>
            </div>

            <!-- 目标分与差距小胶囊 -->
            <div class="card-goal-bar">
              <template v-if="getSubjectGoalGap(s.subject, s.latest.score)">
                <span
                  class="goal-pill"
                  :class="{ 'is-reached': getSubjectGoalGap(s.subject, s.latest.score)?.isReached }"
                >
                  🎯 目标 {{ getSubjectGoalGap(s.subject, s.latest.score)?.target }}分
                  ({{ getSubjectGoalGap(s.subject, s.latest.score)?.isReached
                      ? `+${getSubjectGoalGap(s.subject, s.latest.score)?.diff}分 达标`
                      : `${getSubjectGoalGap(s.subject, s.latest.score)?.diff}分` }})
                </span>
              </template>
              <template v-else>
                <span class="goal-pill unset" @click.stop="openGoalsDialog">
                  🎯 设定目标分 &gt;
                </span>
              </template>
            </div>

            <!-- 极简四维指标 -->
            <div class="card-stats-row">
              <div class="mini-stat">
                <span class="mini-label">均</span>
                <span class="mini-value">{{ s.avg }}%</span>
              </div>
              <div class="mini-stat">
                <span class="mini-label">高</span>
                <span class="mini-value">{{ s.max }}%</span>
              </div>
              <div class="mini-stat">
                <span class="mini-label">低</span>
                <span class="mini-value">{{ s.min }}%</span>
              </div>
              <div class="mini-stat jump-action">
                <span class="view-detail-cue">详情 &gt;</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 2. 趋势分析 (支持各科单线 & 大考总分走势) -->
      <el-tab-pane label="趋势分析" name="trend">
        <div v-if="grades.length === 0" class="empty-hint">
          <el-empty description="暂无成绩数据" />
        </div>
        <div v-else class="chart-container">
          <div class="chart-top-bar">
            <h4 class="chart-title">
              {{ trendViewMode === 'overall' ? '🏆 历次大考综合总得分率走势' : '📈 各门学科成绩趋势走势' }}
            </h4>
            <el-radio-group v-model="trendViewMode" size="small" class="trend-toggle">
              <el-radio-button value="subject">分科走势</el-radio-button>
              <el-radio-button value="overall">大考总分走势</el-radio-button>
            </el-radio-group>
          </div>
          <div id="trend-chart" class="chart-box"></div>
        </div>
      </el-tab-pane>

      <!-- 3. 能力雷达 (当前均分多边形 + 目标分对比金线) -->
      <el-tab-pane label="能力雷达" name="radar">
        <div v-if="subjectStats.length === 0" class="empty-hint">
          <el-empty description="暂无数据" />
        </div>
        <div v-else class="chart-container">
          <div class="chart-top-bar">
            <h4 class="chart-title">各科平均得分率与目标对照雷达</h4>
            <el-button :icon="Aim" size="small" text type="primary" @click="openGoalsDialog">
              调整目标分
            </el-button>
          </div>
          <div id="radar-chart" class="chart-box"></div>
        </div>
      </el-tab-pane>

      <!-- 4. 科目对比 -->
      <el-tab-pane label="科目对比" name="compare">
        <div v-if="subjectStats.length === 0" class="empty-hint">
          <el-empty description="暂无数据" />
        </div>
        <div v-else class="chart-container">
          <h4 class="chart-title">各门学科最高分 / 平均分 / 最低分对比柱状图</h4>
          <div id="bar-chart" class="chart-box"></div>
        </div>
      </el-tab-pane>

      <!-- 5. 成绩明细 (全能筛选器 + 排序 + 修改/删除) -->
      <el-tab-pane label="成绩明细" name="detail">
        <!-- 筛选与搜索工具条 -->
        <div class="detail-filter-panel">
          <!-- 学科胶囊横向选择器 -->
          <div class="subject-filter-pills">
            <button
              class="filter-pill-btn"
              :class="{ active: filterSubject === '全部' }"
              @click="filterSubject = '全部'"
            >
              全部
            </button>
            <button
              v-for="s in subjects"
              :key="s"
              class="filter-pill-btn"
              :class="{ active: filterSubject === s }"
              @click="filterSubject = s"
            >
              <span>{{ subjectEmojis[s] || '📚' }}</span>
              <span>{{ s }}</span>
            </button>
          </div>

          <!-- 搜索与排序 -->
          <div class="filter-actions-row">
            <el-input
              v-model="searchExam"
              placeholder="搜索考试名称 (如：月考、期中)"
              :prefix-icon="Search"
              clearable
              size="default"
              class="exam-search-input"
            />
            <el-select v-model="sortOrder" size="default" class="sort-select">
              <el-option label="📅 日期最新在先" value="date_desc" />
              <el-option label="📅 日期最早在先" value="date_asc" />
              <el-option label="🏆 得分率从高到低" value="pct_desc" />
              <el-option label="📉 得分率从低到高" value="pct_asc" />
            </el-select>
          </div>

          <!-- 当前筛选小计指标 -->
          <div class="detail-summary-strip">
            <span>当前筛选记录: <b>{{ detailSummaryStats.count }}</b> 场</span>
            <span v-if="detailSummaryStats.count > 0">
              平均得分率: <b>{{ detailSummaryStats.avgPct }}%</b>
            </span>
            <span v-if="detailSummaryStats.count > 0">
              最高: <b>{{ detailSummaryStats.maxScore }}%</b> / 最低: <b>{{ detailSummaryStats.minScore }}%</b>
            </span>
          </div>
        </div>

        <!-- 成绩明细表格 -->
        <el-table
          :data="filteredAndSortedGrades"
          stripe
          v-loading="loading"
          class="grade-table"
        >
          <el-table-column prop="subject" label="科目" width="120">
            <template #default="{ row }">
              <div class="table-subject-cell">
                <span class="sub-emoji">{{ subjectEmojis[row.subject] || '📚' }}</span>
                <span class="sub-name">{{ row.subject }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="exam" label="考试名称" min-width="160" />
          <el-table-column label="实考分数 / 满分" width="220">
            <template #default="{ row }">
              <div class="score-bar-wrapper">
                <span class="score-text">{{ row.score }}/{{ row.full_score }}</span>
                <div class="score-bar">
                  <div class="score-bar-fill" :style="getBarStyle(row)"></div>
                </div>
                <span class="score-pct">{{ getScorePct(row) }}%</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="date" label="考试日期" width="130" sortable />
          <el-table-column label="目标对照" width="140">
            <template #default="{ row }">
              <span
                v-if="getSubjectGoalGap(row.subject, row.score)"
                class="table-gap-pill"
                :class="{ 'is-ok': getSubjectGoalGap(row.subject, row.score)?.isReached }"
              >
                {{ getSubjectGoalGap(row.subject, row.score)?.isReached
                  ? `+${getSubjectGoalGap(row.subject, row.score)?.diff}分 达成`
                  : `${getSubjectGoalGap(row.subject, row.score)?.diff}分 差` }}
              </span>
              <span v-else class="text-sub-light">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button
                size="small"
                type="primary"
                text
                :icon="Edit"
                @click="openEditDialog(row)"
              >
                修改
              </el-button>
              <el-button
                size="small"
                type="danger"
                text
                :icon="Delete"
                @click="removeGrade(row.id)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 录入 / 修改成绩弹窗 (支持单科录入与整场大考批量录入) -->
    <el-dialog
      v-model="showGradeDialog"
      :title="editingGradeId ? '✏️ 修改考试成绩' : '📝 录入成绩'"
      width="600px"
      destroy-on-close
      class="grade-edit-dialog"
    >
      <!-- 仅在新增模式下支持切换单科/整场大考 -->
      <div v-if="!editingGradeId" class="dialog-mode-tabs">
        <el-radio-group v-model="gradeDialogMode" size="default">
          <el-radio-button value="single">单科测验录入</el-radio-button>
          <el-radio-button value="batch">大考全科一键批量录入</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 单科录入 / 编辑表单 -->
      <div v-if="gradeDialogMode === 'single'" class="single-grade-form">
        <el-form label-width="90px">
          <el-form-item label="考试科目" required>
            <el-select v-model="singleForm.subject" placeholder="选择科目" filterable style="width:100%">
              <el-option
                v-for="s in subjects"
                :key="s"
                :label="`${subjectEmojis[s] || '📚'} ${s}`"
                :value="s"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="考试名称" required>
            <el-input v-model="singleForm.exam" placeholder="如：高二上期中考试、10月月考" />
          </el-form-item>
          <el-form-item label="实得分数" required>
            <div class="score-input-row">
              <el-input-number v-model="singleForm.score" :min="0" :max="singleForm.full_score" :precision="1" />
              <span class="slash">/</span>
              <el-input-number v-model="singleForm.full_score" :min="1" :step="10" />
              <span class="unit">满分</span>
            </div>
          </el-form-item>
          <el-form-item label="考试日期" required>
            <el-date-picker
              v-model="singleForm.date"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择考试日期"
              style="width:100%"
            />
          </el-form-item>
        </el-form>
      </div>

      <!-- 大考全科批量录入模式 -->
      <div v-else class="batch-grade-form">
        <div class="batch-top-meta">
          <el-input
            v-model="batchForm.exam"
            placeholder="考试统一名称 (如：高二下期末统考)"
            style="flex: 1"
          />
          <el-date-picker
            v-model="batchForm.date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="考试日期"
            style="width: 170px"
          />
        </div>
        <div class="batch-hint">
          * 提示：只需填写参加的科目分数，未考科目留空即可。
        </div>

        <div class="batch-subjects-table">
          <div v-for="item in batchForm.items" :key="item.subject" class="batch-row">
            <span class="batch-subj-tag">
              {{ subjectEmojis[item.subject] || '' }} {{ item.subject }}
            </span>
            <el-input-number
              v-model="item.score"
              :min="0"
              :max="item.full_score"
              :precision="1"
              size="default"
              placeholder="实得分"
              style="width: 140px"
            />
            <span class="batch-slash">/</span>
            <el-input-number
              v-model="item.full_score"
              :min="1"
              size="default"
              style="width: 110px"
            />
            <span class="batch-unit">满分</span>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showGradeDialog = false">取消</el-button>
        <el-button
          v-if="gradeDialogMode === 'single'"
          type="primary"
          @click="submitSingleGrade"
        >
          {{ editingGradeId ? '保存修改' : '确认录入' }}
        </el-button>
        <el-button
          v-else
          type="primary"
          @click="submitBatchGrades"
        >
          一键保存整场考试
        </el-button>
      </template>
    </el-dialog>

    <!-- 设定目标分弹窗 -->
    <el-dialog
      v-model="showGoalsDialog"
      title="🎯 各学科目标分设置 (冲刺基准线)"
      width="560px"
      destroy-on-close
    >
      <div class="goals-intro">
        设定各科目的目标得分，系统将在卡片、能力雷达和明细中实时生成**冲刺目标差距线**，便于锁定薄弱环节。
      </div>
      <div class="goals-grid">
        <div v-for="s in coreSubjects" :key="s" class="goal-config-row">
          <div class="goal-sub-name">
            <span>{{ subjectEmojis[s] || '📚' }}</span>
            <b>{{ s }}</b>
          </div>
          <div class="goal-input-group">
            <el-input-number
              v-if="goalsForm[s]"
              v-model="goalsForm[s].score"
              :min="0"
              :max="goalsForm[s].full_score"
              size="default"
              style="width: 130px"
            />
            <span class="slash">/</span>
            <el-input-number
              v-if="goalsForm[s]"
              v-model="goalsForm[s].full_score"
              :min="1"
              size="default"
              style="width: 110px"
            />
            <span class="unit">满分</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showGoalsDialog = false">取消</el-button>
        <el-button type="primary" @click="saveGoals">保存目标</el-button>
      </template>
    </el-dialog>

    <!-- 单科详细分析弹窗 (包含直达错题本闭环) -->
    <el-dialog
      v-model="showSubjectDialog"
      :title="`${subjectEmojis[activeSubjectStat?.subject || ''] || ''} ${activeSubjectStat?.subject || ''} 深度学情诊断`"
      width="750px"
      destroy-on-close
      @opened="renderSubjectTrendChart"
    >
      <template v-if="activeSubjectStat">
        <div class="detail-summary">
          <div class="summary-item">
            <span class="summary-label">最近得分率</span>
            <span class="summary-value" :style="{ color: getGradeLevel(activeSubjectStat.latestPct).color }">
              {{ activeSubjectStat.latestPct }}%
            </span>
            <el-tag
              :color="getGradeLevel(activeSubjectStat.latestPct).bg"
              :style="{ color: getGradeLevel(activeSubjectStat.latestPct).color, border: 'none' }"
              size="small"
            >
              {{ getGradeLevel(activeSubjectStat.latestPct).text }}
            </el-tag>
          </div>
          <div class="summary-item">
            <span class="summary-label">平均得分率</span>
            <span class="summary-value">{{ activeSubjectStat.avg }}%</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">近期走势</span>
            <span
              class="summary-value"
              :style="{ color: activeSubjectStat.trend > 0 ? '#10b981' : activeSubjectStat.trend < 0 ? '#ef4444' : '#64748b' }"
            >
              {{ trendText(activeSubjectStat.trend) }}
            </span>
          </div>
          <div class="summary-item">
            <span class="summary-label">最高 / 最低</span>
            <span class="summary-value">{{ activeSubjectStat.max }}% / {{ activeSubjectStat.min }}%</span>
          </div>
        </div>

        <!-- 目标分对照与攻克错题闭环横条 -->
        <div class="subject-action-banner">
          <div class="action-left">
            <span class="aim-icon">🎯</span>
            <div class="aim-texts">
              <template v-if="getSubjectGoalGap(activeSubjectStat.subject, activeSubjectStat.latest.score)">
                <span class="aim-main">
                  目标分: {{ getSubjectGoalGap(activeSubjectStat.subject, activeSubjectStat.latest.score)?.target }}分
                  (当前差距: {{ getSubjectGoalGap(activeSubjectStat.subject, activeSubjectStat.latest.score)?.diff }}分)
                </span>
                <span class="aim-sub">
                  {{ getSubjectGoalGap(activeSubjectStat.subject, activeSubjectStat.latest.score)?.isReached ? '🎉 已达标！请继续保持领先优势' : '⚠️ 距离目标仍有空间，重点攻克高频失分题型' }}
                </span>
              </template>
              <template v-else>
                <span class="aim-main">未设定该科目目标分</span>
                <span class="aim-sub">建议设定目标分数以形成明确冲刺牵引</span>
              </template>
            </div>
          </div>
          <el-button
            type="danger"
            class="go-wrongbook-btn"
            @click="jumpToWrongBook(activeSubjectStat.subject)"
          >
            🔴 立即前往攻克{{ activeSubjectStat.subject }}错题
          </el-button>
        </div>

        <!-- 走势折线图 -->
        <div class="detail-chart-section">
          <h4>单科历史得分率曲线</h4>
          <div id="subject-trend-chart" class="detail-chart-box"></div>
        </div>

        <!-- 历史记录列表 -->
        <div class="detail-history-section">
          <h4>历次考试明细</h4>
          <el-table :data="activeSubjectGrades" size="small" stripe>
            <el-table-column prop="exam" label="考试名称" />
            <el-table-column label="实考分数" width="130">
              <template #default="{ row }">
                <b>{{ row.score }}</b> / {{ row.full_score }}分
              </template>
            </el-table-column>
            <el-table-column label="得分率" width="120">
              <template #default="{ row }">
                <span :style="{ color: getGradeLevel(getScorePct(row)).color, fontWeight: 700 }">
                  {{ getScorePct(row) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="date" label="考试日期" width="120" />
          </el-table>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.grade-tracker-page {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-titles h2 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.header-sub {
  font-size: 12px;
  color: var(--text-sub, #64748b);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.goal-btn {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  color: #f59e0b;
  font-weight: 700;
}

.prominent-add-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
}

.refresh-btn {
  color: var(--text-sub, #64748b);
  border-color: var(--border-subtle, #e2e8f0);
}

/* 4大统揽指标卡 */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 22px;
}

.stat-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 12px;
  padding: 18px 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  border-top: 3.5px solid;
  transition: var(--theme-transition);
}

html.dark .stat-card {
  background: var(--bg-card, #131b2e) !important;
  border-color: var(--border-subtle, #1e293b) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
}

.stat-card.total { border-top-color: #3b82f6; }
.stat-card.avg { border-top-color: #f59e0b; }
.stat-card.best { border-top-color: #10b981; }
.stat-card.weak { border-top-color: #ef4444; }

.stat-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub, #64748b);
  margin-top: 4px;
}

/* 9大学科概览卡片 */
.subject-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
}

.subject-stat-card {
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(10px);
}

html.dark .subject-stat-card {
  border-color: rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45) !important;
}

.subject-stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
}

html.dark .subject-stat-card:hover {
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(59, 130, 246, 0.25) !important;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.card-emoji {
  font-size: 26px;
}

.card-subject-name {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.subject-cn {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.subject-count-tag {
  font-size: 10px;
  color: var(--text-sub, #64748b);
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.trend-tag {
  font-weight: 700;
}

.card-score-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}

.card-big-score {
  font-size: 32px;
  font-weight: 900;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.card-score-detail {
  font-size: 12px;
  color: var(--text-sub, #64748b);
  line-height: 1.5;
}

.latest-score-line b {
  color: var(--text-main, #0f172a);
}

.card-exam-name {
  font-size: 11px;
  color: var(--text-sub, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.card-goal-bar {
  margin-bottom: 12px;
}

.goal-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 6px;
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.3);
  display: inline-block;
}

html.dark .goal-pill {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.35);
}

.goal-pill.is-reached {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  border-color: rgba(16, 185, 129, 0.3);
}

html.dark .goal-pill.is-reached {
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.35);
}

.goal-pill.unset {
  color: #64748b;
  border-color: rgba(100, 116, 139, 0.3);
  cursor: pointer;
}

.card-stats-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px dashed rgba(203, 213, 225, 0.5);
}

html.dark .card-stats-row {
  border-top-color: rgba(255, 255, 255, 0.12);
}

.mini-stat {
  display: flex;
  align-items: center;
  gap: 3px;
}

.mini-label {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-sub, #64748b);
}

html.dark .mini-label {
  background: rgba(255, 255, 255, 0.1);
}

.mini-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.view-detail-cue {
  font-size: 11px;
  color: #3b82f6;
  font-weight: 700;
}

/* 图表容器 */
.chart-container {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 14px;
  padding: 22px 24px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
}

html.dark .chart-container {
  background: var(--bg-card, #131b2e) !important;
  border-color: var(--border-subtle, #1e293b) !important;
}

.chart-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.chart-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.chart-box {
  width: 100%;
  height: 420px;
}

/* 明细页筛选器 */
.detail-filter-panel {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

html.dark .detail-filter-panel {
  background: var(--bg-card, #131b2e) !important;
  border-color: var(--border-subtle, #1e293b) !important;
}

.subject-filter-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-pill-btn {
  border: 1px solid var(--border-subtle, #e2e8f0);
  background: var(--bg-card-secondary, #f8fafc);
  color: var(--text-regular, #334155);
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

html.dark .filter-pill-btn {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--text-regular, #e2e8f0);
}

.filter-pill-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.filter-pill-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
}

.filter-actions-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.exam-search-input {
  max-width: 320px;
}

.sort-select {
  width: 190px;
}

.detail-summary-strip {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--text-sub, #64748b);
  border-top: 1px dashed rgba(203, 213, 225, 0.6);
  padding-top: 10px;
}

html.dark .detail-summary-strip {
  border-top-color: rgba(255, 255, 255, 0.1);
}

.detail-summary-strip b {
  color: var(--text-main, #0f172a);
}

.table-subject-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}

.sub-emoji {
  font-size: 16px;
}

.table-gap-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.table-gap-pill.is-ok {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.text-sub-light {
  color: var(--text-sub, #94a3b8);
}

.score-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.score-text {
  width: 70px;
  font-size: 13px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.score-bar {
  flex: 1;
  height: 7px;
  background: rgba(203, 213, 225, 0.4);
  border-radius: 4px;
  overflow: hidden;
}

html.dark .score-bar {
  background: rgba(255, 255, 255, 0.12);
}

.score-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.score-pct {
  width: 45px;
  font-size: 12px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, monospace;
  text-align: right;
  color: var(--text-main, #0f172a);
}

/* 弹窗细节 */
.dialog-mode-tabs {
  margin-bottom: 20px;
  text-align: center;
}

.score-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slash {
  color: var(--text-sub, #94a3b8);
  font-weight: bold;
}

.unit {
  color: var(--text-sub, #64748b);
  font-size: 12px;
}

.batch-top-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.batch-hint {
  font-size: 11px;
  color: var(--text-sub, #64748b);
  margin-bottom: 14px;
}

.batch-subjects-table {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 6px;
}

.batch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-card-secondary, #f8fafc);
  border: 1px solid var(--border-subtle, #e2e8f0);
  padding: 8px 12px;
  border-radius: 8px;
}

html.dark .batch-row {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
}

.batch-subj-tag {
  width: 90px;
  font-weight: 800;
  font-size: 13px;
}

.batch-slash {
  color: #94a3b8;
}

.batch-unit {
  font-size: 11px;
  color: #94a3b8;
}

/* 目标分弹窗 */
.goals-intro {
  font-size: 13px;
  color: var(--text-sub, #64748b);
  margin-bottom: 16px;
  line-height: 1.6;
}

.goals-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.goal-config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--bg-card-secondary, #f8fafc);
  border: 1px solid var(--border-subtle, #e2e8f0);
}

html.dark .goal-config-row {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
}

.goal-sub-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.goal-input-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 单科深度分析弹窗 */
.detail-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 18px;
}

.summary-item {
  background: var(--bg-card-secondary, #f8fafc);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

html.dark .summary-item {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.summary-label {
  display: block;
  font-size: 11px;
  color: var(--text-sub, #64748b);
  margin-bottom: 4px;
}

.summary-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.subject-action-banner {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  padding: 12px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  gap: 16px;
}

.action-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.aim-icon {
  font-size: 24px;
}

.aim-texts {
  display: flex;
  flex-direction: column;
}

.aim-main {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.aim-sub {
  font-size: 11px;
  color: var(--text-sub, #64748b);
}

.go-wrongbook-btn {
  font-weight: 700;
  border-radius: 8px;
}

.detail-chart-section {
  margin-bottom: 20px;
}

.detail-chart-section h4,
.detail-history-section h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.detail-chart-box {
  width: 100%;
  height: 250px;
}

.empty-hint {
  padding: 60px 0;
}
</style>
