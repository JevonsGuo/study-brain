<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { api } from '../../utils/api'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { subjectEmojis } from '../../utils/subjects'

interface Grade {
  id: number
  subject: string
  exam: string
  score: number
  full_score: number
  date: string
}

const grades = ref<Grade[]>([])
const loading = ref(false)
const newGrade = ref({ subject: '', exam: '', score: 0, full_score: 150, date: '' })
const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他']
const activeTab = ref('overview')
const showAddDialog = ref(false)
const showSubjectDialog = ref(false)
const activeSubjectStat = ref<{
  subject: string; avg: number; max: number; min: number; count: number;
  trend: number; latest: Grade; latestPct: number
} | null>(null)
const activeSubjectGrades = computed(() => {
  if (!activeSubjectStat.value) return []
  return sortedGrades.value.filter(g => g.subject === activeSubjectStat.value!.subject)
})

const openSubjectDetail = (stat: typeof activeSubjectStat.value) => {
  activeSubjectStat.value = stat
  showSubjectDialog.value = true
  nextTick(() => renderSubjectTrendChart())
}

let subjectTrendChart: echarts.ECharts | null = null

const renderSubjectTrendChart = () => {
  const el = document.getElementById('subject-trend-chart')
  if (!el || !activeSubjectStat.value) return
  if (subjectTrendChart) subjectTrendChart.dispose()
  subjectTrendChart = echarts.init(el)

  const sg = activeSubjectGrades.value
  const color = subjectColors[activeSubjectStat.value.subject] || '#409eff'

  subjectTrendChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ value: number; axisValue: string; dataIndex: number }>) => {
        const p = params[0]
        const g = sg[p.dataIndex]
        return `<b>${p.axisValue}</b><br/>${p.value}%${g ? ` (${g.score}/${g.full_score})` : ''}`
      },
    },
    grid: { top: 20, left: 45, right: 20, bottom: 30 },
    xAxis: { type: 'category', data: sg.map(g => g.date), axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'value', min: 40, max: 100,
      axisLabel: { fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { type: 'dashed' } },
    },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 10,
      data: sg.map(g => getScorePct(g)),
      lineStyle: { width: 3, color },
      itemStyle: { color },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: color + '40' },
        { offset: 1, color: color + '05' },
      ])},
      markLine: {
        silent: true,
        data: [{ yAxis: activeSubjectStat.value.avg, name: '平均', lineStyle: { color: color, type: 'dashed' }, label: { formatter: `均${activeSubjectStat.value.avg}%` } }],
      },
    }],
  })
}

const subjectColors: Record<string, string> = {
  '语文': '#909399', '数学': '#409eff', '英语': '#67c23a',
  '物理': '#e6a23c', '化学': '#f56c6c', '生物': '#85ce61',
  '历史': '#c45656', '地理': '#2d8cf0', '政治': '#ed4014',
}

const subjectGradients: Record<string, string> = {
  '语文': 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 100%)',
  '数学': 'linear-gradient(135deg, #b3d8ff 0%, #ecf5ff 100%)',
  '英语': 'linear-gradient(135deg, #b3e19d 0%, #f0f9eb 100%)',
  '物理': 'linear-gradient(135deg, #f3d19e 0%, #fdf6ec 100%)',
  '化学': 'linear-gradient(135deg, #fab6b6 0%, #fef0f0 100%)',
  '生物': 'linear-gradient(135deg, #95d475 0%, #f0f9eb 100%)',
  '历史': 'linear-gradient(135deg, #c2c2c2 0%, #f5f5f5 100%)',
  '地理': 'linear-gradient(135deg, #79bbff 0%, #ecf5ff 100%)',
  '政治': 'linear-gradient(135deg, #f89898 0%, #fef0f0 100%)',
}

const fetchGrades = async () => {
  loading.value = true
  try {
    grades.value = await api.get('/grades')
    await nextTick()
    renderCharts()
  } catch {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const addGrade = async () => {
  if (!newGrade.value.subject || !newGrade.value.exam || !newGrade.value.date) return
  try {
    await api.post('/grades', newGrade.value)
    newGrade.value = { subject: '', exam: '', score: 0, full_score: 150, date: '' }
    await fetchGrades()
    ElMessage.success('添加成功')
  } catch {
    ElMessage.error('添加失败')
  }
}

const removeGrade = async (id: number) => {
  try {
    await api.del(`/grades/${id}`)
    await fetchGrades()
    ElMessage.success('已删除')
  } catch {
    ElMessage.error('删除失败')
  }
}

const getBarStyle = (grade: Grade) => {
  const pct = (grade.score / grade.full_score) * 100
  const color = pct >= 90 ? '#52c41a' : pct >= 75 ? '#1890ff' : pct >= 60 ? '#faad14' : '#f5222d'
  return { width: pct + '%', background: color }
}

const getScorePct = (grade: Grade) => Math.round((grade.score / grade.full_score) * 1000) / 10

const sortedGrades = computed(() => {
  return [...grades.value].sort((a, b) => a.date.localeCompare(b.date))
})

const subjectStats = computed(() => {
  const map: Record<string, { scores: number[]; pcts: number[]; count: number; latest: Grade | null }> = {}
  for (const g of sortedGrades.value) {
    if (!map[g.subject]) map[g.subject] = { scores: [], pcts: [], count: 0, latest: null }
    map[g.subject].scores.push(g.score)
    map[g.subject].pcts.push(getScorePct(g))
    map[g.subject].count++
    map[g.subject].latest = g
  }
  const result: Array<{
    subject: string; avg: number; max: number; min: number; count: number;
    trend: number; latest: Grade; latestPct: number
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
      subject, avg: Math.round(avg * 10) / 10, max: Math.round(max * 10) / 10,
      min: Math.round(min * 10) / 10, count: data.count, trend,
      latest: data.latest!, latestPct: data.pcts[data.pcts.length - 1],
    })
  }
  return result
})

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

const trendText = (t: number) => t > 0 ? `↑${t}%` : t < 0 ? `↓${Math.abs(t)}%` : '→0%'
const trendTag = (t: number) => t > 2 ? 'danger' : t < -2 ? 'success' : 'info'

const getGradeLevel = (pct: number) => {
  if (pct >= 90) return { text: '优秀', color: '#52c41a', bg: '#f6ffed' }
  if (pct >= 80) return { text: '良好', color: '#409eff', bg: '#ecf5ff' }
  if (pct >= 70) return { text: '中等', color: '#e6a23c', bg: '#fdf6ec' }
  if (pct >= 60) return { text: '及格', color: '#fa8c16', bg: '#fff7e6' }
  return { text: '需努力', color: '#f5222d', bg: '#fff1f0' }
}

const getSubjectAnalysis = (stat: typeof activeSubjectStat.value) => {
  if (!stat) return { stability: '', suggestion: '' }
  const range = stat.max - stat.min
  const stability = range <= 5 ? '非常稳定' : range <= 10 ? '较稳定' : range <= 15 ? '波动较大' : '很不稳定'
  const suggestions: string[] = []
  if (stat.latestPct < 60) suggestions.push('基础薄弱，建议回归课本夯实基础')
  else if (stat.latestPct < 75) suggestions.push('有提升空间，建议针对性刷题补短板')
  else if (stat.latestPct < 85) suggestions.push('良好水平，注意减少粗心失分')
  else suggestions.push('优秀水平，保持并挑战难题')
  if (stat.trend < -3) suggestions.push('成绩下滑明显，需要重视')
  else if (stat.trend > 3) suggestions.push('进步显著，继续保持')
  if (range > 15) suggestions.push('成绩波动大，需保持稳定发挥')
  return { stability, suggestion: suggestions.join('；') }
}

let trendChart: echarts.ECharts | null = null
let radarChart: echarts.ECharts | null = null
let barChart: echarts.ECharts | null = null

const renderCharts = () => {
  renderTrendChart()
  renderRadarChart()
  renderBarChart()
}

const renderTrendChart = () => {
  const el = document.getElementById('trend-chart')
  if (!el || grades.value.length === 0) return
  if (trendChart) trendChart.dispose()
  trendChart = echarts.init(el)

  const subjectMap: Record<string, Array<{ date: string; pct: number; exam: string }>> = {}
  for (const g of sortedGrades.value) {
    if (!subjectMap[g.subject]) subjectMap[g.subject] = []
    subjectMap[g.subject].push({ date: g.date, pct: getScorePct(g), exam: g.exam })
  }

  const series = Object.entries(subjectMap).map(([subject, data]) => ({
    name: subject,
    type: 'line' as const,
    smooth: true,
    symbol: 'circle',
    symbolSize: 8,
    data: data.map(d => [d.date, d.pct]),
    lineStyle: { width: 2 },
    itemStyle: { color: subjectColors[subject] || '#909399' },
  }))

  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ seriesName: string; value: [string, number] }>) => {
        let html = `<b>${params[0].value[0]}</b><br/>`
        for (const p of params) {
          html += `${p.seriesName}: ${p.value[1]}%<br/>`
        }
        return html
      },
    },
    legend: { top: 0, textStyle: { fontSize: 12 } },
    grid: { top: 40, left: 50, right: 20, bottom: 30 },
    xAxis: { type: 'category', boundaryGap: false, axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'value', min: 40, max: 100,
      axisLabel: { fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { type: 'dashed' } },
    },
    series,
  })
}

const renderRadarChart = () => {
  const el = document.getElementById('radar-chart')
  if (!el || subjectStats.value.length === 0) return
  if (radarChart) radarChart.dispose()
  radarChart = echarts.init(el)

  const stats = subjectStats.value
  const indicator = stats.map(s => ({ name: s.subject, max: 100 }))

  radarChart.setOption({
    tooltip: {},
    radar: {
      indicator,
      radius: '65%',
      axisName: { fontSize: 12, color: '#606266' },
      splitArea: { areaStyle: { color: ['rgba(64,158,255,0.05)', 'rgba(64,158,255,0.1)'] } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: stats.map(s => s.avg),
        name: '平均得分率',
        areaStyle: { opacity: 0.2, color: '#409eff' },
        lineStyle: { color: '#409eff', width: 2 },
        itemStyle: { color: '#409eff' },
      }],
    }],
  })
}

const renderBarChart = () => {
  const el = document.getElementById('bar-chart')
  if (!el || subjectStats.value.length === 0) return
  if (barChart) barChart.dispose()
  barChart = echarts.init(el)

  const stats = subjectStats.value

  barChart.setOption({
    tooltip: { trigger: 'axis', formatter: (params: Array<{ seriesName: string; value: number; name: string }>) => {
      let html = `<b>${params[0].name}</b><br/>`
      for (const p of params) html += `${p.seriesName}: ${p.value}%<br/>`
      return html
    }},
    legend: { top: 0, textStyle: { fontSize: 12 } },
    grid: { top: 40, left: 50, right: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: stats.map(s => s.subject),
      axisLabel: { fontSize: 12 },
    },
    yAxis: {
      type: 'value', min: 0, max: 100,
      axisLabel: { fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { type: 'dashed' } },
    },
    series: [
      {
        name: '最高', type: 'bar', barWidth: 12,
        data: stats.map(s => s.max),
        itemStyle: { color: '#67c23a', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '平均', type: 'bar', barWidth: 12,
        data: stats.map(s => s.avg),
        itemStyle: { color: '#409eff', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '最低', type: 'bar', barWidth: 12,
        data: stats.map(s => s.min),
        itemStyle: { color: '#f56c6c', borderRadius: [4, 4, 0, 0] },
      },
    ],
  })
}

watch(activeTab, () => nextTick(renderCharts))

onMounted(fetchGrades)

window.addEventListener('resize', () => {
  trendChart?.resize()
  radarChart?.resize()
  barChart?.resize()
  subjectTrendChart?.resize()
})
</script>

<template>
  <div class="grade-tracker-page">
    <div class="page-header">
      <h2>成绩追踪</h2>
      <el-button type="primary" size="small" @click="showAddDialog = true" :icon="'Plus'">录入成绩</el-button>
    </div>

    <div v-if="overallStats" class="stats-overview">
      <div class="stat-card total">
        <div class="stat-value">{{ overallStats.total }}</div>
        <div class="stat-label">考试次数</div>
      </div>
      <div class="stat-card avg">
        <div class="stat-value">{{ overallStats.avgPct }}%</div>
        <div class="stat-label">平均得分率</div>
      </div>
      <div class="stat-card best">
        <div class="stat-value">{{ overallStats.maxPct }}%</div>
        <div class="stat-label">最高得分率</div>
      </div>
      <div class="stat-card weak">
        <div class="stat-value">{{ overallStats.minPct }}%</div>
        <div class="stat-label">最低得分率</div>
      </div>
    </div>

    <el-dialog v-model="showAddDialog" title="录入成绩" width="520px" destroy-on-close>
      <el-form @submit.prevent="addGrade" label-width="80px">
        <el-form-item label="科目" required>
          <el-select v-model="newGrade.subject" placeholder="选择科目" filterable allow-create>
            <el-option v-for="s in subjects" :key="s" :label="`${subjectEmojis[s] || '📚'} ${s}`" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="考试" required>
          <el-input v-model="newGrade.exam" placeholder="如：月考一、期中考试" />
        </el-form-item>
        <el-form-item label="分数" required>
          <div style="display:flex;gap:12px;align-items:center">
            <el-input-number v-model="newGrade.score" :min="0" :max="newGrade.full_score" />
            <span style="color:#909399">/</span>
            <el-input-number v-model="newGrade.full_score" :min="1" />
            <span style="color:#909399">满分</span>
          </div>
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker v-model="newGrade.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addGrade">录入</el-button>
      </template>
    </el-dialog>

    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="科目概览" name="overview">
        <div v-if="subjectStats.length === 0" class="empty-hint">
          <el-empty description="暂无成绩数据，请先录入" />
        </div>
        <div v-else class="subject-cards">
          <div
            v-for="s in subjectStats"
            :key="s.subject"
            class="subject-stat-card"
            :style="{ background: subjectGradients[s.subject] || 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }"
            @click="openSubjectDetail(s)"
          >
            <div class="card-top">
              <div class="card-emoji">{{ subjectEmojis[s.subject] || '📚' }}</div>
              <div class="card-subject">{{ s.subject }}</div>
              <el-tag :type="trendTag(s.trend)" size="small" class="trend-tag" effect="dark">{{ trendText(s.trend) }}</el-tag>
            </div>
            <div class="card-score-row">
              <div class="card-big-score">{{ s.latestPct }}%</div>
              <div class="card-score-detail">
                <div>最近: {{ s.latest.score }}/{{ s.latest.full_score }}</div>
                <div class="card-exam-name">{{ s.latest.exam }}</div>
              </div>
            </div>
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
              <div class="mini-stat">
                <span class="mini-label">次</span>
                <span class="mini-value">{{ s.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="趋势分析" name="trend">
        <div v-if="grades.length === 0" class="empty-hint">
          <el-empty description="暂无数据" />
        </div>
        <div v-else class="chart-container">
          <h4 class="chart-title">各科成绩趋势</h4>
          <div id="trend-chart" class="chart-box"></div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="能力雷达" name="radar">
        <div v-if="subjectStats.length === 0" class="empty-hint">
          <el-empty description="暂无数据" />
        </div>
        <div v-else class="chart-container">
          <h4 class="chart-title">各科平均得分率雷达图</h4>
          <div id="radar-chart" class="chart-box"></div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="科目对比" name="compare">
        <div v-if="subjectStats.length === 0" class="empty-hint">
          <el-empty description="暂无数据" />
        </div>
        <div v-else class="chart-container">
          <h4 class="chart-title">各科最高/平均/最低对比</h4>
          <div id="bar-chart" class="chart-box"></div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="成绩明细" name="detail">
        <el-table :data="sortedGrades" stripe v-loading="loading" class="grade-table">
          <el-table-column prop="subject" label="科目" width="100">
            <template #default="{ row }">
              {{ subjectEmojis[row.subject] || '' }} {{ row.subject }}
            </template>
          </el-table-column>
          <el-table-column prop="exam" label="考试" width="140" />
          <el-table-column label="分数" width="220">
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
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button size="small" type="danger" text @click="removeGrade(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="showSubjectDialog"
      :title="`${subjectEmojis[activeSubjectStat?.subject || ''] || ''} ${activeSubjectStat?.subject || ''} 详细分析`"
      width="720px"
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
            <el-tag :color="getGradeLevel(activeSubjectStat.latestPct).bg" :style="{ color: getGradeLevel(activeSubjectStat.latestPct).color, border: 'none' }" size="small">
              {{ getGradeLevel(activeSubjectStat.latestPct).text }}
            </el-tag>
          </div>
          <div class="summary-item">
            <span class="summary-label">平均得分率</span>
            <span class="summary-value">{{ activeSubjectStat.avg }}%</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">成绩趋势</span>
            <span class="summary-value" :style="{ color: activeSubjectStat.trend > 0 ? '#f5222d' : activeSubjectStat.trend < 0 ? '#52c41a' : '#909399' }">
              {{ trendText(activeSubjectStat.trend) }}
            </span>
          </div>
          <div class="summary-item">
            <span class="summary-label">波动范围</span>
            <span class="summary-value">{{ activeSubjectStat.min }}% ~ {{ activeSubjectStat.max }}%</span>
          </div>
        </div>

        <div class="detail-analysis">
          <div class="analysis-item">
            <el-icon color="#e6a23c"><Warning /></el-icon>
            <span>稳定性：<b>{{ getSubjectAnalysis(activeSubjectStat).stability }}</b></span>
          </div>
          <div class="analysis-item">
            <el-icon color="#409eff"><Promotion /></el-icon>
            <span>{{ getSubjectAnalysis(activeSubjectStat).suggestion }}</span>
          </div>
        </div>

        <div class="detail-chart-section">
          <h4>成绩走势</h4>
          <div id="subject-trend-chart" class="detail-chart-box"></div>
        </div>

        <div class="detail-history-section">
          <h4>历次成绩</h4>
          <el-table :data="activeSubjectGrades" size="small" stripe>
            <el-table-column prop="exam" label="考试" />
            <el-table-column label="分数" width="120">
              <template #default="{ row }">
                {{ row.score }}/{{ row.full_score }}
              </template>
            </el-table-column>
            <el-table-column label="得分率" width="100">
              <template #default="{ row }">
                <span :style="{ color: getGradeLevel(getScorePct(row)).color, fontWeight: 600 }">
                  {{ getScorePct(row) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="date" label="日期" width="120" />
          </el-table>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.grade-tracker-page h2 {
  margin: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  border-top: 3px solid;
}

.stat-card.total { border-top-color: #409eff; }
.stat-card.avg { border-top-color: #e6a23c; }
.stat-card.best { border-top-color: #52c41a; }
.stat-card.weak { border-top-color: #f56c6c; }

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.subject-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.subject-stat-card {
  border-radius: 16px;
  padding: 22px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.06);
}

.subject-stat-card:hover {
  transform: scale(1.06);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  position: relative;
  z-index: 1;
}

.card-emoji {
  font-size: 28px;
}

.card-subject {
  font-size: 17px;
  font-weight: 700;
  color: #303133;
  flex: 1;
}

.trend-tag {
  font-weight: 600;
}

.card-score-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  position: relative;
  z-index: 1;
}

.card-big-score {
  font-size: 34px;
  font-weight: 700;
  color: #303133;
}

.card-score-detail {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.card-exam-name {
  color: #909399;
  font-size: 11px;
}

.card-stats-row {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(0,0,0,0.08);
  position: relative;
  z-index: 1;
}

.mini-stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mini-label {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0,0,0,0.06);
  color: #606266;
}

.mini-value {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.chart-container {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.chart-title {
  margin: 0 0 16px;
  font-size: 15px;
  color: #606266;
}

.chart-box {
  width: 100%;
  height: 400px;
}

.score-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.score-text {
  width: 70px;
  font-size: 13px;
  font-weight: 500;
}

.score-bar {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.score-pct {
  width: 45px;
  font-size: 12px;
  color: #909399;
  text-align: right;
}

.empty-hint {
  padding: 60px 0;
}

.detail-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.summary-item {
  background: #f8f9fb;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.summary-label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.detail-analysis {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.analysis-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.detail-chart-section {
  margin-bottom: 20px;
}

.detail-chart-section h4,
.detail-history-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #606266;
}

.detail-chart-box {
  width: 100%;
  height: 250px;
}
</style>
