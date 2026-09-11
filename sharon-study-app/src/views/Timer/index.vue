<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import { useTimerStore, RELIABLE_SOUND_CHANNELS } from '../../stores/timer'
import { api } from '../../utils/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  VideoPlay, VideoPause, RefreshLeft, Setting, FullScreen,
  Right, Notebook, Check, Delete, Calendar, TrendCharts,
  ArrowDown
} from '@element-plus/icons-vue'

const route = useRoute()
const timerStore = useTimerStore()

// 9 大学科色彩与 Emoji 字典
const subjects = [
  { name: '数学', emoji: '📐', color: '#6366f1', lightBg: '#eef2ff' },
  { name: '物理', emoji: '⚡', color: '#e6a23c', lightBg: '#fdf6ec' },
  { name: '化学', emoji: '🧪', color: '#f56c6c', lightBg: '#fef0f0' },
  { name: '生物', emoji: '🧬', color: '#85ce61', lightBg: '#f0f9eb' },
  { name: '英语', emoji: '🔤', color: '#10b981', lightBg: '#ecfdf5' },
  { name: '语文', emoji: '📖', color: '#909399', lightBg: '#f4f4f5' },
  { name: '政治', emoji: '📜', color: '#ed4014', lightBg: '#fef2f2' },
  { name: '历史', emoji: '🏛️', color: '#c45656', lightBg: '#fdf2f2' },
  { name: '地理', emoji: '🌍', color: '#2d8cf0', lightBg: '#eff6ff' },
  { name: '其他', emoji: '📌', color: '#8c8c8c', lightBg: '#f5f5f5' },
]

// 考场模考预设
const examPresets = [
  { label: '📐 高考数学', duration: 120, subject: '数学' },
  { label: '📖 语文 / 理综', duration: 150, subject: '语文' },
  { label: '🔤 英语套卷', duration: 100, subject: '英语' },
  { label: '⚡ 物化生大题', duration: 90, subject: '物理' },
  { label: '⏱️ 课后限时微测', duration: 45, subject: '其他' },
]

// 5 大纯净高可用轻音乐渠道
const reliableChannels = RELIABLE_SOUND_CHANNELS

const currentActiveTrack = computed(() => {
  if (timerStore.noiseType === 'none') {
    return { id: 'none', name: '静音专注', icon: '🔇', desc: '纯净无声 · 深度心流', badge: '无声' }
  }
  return reliableChannels.find(t => t.id === timerStore.noiseType)
})

// 视图标签：专注工作台 vs 统计看板
const activeTab = ref<'timer' | 'analytics'>('timer')
const showSettings = ref(false)
const markPlanDoneChecked = ref(true)

// 今日未完成计划列表
interface PlanItem {
  id: number
  subject: string
  content: string
  date: string
  done: boolean
}
const todayPlans = ref<PlanItem[]>([])

// 设置表单
const tempWorkDur = ref(timerStore.workDuration)
const tempBreakDur = ref(timerStore.breakDuration)
const tempExamDur = ref(timerStore.examDuration)
const tempAutoBreak = ref(timerStore.autoStartBreak)

// ECharts 实例与容器
const subjectChartRef = ref<HTMLDivElement | null>(null)
const trendChartRef = ref<HTMLDivElement | null>(null)
let subjectChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null
let themeObserver: MutationObserver | null = null

// SVG 进度圆环计算
const circumference = 2 * Math.PI * 132
const strokeDashoffset = computed(() => {
  return circumference - (timerStore.progress / 100) * circumference
})

// 动态主题判定
const isDark = computed(() => {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
})

// 颜色渐变动态响应
const gradientStart = computed(() => {
  if (timerStore.isBreak) return '#10b981'
  if (timerStore.mode === 'exam') {
    return timerStore.totalSeconds <= 15 * 60 ? '#f59e0b' : '#6366f1'
  }
  if (timerStore.mode === 'stopwatch') return '#8b5cf6'
  const sub = subjects.find(s => s.name === timerStore.selectedSubject)
  return sub ? sub.color : '#6366f1'
})

const gradientEnd = computed(() => {
  if (timerStore.isBreak) return '#34d399'
  if (timerStore.mode === 'exam') {
    return timerStore.totalSeconds <= 15 * 60 ? '#fbbf24' : '#818cf8'
  }
  if (timerStore.mode === 'stopwatch') return '#a78bfa'
  return '#818cf8'
})

const currentSubjectObj = computed(() => {
  return subjects.find(s => s.name === timerStore.selectedSubject) || subjects[0]
})

// 载入今日学习计划
const loadTodayPlans = async () => {
  try {
    const res = await api.get('/study-plans') as PlanItem[]
    const today = new Date().toISOString().slice(0, 10)
    todayPlans.value = (res || []).filter(p => p.date === today && !p.done)
  } catch (e) {
    console.error('Failed to load plans:', e)
  }
}

// 选择某项计划作为当前专注任务
const selectPlan = (plan: PlanItem) => {
  timerStore.selectedPlanId = plan.id
  timerStore.selectedTaskName = plan.content
  timerStore.setSubject(plan.subject)
  ElMessage.success(`已锁定学习任务：【${plan.subject}】${plan.content}`)
}

// 清除关联任务
const clearSelectedPlan = () => {
  timerStore.selectedPlanId = null
  timerStore.selectedTaskName = ''
}

// 模考预设快速选择
const applyExamPreset = (preset: typeof examPresets[0]) => {
  timerStore.examDuration = preset.duration
  timerStore.setSubject(preset.subject)
  timerStore.selectedTaskName = preset.label
  timerStore.switchMode('exam')
  ElMessage.success(`已切换为【${preset.label}】(${preset.duration}分钟)`)
}

// 选择或切换 5 大轻音乐渠道（下拉菜单选中后触发并自动收起）
const selectChannel = (channelId: string | number | object) => {
  const id = String(channelId)
  timerStore.audioError = null
  if (id === 'none') {
    timerStore.setNoiseType('none')
    return
  }
  // 切换并立即播放该轻音乐渠道
  timerStore.setNoiseType(id, true)
}

// 独立试听/播放控制
const toggleAudioPreview = () => {
  timerStore.audioError = null
  timerStore.toggleAudioPlay()
}

// 监听音频播放异常
watch(() => timerStore.audioError, (err) => {
  if (err) {
    ElMessage.error(err)
  }
})

// 打开设置
const openSettings = () => {
  tempWorkDur.value = timerStore.workDuration
  tempBreakDur.value = timerStore.breakDuration
  tempExamDur.value = timerStore.examDuration
  tempAutoBreak.value = timerStore.autoStartBreak
  showSettings.value = true
}

// 保存设置
const saveSettings = () => {
  timerStore.autoStartBreak = tempAutoBreak.value
  timerStore.setDurations(tempWorkDur.value, tempBreakDur.value, tempExamDur.value)
  showSettings.value = false
  ElMessage.success('设置已保存')
}

// 切换全屏禅模式
const toggleZenMode = () => {
  timerStore.isZenMode = !timerStore.isZenMode
}

// 退出禅模式按 ESC
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && timerStore.isZenMode) {
    timerStore.isZenMode = false
  }
}

// 达成弹窗确认
const handleConfirmComplete = async () => {
  await timerStore.confirmCompletion(markPlanDoneChecked.value)
  await loadTodayPlans()
  if (activeTab.value === 'analytics') {
    renderCharts()
  }
}

// 删除专注记录
const handleDeleteRecord = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这条专注记录吗？', '删除提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await api.del(`/focus-records/${id}`)
    ElMessage.success('记录已删除')
    await timerStore.fetchStats()
    renderCharts()
  } catch { /* cancel */ }
}

// 渲染 ECharts 图表
const renderCharts = () => {
  nextTick(() => {
    renderSubjectChart()
    renderTrendChart()
  })
}

// 1. 学科专注时长环形图
const renderSubjectChart = () => {
  if (!subjectChartRef.value) return
  if (subjectChart) subjectChart.dispose()
  subjectChart = echarts.init(subjectChartRef.value)

  const dark = isDark.value
  const bySub = timerStore.stats.by_subject || []

  const chartData = bySub.map(item => {
    const subObj = subjects.find(s => s.name === item.subject)
    return {
      name: item.subject,
      value: item.minutes,
      itemStyle: { color: subObj ? subObj.color : '#6366f1' }
    }
  })

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: dark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
      borderColor: dark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0',
      textStyle: { color: dark ? '#f8fafc' : '#1e293b' },
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number; marker: string }
        return `${p.marker} <b>${p.name}</b><br/>专注时长：${p.value} 分钟 (${p.percent}%)`
      }
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'middle',
      textStyle: { color: dark ? '#94a3b8' : '#64748b', fontSize: 12 },
      itemGap: 8
    },
    series: [
      {
        name: '学科专注',
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: dark ? '#131b2e' : '#fff',
          borderWidth: 2
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: dark ? '#f8fafc' : '#0f172a'
          }
        },
        data: chartData.length > 0 ? chartData : [{ name: '暂无数据', value: 0 }]
      }
    ]
  }
  subjectChart.setOption(option)
}

// 2. 近 7 天趋势堆叠柱状图
const renderTrendChart = () => {
  if (!trendChartRef.value) return
  if (trendChart) trendChart.dispose()
  trendChart = echarts.init(trendChartRef.value)

  const dark = isDark.value
  const recent = timerStore.stats.recent_days || []
  const xData = recent.map(r => r.date.slice(5)) // MM-DD
  const yData = recent.map(r => r.minutes)

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
      borderColor: dark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0',
      textStyle: { color: dark ? '#f8fafc' : '#1e293b' },
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params
        return `<b>${p.axisValue}</b><br/>专注时长：${p.value} 分钟`
      }
    },
    grid: { left: '4%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLine: { lineStyle: { color: dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' } },
      axisLabel: { color: dark ? '#94a3b8' : '#64748b' }
    },
    yAxis: {
      type: 'value',
      name: '分钟',
      nameTextStyle: { color: dark ? '#94a3b8' : '#64748b' },
      axisLabel: { color: dark ? '#94a3b8' : '#64748b' },
      splitLine: { lineStyle: { color: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' } }
    },
    series: [
      {
        name: '专注时长',
        type: 'bar',
        barWidth: '36%',
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#6366f1' },
            { offset: 1, color: '#818cf8' }
          ])
        },
        data: yData
      }
    ]
  }
  trendChart.setOption(option)
}

// 页面挂载
onMounted(async () => {
  await timerStore.fetchStats()
  await loadTodayPlans()
  window.addEventListener('keydown', handleKeyDown)

  // 监听暗色主题切换
  themeObserver = new MutationObserver(() => {
    if (activeTab.value === 'analytics') {
      renderCharts()
    }
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  if (route.query.openMusicDropdown === '1') {
    setTimeout(() => {
      const btn = document.querySelector('.channel-dropdown-btn') as HTMLElement
      btn?.click()
    }, 400)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (themeObserver) themeObserver.disconnect()
  if (subjectChart) subjectChart.dispose()
  if (trendChart) trendChart.dispose()
  if (!timerStore.isRunning) {
    timerStore.stopSound()
  }
})
</script>

<template>
  <div class="timer-container" :class="{ 'is-zen-active': timerStore.isZenMode }">
    <!-- 顶部主导航控制栏 -->
    <div class="top-nav-bar">
      <!-- 模式胶囊群组 -->
      <div class="mode-tabs">
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: timerStore.mode === 'pomodoro' }"
          @click="timerStore.switchMode('pomodoro')"
        >
          <span>🍅</span>
          <span class="mode-text">经典番茄</span>
        </button>
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: timerStore.mode === 'exam' }"
          @click="timerStore.switchMode('exam')"
        >
          <span>📝</span>
          <span class="mode-text">考场模拟</span>
        </button>
        <button
          type="button"
          class="mode-tab-btn"
          :class="{ active: timerStore.mode === 'stopwatch' }"
          @click="timerStore.switchMode('stopwatch')"
        >
          <span>⏱️</span>
          <span class="mode-text">心流正向</span>
        </button>
      </div>

      <!-- 右侧控制区：视图切换 + 全屏 + 设置 -->
      <div class="nav-right-actions">
        <el-radio-group v-model="activeTab" size="small" @change="renderCharts">
          <el-radio-button value="timer">
            <el-icon><Calendar /></el-icon> 专注工作台
          </el-radio-button>
          <el-radio-button value="analytics">
            <el-icon><TrendCharts /></el-icon> 学情看板
          </el-radio-button>
        </el-radio-group>

        <button class="icon-tool-btn" @click="toggleZenMode" title="全屏禅模式 (Esc退出)">
          <el-icon size="16"><FullScreen /></el-icon>
        </button>
        <button class="icon-tool-btn" @click="openSettings" title="番茄钟设置">
          <el-icon size="16"><Setting /></el-icon>
        </button>
      </div>
    </div>

    <!-- 视图一：专注计时工作台 -->
    <div v-show="activeTab === 'timer'" class="tab-content timer-main-layout">
      <!-- 1. 学科与计划绑定选择条 -->
      <div class="subject-bar-card">
        <div class="subject-capsules">
          <button
            v-for="sub in subjects"
            :key="sub.name"
            class="subject-pill"
            :class="{ active: timerStore.selectedSubject === sub.name }"
            @click="timerStore.setSubject(sub.name)"
          >
            <span class="pill-emoji">{{ sub.emoji }}</span>
            <span class="pill-name">{{ sub.name }}</span>
          </button>
        </div>

        <!-- 联动今日学习计划选择器 -->
        <div class="plan-linkage-row">
          <div class="linkage-title">
            <el-icon><Notebook /></el-icon>
            <span>绑定今日任务：</span>
          </div>

          <div v-if="timerStore.selectedPlanId" class="active-task-tag">
            <span class="task-badge">今日待办</span>
            <span class="task-name">{{ timerStore.selectedTaskName }}</span>
            <button class="task-clear-btn" @click="clearSelectedPlan" title="取消关联">×</button>
          </div>

          <div v-else class="plan-selector">
            <el-dropdown trigger="click" @command="selectPlan">
              <span class="plan-dropdown-trigger">
                {{ todayPlans.length > 0 ? `可选任务 (${todayPlans.length}项)` : '今日暂无未完成计划' }}
                <el-icon class="el-icon--right"><Right /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="plan in todayPlans"
                    :key="plan.id"
                    :command="plan"
                  >
                    <span class="plan-sub-tag">[{{ plan.subject }}]</span> {{ plan.content }}
                  </el-dropdown-item>
                  <el-dropdown-item v-if="todayPlans.length === 0" disabled>
                    暂无待办计划，可直接在下方输入专注备注
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-input
              v-model="timerStore.selectedTaskName"
              placeholder="或输入本次专注目标（例如：导数小题集训）"
              size="small"
              class="task-quick-input"
              clearable
            />
          </div>
        </div>

        <!-- 模考预设快捷栏（考场模式特有） -->
        <div v-if="timerStore.mode === 'exam'" class="exam-preset-bar">
          <span class="preset-label">🏫 考场预设：</span>
          <button
            v-for="preset in examPresets"
            :key="preset.label"
            class="preset-btn"
            :class="{ active: timerStore.examDuration === preset.duration && timerStore.selectedSubject === preset.subject }"
            @click="applyExamPreset(preset)"
          >
            {{ preset.label }} ({{ preset.duration }}m)
          </button>
        </div>
      </div>

      <!-- 2. 核心大表盘卡片 -->
      <div
        class="timer-hero-card"
        :style="{
          background: `linear-gradient(145deg, ${gradientStart}18 0%, ${gradientEnd}0a 100%)`
        }"
      >
        <!-- 表盘顶部状态指示 -->
        <div class="hero-status-pill" :class="{ 'is-break': timerStore.isBreak }">
          <span class="status-pulse-dot"></span>
          <span class="status-label">
            {{ timerStore.isBreak ? '☕ 休息充电中' : (timerStore.mode === 'exam' ? '📝 全真模考计时中' : (timerStore.mode === 'stopwatch' ? '⏱️ 心流深度自习' : '🍅 专注自习中')) }}
          </span>
          <span class="subject-tag-chip">{{ currentSubjectObj.emoji }} {{ timerStore.selectedSubject }}</span>
        </div>

        <!-- SVG 环形进度条与数码时间 -->
        <div class="ring-stage">
          <svg class="progress-ring-svg" viewBox="0 0 280 280">
            <defs>
              <linearGradient id="timerRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" :stop-color="gradientStart" />
                <stop offset="100%" :stop-color="gradientEnd" />
              </linearGradient>
            </defs>
            <circle class="ring-track" cx="140" cy="140" r="132" />
            <circle
              class="ring-bar"
              cx="140" cy="140" r="132"
              stroke="url(#timerRingGradient)"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeDashoffset"
              stroke-linecap="round"
              transform="rotate(-90 140 140)"
            />
          </svg>

          <!-- 环内翻页排版数码时钟 -->
          <div class="ring-inner-display">
            <div class="clock-numbers">
              <span class="clock-digit">{{ timerStore.displayMinutes }}</span>
              <span class="clock-colon">:</span>
              <span class="clock-digit">{{ timerStore.displaySeconds }}</span>
            </div>
            <div class="clock-sublabel">
              <template v-if="timerStore.mode === 'stopwatch'">已持续沉浸</template>
              <template v-else-if="timerStore.isBreak">长息放松 · 喝口温水</template>
              <template v-else-if="timerStore.mode === 'exam'">
                {{ timerStore.totalSeconds <= 15 * 60 ? '⚠️ 剩余最后15分钟' : '高考标准全真模拟' }}
              </template>
              <template v-else>保持专注 · 攻坚克难</template>
            </div>
          </div>
        </div>

        <!-- 操作按钮组合 -->
        <div class="control-actions-row">
          <!-- 正向计时模式 -->
          <template v-if="timerStore.mode === 'stopwatch'">
            <button
              v-if="!timerStore.isRunning"
              class="btn-primary-action start-btn"
              @click="timerStore.start"
            >
              <el-icon size="20"><VideoPlay /></el-icon>
              <span>开始心流</span>
            </button>
            <button
              v-else
              class="btn-primary-action pause-btn"
              @click="timerStore.pause"
            >
              <el-icon size="20"><VideoPause /></el-icon>
              <span>暂停</span>
            </button>
            <button
              v-if="timerStore.stopwatchSeconds > 0"
              class="btn-primary-action finish-btn"
              @click="timerStore.finishStopwatch"
            >
              <el-icon size="18"><Check /></el-icon>
              <span>结算入库</span>
            </button>
            <button class="btn-tool-action" @click="timerStore.reset" title="重置">
              <el-icon size="18"><RefreshLeft /></el-icon>
            </button>
          </template>

          <!-- 倒计时模式（番茄 / 模考） -->
          <template v-else>
            <button
              v-if="!timerStore.isRunning"
              class="btn-primary-action start-btn"
              @click="timerStore.start"
            >
              <el-icon size="20"><VideoPlay /></el-icon>
              <span>{{ timerStore.isBreak ? '开始休息' : '开始专注' }}</span>
            </button>
            <button
              v-else
              class="btn-primary-action pause-btn"
              @click="timerStore.pause"
            >
              <el-icon size="20"><VideoPause /></el-icon>
              <span>暂停</span>
            </button>

            <button
              v-if="timerStore.isBreak"
              class="btn-tool-action skip-btn"
              @click="timerStore.skipBreak"
              title="跳过休息直接进入下一轮"
            >
              <el-icon size="18"><Right /></el-icon>
              <span>跳过休息</span>
            </button>

            <button class="btn-tool-action" @click="timerStore.reset" title="重置计时">
              <el-icon size="18"><RefreshLeft /></el-icon>
            </button>
          </template>
        </div>
      </div>

      <!-- 3. 5 大纯净轻音乐渠道直达栏 (零多余标签，100%可靠本地轻音) -->
      <div class="sound-deck-card">
        <div class="sound-deck-bar">
          <!-- 左侧：黑胶唱片与当前频道状态 -->
          <div class="deck-track-meta">
            <div class="vinyl-record" :class="{ 'is-spinning': timerStore.isAudioPlaying }">
              <div class="vinyl-inner">
                <span class="vinyl-icon">{{ currentActiveTrack ? currentActiveTrack.icon : '🔇' }}</span>
              </div>
            </div>

            <div class="deck-meta-text">
              <div class="deck-title-row">
                <span class="deck-title">{{ currentActiveTrack ? currentActiveTrack.name : '静音专注' }}</span>
                <span v-if="currentActiveTrack?.badge" class="deck-badge">{{ currentActiveTrack.badge }}</span>
              </div>
              <div class="deck-sub-row">
                <span v-if="timerStore.isAudioPlaying" class="status-playing">
                  <span class="pulse-dot-green"></span> 正在伴读
                </span>
                <span v-else class="status-idle">
                  {{ currentActiveTrack?.desc || '点击渠道一键伴读' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 中间：单一下拉选择音乐按钮（点击下拉展示 5 大轻音乐渠道，选择后自动收起） -->
          <div class="music-channel-selector">
            <el-dropdown trigger="click" @command="selectChannel">
              <button
                type="button"
                class="channel-dropdown-btn"
                :class="{
                  'is-active': timerStore.noiseType !== 'none',
                  'is-playing': timerStore.isAudioPlaying && timerStore.noiseType !== 'none'
                }"
                title="点击选择轻音乐伴读渠道"
              >
                <span class="dropdown-btn-icon">{{ currentActiveTrack ? currentActiveTrack.icon : '🎵' }}</span>
                <span class="dropdown-btn-name">
                  {{ currentActiveTrack && timerStore.noiseType !== 'none' ? currentActiveTrack.name : '选择音乐' }}
                </span>
                <div v-if="timerStore.isAudioPlaying && timerStore.noiseType !== 'none'" class="dropdown-wave">
                  <span></span><span></span><span></span>
                </div>
                <el-icon class="dropdown-arrow"><ArrowDown /></el-icon>
              </button>

              <template #dropdown>
                <el-dropdown-menu class="music-select-dropdown-menu">
                  <div class="dropdown-menu-title">
                    <span>🎧 5 个可靠伴读轻音乐渠道</span>
                  </div>
                  <el-dropdown-item
                    v-for="channel in reliableChannels"
                    :key="channel.id"
                    :command="channel.id"
                    class="channel-dropdown-item"
                    :class="{ 'is-selected': timerStore.noiseType === channel.id }"
                  >
                    <div class="dropdown-item-content">
                      <span class="item-icon">{{ channel.icon }}</span>
                      <div class="item-details">
                        <div class="item-title-row">
                          <span class="item-name">{{ channel.name }}</span>
                          <span v-if="timerStore.isAudioPlaying && timerStore.noiseType === channel.id" class="item-playing-badge">
                            ● 正在播放
                          </span>
                        </div>
                        <span class="item-desc">{{ channel.desc }}</span>
                      </div>
                      <el-icon v-if="timerStore.noiseType === channel.id" class="item-check"><Check /></el-icon>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item
                    divided
                    command="none"
                    class="channel-dropdown-item mute-option"
                    :class="{ 'is-selected': timerStore.noiseType === 'none' }"
                  >
                    <div class="dropdown-item-content">
                      <span class="item-icon">🔇</span>
                      <div class="item-details">
                        <span class="item-name">静音专注</span>
                        <span class="item-desc">纯净无声 · 深度心流</span>
                      </div>
                      <el-icon v-if="timerStore.noiseType === 'none'" class="item-check"><Check /></el-icon>
                    </div>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <!-- 右侧：核心播放控制与音量滑块 -->
          <div class="deck-right-actions">
            <!-- 迷你播放/暂停按钮 -->
            <button
              type="button"
              class="deck-play-btn"
              :class="{ 'is-active': timerStore.isAudioPlaying }"
              :title="timerStore.isAudioPlaying ? '暂停背景音' : '播放背景音'"
              @click="toggleAudioPreview"
            >
              <span v-if="timerStore.isAudioPlaying">⏸</span>
              <span v-else>▶</span>
            </button>

            <!-- 静音切换与音量滑块 -->
            <div class="deck-volume-box">
              <button
                type="button"
                class="deck-mute-btn"
                :title="timerStore.isMuted ? '取消静音' : '静音'"
                @click="timerStore.toggleMute"
              >
                {{ timerStore.isMuted ? '🔇' : '🔊' }}
              </button>
              <el-slider
                v-model="timerStore.volume"
                :min="0"
                :max="1"
                :step="0.05"
                :show-tooltip="false"
                class="deck-volume-slider"
                @input="timerStore.setVolume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 视图二：专注学情看板 -->
    <div v-show="activeTab === 'analytics'" class="tab-content analytics-layout">
      <!-- 四大核心指标卡 -->
      <div class="stats-overview-grid">
        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(99, 102, 241, 0.12); color: #6366f1;">⏱️</div>
          <div class="metric-info">
            <div class="metric-label">今日专注时长</div>
            <div class="metric-val">{{ timerStore.stats.today_minutes }} <span class="unit">分钟</span></div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(239, 68, 68, 0.12); color: #ef4444;">🍅</div>
          <div class="metric-info">
            <div class="metric-label">今日达成番茄</div>
            <div class="metric-val">{{ timerStore.stats.today_pomodoros }} <span class="unit">个</span></div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(16, 185, 129, 0.12); color: #10b981;">📅</div>
          <div class="metric-info">
            <div class="metric-label">累计坚持天数</div>
            <div class="metric-val">{{ timerStore.stats.active_days }} <span class="unit">天</span></div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b;">🏆</div>
          <div class="metric-info">
            <div class="metric-label">累计专注投入</div>
            <div class="metric-val">{{ timerStore.stats.total_minutes }} <span class="unit">分钟</span></div>
          </div>
        </div>
      </div>

      <!-- 双 ECharts 图表行 -->
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">各学科专注时长分布</span>
          </div>
          <div ref="subjectChartRef" class="echarts-container"></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">近 7 天每日专注走势</span>
          </div>
          <div ref="trendChartRef" class="echarts-container"></div>
        </div>
      </div>

      <!-- 专注历史流水明细表 -->
      <div class="history-table-card">
        <div class="table-header">
          <span class="table-title">📜 专注明细流水账 (最近 {{ timerStore.recentRecords.length }} 次)</span>
        </div>

        <el-table :data="timerStore.recentRecords" stripe style="width: 100%" max-height="400">
          <el-table-column prop="completed_at" label="完成时间" width="170" />
          <el-table-column label="学科" width="110">
            <template #default="{ row }">
              <el-tag size="small" :style="{ color: '#6366f1' }">
                {{ row.subject }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="模式" width="110">
            <template #default="{ row }">
              <span v-if="row.mode === 'exam'">📝 考场模拟</span>
              <span v-else-if="row.mode === 'stopwatch'">⏱️ 心流正向</span>
              <span v-else>🍅 经典番茄</span>
            </template>
          </el-table-column>
          <el-table-column prop="duration_minutes" label="专注时长" width="110">
            <template #default="{ row }">
              <b>{{ row.duration_minutes }}</b> 分钟
            </template>
          </el-table-column>
          <el-table-column prop="task_name" label="专注目标 / 关联任务" min-width="200" />
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button
                type="danger"
                text
                size="small"
                @click="handleDeleteRecord(row.id)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 全屏禅模式遮罩 (Zen Mode) -->
    <transition name="zen-fade">
      <div v-if="timerStore.isZenMode" class="zen-mode-overlay">
        <!-- 退出提示 -->
        <button class="zen-exit-btn" @click="toggleZenMode">
          <span>退出全屏 (ESC)</span>
        </button>

        <!-- 禅模式核心大数字与发光进度圈 -->
        <div class="zen-center-box">
          <div class="zen-subject-badge">
            {{ currentSubjectObj.emoji }} {{ timerStore.selectedSubject }}
            <span v-if="timerStore.selectedTaskName" class="zen-task-text">· {{ timerStore.selectedTaskName }}</span>
          </div>

          <div class="zen-time-display">
            <span class="zen-digit">{{ timerStore.displayMinutes }}</span>
            <span class="zen-colon">:</span>
            <span class="zen-digit">{{ timerStore.displaySeconds }}</span>
          </div>

          <div class="zen-progress-bar-wrap">
            <div class="zen-progress-bar-fill" :style="{ width: `${timerStore.progress}%` }"></div>
          </div>

          <!-- 禅模式悬浮精简控制 -->
          <div class="zen-controls">
            <button
              v-if="!timerStore.isRunning"
              class="zen-btn play"
              @click="timerStore.start"
            >
              <el-icon size="24"><VideoPlay /></el-icon>
            </button>
            <button
              v-else
              class="zen-btn pause"
              @click="timerStore.pause"
            >
              <el-icon size="24"><VideoPause /></el-icon>
            </button>
            <button class="zen-btn" @click="timerStore.reset">
              <el-icon size="20"><RefreshLeft /></el-icon>
            </button>
            <button class="zen-btn" @click="timerStore.toggleMute">
              <span v-if="timerStore.isMuted">🔇</span>
              <span v-else>🔊</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 达成恭喜弹窗（含关联学习计划打钩确认） -->
    <el-dialog
      v-model="timerStore.showCompletionModal"
      title="🎉 专注达成！"
      width="420px"
      :show-close="false"
      class="completion-dialog"
    >
      <div class="completion-dialog-content">
        <div class="celebrate-badge">🏆 坚持就是胜利</div>
        <div class="celebrate-title">
          恭喜完成本次在【{{ timerStore.lastFinishedRecord?.subject }}】的专注！
        </div>
        <div class="celebrate-meta">
          本次投入专注时长：<b>{{ timerStore.lastFinishedRecord?.durationMinutes }}</b> 分钟
        </div>

        <!-- 联动计划打钩 -->
        <div v-if="timerStore.lastFinishedRecord?.planId" class="plan-hook-box">
          <el-checkbox v-model="markPlanDoneChecked">
            同时标记今日学习计划为已完成：
            <div class="hook-task-name">「{{ timerStore.lastFinishedRecord?.taskName }}」</div>
          </el-checkbox>
        </div>
      </div>

      <template #footer>
        <el-button type="primary" size="large" style="width: 100%" @click="handleConfirmComplete">
          好极了，继续保持！
        </el-button>
      </template>
    </el-dialog>

    <!-- 番茄钟偏好设置弹窗 -->
    <el-dialog v-model="showSettings" title="⏱ 番茄钟与模考偏好设置" width="400px">
      <el-form label-width="110px">
        <el-form-item label="番茄专注时长">
          <el-input-number v-model="tempWorkDur" :min="10" :max="60" :step="5" />
          <span class="input-unit">分钟</span>
        </el-form-item>
        <el-form-item label="短休息时长">
          <el-input-number v-model="tempBreakDur" :min="3" :max="20" :step="1" />
          <span class="input-unit">分钟</span>
        </el-form-item>
        <el-form-item label="模考默认时长">
          <el-input-number v-model="tempExamDur" :min="30" :max="180" :step="15" />
          <span class="input-unit">分钟</span>
        </el-form-item>
        <el-form-item label="自动开始休息">
          <el-switch v-model="tempAutoBreak" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存偏好</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
.timer-container {
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: 40px;
}

/* 顶部导航控制条 */
.top-nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.mode-tabs {
  display: flex;
  gap: 6px;
  background: var(--bg-card, #ffffff);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.mode-tab-btn {
  border: none;
  background: transparent;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-regular, #64748b);
  transition: all 0.2s;
}

.mode-tab-btn.active {
  background: var(--primary-color, #6366f1);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.nav-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-tool-btn {
  border: none;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-regular, #64748b);
  transition: all 0.2s;
}

.icon-tool-btn:hover {
  color: var(--primary-color, #6366f1);
  border-color: var(--primary-color, #6366f1);
}

/* 1. 学科与计划绑定条 */
.subject-bar-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.subject-capsules {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.subject-pill {
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-page, #f8fafc);
  padding: 6px 12px;
  border-radius: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-regular, #475569);
  transition: all 0.2s;
}

.subject-pill:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.subject-pill.active {
  background: #6366f1;
  color: #ffffff;
  border-color: #6366f1;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.plan-linkage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color, #e2e8f0);
}

.linkage-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #334155);
}

.plan-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.plan-dropdown-trigger {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.08);
  color: #6366f1;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.task-quick-input {
  max-width: 320px;
}

.active-task-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 4px 10px;
  border-radius: 8px;
}

.task-badge {
  font-size: 11px;
  background: #10b981;
  color: #fff;
  padding: 1px 6px;
  border-radius: 4px;
}

.task-name {
  font-size: 13px;
  color: var(--text-main, #0f172a);
  font-weight: 600;
}

.task-clear-btn {
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  color: #94a3b8;
}

.plan-sub-tag {
  color: #6366f1;
  font-weight: 600;
  margin-right: 4px;
}

/* 模考预设 */
.exam-preset-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color, #e2e8f0);
  flex-wrap: wrap;
}

.preset-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub, #64748b);
}

.preset-btn {
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-regular, #475569);
  transition: all 0.2s;
}

.preset-btn.active {
  background: #f59e0b;
  border-color: #f59e0b;
  color: #fff;
  font-weight: 600;
}

/* 2. 核心大表盘卡片 */
.timer-hero-card {
  border-radius: 24px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
  padding: 32px;
  margin-bottom: 20px;
  text-align: center;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  transition: var(--theme-transition);
}

.hero-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
  margin-bottom: 16px;
}

.hero-status-pill.is-break {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.status-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.6s infinite;
}

.subject-tag-chip {
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.ring-stage {
  position: relative;
  width: 290px;
  height: 290px;
  margin: 10px auto 26px;
}

.progress-ring-svg {
  width: 100%;
  height: 100%;
}

.ring-track {
  fill: none;
  stroke: rgba(0, 0, 0, 0.05);
  stroke-width: 8;
}

.dark .ring-track {
  stroke: rgba(255, 255, 255, 0.06);
}

.ring-bar {
  fill: none;
  stroke-width: 8;
  transition: stroke-dashoffset 0.5s linear;
}

.ring-inner-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.clock-numbers {
  font-size: 64px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  letter-spacing: -2px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.clock-colon {
  opacity: 0.5;
  margin: 0 2px;
}

.clock-sublabel {
  font-size: 13px;
  color: var(--text-sub, #64748b);
  margin-top: 10px;
  font-weight: 500;
}

.control-actions-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
}

.btn-primary-action {
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  border-radius: 30px;
  padding: 12px 36px;
  transition: all 0.25s;
}

.start-btn {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
}

.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}

.pause-btn {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);
}

.finish-btn {
  background: linear-gradient(135deg, #10b981, #34d399);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
}

.btn-tool-action {
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-regular, #475569);
  padding: 12px 18px;
  border-radius: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-tool-action:hover {
  border-color: #6366f1;
  color: #6366f1;
}

/* 3. 5 大纯净轻音乐渠道直达栏 (Sound Deck Bar) */
.sound-deck-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 10px 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
}

.sound-deck-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
}

/* 左侧：黑胶与当前频道状态 */
.deck-track-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
  min-width: 140px;
  flex-shrink: 0;
}

.vinyl-record {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: radial-gradient(circle, #334155 25%, #1e293b 65%, #0f172a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.vinyl-record.is-spinning {
  animation: spinVinyl 12s linear infinite;
}

@keyframes spinVinyl {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.vinyl-inner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.vinyl-icon {
  font-size: 9px;
}

.deck-meta-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.deck-title-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.deck-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  white-space: nowrap;
}

.deck-badge {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  font-weight: 600;
}

.deck-sub-row {
  font-size: 11px;
  white-space: nowrap;
}

.status-playing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #10b981;
  font-weight: 600;
}

.pulse-dot-green {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #10b981;
  animation: pulseDot 1.2s infinite;
}

@keyframes pulseDot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.6; }
}

.status-idle {
  color: var(--text-secondary, #94a3b8);
}

/* 中间：单一音乐下拉选择按钮 (Music Channel Dropdown Trigger) */
.music-channel-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.channel-dropdown-btn {
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-page, #f8fafc);
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #0f172a);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  user-select: none;
}

.channel-dropdown-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.04);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(99, 102, 241, 0.12);
}

.channel-dropdown-btn.is-active {
  border-color: #6366f1;
  color: #6366f1;
}

.channel-dropdown-btn.is-playing {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.12));
  border-color: #6366f1;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3);
}

.dropdown-btn-icon {
  font-size: 15px;
}

.dropdown-btn-name {
  font-size: 13px;
  letter-spacing: 0.2px;
}

.dropdown-arrow {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  transition: transform 0.2s;
}

.channel-dropdown-btn:hover .dropdown-arrow {
  color: #6366f1;
}

/* 按钮内跳动小音波 */
.dropdown-wave {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 10px;
  margin-left: 1px;
}

.dropdown-wave span {
  width: 2px;
  background: #6366f1;
  border-radius: 1px;
  animation: soundBarPulse 0.8s ease-in-out infinite alternate;
}

.dropdown-wave span:nth-child(1) { height: 4px; animation-delay: 0.1s; }
.dropdown-wave span:nth-child(2) { height: 10px; animation-delay: 0.3s; }
.dropdown-wave span:nth-child(3) { height: 6px; animation-delay: 0.2s; }

@keyframes soundBarPulse {
  0% { transform: scaleY(0.3); }
  100% { transform: scaleY(1); }
}

/* 下拉菜单弹出层容器 */
:deep(.music-select-dropdown-menu) {
  min-width: 280px;
  padding: 6px 4px;
  border-radius: 14px;
}

:deep(.dropdown-menu-title) {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary, #94a3b8);
  padding: 6px 12px 8px;
  border-bottom: 1px dashed var(--border-color, #e2e8f0);
  margin-bottom: 4px;
}

:deep(.channel-dropdown-item) {
  padding: 8px 12px;
  border-radius: 10px;
  margin: 2px 0;
  transition: all 0.2s;
}

:deep(.dropdown-item-content) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

:deep(.dropdown-item-content .item-icon) {
  font-size: 18px;
  flex-shrink: 0;
}

:deep(.dropdown-item-content .item-details) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:deep(.dropdown-item-content .item-title-row) {
  display: flex;
  align-items: center;
  gap: 6px;
}

:deep(.dropdown-item-content .item-name) {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #0f172a);
}

:deep(.dropdown-item-content .item-playing-badge) {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  font-weight: 600;
}

:deep(.dropdown-item-content .item-desc) {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

:deep(.dropdown-item-content .item-check) {
  color: #6366f1;
  font-size: 15px;
  flex-shrink: 0;
}

:deep(.channel-dropdown-item.is-selected) {
  background: rgba(99, 102, 241, 0.08);
}

:deep(.channel-dropdown-item.is-selected .item-name) {
  color: #6366f1;
}

/* 右侧：播放开关与音量控制 */
.deck-right-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.deck-play-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(99, 102, 241, 0.3);
  transition: all 0.2s;
}

.deck-play-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 5px 14px rgba(99, 102, 241, 0.4);
}

.deck-play-btn.is-active {
  background: linear-gradient(135deg, #ec4899, #f43f5e);
  box-shadow: 0 3px 10px rgba(236, 72, 153, 0.3);
}

.deck-volume-box {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 105px;
}

.deck-mute-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  padding: 0;
  display: flex;
  align-items: center;
  color: var(--text-secondary, #94a3b8);
  transition: color 0.2s;
}

.deck-mute-btn:hover {
  color: #6366f1;
}

.deck-volume-slider {
  flex: 1;
}

/* 暗色模式专属微调 */
:deep(.dark) .sound-deck-card,
.dark .sound-deck-card {
  background: #1e293b;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

:deep(.dark) .channel-dropdown-btn,
.dark .channel-dropdown-btn {
  background: #0f172a;
  border-color: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

:deep(.dark) .channel-dropdown-btn:hover,
.dark .channel-dropdown-btn:hover {
  border-color: #818cf8;
  color: #c7d2fe;
  background: rgba(99, 102, 241, 0.15);
}

:deep(.dark) .channel-dropdown-btn.is-active,
.dark .channel-dropdown-btn.is-active {
  border-color: #818cf8;
  color: #c7d2fe;
}

:deep(.dark) .channel-dropdown-btn.is-playing,
.dark .channel-dropdown-btn.is-playing {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.25));
  border-color: #818cf8;
}

/* 学情看板布局 */
.analytics-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-overview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .stats-overview-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.metric-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.metric-label {
  font-size: 12px;
  color: var(--text-sub, #64748b);
  margin-bottom: 4px;
}

.metric-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.metric-val .unit {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-sub, #94a3b8);
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 18px;
}

.chart-header {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #0f172a);
  margin-bottom: 12px;
}

.echarts-container {
  width: 100%;
  height: 260px;
}

.history-table-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  padding: 18px;
}

.table-header {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #0f172a);
  margin-bottom: 12px;
}

/* 全屏禅模式 (Zen Mode) */
.zen-mode-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 3000;
  background: radial-gradient(circle at center, #1e1b4b 0%, #09090b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.zen-exit-btn {
  position: absolute;
  top: 28px;
  right: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.zen-exit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.zen-center-box {
  text-align: center;
  max-width: 600px;
}

.zen-subject-badge {
  font-size: 16px;
  font-weight: 600;
  color: #a5b4fc;
  margin-bottom: 16px;
  display: inline-block;
  background: rgba(99, 102, 241, 0.15);
  padding: 6px 18px;
  border-radius: 20px;
}

.zen-task-text {
  color: #e2e8f0;
}

.zen-time-display {
  font-size: 120px;
  font-weight: 800;
  letter-spacing: -4px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 30px rgba(99, 102, 241, 0.4);
}

.zen-colon {
  opacity: 0.6;
  margin: 0 4px;
}

.zen-progress-bar-wrap {
  width: 280px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  margin: 32px auto;
  overflow: hidden;
}

.zen-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  box-shadow: 0 0 10px #6366f1;
  transition: width 0.5s ease;
}

.zen-controls {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.zen-btn {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 20px;
}

.zen-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.08);
}

.zen-btn.play {
  background: #6366f1;
  border-color: #6366f1;
}

.zen-btn.pause {
  background: #f59e0b;
  border-color: #f59e0b;
}

/* 达成弹窗 */
.completion-dialog-content {
  text-align: center;
  padding: 10px 0;
}

.celebrate-badge {
  font-size: 14px;
  font-weight: 700;
  color: #10b981;
  margin-bottom: 8px;
}

.celebrate-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  margin-bottom: 12px;
}

.celebrate-meta {
  font-size: 14px;
  color: var(--text-regular, #475569);
  margin-bottom: 20px;
}

.plan-hook-box {
  background: var(--bg-page, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 12px;
  text-align: left;
}

.hook-task-name {
  font-weight: 600;
  color: #6366f1;
  margin-top: 4px;
  padding-left: 24px;
}

.input-unit {
  margin-left: 8px;
  color: var(--text-sub, #94a3b8);
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.zen-fade-enter-active,
.zen-fade-leave-active {
  transition: opacity 0.3s ease;
}

.zen-fade-enter-from,
.zen-fade-leave-to {
  opacity: 0;
}
</style>
