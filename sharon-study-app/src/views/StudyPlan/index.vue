<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { api } from '../../utils/api'
import { ElMessage } from 'element-plus'
import { subjectEmojis } from '../../utils/subjects'

interface PlanItem {
  id: number
  subject: string
  content: string
  date: string
  done: boolean
}

interface DayStats {
  total: number
  done: number
}

const plans = ref<PlanItem[]>([])
const loading = ref(false)
const newPlan = ref({ subject: '', content: '', date: todayStr() })
const selectedDate = ref(todayStr())
const showAddDialog = ref(false)
const showQuickDialog = ref(false)
const showCalDialog = ref(false)
const quickInput = ref('')
const quickDate = ref(todayStr())
const showDoneList = ref(true)
const quickArea = ref<HTMLTextAreaElement | null>(null)
const calView = ref<'month' | 'week'>('month')
const calYear = ref(new Date().getFullYear())
const calMonth = ref(new Date().getMonth())
const dayStatsMap = ref<Record<string, DayStats>>({})

const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

const subjectColors: Record<string, string> = {
  '语文': '#909399', '数学': '#6366f1', '英语': '#52c41a',
  '物理': '#e6a23c', '化学': '#f56c6c', '生物': '#85ce61',
  '历史': '#c45656', '地理': '#2d8cf0', '政治': '#ed4014',
}

const subjectLightBg: Record<string, string> = {
  '语文': '#f4f4f5', '数学': '#eef2ff', '英语': '#f0f9eb',
  '物理': '#fdf6ec', '化学': '#fef0f0', '生物': '#f0f9eb',
  '历史': '#fdf2f2', '地理': '#eff6ff', '政治': '#fef2f2',
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

const isToday = computed(() => selectedDate.value === todayStr())

const dateLabel = computed(() => dateLabelStr(selectedDate.value))

const dayPlans = computed(() => plans.value.filter(p => p.date === selectedDate.value))
const pendingPlans = computed(() => dayPlans.value.filter(p => !p.done))
const donePlans = computed(() => dayPlans.value.filter(p => p.done))

const progressPct = computed(() => {
  const total = dayPlans.value.length
  if (total === 0) return 0
  return Math.round((donePlans.value.length / total) * 100)
})

const groupedPending = computed(() => {
  const map: Record<string, PlanItem[]> = {}
  for (const p of pendingPlans.value) {
    if (!map[p.subject]) map[p.subject] = []
    map[p.subject].push(p)
  }
  return map
})

const todayDotType = computed(() => {
  const s = getDayStats(todayStr())
  if (s.total === 0) return 'none'
  if (s.done === s.total) return 'full'
  if (s.done > 0) return 'partial'
  return 'empty'
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

const getDayStats = (date: string): DayStats => {
  return dayStatsMap.value[date] || { total: 0, done: 0 }
}

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
    if (p.done) map[p.date].done++
  }
  dayStatsMap.value = map
}

const fetchPlans = async () => {
  loading.value = true
  try {
    plans.value = await api.get('/study-plans')
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
    newPlan.value = { subject: '', content: '', date: selectedDate.value }
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
    const match = line.match(/^([^\s]+)\s+(.+)$/)
    if (match) {
      const maybe = match[1]
      if (subjects.includes(maybe)) {
        subject = maybe
        content = match[2]
      }
    }
    if (!subject) subject = '数学'
    try {
      await api.post('/study-plans', { subject, content, date: quickDate.value })
      count++
    } catch {
      // skip
    }
  }
  quickInput.value = ''
  showQuickDialog.value = false
  if (quickDate.value !== selectedDate.value) {
    selectedDate.value = quickDate.value
  }
  await fetchPlans()
  ElMessage.success(`已添加 ${count} 项`)
}

const toggleDone = async (item: PlanItem) => {
  try {
    await api.put(`/study-plans/${item.id}/toggle`)
    await fetchPlans()
  } catch {
    ElMessage.error('操作失败')
  }
}

const removePlan = async (id: number) => {
  try {
    await api.del(`/study-plans/${id}`)
    await fetchPlans()
    ElMessage.success('已删除')
  } catch {
    ElMessage.error('删除失败')
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
  showCalDialog.value = false
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

const openCalendar = () => {
  const d = new Date(selectedDate.value + 'T00:00:00')
  calYear.value = d.getFullYear()
  calMonth.value = d.getMonth()
  showCalDialog.value = true
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
    <div class="top-row">
      <div class="date-nav">
        <button class="nav-btn" @click="prevDay">◀</button>
        <div class="date-center" @click="goToday">
          <div class="date-main">{{ dateLabel }}</div>
          <div class="date-sub">{{ selectedDate }}</div>
        </div>
        <button class="nav-btn" @click="nextDay">▶</button>
        <button class="cal-open-btn" @click="openCalendar" title="查看日历">
          <span class="cal-open-icon">📅</span>
          <span v-if="todayDotType === 'full'" class="cal-badge badge-full"></span>
          <span v-else-if="todayDotType === 'partial'" class="cal-badge badge-partial"></span>
        </button>
      </div>
      <div class="action-bar">
        <button class="add-btn" @click="showAddDialog = true">
          <el-icon size="16"><Plus /></el-icon>
          添加
        </button>
        <button class="quick-btn" @click="openQuickInput">
          <el-icon size="14"><EditPen /></el-icon>
          快速录入
        </button>
      </div>
    </div>

    <div class="progress-bar-wrap" v-if="dayPlans.length > 0">
      <div class="progress-info">
        <span class="progress-text">{{ donePlans.length }}/{{ dayPlans.length }} 已完成</span>
        <span class="progress-pct">{{ progressPct }}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progressPct + '%', background: progressPct === 100 ? '#52c41a' : '#6366f1' }"></div>
      </div>
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
        </div>
        <div
          v-for="item in items" :key="item.id"
          class="plan-item pending"
          :style="{ borderLeftColor: subjectColors[item.subject] || '#909399', background: subjectLightBg[item.subject] || '#f8f9fb' }"
        >
          <button class="check-btn" @click="toggleDone(item)"></button>
          <div class="item-content">{{ item.content }}</div>
          <button class="del-btn" @click="removePlan(item.id)">
            <el-icon size="12"><Delete /></el-icon>
          </button>
        </div>
      </div>

      <div v-if="donePlans.length > 0" class="done-section">
        <div class="done-header" @click="showDoneList = !showDoneList">
          <span>✅ 已完成 {{ donePlans.length }} 项</span>
          <el-icon size="12"><component :is="showDoneList ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
        </div>
        <template v-if="showDoneList">
          <div v-for="item in donePlans" :key="item.id" class="plan-item done">
            <button class="check-btn checked" @click="toggleDone(item)">✓</button>
            <span class="done-subject-tag" :style="{ color: subjectColors[item.subject] || '#909399', background: subjectLightBg[item.subject] || '#f0f2f5' }">{{ item.subject }}</span>
            <div class="item-content">{{ item.content }}</div>
            <button class="del-btn" @click="removePlan(item.id)">
              <el-icon size="12"><Delete /></el-icon>
            </button>
          </div>
        </template>
      </div>
    </div>

    <el-dialog v-model="showAddDialog" title="添加学习计划" width="460px" destroy-on-close>
      <el-form @submit.prevent="addPlan" label-width="70px">
        <el-form-item label="科目" required>
          <el-select v-model="newPlan.subject" placeholder="选择科目" filterable allow-create style="width:100%">
            <el-option v-for="s in subjects" :key="s" :label="`${subjectEmojis[s]} ${s}`" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="newPlan.content" type="textarea" :rows="3" placeholder="今天要学什么" />
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
        <el-date-picker v-model="quickDate" type="date" value-format="YYYY-MM-DD" size="small" style="width: 180px" />
        <span class="quick-date-text">{{ dateLabelStr(quickDate) }}</span>
      </div>
      <textarea
        ref="quickArea"
        v-model="quickInput"
        class="quick-textarea"
        placeholder="每行一条，科目开头自动识别&#10;&#10;数学 完成课后习题1-5&#10;英语 背Unit3单词&#10;物理 复习力学笔记&#10;&#10;无科目前缀默认为数学"
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

    <el-dialog v-model="showCalDialog" title="学习日历" width="520px" destroy-on-close>
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
    </el-dialog>
  </div>
</template>

<style scoped>
.plan-page {
  max-width: 760px;
  margin: 0 auto;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  border: none;
  background: #f0f2f5;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  transition: all 0.2s;
}
.nav-btn:hover { background: #e4e7ed; }

.date-center {
  text-align: center;
  cursor: pointer;
  padding: 2px 14px;
  border-radius: 10px;
  transition: background 0.2s;
}
.date-center:hover { background: #f0f2f5; }
.date-main { font-size: 18px; font-weight: 700; color: #303133; }
.date-sub { font-size: 12px; color: #909399; margin-top: 2px; }

.cal-open-btn {
  position: relative;
  border: none;
  background: #fff;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  transition: all 0.2s;
}
.cal-open-btn:hover { transform: scale(1.08); box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.cal-open-icon { font-size: 20px; line-height: 1; }

.cal-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #fff;
}
.badge-full { background: #52c41a; }
.badge-partial { background: #e6a23c; }

.action-bar { display: flex; gap: 8px; }

.add-btn {
  border: none;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  padding: 7px 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 8px rgba(99,102,241,0.3);
  transition: all 0.2s;
}
.add-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.4); }

.quick-btn {
  border: 1px dashed #d5d8dc;
  background: #fff;
  color: #606266;
  padding: 7px 14px;
  border-radius: 10px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}
.quick-btn:hover { border-color: #6366f1; color: #6366f1; }

.progress-bar-wrap { margin-bottom: 20px; }
.progress-info { display: flex; justify-content: space-between; margin-bottom: 6px; }
.progress-text { font-size: 13px; color: #606266; }
.progress-pct { font-size: 13px; font-weight: 700; color: #6366f1; }
.progress-track { height: 6px; background: #f0f2f5; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease, background 0.3s; }

/* Plan list */
.empty-state { text-align: center; padding: 48px 0; }
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-text { font-size: 14px; color: #909399; }

.plan-list { display: flex; flex-direction: column; gap: 18px; }
.subject-group { display: flex; flex-direction: column; gap: 8px; }
.group-header { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; padding: 0 4px; }
.group-emoji { font-size: 18px; }
.group-count { font-size: 11px; background: rgba(0,0,0,0.06); padding: 1px 7px; border-radius: 8px; color: #909399; font-weight: 500; }

.plan-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border-left: 3px solid; transition: all 0.2s; }
.plan-item.pending:hover { transform: translateX(4px); }
.plan-item.done { border-left-color: #52c41a; background: #f0f9eb !important; }
.plan-item.done .item-content { text-decoration: line-through; color: #b0b5bd; }

.done-subject-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
  line-height: 1.4;
}

.check-btn { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #c0c4cc; background: #fff; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #52c41a; transition: all 0.2s; }
.check-btn:hover { border-color: #6366f1; }
.check-btn.checked { border-color: #52c41a; background: #52c41a; color: #fff; }

.item-content { flex: 1; font-size: 14px; color: #303133; line-height: 1.5; }

.del-btn { border: none; background: none; cursor: pointer; color: #c0c4cc; padding: 4px; border-radius: 4px; opacity: 0; transition: all 0.2s; }
.plan-item:hover .del-btn { opacity: 1; }
.plan-item.done:hover .del-btn { opacity: 1; }
.del-btn:hover { color: #f56c6c; background: #fef0f0; }

.done-section { background: #f8f9fb; border-radius: 12px; padding: 12px 16px; }
.done-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 13px; color: #909399; user-select: none; }

/* Quick dialog */
.quick-date-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: #f8f9fb;
  border-radius: 10px;
}
.quick-date-label { font-size: 13px; color: #606266; font-weight: 600; }
.quick-date-text { font-size: 12px; color: #909399; }

.quick-textarea {
  width: 100%;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.8;
  resize: vertical;
  font-family: inherit;
  color: #303133;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.quick-textarea:focus { border-color: #6366f1; }
.quick-textarea::placeholder { color: #c0c4cc; }
.quick-hint { font-size: 11px; color: #c0c4cc; margin-top: 8px; }

/* Calendar dialog */
.cal-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.cal-nav-btn { border: none; background: #f0f2f5; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 11px; color: #606266; transition: all 0.2s; }
.cal-nav-btn:hover { background: #e4e7ed; }
.cal-title { font-size: 15px; font-weight: 700; color: #303133; cursor: pointer; padding: 2px 10px; border-radius: 6px; transition: background 0.2s; }
.cal-title:hover { background: #f0f2f5; }
.cal-view-toggle { margin-left: auto; display: flex; background: #f0f2f5; border-radius: 8px; overflow: hidden; }
.toggle-btn { border: none; background: none; padding: 4px 14px; font-size: 12px; color: #909399; cursor: pointer; font-weight: 500; transition: all 0.2s; }
.toggle-btn.active { background: #6366f1; color: #fff; }

.cal-weekday-row { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 4px; }
.cal-weekday { font-size: 11px; color: #c0c4cc; font-weight: 600; padding: 4px 0; }

.cal-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-day-cell { display: flex; flex-direction: column; align-items: center; padding: 6px 2px 4px; border-radius: 8px; cursor: pointer; transition: all 0.15s; min-height: 44px; }
.cal-day-cell:hover { background: #f0f2f5; }
.cal-day-cell.other-month { opacity: 0.3; }
.cal-day-cell.is-today .cal-day-num { background: #6366f1; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.cal-day-cell.is-selected { background: #eef2ff; border: 1px solid #c7d2fe; }
.cal-day-num { font-size: 13px; font-weight: 600; color: #303133; line-height: 1; }
.cal-day-dot-wrap { height: 14px; display: flex; align-items: center; justify-content: center; }
.cal-dot { font-size: 8px; line-height: 1; }
.dot-full { color: #52c41a; font-size: 9px; }
.dot-partial { color: #e6a23c; font-size: 10px; }
.dot-empty { color: #dcdfe6; }
.cal-day-count { font-size: 9px; color: #909399; line-height: 1; }

.cal-week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-week-cell { display: flex; flex-direction: column; align-items: center; padding: 10px 4px 8px; border-radius: 10px; cursor: pointer; transition: all 0.15s; min-height: 72px; }
.cal-week-cell:hover { background: #f0f2f5; }
.cal-week-cell.is-today .week-cell-day { background: #6366f1; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.cal-week-cell.is-selected { background: #eef2ff; border: 1px solid #c7d2fe; }
.week-cell-weekday { font-size: 11px; color: #909399; font-weight: 500; margin-bottom: 4px; }
.week-cell-day { font-size: 16px; font-weight: 700; color: #303133; line-height: 1; margin-bottom: 4px; }
.week-cell-stats { font-size: 10px; color: #909399; margin-top: 2px; }
</style>
