<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { api } from '../../utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'

interface PlanItem {
  id: number
  subject: string
  content: string
  date: string
  status?: string
  done: boolean
  estimated_minutes: number
}

interface DayStats {
  total: number
  done: number
}

const plans = ref<PlanItem[]>([])
const loading = ref(false)
const selectedDate = ref(todayStr())
const showAddDialog = ref(false)
const showQuickDialog = ref(false)
const quickInput = ref('')
const quickDate = ref(todayStr())
const showDoneList = ref(true)
const quickArea = ref<HTMLTextAreaElement | null>(null)
const calView = ref<'month' | 'week'>('month')
const calYear = ref(new Date().getFullYear())
const calMonth = ref(new Date().getMonth())
const dayStatsMap = ref<Record<string, DayStats>>({})
const activeFilter = ref('')
const newPlan = ref({ subject: '', content: '', date: todayStr(), estimated_minutes: 0 })
const movingId = ref<number | null>(null)
const movingDir = ref<'done' | 'undone'>('done')
const showEditDialog = ref(false)
const editingPlan = ref({ id: 0, subject: '', content: '', date: '', estimated_minutes: 0 })

const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他']

const subjectColors: Record<string, string> = {
  '语文': '#909399', '数学': '#6366f1', '英语': '#52c41a',
  '物理': '#e6a23c', '化学': '#f56c6c', '生物': '#85ce61',
  '历史': '#c45656', '地理': '#2d8cf0', '政治': '#ed4014', '其他': '#8c8c8c',
}

const subjectEmojis: Record<string, string> = {
  '语文': '📖', '数学': '📐', '英语': '🔤', '物理': '⚡',
  '化学': '🧪', '生物': '🧬', '历史': '🏛️', '地理': '🌍', '政治': '📜', '其他': '📌',
}

const subjectLightBg: Record<string, string> = {
  '语文': '#f4f4f5', '数学': '#eef2ff', '英语': '#f0f9eb',
  '物理': '#fdf6ec', '化学': '#fef0f0', '生物': '#f0f9eb',
  '历史': '#fdf2f2', '地理': '#eff6ff', '政治': '#fef2f2', '其他': '#f5f5f5',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function dateLabelStr(date: string) {
  if (date === todayStr()) return '今天'
  const d = new Date(date)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}`
}

function shortDateLabel(date: string) {
  const d = new Date(date)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}/${d.getDate()} 周${weekdays[d.getDay()]}`
}

const isToday = computed(() => selectedDate.value === todayStr())
const dateLabel = computed(() => dateLabelStr(selectedDate.value))

const dayPlans = computed(() => plans.value.filter(p => p.date === selectedDate.value))
const pendingPlans = computed(() => {
  let items = dayPlans.value.filter(p => !p.done && p.status !== 'done')
  if (activeFilter.value) items = items.filter(p => p.subject === activeFilter.value)
  return items
})
const donePlans = computed(() => {
  let items = dayPlans.value.filter(p => p.done || p.status === 'done')
  if (activeFilter.value) items = items.filter(p => p.subject === activeFilter.value)
  return items
})

const progressPct = computed(() => {
  const total = dayPlans.value.length
  if (total === 0) return 0
  return Math.round((donePlans.value.length / total) * 100)
})

const totalMinutes = computed(() => dayPlans.value.reduce((sum, p) => sum + (p.estimated_minutes || 0), 0))
const pendingMinutes = computed(() => pendingPlans.value.reduce((sum, p) => sum + (p.estimated_minutes || 0), 0))

const daySubjects = computed(() => {
  const set = new Set<string>()
  for (const p of dayPlans.value) set.add(p.subject)
  return Array.from(set)
})

const groupedPending = computed(() => {
  const map: Record<string, PlanItem[]> = {}
  for (const p of pendingPlans.value) {
    if (!map[p.subject]) map[p.subject] = []
    map[p.subject].push(p)
  }
  return map
})

const weekStats = computed(() => {
  const sel = new Date(selectedDate.value + 'T00:00:00')
  const dow = sel.getDay()
  const monday = new Date(sel)
  monday.setDate(sel.getDate() - ((dow + 6) % 7))
  let total = 0, done = 0
  let streak = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = fmtDate(d.getFullYear(), d.getMonth(), d.getDate())
    const s = getDayStats(dateStr)
    total += s.total
    done += s.done
  }
  for (let i = 0; i < 60; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = fmtDate(d.getFullYear(), d.getMonth(), d.getDate())
    const s = getDayStats(dateStr)
    if (s.total > 0 && s.done === s.total) streak++
    else break
  }
  return { total, done, pct: total > 0 ? Math.round(done / total * 100) : 0, streak }
})

const prev3Days = computed(() => {
  const result: { date: string; label: string; plans: PlanItem[] }[] = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = fmtDate(d.getFullYear(), d.getMonth(), d.getDate())
    if (dateStr === selectedDate.value) continue
    const dayItems = plans.value.filter(p => p.date === dateStr)
    result.push({ date: dateStr, label: shortDateLabel(dateStr), plans: dayItems })
  }
  return result
})

const monthDays = computed(() => {
  const y = calYear.value
  const m = calMonth.value
  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const prevDays = new Date(y, m, 0).getDate()
  const cells: { date: string; day: number; inMonth: boolean; isToday: boolean }[] = []
  for (let i = 0; i < firstDay; i++) {
    const day = prevDays - firstDay + 1 + i
    const pm = m === 0 ? 11 : m - 1
    const py = m === 0 ? y - 1 : y
    cells.push({ date: fmtDate(py, pm, day), day, inMonth: false, isToday: false })
  }
  const todayS = todayStr()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = fmtDate(y, m, d)
    cells.push({ date, day: d, inMonth: true, isToday: date === todayS })
  }
  const remain = 42 - cells.length
  for (let i = 1; i <= remain; i++) {
    const nm = m === 11 ? 0 : m + 1
    const ny = m === 11 ? y + 1 : y
    cells.push({ date: fmtDate(ny, nm, i), day: i, inMonth: false, isToday: false })
  }
  return cells
})

const weekDays = computed(() => {
  const sel = new Date(selectedDate.value + 'T00:00:00')
  const dow = sel.getDay()
  const monday = new Date(sel)
  monday.setDate(sel.getDate() - ((dow + 6) % 7))
  const cells: { date: string; day: number; inMonth: boolean; isToday: boolean; weekday: string }[] = []
  const weekdays = ['一', '二', '三', '四', '五', '六', '日']
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const date = fmtDate(d.getFullYear(), d.getMonth(), d.getDate())
    cells.push({ date, day: d.getDate(), inMonth: d.getMonth() === calMonth.value, isToday: date === todayStr(), weekday: '周' + weekdays[i] })
  }
  return cells
})

const getDayStats = (date: string): DayStats => dayStatsMap.value[date] || { total: 0, done: 0 }

const getDayDotType = (date: string): string => {
  const s = getDayStats(date)
  if (s.total === 0) return 'none'
  if (s.done === s.total) return 'full'
  if (s.done > 0) return 'partial'
  return 'empty'
}

const computeDayStats = () => {
  const map: Record<string, DayStats> = {}
  for (const p of plans.value) {
    if (!map[p.date]) map[p.date] = { total: 0, done: 0 }
    map[p.date].total++
    if (p.done || p.status === 'done') map[p.date].done++
  }
  dayStatsMap.value = map
}

const fetchPlans = async () => {
  loading.value = true
  try {
    const res = (await api.get('/study-plans')) as any[]
    plans.value = (res || []).map(p => ({
      ...p,
      done: p.done !== undefined ? Boolean(p.done) : p.status === 'done'
    }))
    computeDayStats()
  } catch {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const addPlan = async () => {
  if (!newPlan.value.subject || !newPlan.value.content || !newPlan.value.date) return
  try {
    await api.post('/study-plans', newPlan.value)
    newPlan.value = { subject: '', content: '', date: selectedDate.value, estimated_minutes: 0 }
    showAddDialog.value = false
    await fetchPlans()
    ElMessage.success('已添加')
  } catch {
    ElMessage.error('添加失败')
  }
}

const addQuickPlans = async () => {
  const text = quickInput.value.trim()
  if (!text) return
  const lines = text.split('\n').filter(l => l.trim())
  let count = 0
  for (const line of lines) {
    let subject = ''
    let content = line.trim()
    let estimated_minutes = 0
    const match = line.match(/^([^\s]+)\s+(.+)$/)
    if (match) {
      const maybe = match[1]
      if (subjects.includes(maybe)) { subject = maybe; content = match[2] }
    }
    if (!subject) subject = '数学'
    const timeMatch = content.match(/\((\d+)分?\)/)
    if (timeMatch) { estimated_minutes = parseInt(timeMatch[1]); content = content.replace(/\(\d+分?\)/, '').trim() }
    try {
      await api.post('/study-plans', { subject, content, date: quickDate.value, estimated_minutes })
      count++
    } catch { /* skip */ }
  }
  quickInput.value = ''
  showQuickDialog.value = false
  if (quickDate.value !== selectedDate.value) selectedDate.value = quickDate.value
  await fetchPlans()
  ElMessage.success(`已添加 ${count} 项`)
}

const toggleDone = async (item: PlanItem) => {
  const el = document.querySelector(`[data-plan-id="${item.id}"]`)
  let startY = 0
  if (el) startY = el.getBoundingClientRect().top

  const willBeDone = !(item.done || item.status === 'done')
  movingId.value = item.id
  movingDir.value = willBeDone ? 'done' : 'undone'

  // 立即乐观更新内存状态，实现零延迟顺畅勾选
  item.done = willBeDone
  item.status = willBeDone ? 'done' : 'pending'
  computeDayStats()

  try {
    await api.put(`/study-plans/${item.id}/toggle`)
    await fetchPlans()
  } catch {
    item.done = !willBeDone
    item.status = !willBeDone ? 'done' : 'pending'
    computeDayStats()
    ElMessage.error('操作失败')
    movingId.value = null
    return
  }

  showDoneList.value = true

  await nextTick()
  const targetEl = document.querySelector(`[data-plan-id="${item.id}"]`)
  if (el && targetEl) {
    const endY = targetEl.getBoundingClientRect().top
    const delta = startY - endY
    targetEl.animate([
      { transform: `translateY(${delta}px)`, opacity: 0.5 },
      { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' })
  }

  setTimeout(() => { movingId.value = null }, 450)
}

const removePlan = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这项学习任务吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    await api.del(`/study-plans/${id}`)
    await fetchPlans()
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

const openEdit = (item: PlanItem) => {
  editingPlan.value = { id: item.id, subject: item.subject, content: item.content, date: item.date, estimated_minutes: item.estimated_minutes || 0 }
  showEditDialog.value = true
}

const saveEdit = async () => {
  const e = editingPlan.value
  if (!e.subject || !e.content || !e.date) return
  try {
    await api.put(`/study-plans/${e.id}`, { subject: e.subject, content: e.content, date: e.date, estimated_minutes: e.estimated_minutes })
    showEditDialog.value = false
    await fetchPlans()
    ElMessage.success('已更新')
  } catch {
    ElMessage.error('更新失败')
  }
}

const prevDay = () => {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() - 1)
  selectedDate.value = fmtDate(d.getFullYear(), d.getMonth(), d.getDate())
}

const nextDay = () => {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + 1)
  selectedDate.value = fmtDate(d.getFullYear(), d.getMonth(), d.getDate())
}

const goToday = () => { selectedDate.value = todayStr() }

const selectDay = (date: string) => {
  selectedDate.value = date
  const d = new Date(date + 'T00:00:00')
  calYear.value = d.getFullYear()
  calMonth.value = d.getMonth()
}

const calPrev = () => {
  if (calMonth.value === 0) { calYear.value--; calMonth.value = 11 }
  else calMonth.value--
}

const calNext = () => {
  if (calMonth.value === 11) { calYear.value++; calMonth.value = 0 }
  else calMonth.value++
}

const calGoToday = () => {
  const d = new Date()
  calYear.value = d.getFullYear()
  calMonth.value = d.getMonth()
  selectedDate.value = todayStr()
}

const openQuickInput = () => {
  quickDate.value = selectedDate.value
  showQuickDialog.value = true
  nextTick(() => quickArea.value?.focus())
}

const monthLabel = computed(() => `${calYear.value}年${calMonth.value + 1}月`)

watch(selectedDate, (v) => {
  const d = new Date(v + 'T00:00:00')
  calYear.value = d.getFullYear()
  calMonth.value = d.getMonth()
})

onMounted(fetchPlans)
</script>

<template>
  <div class="plan-page">
    <div class="two-col">
      <!-- LEFT -->
      <div class="col-left">
        <div class="date-nav">
          <button class="nav-btn" @click="prevDay">◀</button>
          <div class="date-center" @click="goToday">
            <div class="date-main">{{ dateLabel }}</div>
            <div class="date-sub">{{ selectedDate }}</div>
          </div>
          <button class="nav-btn" @click="nextDay">▶</button>
        </div>

        <div class="top-info" v-if="dayPlans.length > 0">
          <div class="progress-mini">
            <span>{{ donePlans.length }}/{{ dayPlans.length }} 完成</span>
            <div class="progress-track-sm">
              <div class="progress-fill-sm" :style="{ width: progressPct + '%', background: progressPct === 100 ? '#52c41a' : '#6366f1' }"></div>
            </div>
            <span class="pct">{{ progressPct }}%</span>
          </div>
          <div v-if="totalMinutes > 0" class="time-estimate">
            ⏱ {{ pendingMinutes }}/{{ totalMinutes }} 分钟
          </div>
        </div>

        <div class="action-bar">
          <button class="add-btn" @click="showAddDialog = true">
            <el-icon size="15"><Plus /></el-icon> 添加
          </button>
          <button class="quick-btn" @click="openQuickInput">
            <el-icon size="13"><EditPen /></el-icon> 快速录入
          </button>
        </div>

        <div v-if="daySubjects.length > 1" class="filter-bar">
          <button :class="['filter-tag', { active: activeFilter === '' }]" @click="activeFilter = ''">全部</button>
          <button v-for="s in daySubjects" :key="s" :class="['filter-tag', { active: activeFilter === s }]" :style="activeFilter === s ? { background: subjectColors[s], color: '#fff', borderColor: subjectColors[s] } : {}" @click="activeFilter = activeFilter === s ? '' : s">
            {{ subjectEmojis[s] }} {{ s }}
          </button>
        </div>

        <div v-if="dayPlans.length === 0 && !loading" class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-text">{{ isToday ? '今天还没有计划，开始添加吧' : '这天没有计划' }}</div>
        </div>

        <div v-else class="plan-list">
          <div v-for="(items, subject) in groupedPending" :key="subject" class="subject-group">
            <div class="group-header" :style="{ color: subjectColors[subject] || '#606266' }">
              <span class="group-emoji">{{ subjectEmojis[subject] || '📚' }}</span>
              {{ subject }}
              <span class="group-count">{{ items.length }}</span>
              <span v-if="items.reduce((s,p) => s + (p.estimated_minutes||0), 0) > 0" class="group-time">⏱{{ items.reduce((s,p) => s + (p.estimated_minutes||0), 0) }}′</span>
            </div>
            <div
              v-for="item in items" :key="item.id"
              :data-plan-id="item.id"
              :class="['plan-item', 'pending', { 'just-moved': movingId === item.id && movingDir === 'undone' }]"
              :style="{ borderLeftColor: subjectColors[item.subject] || '#909399', background: subjectLightBg[item.subject] || '#f8f9fb' }"
              @click="toggleDone(item)"
              title="点击标记为已完成"
            >
              <button class="check-btn" @click.stop="toggleDone(item)" title="点击完成"></button>
              <div class="item-content">
                {{ item.content }}
                <span v-if="item.estimated_minutes" class="item-time">{{ item.estimated_minutes }}′</span>
              </div>
              <button class="del-btn" @click.stop="removePlan(item.id)" title="删除计划">
                <el-icon size="12"><Delete /></el-icon>
              </button>
              <button class="edit-btn" @click.stop="openEdit(item)" title="编辑计划">
                <el-icon size="12"><Edit /></el-icon>
              </button>
            </div>
          </div>

          <div v-if="donePlans.length > 0" class="done-section">
            <div class="done-header" @click="showDoneList = !showDoneList">
              <span>✅ 已完成 {{ donePlans.length }} 项</span>
              <el-icon size="12"><component :is="showDoneList ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
            </div>
            <div v-if="showDoneList" class="done-list">
              <div
                v-for="item in donePlans" :key="item.id"
                :data-plan-id="item.id"
                :class="['plan-item', 'done', { 'just-moved': movingId === item.id && movingDir === 'done' }]"
              >
                <button class="check-btn checked" @click="toggleDone(item)">✓</button>
                <span class="done-subject-tag" :style="{ color: subjectColors[item.subject] || '#909399', background: subjectLightBg[item.subject] || '#f0f2f5' }">{{ item.subject }}</span>
                <div class="item-content">{{ item.content }}</div>
                <button class="del-btn" @click="removePlan(item.id)">
                  <el-icon size="12"><Delete /></el-icon>
                </button>
                <button class="edit-btn" @click="openEdit(item)">
                  <el-icon size="12"><Edit /></el-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT -->
      <div class="col-right">
        <div class="week-stats-card">
          <div class="stat-item">
            <div class="stat-val">{{ weekStats.pct }}<span class="stat-unit">%</span></div>
            <div class="stat-label">本周完成率</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-val">{{ weekStats.streak }}</div>
            <div class="stat-label">连续完成天</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-val">{{ donePlans.length }}<span class="stat-unit">/{{ dayPlans.length }}</span></div>
            <div class="stat-label">今日进度</div>
          </div>
        </div>

        <div class="calendar-card">
          <div class="cal-header">
            <button class="cal-nav-btn" @click="calPrev">◀</button>
            <div class="cal-title" @click="calGoToday">{{ monthLabel }}</div>
            <button class="cal-nav-btn" @click="calNext">▶</button>
            <div class="cal-view-toggle">
              <button :class="['toggle-btn', { active: calView === 'month' }]" @click="calView = 'month'">月</button>
              <button :class="['toggle-btn', { active: calView === 'week' }]" @click="calView = 'week'">周</button>
            </div>
          </div>

          <div class="cal-weekday-row">
            <span v-for="w in ['一','二','三','四','五','六','日']" :key="w" class="cal-weekday">{{ w }}</span>
          </div>

          <div v-if="calView === 'month'" class="cal-month-grid">
            <div
              v-for="cell in monthDays" :key="cell.date"
              :class="['cal-day-cell', { 'other-month': !cell.inMonth, 'is-today': cell.isToday, 'is-selected': cell.date === selectedDate }]"
              @click="selectDay(cell.date)"
            >
              <span class="cal-day-num">{{ cell.day }}</span>
              <span class="cal-day-dot-wrap">
                <span v-if="getDayDotType(cell.date) === 'full'" class="cal-dot dot-full">●</span>
                <span v-else-if="getDayDotType(cell.date) === 'partial'" class="cal-dot dot-partial">◐</span>
                <span v-else-if="getDayDotType(cell.date) === 'empty'" class="cal-dot dot-empty">○</span>
              </span>
              <span v-if="getDayStats(cell.date).total > 0" class="cal-day-count">{{ getDayStats(cell.date).done }}/{{ getDayStats(cell.date).total }}</span>
            </div>
          </div>

          <div v-else class="cal-week-grid">
            <div
              v-for="cell in weekDays" :key="cell.date"
              :class="['cal-week-cell', { 'is-today': cell.isToday, 'is-selected': cell.date === selectedDate }]"
              @click="selectDay(cell.date)"
            >
              <div class="week-cell-weekday">{{ cell.weekday }}</div>
              <div class="week-cell-day">{{ cell.day }}</div>
              <span class="cal-day-dot-wrap">
                <span v-if="getDayDotType(cell.date) === 'full'" class="cal-dot dot-full">●</span>
                <span v-else-if="getDayDotType(cell.date) === 'partial'" class="cal-dot dot-partial">◐</span>
                <span v-else-if="getDayDotType(cell.date) === 'empty'" class="cal-dot dot-empty">○</span>
              </span>
              <div v-if="getDayStats(cell.date).total > 0" class="week-cell-stats">
                {{ getDayStats(cell.date).done }}/{{ getDayStats(cell.date).total }}
              </div>
            </div>
          </div>
        </div>

        <div class="history-section">
          <div class="history-title">近期记录</div>
          <div v-for="day in prev3Days" :key="day.date" class="history-day">
            <div class="history-day-header" @click="selectDay(day.date)">
              <span class="history-date">{{ day.label }}</span>
              <span class="history-stats">
                <span v-if="day.plans.length === 0" class="stats-empty">无计划</span>
                <span v-else-if="day.plans.every(p => p.done)" class="stats-full">✅ 全完成</span>
                <span v-else class="stats-partial">{{ day.plans.filter(p => p.done).length }}/{{ day.plans.length }}</span>
              </span>
            </div>
            <div v-if="day.plans.length > 0" class="history-items">
              <div v-for="p in day.plans.slice(0, 4)" :key="p.id" :class="['history-item', { 'is-done': p.done }]">
                <span class="history-dot" :style="{ background: subjectColors[p.subject] || '#909399' }"></span>
                <span class="history-subject">{{ p.subject }}</span>
                <span class="history-content">{{ p.content }}</span>
              </div>
              <div v-if="day.plans.length > 4" class="history-more">还有 {{ day.plans.length - 4 }} 项...</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showAddDialog" title="添加学习计划" width="460px" destroy-on-close>
      <el-form @submit.prevent="addPlan" label-width="80px">
        <el-form-item label="科目" required>
          <el-select v-model="newPlan.subject" placeholder="选择科目" filterable allow-create style="width:100%">
            <el-option v-for="s in subjects" :key="s" :label="`${subjectEmojis[s]} ${s}`" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="newPlan.content" type="textarea" :rows="2" placeholder="今天要学什么" />
        </el-form-item>
        <el-form-item label="预计时长">
          <el-input-number v-model="newPlan.estimated_minutes" :min="0" :step="15" :max="300" />
          <span style="margin-left:8px;color:#909399;font-size:12px">分钟</span>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="newPlan.date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addPlan">添加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showQuickDialog" title="快速录入" width="500px" destroy-on-close @opened="quickArea?.focus()">
      <div class="quick-date-row">
        <span class="quick-date-label">录入日期</span>
        <el-date-picker v-model="quickDate" type="date" value-format="YYYY-MM-DD" size="small" style="width:180px" />
        <span class="quick-date-text">{{ dateLabelStr(quickDate) }}</span>
      </div>
      <textarea
        ref="quickArea"
        v-model="quickInput"
        class="quick-textarea"
        placeholder="每行一条，科目开头自动识别&#10;&#10;数学 完成课后习题1-5 (30分)&#10;英语 背Unit3单词 (20分)&#10;物理 复习力学笔记&#10;&#10;无科目前缀默认为数学&#10;(XX分) 可标注预计时长"
        rows="8"
        @keydown.meta.enter="addQuickPlans"
        @keydown.ctrl.enter="addQuickPlans"
      ></textarea>
      <div class="quick-hint">⌘+Enter 快速提交</div>
      <template #footer>
        <el-button @click="showQuickDialog = false">取消</el-button>
        <el-button type="primary" @click="addQuickPlans" :disabled="!quickInput.trim()">录入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEditDialog" title="编辑计划" width="460px" destroy-on-close>
      <el-form @submit.prevent="saveEdit" label-width="80px">
        <el-form-item label="科目" required>
          <el-select v-model="editingPlan.subject" placeholder="选择科目" filterable allow-create style="width:100%">
            <el-option v-for="s in subjects" :key="s" :label="`${subjectEmojis[s]} ${s}`" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="editingPlan.content" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="预计时长">
          <el-input-number v-model="editingPlan.estimated_minutes" :min="0" :step="15" :max="300" />
          <span style="margin-left:8px;color:#909399;font-size:12px">分钟</span>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="editingPlan.date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.plan-page { max-width: 1100px; margin: 0 auto; }

.two-col { display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start; }

/* LEFT */
.date-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 16px; }
.nav-btn { border: none; background: var(--bg-card-secondary, #f0f2f5); width: 34px; height: 34px; border-radius: 10px; cursor: pointer; font-size: 13px; color: var(--text-regular, #606266); transition: all 0.2s; }
.nav-btn:hover { background: var(--border-subtle, #e4e7ed); }
.date-center { text-align: center; cursor: pointer; padding: 4px 20px; border-radius: 10px; transition: background 0.2s; }
.date-center:hover { background: var(--bg-card-secondary, #f0f2f5); }
.date-main { font-size: 20px; font-weight: 700; color: var(--text-main, #303133); }
.date-sub { font-size: 12px; color: var(--text-sub, #909399); margin-top: 2px; }

.top-info { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 10px 16px; background: var(--bg-card-secondary, #f8f9fb); border-radius: 10px; transition: var(--theme-transition); }
.progress-mini { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-regular, #606266); }
.progress-track-sm { width: 80px; height: 4px; background: var(--border-subtle, #e4e7ed); border-radius: 2px; overflow: hidden; }
.progress-fill-sm { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
.pct { font-weight: 700; color: #6366f1; font-size: 12px; }
.time-estimate { font-size: 13px; color: var(--text-sub, #909399); }

.action-bar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.add-btn { border: none; background: linear-gradient(135deg, #6366f1, #818cf8); color: #fff; padding: 7px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(99,102,241,0.3); transition: all 0.2s; }
.add-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
.quick-btn { border: 1px dashed var(--border-regular, #d5d8dc); background: var(--bg-card, #fff); color: var(--text-regular, #606266); padding: 7px 14px; border-radius: 10px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; }
.quick-btn:hover { border-color: #6366f1; color: #6366f1; }

.filter-bar { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
.filter-tag { border: 1px solid var(--border-subtle, #e4e7ed); background: var(--bg-card, #fff); color: var(--text-sub, #909399); padding: 4px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
.filter-tag:hover { border-color: #c0c4cc; }
.filter-tag.active { background: #6366f1; color: #fff; border-color: #6366f1; }

.empty-state { text-align: center; padding: 48px 0; }
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-text { font-size: 14px; color: var(--text-sub, #909399); }

.plan-list { display: flex; flex-direction: column; gap: 16px; }
.subject-group { display: flex; flex-direction: column; gap: 6px; }
.group-header { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; padding: 0 4px; color: var(--text-main, #303133); }
.group-emoji { font-size: 18px; }
.group-count { font-size: 11px; background: rgba(0,0,0,0.06); padding: 1px 7px; border-radius: 8px; color: var(--text-sub, #909399); font-weight: 500; }
.group-time { font-size: 11px; color: var(--text-sub, #909399); margin-left: 4px; }

.plan-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; border-left: 3px solid; background: var(--bg-card, #ffffff); transition: all 0.2s; cursor: pointer; user-select: none; }
.plan-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.plan-item.pending:hover { transform: translateX(3px); }
.plan-item.done { border-left-color: #52c41a; background: #f0f9eb !important; }
.plan-item.done .item-content { text-decoration: line-through; color: #b0b5bd; }

.plan-item.just-moved {
  animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideIn {
  0% { opacity: 0.5; transform: scale(0.98); }
  100% { opacity: 1; transform: scale(1); }
}

.check-btn { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #c0c4cc; background: var(--bg-card, #fff); cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #52c41a; transition: all 0.2s; }
.check-btn:hover { border-color: #6366f1; }
.check-btn.checked { border-color: #52c41a; background: #52c41a; color: #fff; }

.item-content { flex: 1; font-size: 13px; color: var(--text-main, #303133); line-height: 1.5; }
.item-time { font-size: 11px; color: #c0c4cc; margin-left: 6px; }
.done-subject-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; flex-shrink: 0; line-height: 1.4; }

.del-btn { border: none; background: none; cursor: pointer; color: #c0c4cc; padding: 4px; border-radius: 4px; opacity: 0; transition: all 0.2s; }
.plan-item:hover .del-btn { opacity: 1; }
.plan-item.done:hover .del-btn { opacity: 1; }
.del-btn:hover { color: #f56c6c; background: #fef0f0; }
.edit-btn { border: none; background: none; cursor: pointer; color: #c0c4cc; padding: 4px; border-radius: 4px; opacity: 0; transition: all 0.2s; }
.plan-item:hover .edit-btn { opacity: 1; }
.plan-item.done:hover .edit-btn { opacity: 1; }
.edit-btn:hover { color: #6366f1; background: #eef2ff; }

.done-section { background: var(--bg-card-secondary, #f8f9fb); border-radius: 12px; padding: 10px 14px; transition: var(--theme-transition); }
.done-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 13px; color: var(--text-sub, #909399); user-select: none; }
.done-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }

/* RIGHT */
.col-right { position: sticky; top: 20px; }
.week-stats-card { display: flex; align-items: center; justify-content: space-around; background: linear-gradient(135deg, #6366f1, #818cf8); border-radius: 14px; padding: 16px 12px; margin-bottom: 16px; color: #fff; }
.stat-item { text-align: center; }
.stat-val { font-size: 26px; font-weight: 800; line-height: 1.2; }
.stat-unit { font-size: 13px; font-weight: 400; opacity: 0.8; }
.stat-label { font-size: 11px; opacity: 0.7; margin-top: 2px; }
.stat-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.2); }

.calendar-card { background: var(--bg-card, #fff); border-radius: 14px; padding: 14px; margin-bottom: 16px; border: 1px solid var(--border-subtle, #f0f2f5); transition: var(--theme-transition); }
.cal-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.cal-nav-btn { border: none; background: var(--bg-card-secondary, #f0f2f5); width: 26px; height: 26px; border-radius: 7px; cursor: pointer; font-size: 10px; color: var(--text-regular, #606266); transition: all 0.2s; }
.cal-nav-btn:hover { background: var(--border-subtle, #e4e7ed); }
.cal-title { font-size: 14px; font-weight: 700; color: var(--text-main, #303133); cursor: pointer; padding: 2px 8px; border-radius: 6px; transition: background 0.2s; }
.cal-title:hover { background: var(--bg-card-secondary, #f0f2f5); }
.cal-view-toggle { margin-left: auto; display: flex; background: var(--bg-card-secondary, #f0f2f5); border-radius: 7px; overflow: hidden; }
.toggle-btn { border: none; background: none; padding: 3px 12px; font-size: 11px; color: var(--text-sub, #909399); cursor: pointer; font-weight: 500; transition: all 0.2s; }
.toggle-btn.active { background: #6366f1; color: #fff; }

.cal-weekday-row { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 2px; }
.cal-weekday { font-size: 10px; color: var(--text-sub, #c0c4cc); font-weight: 600; padding: 3px 0; }

.cal-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
.cal-day-cell { display: flex; flex-direction: column; align-items: center; padding: 4px 1px 3px; border-radius: 7px; cursor: pointer; transition: all 0.15s; min-height: 38px; }
.cal-day-cell:hover { background: var(--bg-card-secondary, #f0f2f5); }
.cal-day-cell.other-month { opacity: 0.3; }
.cal-day-cell.is-today .cal-day-num { background: #6366f1; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.cal-day-cell.is-selected { background: #eef2ff; border: 1px solid #c7d2fe; }
.dark .cal-day-cell.is-selected { background: rgba(99, 102, 241, 0.2); border-color: rgba(99, 102, 241, 0.5); }
.cal-day-num { font-size: 12px; font-weight: 600; color: var(--text-main, #303133); line-height: 1; }
.cal-day-dot-wrap { height: 12px; display: flex; align-items: center; justify-content: center; }
.cal-dot { font-size: 7px; line-height: 1; }
.dot-full { color: #52c41a; font-size: 8px; }
.dot-partial { color: #e6a23c; font-size: 9px; }
.dot-empty { color: var(--border-subtle, #dcdfe6); }
.cal-day-count { font-size: 8px; color: var(--text-sub, #909399); line-height: 1; }

.cal-week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cal-week-cell { display: flex; flex-direction: column; align-items: center; padding: 8px 3px 6px; border-radius: 8px; cursor: pointer; transition: all 0.15s; min-height: 60px; }
.cal-week-cell:hover { background: var(--bg-card-secondary, #f0f2f5); }
.cal-week-cell.is-today .week-cell-day { background: #6366f1; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.cal-week-cell.is-selected { background: #eef2ff; border: 1px solid #c7d2fe; }
.dark .cal-week-cell.is-selected { background: rgba(99, 102, 241, 0.2); border-color: rgba(99, 102, 241, 0.5); }
.week-cell-weekday { font-size: 10px; color: var(--text-sub, #909399); font-weight: 500; margin-bottom: 3px; }
.week-cell-day { font-size: 14px; font-weight: 700; color: var(--text-main, #303133); line-height: 1; margin-bottom: 3px; }
.week-cell-stats { font-size: 9px; color: var(--text-sub, #909399); margin-top: 1px; }

.history-section { background: var(--bg-card, #fff); border-radius: 14px; padding: 14px; border: 1px solid var(--border-subtle, #f0f2f5); transition: var(--theme-transition); }
.history-title { font-size: 13px; font-weight: 700; color: var(--text-main, #303133); margin-bottom: 10px; }
.history-day { margin-bottom: 10px; }
.history-day:last-child { margin-bottom: 0; }
.history-day-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 4px 0; transition: color 0.2s; }
.history-day-header:hover { color: #6366f1; }
.history-date { font-size: 12px; font-weight: 600; color: var(--text-regular, #606266); }
.stats-empty { font-size: 11px; color: var(--text-sub, #c0c4cc); }
.stats-full { font-size: 11px; color: #52c41a; }
.stats-partial { font-size: 11px; color: #e6a23c; }
.history-items { margin-top: 4px; }
.history-item { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 12px; color: var(--text-regular, #606266); }
.history-item.is-done { color: var(--text-sub, #c0c4cc); text-decoration: line-through; }
.history-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.history-subject { font-weight: 600; flex-shrink: 0; min-width: 24px; }
.history-content { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-more { font-size: 11px; color: var(--text-sub, #c0c4cc); padding-left: 11px; }

/* 快速录入弹窗样式 */
.quick-date-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: var(--bg-card-secondary, #f8f9fb);
  border: 1px solid var(--border-subtle, #e4e7ed);
  border-radius: 10px;
  transition: var(--theme-transition);
}
.quick-date-label { font-size: 13px; color: var(--text-main, #334155); font-weight: 600; }
.quick-date-text { font-size: 12px; color: var(--text-sub, #909399); }

.quick-textarea {
  width: 100%;
  border: 1px solid var(--border-subtle, #e4e7ed);
  background-color: var(--bg-card-secondary, #ffffff);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.8;
  resize: vertical;
  font-family: inherit;
  color: var(--text-main, #0f172a);
  -webkit-text-fill-color: var(--text-main, #0f172a);
  caret-color: #6366f1;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.quick-textarea:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.quick-textarea::placeholder {
  color: var(--text-sub, #94a3b8);
  -webkit-text-fill-color: var(--text-sub, #94a3b8);
  opacity: 0.8;
}

.quick-hint {
  font-size: 12px;
  color: var(--text-sub, #94a3b8);
  margin-top: 8px;
}

/* 暗色模式专属深阶接管 */
:global(html.dark) .quick-textarea {
  background-color: #1a233a !important;
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
  border-color: #26334a !important;
  caret-color: #818cf8 !important;
}

:global(html.dark) .quick-textarea::placeholder {
  color: #64748b !important;
  -webkit-text-fill-color: #64748b !important;
}

:global(html.dark) .quick-date-row {
  background-color: #1a233a !important;
  border-color: #26334a !important;
}

:global(html.dark) .quick-date-label {
  color: #f8fafc !important;
}

:global(html.dark) .quick-hint {
  color: #94a3b8 !important;
}
</style>
