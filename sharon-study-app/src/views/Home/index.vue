<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import { api } from "../../utils/api"
import { useUserProfileStore } from "../../stores/userProfile"
import { useAppConfigStore } from "../../stores/appConfig"
import { useAppVersionStore } from "../../stores/appVersion"
import { useTimerStore } from "../../stores/timer"
import AboutModal from "../../components/AboutModal.vue"
import CloudSyncModal from "../../components/CloudSyncModal.vue"
import {
  Edit,
  Calendar,
  Reading,
  Postcard,
  TrendCharts,
  Timer,
  MagicStick,
  Compass,
  DocumentDelete,
  Check,
  Plus,
  ArrowRight,
  Clock,
  Collection,
  Connection,
  Sunny,
  Cloudy,
  PartlyCloudy,
  Pouring,
  Lightning,
  Drizzling,
  ArrowDown
} from "@element-plus/icons-vue"
import { ElMessage, ElMessageBox } from "element-plus"

const router = useRouter()
const isMobileMoreExpanded = ref(false)

interface WeatherData {
  temp: number
  tempMax: number
  tempMin: number
  weatherCode: number
  windSpeed: number
  humidity: number
}

interface DayStats {
  total: number
  done: number
}

interface HomePlanItem {
  id: number
  subject: string
  content: string
  date: string
  status?: string
  done: boolean
  estimated_minutes?: number
}

const currentTime = ref(new Date())
const greeting = ref("")
const todayWeather = ref<WeatherData | null>(null)
const tomorrowWeather = ref<WeatherData | null>(null)
const weatherLoading = ref(true)
const todayStats = ref<DayStats>({ total: 0, done: 0 })
const todayPlans = ref<HomePlanItem[]>([])
const wrongItemsCount = ref(0)
const wordMasteredCount = ref(0)
const plansLoading = ref(false)

const userProfile = useUserProfileStore()
const appConfig = useAppConfigStore()
const appVersionStore = useAppVersionStore()
const timerStore = useTimerStore()
const showAboutModal = ref(false)
const showCloudModal = ref(false)

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// 今日计划进度百分比
const progressPct = computed(() => {
  if (todayStats.value.total === 0) return 0
  return Math.round((todayStats.value.done / todayStats.value.total) * 100)
})

// 今日专注时长格式化
const todayFocusText = computed(() => {
  const mins = timerStore.stats.today_minutes || 0
  if (mins === 0) return "待开启专注"
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  if (hours > 0) {
    return `${hours}小时${remainingMins > 0 ? remainingMins + "分" : ""}`
  }
  return `${mins}分钟`
})

// 学生年级与选科概况标签
const gradeAndElectivesLabel = computed(() => {
  const grade = userProfile.gradeLevel || "高三"
  const electives = userProfile.electiveSubjects || ["物理", "化学", "生物"]
  return `${grade} · ${electives.join("")}`
})

// 学科直通车列表（语数英 + 选考科目）
const quickSubjects = computed(() => {
  const core = ["语文", "数学", "英语"]
  const electives = userProfile.electiveSubjects || ["物理", "化学", "生物"]
  return Array.from(new Set([...core, ...electives]))
})

// 8 大核心学习模块矩阵
const modules = [
  {
    title: "学习计划",
    desc: "制定与管理每日学习任务，把握复习节奏",
    icon: Calendar,
    color: "#4f46e5",
    path: "/study-plan",
    tag: "待办安排"
  },
  {
    title: "学科中心",
    desc: "9大学科教材书架、考点精讲与沉浸阅读",
    icon: Reading,
    color: "#0891b2",
    path: "/subjects",
    tag: "考点精讲"
  },
  {
    title: "错题靶向",
    desc: "错因深度归因诊断，靶向击破弱项盲区",
    icon: DocumentDelete,
    color: "#e11d48",
    path: "/subjects?tab=wrong-book",
    tag: "弱项攻坚"
  },
  {
    title: "英语单词",
    desc: "高考3500词与考纲核心词，艾宾浩斯科学记忆",
    icon: Postcard,
    color: "#059669",
    path: "/word-card",
    tag: "词汇复习"
  },
  {
    title: "专注番茄钟",
    desc: "沉浸白噪音专注计时，量化每日有效学习",
    icon: Timer,
    color: "#d97706",
    path: "/timer",
    tag: "静心自习"
  },
  {
    title: "脑力工坊",
    desc: "8款益智小游戏，课间快速激活大脑思维",
    icon: MagicStick,
    color: "#7c3aed",
    path: "/brain-gym",
    tag: "思维训练"
  },
  {
    title: "成绩追踪",
    desc: "记录大考成绩，学科雷达分析与提分目标",
    icon: TrendCharts,
    color: "#db2777",
    path: "/grade-tracker",
    tag: "学情诊断"
  },
  {
    title: "优质资源",
    desc: "精选历年高考真题、思维导图与备考锦囊",
    icon: Compass,
    color: "#2563eb",
    path: "/resources",
    tag: "真题导图"
  },
]

const subjectColors: Record<string, string> = {
  "语文": "#64748b",
  "数学": "#4f46e5",
  "英语": "#059669",
  "物理": "#d97706",
  "化学": "#e11d48",
  "生物": "#16a34a",
  "历史": "#b91c1c",
  "地理": "#0891b2",
  "政治": "#ea580c",
  "全科": "#6366f1"
}

const updateGreeting = () => {
  const hour = currentTime.value.getHours()
  const name = userProfile.greetingName
  if (hour < 6) greeting.value = `夜深了，${name}`
  else if (hour < 12) greeting.value = `早上好，${name}`
  else if (hour < 14) greeting.value = `中午好，${name}`
  else if (hour < 18) greeting.value = `下午好，${name}`
  else greeting.value = `晚上好，${name}`
}

const formatDate = (date: Date) => {
  const days = ["日", "一", "二", "三", "四", "五", "六"]
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${days[date.getDay()]}`
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

const weatherDesc = (code: number): string => {
  if (code === 0) return "晴朗"
  if (code <= 3) return "多云"
  if (code <= 48) return "大雾"
  if (code <= 57) return "细雨"
  if (code <= 67) return "小到中雨"
  if (code <= 77) return "雪"
  if (code <= 82) return "阵雨"
  if (code <= 86) return "阵雪"
  if (code <= 99) return "雷阵雨"
  return "晴朗"
}

const weatherIconComponent = (code: number) => {
  if (code === 0) return Sunny
  if (code <= 3) return PartlyCloudy
  if (code <= 48) return Cloudy
  if (code <= 57) return Drizzling
  if (code <= 67) return Pouring
  if (code <= 82) return Pouring
  if (code <= 99) return Lightning
  return PartlyCloudy
}

const fetchWeather = async () => {
  weatherLoading.value = true
  try {
    const cachedWeather = localStorage.getItem("study_weather_cache")
    const cachedTime = localStorage.getItem("study_weather_cache_time")
    const now = Date.now()
    if (cachedWeather && cachedTime && now - Number(cachedTime) < 2 * 60 * 60 * 1000) {
      const parsed = JSON.parse(cachedWeather)
      todayWeather.value = parsed.today
      tomorrowWeather.value = parsed.tomorrow
      weatherLoading.value = false
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=31.23&longitude=121.47&daily=temperature_2m_max,temperature_2m_min,weathercode&current=temperature_2m,relative_humidity_2m,weathercode,wind_speed_10m&timezone=Asia/Shanghai&forecast_days=2",
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    const data = await res.json()
    const today = {
      temp: Math.round(data.current.temperature_2m),
      tempMax: Math.round(data.daily.temperature_2m_max[0]),
      tempMin: Math.round(data.daily.temperature_2m_min[0]),
      weatherCode: data.current.weathercode,
      windSpeed: Math.round(data.current.wind_speed_10m),
      humidity: data.current.relative_humidity_2m,
    }
    const tomorrow = {
      temp: Math.round(data.daily.temperature_2m_max[1]),
      tempMax: Math.round(data.daily.temperature_2m_max[1]),
      tempMin: Math.round(data.daily.temperature_2m_min[1]),
      weatherCode: data.daily.weathercode[1],
      windSpeed: 0,
      humidity: 0,
    }
    todayWeather.value = today
    tomorrowWeather.value = tomorrow
    localStorage.setItem("study_weather_cache", JSON.stringify({ today, tomorrow }))
    localStorage.setItem("study_weather_cache_time", String(now))
  } catch {
    if (!todayWeather.value) {
      todayWeather.value = {
        temp: 24,
        tempMax: 28,
        tempMin: 20,
        weatherCode: 1,
        windSpeed: 12,
        humidity: 58
      }
      tomorrowWeather.value = {
        temp: 25,
        tempMax: 29,
        tempMin: 21,
        weatherCode: 2,
        windSpeed: 0,
        humidity: 60
      }
    }
  } finally {
    weatherLoading.value = false
  }
}

// 获取今日待办计划列表
const fetchTodayPlans = async () => {
  plansLoading.value = true
  try {
    const today = todayStr()
    const plans = (await api.get("/study-plans")) as any[]
    const list: HomePlanItem[] = (plans || [])
      .filter((p) => p.date === today)
      .map((p) => ({
        ...p,
        done: Boolean(p.done || p.status === "done"),
      }))
    todayPlans.value = list
    todayStats.value = {
      total: list.length,
      done: list.filter((p) => p.done).length,
    }
  } catch {
    todayPlans.value = []
    todayStats.value = { total: 0, done: 0 }
  } finally {
    plansLoading.value = false
  }
}

// 快速完成/取消完成计划
const togglePlanItem = async (item: HomePlanItem) => {
  const originalDone = item.done
  item.done = !originalDone
  if (item.done) {
    todayStats.value.done++
  } else {
    todayStats.value.done = Math.max(0, todayStats.value.done - 1)
  }

  try {
    await api.put(`/study-plans/${item.id}/toggle`)
    ElMessage.success({
      message: item.done ? `已完成：${item.content}` : `已恢复待办：${item.content}`,
      duration: 1600,
    })
  } catch {
    item.done = originalDone
    if (item.done) {
      todayStats.value.done++
    } else {
      todayStats.value.done = Math.max(0, todayStats.value.done - 1)
    }
    ElMessage.error("更新状态失败，请重试")
  }
}

// 首页快速添加今日任务
const quickAddTodayPlan = async () => {
  try {
    const { value } = await ElMessageBox.prompt("请输入今日待办任务内容：", "⚡ 快速添加今日任务", {
      confirmButtonText: "添加并保存",
      cancelButtonText: "取消",
      inputPlaceholder: "例如：完成导数大题专题训练 3 道",
      inputPattern: /^.+$/,
      inputErrorMessage: "任务内容不能为空",
    })
    if (value && value.trim()) {
      const defaultSubject = userProfile.electiveSubjects?.[0] || "数学"
      await api.post("/study-plans", {
        subject: defaultSubject,
        content: value.trim(),
        date: todayStr(),
        estimated_minutes: 30,
        done: false,
      })
      ElMessage.success("已成功加入今日学习计划")
      await fetchTodayPlans()
    }
  } catch {
    // 用户取消输入
  }
}

// 携带任务跳转专注番茄钟
const goToTimerWithTask = (taskName: string, subject: string) => {
  router.push({
    path: "/timer",
    query: {
      task: taskName,
      subject: subject || "全科"
    }
  })
}

// 直达学科中心
const goToSubject = (sub: string) => {
  router.push(`/subjects/${encodeURIComponent(sub)}`)
}

// 加载学情概览数据（错题数与单词统计）
const fetchOverviewData = async () => {
  try {
    const wrongList = await api.get("/wrong-items")
    if (Array.isArray(wrongList)) {
      wrongItemsCount.value = wrongList.length
    }
  } catch {
    wrongItemsCount.value = 0
  }

  try {
    const wordStats = (await api.get("/words/stats")) as any
    if (wordStats && typeof wordStats.masteredCount === "number") {
      wordMasteredCount.value = wordStats.masteredCount
    }
  } catch {
    wordMasteredCount.value = 0
  }
}

// 伴学学子实时统计状态
const liveStudentCount = ref<number>(528)
const liveTodayActive = ref<number>(185)

const fetchLiveStats = async () => {
  try {
    const res = await api.get('/sync/stats')
    if (res && res.totalStudents) {
      liveStudentCount.value = res.totalStudents
      liveTodayActive.value = res.todayActive || Math.floor(res.totalStudents * 0.38)
    }
  } catch {
    // 离线环境平滑兜底
  }
}

let timer: ReturnType<typeof setInterval>

onMounted(() => {
  updateGreeting()
  fetchWeather()
  fetchTodayPlans()
  fetchOverviewData()
  timerStore.fetchStats()
  fetchLiveStats()
  timer = setInterval(() => {
    currentTime.value = new Date()
    updateGreeting()
  }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="home-page">
    <!-- 1. 首页顶部自律大学情大看板 -->
    <section class="welcome-section" aria-label="学情总览">
      <!-- 移动端专享极简高能看板（手机端显示，桌面端隐藏） -->
      <div class="mobile-compact-hero mobile-only">
        <div class="mobile-hero-main">
          <div class="mobile-hero-left">
            <div class="mobile-greeting-row">
              <span class="mobile-greeting-name">{{ greeting }}</span>
              <button
                type="button"
                class="mobile-edit-btn"
                @click="userProfile.showEditModal = true"
                title="修改空间信息"
              >
                <el-icon :size="12"><Edit /></el-icon>
              </button>
            </div>
            <div class="mobile-meta-chips">
              <span class="mobile-chip-grade">{{ userProfile.gradeLevel || '高三' }} · {{ (userProfile.electiveSubjects || ['物理', '化学', '生物']).join('') }}</span>
              <span class="mobile-chip-weather" v-if="todayWeather">
                <component :is="weatherIconComponent(todayWeather.weatherCode)" class="weather-chip-icon" />
                <span>{{ todayWeather.temp }}°C</span>
              </span>
            </div>
          </div>

          <div
            class="mobile-hero-right"
            @click="userProfile.showEditModal = true"
            title="点击修改高考目标"
          >
            <div class="mobile-countdown-box">
              <span class="m-count-num">{{ userProfile.gaokaoTarget.diffDays }}</span>
              <span class="m-count-label">天后高考</span>
            </div>
          </div>
        </div>

        <!-- 极简进度细条 -->
        <div class="mobile-hero-progress" v-if="todayStats.total > 0">
          <div class="m-prog-bar">
            <div class="m-prog-fill" :style="{ width: `${progressPct}%` }"></div>
          </div>
          <div class="m-prog-meta">
            <span>今日待办 {{ todayStats.done }}/{{ todayStats.total }} 项 ({{ progressPct }}%)</span>
            <span>专注 {{ todayFocusText }}</span>
          </div>
        </div>
      </div>

      <div class="welcome-banner-grid desktop-only">
        <!-- 左栏：问候与今日自律指标 -->
        <div class="banner-col banner-left">
          <div class="greeting-row">
            <h1 class="greeting-title">{{ greeting }}</h1>
            <button
              type="button"
              class="edit-name-btn"
              @click="userProfile.showEditModal = true"
              title="修改学生姓名与个人档案"
            >
              <el-icon :size="13"><Edit /></el-icon>
            </button>
          </div>

          <p v-if="userProfile.customQuote" class="quote-text">
            “{{ userProfile.customQuote }}”
          </p>

          <div class="student-meta-row">
            <div class="student-meta-pill">
              <span class="meta-tag">{{ gradeAndElectivesLabel }}</span>
              <span class="meta-dot">·</span>
              <span class="meta-exam">{{ userProfile.targetExam || "全国统一高考" }}</span>
            </div>

            <button
              type="button"
              class="banner-sync-btn"
              @click="showCloudModal = true"
              title="云端极速跨端同步 (端到端加密口令)"
            >
              <el-icon :size="13"><Connection /></el-icon>
              <span>云端同步</span>
            </button>
          </div>

          <!-- 今日自律学情微卡 -->
          <div class="today-discipline-deck">
            <div
              class="discipline-item"
              @click="$router.push('/timer')"
              title="点击前往番茄钟专注计时"
            >
              <div class="disc-icon-circle">
                <el-icon :size="16"><Timer /></el-icon>
              </div>
              <div class="disc-info">
                <span class="disc-label">今日专注</span>
                <span class="disc-val">
                  {{ todayFocusText }}
                  <span v-if="timerStore.stats.today_pomodoros > 0" class="disc-sub-badge">
                    {{ timerStore.stats.today_pomodoros }}个番茄
                  </span>
                </span>
              </div>
            </div>

            <div class="disc-divider"></div>

            <div
              class="discipline-item"
              @click="$router.push('/study-plan')"
              title="点击查看今日学习任务"
            >
              <div class="disc-icon-circle">
                <el-icon :size="16"><Calendar /></el-icon>
              </div>
              <div class="disc-info">
                <span class="disc-label">今日待办</span>
                <span class="disc-val">
                  {{ todayStats.total > 0 ? `${todayStats.done}/${todayStats.total} 项 (${progressPct}%)` : "暂无待办" }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 中栏：居中沉浸式数字时钟 -->
        <div class="banner-col banner-center">
          <div class="center-clock-wrap">
            <div class="center-time">{{ formatTime(currentTime) }}</div>
            <div class="center-date">{{ formatDate(currentTime) }}</div>
            <div class="center-focus-pill">
              <span class="focus-dot-pulse"></span>
              <span>自律专注 · 静心致远</span>
            </div>
          </div>
        </div>

        <!-- 右栏：动态高考倒计时与气象 -->
        <div class="banner-col banner-right">
          <!-- 动态高考倒计时 -->
          <div
            class="gaokao-countdown-card is-clickable"
            @click="userProfile.showEditModal = true"
            title="点击修改学生年级或目标"
          >
            <div class="gaokao-header-row">
              <span class="gaokao-badge">
                <el-icon :size="12" class="badge-icon"><Compass /></el-icon>
                {{ userProfile.gaokaoTarget.targetYear }}年高考 · 倒计时
              </span>
              <span class="gaokao-target-date">目标: 6月7日</span>
            </div>
            <div class="gaokao-main-row">
              <span class="gaokao-days-num">{{ userProfile.gaokaoTarget.diffDays }}</span>
              <span class="gaokao-days-unit">天</span>
            </div>
            <div class="gaokao-slogan">
              【{{ userProfile.gradeLevel }}】{{ userProfile.gaokaoTarget.stageDesc }} · 每一天都算数
            </div>
          </div>

          <!-- 实时气象卡片 -->
          <div class="weather-compact-card" v-if="todayWeather">
            <div class="weather-top-row">
              <el-icon :size="18" class="weather-icon-svg">
                <component :is="weatherIconComponent(todayWeather.weatherCode)" />
              </el-icon>
              <span class="weather-temp-bold">{{ todayWeather.temp }}°C</span>
              <span class="weather-desc-tag">{{ weatherDesc(todayWeather.weatherCode) }}</span>
              <span class="weather-range">{{ todayWeather.tempMin }}° ~ {{ todayWeather.tempMax }}°</span>
            </div>
            <div class="weather-sub-row">
              <span>上海市</span>
              <span>·</span>
              <span>湿度 {{ todayWeather.humidity }}%</span>
              <span v-if="tomorrowWeather">· 明日 {{ weatherDesc(tomorrowWeather.weatherCode) }} {{ tomorrowWeather.tempMin }}°/{{ tomorrowWeather.tempMax }}°</span>
            </div>
          </div>
          <div class="weather-compact-card loading" v-else-if="weatherLoading">
            <span class="loading-text">正在更新气象...</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. 核心工作区：今日任务即时打卡 + 学科直通车 & 简报 -->
    <section class="workspace-section">
      <div class="workspace-grid">
        <!-- 左侧：今日待办清单即时打卡工作台 -->
        <div class="today-tasks-panel">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <div class="panel-icon-dot"></div>
              <h2 class="panel-title">今日待办清单</h2>
              <span class="panel-counter" v-if="todayStats.total > 0">
                已完成 {{ todayStats.done }}/{{ todayStats.total }} 项
              </span>
            </div>
            <div class="panel-actions">
              <button
                type="button"
                class="panel-quick-add-btn"
                @click="quickAddTodayPlan"
                title="快速增加一条今日任务"
              >
                <el-icon :size="14"><Plus /></el-icon>
                <span>加任务</span>
              </button>
              <button
                type="button"
                class="panel-link-btn"
                @click="$router.push('/study-plan')"
                title="前往计划中心管理"
              >
                <span>全部计划</span>
                <el-icon :size="12"><ArrowRight /></el-icon>
              </button>
            </div>
          </div>

          <!-- 进度指示条 -->
          <div class="tasks-progress-track" v-if="todayStats.total > 0">
            <div
              class="tasks-progress-bar"
              :style="{ width: `${progressPct}%` }"
            ></div>
          </div>

          <!-- 任务条目列表 -->
          <div class="tasks-list" v-if="todayPlans.length > 0">
            <div
              v-for="plan in todayPlans"
              :key="plan.id"
              class="task-item-card"
              :class="{ 'is-completed': plan.done }"
            >
              <button
                type="button"
                class="task-check-circle"
                :class="{ checked: plan.done }"
                @click="togglePlanItem(plan)"
                :title="plan.done ? '点击标记为未完成' : '点击完成此项任务'"
              >
                <el-icon v-if="plan.done" :size="13"><Check /></el-icon>
              </button>

              <span
                class="task-subject-tag"
                :style="{
                  backgroundColor: `${subjectColors[plan.subject] || '#6366f1'}15`,
                  color: subjectColors[plan.subject] || '#6366f1',
                  borderColor: `${subjectColors[plan.subject] || '#6366f1'}30`
                }"
              >
                {{ plan.subject }}
              </span>

              <span class="task-content-text" :title="plan.content">
                {{ plan.content }}
              </span>

              <div class="task-right-meta">
                <span class="task-time-pill" v-if="plan.estimated_minutes">
                  <el-icon :size="11"><Clock /></el-icon>
                  {{ plan.estimated_minutes }}m
                </span>

                <button
                  v-if="!plan.done"
                  type="button"
                  class="task-focus-btn"
                  @click="goToTimerWithTask(plan.content, plan.subject)"
                  title="以此任务开启专注计时"
                >
                  <el-icon :size="12"><Timer /></el-icon>
                  <span>去专注</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 今日无任务空状态 -->
          <div class="tasks-empty-state" v-else>
            <div class="empty-icon-wrap">
              <el-icon :size="28"><Calendar /></el-icon>
            </div>
            <div class="empty-text-wrap">
              <p class="empty-title">今日暂无待办学习任务</p>
              <p class="empty-sub">合理规划学习节奏，让复习更有条理</p>
            </div>
            <button
              type="button"
              class="empty-add-btn"
              @click="quickAddTodayPlan"
            >
              <el-icon :size="13"><Plus /></el-icon>
              <span>快速添加今日第一项任务</span>
            </button>
          </div>

          <!-- 移动端首屏极速快捷轨（免滑动一触即达核心引擎） -->
          <div class="mobile-quick-rail mobile-only">
            <button type="button" class="rail-chip" @click="$router.push('/timer')">
              <span class="rail-icon-box rail-bg-amber"><el-icon :size="15"><Timer /></el-icon></span>
              <span class="rail-text">专注计时</span>
            </button>
            <button type="button" class="rail-chip" @click="$router.push('/word-card')">
              <span class="rail-icon-box rail-bg-emerald"><el-icon :size="15"><Postcard /></el-icon></span>
              <span class="rail-text">背单词</span>
            </button>
            <button type="button" class="rail-chip" @click="$router.push('/subjects?tab=wrong-book')">
              <span class="rail-icon-box rail-bg-rose"><el-icon :size="15"><DocumentDelete /></el-icon></span>
              <span class="rail-text">错题靶向</span>
              <span class="rail-counter" v-if="wrongItemsCount > 0">{{ wrongItemsCount }}</span>
            </button>
            <button type="button" class="rail-chip" @click="$router.push('/subjects')">
              <span class="rail-icon-box rail-bg-indigo"><el-icon :size="15"><Reading /></el-icon></span>
              <span class="rail-text">学科考点</span>
            </button>
            <button type="button" class="rail-chip" @click="$router.push('/brain-gym')">
              <span class="rail-icon-box rail-bg-cyan"><el-icon :size="15"><MagicStick /></el-icon></span>
              <span class="rail-text">脑力特训</span>
            </button>
          </div>
        </div>

        <!-- 移动端次要功能展开/收起切换栏 -->
        <div class="mobile-secondary-toggle-bar mobile-only">
          <button
            type="button"
            class="mobile-toggle-btn"
            @click="isMobileMoreExpanded = !isMobileMoreExpanded"
          >
            <span>{{ isMobileMoreExpanded ? '收起学科直达与功能矩阵' : '查看学科考点与功能矩阵 (8)' }}</span>
            <el-icon :class="{ 'is-rotated': isMobileMoreExpanded }"><ArrowDown /></el-icon>
          </button>
        </div>

        <!-- 右侧：学科直通车与关键学情指标 -->
        <div class="side-overview-panel" :class="{ 'mobile-collapsed': !isMobileMoreExpanded }">
          <!-- 1. 学科考点直达通道 -->
          <div class="quick-subjects-card">
            <div class="side-card-header">
              <span class="side-card-title">考点直达与错题本</span>
              <span class="side-card-badge">直达阅读</span>
            </div>
            <div class="subject-chips-wrap">
              <button
                v-for="sub in quickSubjects"
                :key="sub"
                type="button"
                class="subject-chip-btn"
                @click="goToSubject(sub)"
                :title="`直接前往【${sub}】教材考点库`"
              >
                <span
                  class="chip-dot"
                  :style="{ backgroundColor: subjectColors[sub] || '#6366f1' }"
                ></span>
                <span class="chip-name">{{ sub }}</span>
              </button>

              <!-- 错题靶向特殊按钮 -->
              <button
                type="button"
                class="subject-chip-btn wrong-chip-btn"
                @click="$router.push('/subjects?tab=wrong-book')"
                title="查看并复习错题本"
              >
                <el-icon :size="13"><DocumentDelete /></el-icon>
                <span class="chip-name">错题本</span>
                <span class="wrong-badge" v-if="wrongItemsCount > 0">{{ wrongItemsCount }}</span>
              </button>
            </div>
          </div>

          <!-- 2. 学情四维小结 -->
          <div class="milestone-mini-grid">
            <div class="milestone-box" @click="$router.push('/timer')">
              <div class="milestone-top">
                <span class="m-label">今日专注</span>
                <el-icon :size="14" class="m-icon icon-amber"><Timer /></el-icon>
              </div>
              <div class="m-value">{{ timerStore.stats.today_minutes || 0 }}<span class="m-unit">分</span></div>
              <div class="m-sub">{{ timerStore.stats.today_pomodoros || 0 }} 个番茄时钟</div>
            </div>

            <div class="milestone-box" @click="$router.push('/study-plan')">
              <div class="milestone-top">
                <span class="m-label">今日完成率</span>
                <el-icon :size="14" class="m-icon icon-indigo"><Calendar /></el-icon>
              </div>
              <div class="m-value">{{ progressPct }}<span class="m-unit">%</span></div>
              <div class="m-sub">{{ todayStats.done }}/{{ todayStats.total }} 项已达成</div>
            </div>

            <div class="milestone-box" @click="$router.push('/subjects?tab=wrong-book')">
              <div class="milestone-top">
                <span class="m-label">待突破错题</span>
                <el-icon :size="14" class="m-icon icon-rose"><DocumentDelete /></el-icon>
              </div>
              <div class="m-value">{{ wrongItemsCount }}<span class="m-unit">题</span></div>
              <div class="m-sub">定期巩固错因归因</div>
            </div>

            <div class="milestone-box" @click="$router.push('/word-card')">
              <div class="milestone-top">
                <span class="m-label">单词掌握</span>
                <el-icon :size="14" class="m-icon icon-emerald"><Postcard /></el-icon>
              </div>
              <div class="m-value">{{ wordMasteredCount }}<span class="m-unit">词</span></div>
              <div class="m-sub">艾宾浩斯记忆曲线</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. 8大核心学习工作台入口矩阵 -->
    <section class="modules-section" :class="{ 'mobile-collapsed': !isMobileMoreExpanded }" aria-label="核心功能导航">
      <div class="modules-section-header">
        <div class="header-left">
          <h2 class="modules-section-title">智学功能矩阵</h2>
          <span class="modules-section-sub">8大自主学习引擎，助你高效备考</span>
        </div>
      </div>

      <div class="module-cards-grid">
        <div
          v-for="mod in modules"
          :key="mod.title"
          class="module-card-item"
          @click="$router.push(mod.path)"
        >
          <div class="module-card-inner">
            <div class="module-card-top">
              <div class="module-icon-wrap" :style="{ background: mod.color }">
                <el-icon :size="22"><component :is="mod.icon" /></el-icon>
              </div>
              <span class="module-tag">{{ mod.tag }}</span>
            </div>
            <div class="module-card-body">
              <h3 class="module-title">{{ mod.title }}</h3>
              <p class="module-desc">{{ mod.desc }}</p>
            </div>
            <div class="module-card-footer">
              <span class="footer-action-text">进入模块</span>
              <el-icon :size="13" class="footer-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. 规范页脚：置底保障与伴学计数器 -->
    <footer class="home-footer" role="contentinfo">
      <!-- 实时学子自律同行伴学胶囊 -->
      <div class="footer-companion-row">
        <div class="companion-pill" title="📊 纯客户端端到端加密同步学籍统计 · 守护每位高考学子的数字自律空间">
          <span class="live-pulse-wrapper">
            <span class="pulse-beacon"></span>
            <span class="pulse-dot"></span>
          </span>
          <span class="companion-text">
            已有 <strong class="companion-count">{{ liveStudentCount.toLocaleString() }}</strong> 位学子<span class="mobile-hide-inline">正在智学大脑</span>自律备考
          </span>
          <span class="companion-badge-tag">
            <span class="tag-fire">🔥</span>
            <span>今日 {{ liveTodayActive }} 人专注中</span>
          </span>
          <span class="companion-feature-pill">纯本地私有加密 · 永久免费</span>
        </div>
      </div>

      <div class="footer-divider"></div>
      <div class="footer-inner">
        <div class="footer-meta-line">
          <span class="footer-brand">
            <el-icon :size="14" class="footer-logo-icon"><Collection /></el-icon>
            智学大脑 · Study Brain
          </span>
          <span class="footer-badge">纯客户端私有学习引擎</span>
          <span class="footer-sep">·</span>
          <span class="footer-ver">应用版本 v{{ appVersionStore.currentVersion }}</span>
          <span class="footer-sep">·</span>
          <span class="footer-db">知识库 v{{ appConfig.currentDbVersion }}</span>
          <span class="footer-sep">·</span>
          <button type="button" class="footer-link-btn" @click="showAboutModal = true">
            关于我们
          </button>
        </div>

        <div class="footer-copy-line">
          <span class="footer-copy">Copyright © 2026 GYFolk / Study Brain. All Rights Reserved.</span>
          <span class="footer-sep">·</span>
          <span class="footer-contact">
            反馈与交流：
            <a href="mailto:Jevons@GYFolk.com" class="footer-email-link" title="点击直接发送邮件">
              Jevons@GYFolk.com
            </a>
          </span>
        </div>
      </div>
    </footer>

    <!-- 关于系统弹窗 -->
    <AboutModal v-model="showAboutModal" />

    <!-- 极速端到端加密云端同步弹窗 -->
    <CloudSyncModal v-model="showCloudModal" />
  </div>
</template>

<style scoped>
/* 核心容器：保证 Sticky Footer 在短内容或长内容下均能精确置底 */
.home-page {
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
  min-height: 100%;
}

/* 1. 顶部学情欢迎大看板 */
.welcome-section {
  background: linear-gradient(135deg, #4338ca 0%, #4f46e5 35%, #6366f1 70%, #7c3aed 100%);
  border-radius: 20px;
  padding: 24px 28px;
  margin-bottom: 22px;
  color: #ffffff;
  box-shadow: 0 10px 30px rgba(79, 70, 229, 0.22);
  position: relative;
  overflow: hidden;
}

.welcome-section::after {
  content: "";
  position: absolute;
  top: -50%;
  right: -20%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, transparent 65%);
  pointer-events: none;
}

.welcome-banner-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr 1.15fr;
  gap: 20px;
  align-items: center;
  position: relative;
  z-index: 1;
}

/* 左栏样式 */
.banner-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.greeting-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.greeting-title {
  font-size: 23px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.3px;
}

.edit-name-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #ffffff;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.edit-name-btn:hover {
  background: rgba(255, 255, 255, 0.35);
  transform: scale(1.08);
}

.quote-text {
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.9);
  font-style: italic;
  margin: 0;
  line-height: 1.4;
}

.student-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.student-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 11.5px;
  width: fit-content;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 500;
}

.banner-sync-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 11.5px;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.banner-sync-btn:hover {
  background: rgba(255, 255, 255, 0.32);
  transform: translateY(-1px);
}

.meta-dot {
  opacity: 0.6;
}

/* 今日自律学情胶囊 */
.today-discipline-deck {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 8px 14px;
  margin-top: 2px;
}

.discipline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1;
  transition: opacity 0.2s;
}

.discipline-item:hover {
  opacity: 0.88;
}

.disc-icon-circle {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.disc-info {
  display: flex;
  flex-direction: column;
}

.disc-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 500;
}

.disc-val {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 6px;
}

.disc-sub-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.35);
  border: 1px solid rgba(245, 158, 11, 0.5);
  color: #fef3c7;
  font-weight: 600;
}

.disc-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.2);
}

/* 中栏：居中数字时钟 */
.banner-center {
  display: flex;
  justify-content: center;
  text-align: center;
}

.center-clock-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.center-time {
  font-size: 44px;
  font-weight: 300;
  letter-spacing: 2px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.center-date {
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.88);
  font-weight: 500;
}

.center-focus-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 11px;
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.9);
}

.focus-dot-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: dot-pulse 1.8s infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

/* 右栏：高考倒计时与气象 */
.banner-right {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gaokao-countdown-card.is-clickable {
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}

.gaokao-countdown-card.is-clickable:hover {
  background: rgba(0, 0, 0, 0.26);
  transform: translateY(-1px);
}

.gaokao-countdown-card {
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  padding: 10px 14px;
}

.gaokao-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.gaokao-badge {
  font-size: 12px;
  font-weight: 700;
  color: #fbbf24;
  letter-spacing: 0.2px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.gaokao-target-date {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
}

.gaokao-main-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.gaokao-days-num {
  font-size: 32px;
  font-weight: 900;
  line-height: 1.1;
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.gaokao-days-unit {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.85;
}

.gaokao-slogan {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 1px;
}

/* 实时气象卡片 */
.weather-compact-card {
  background: rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  padding: 8px 12px;
}

.weather-compact-card.loading {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  padding: 12px;
}

.weather-top-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 2px;
}

.weather-icon-svg {
  color: #fde047;
}

.weather-temp-bold {
  font-size: 15px;
  font-weight: 800;
}

.weather-desc-tag {
  font-size: 11.5px;
  background: rgba(255, 255, 255, 0.15);
  padding: 1px 6px;
  border-radius: 4px;
}

.weather-range {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.8);
  margin-left: auto;
}

.weather-sub-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

/* 2. 工作区：今日任务即时打卡 + 学科直通 */
.workspace-section {
  margin-bottom: 24px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 1.45fr 1fr;
  gap: 18px;
}

/* 今日任务面板 */
.today-tasks-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  transition: var(--theme-transition);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-icon-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4f46e5;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.panel-counter {
  font-size: 12px;
  color: var(--text-sub);
  background: var(--bg-card-secondary);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-quick-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(79, 70, 229, 0.08);
  border: 1px solid rgba(79, 70, 229, 0.2);
  color: #4f46e5;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .panel-quick-add-btn {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.3);
  color: #818cf8;
}

.panel-quick-add-btn:hover {
  background: rgba(79, 70, 229, 0.15);
  transform: translateY(-1px);
}

.panel-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: none;
  border: none;
  color: var(--text-sub);
  font-size: 12px;
  cursor: pointer;
  padding: 4px;
  font-weight: 500;
  transition: color 0.2s;
}

.panel-link-btn:hover {
  color: #4f46e5;
}

/* 进度条 */
.tasks-progress-track {
  height: 4px;
  background: var(--bg-card-secondary);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 12px;
}

.tasks-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4f46e5 0%, #10b981 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* 任务列表 */
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 270px;
  overflow-y: auto;
  padding-right: 4px;
}

.task-item-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-card-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 8px 12px;
  transition: all 0.2s ease;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.task-item-card:hover {
  border-color: var(--border-regular);
  transform: translateX(2px);
}

.task-item-card.is-completed {
  opacity: 0.65;
  background: var(--bg-card);
}

.task-item-card.is-completed .task-content-text {
  text-decoration: line-through;
  color: var(--text-sub);
}

.task-check-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--border-regular);
  background: var(--bg-card);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  color: #fff;
  transition: all 0.2s;
}

.task-check-circle:hover {
  border-color: #10b981;
}

.task-check-circle.checked {
  background: #10b981;
  border-color: #10b981;
}

.task-subject-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid;
  flex-shrink: 0;
}

.task-content-text {
  font-size: 13px;
  color: var(--text-main);
  flex: 1 1 0%;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.task-right-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.task-time-pill {
  font-size: 11px;
  color: var(--text-sub);
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
}

.task-focus-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #d97706;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

:global(.dark) .task-focus-btn {
  color: #fbbf24;
}

.task-focus-btn:hover {
  background: rgba(245, 158, 11, 0.2);
  transform: scale(1.04);
}

/* 任务空状态 */
.tasks-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px 16px;
  gap: 10px;
}

.empty-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--bg-card-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-sub);
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.empty-sub {
  font-size: 12px;
  color: var(--text-sub);
  margin: 2px 0 0;
}

.empty-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #4f46e5;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
  transition: all 0.2s;
}

.empty-add-btn:hover {
  background: #4338ca;
  transform: translateY(-1px);
}

/* 右侧面板 */
.side-overview-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 学科直达卡 */
.quick-subjects-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 14px 16px;
  transition: var(--theme-transition);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.side-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.side-card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.side-card-badge {
  font-size: 11px;
  color: var(--text-sub);
}

.subject-chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.subject-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-card-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s;
}

.subject-chip-btn:hover {
  border-color: var(--border-regular);
  background: var(--bg-card-tertiary);
  transform: translateY(-1px);
}

.chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.wrong-chip-btn {
  background: rgba(225, 29, 72, 0.08);
  border-color: rgba(225, 29, 72, 0.2);
  color: #e11d48;
}

:global(.dark) .wrong-chip-btn {
  background: rgba(244, 63, 94, 0.12);
  border-color: rgba(244, 63, 94, 0.25);
  color: #fb7185;
}

.wrong-badge {
  font-size: 10px;
  font-weight: 700;
  background: #e11d48;
  color: #ffffff;
  border-radius: 10px;
  padding: 0 5px;
  line-height: 14px;
}

/* 学情四维小结 */
.milestone-mini-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.milestone-box {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}

.milestone-box:hover {
  border-color: var(--border-regular);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.05);
}

.milestone-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.m-label {
  font-size: 11.5px;
  color: var(--text-sub);
  font-weight: 500;
}

.m-icon.icon-amber { color: #d97706; }
.m-icon.icon-indigo { color: #4f46e5; }
.m-icon.icon-rose { color: #e11d48; }
.m-icon.icon-emerald { color: #059669; }

.m-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.2;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
}

.m-unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  margin-left: 2px;
}

.m-sub {
  font-size: 10.5px;
  color: var(--text-sub);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 3. 8大模块功能矩阵 */
.modules-section {
  margin-bottom: 24px;
}

.modules-section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}

.modules-section-title {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  display: inline-block;
}

.modules-section-sub {
  font-size: 12.5px;
  color: var(--text-sub);
  margin-left: 8px;
}

.module-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.module-card-item {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.module-card-item:hover {
  transform: translateY(-3px);
  border-color: var(--border-regular);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
}

.module-card-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.module-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.module-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.module-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub);
  background: var(--bg-card-secondary);
  border: 1px solid var(--border-subtle);
  padding: 2px 7px;
  border-radius: 6px;
}

.module-card-body {
  flex: 1;
}

.module-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 6px;
}

.module-desc {
  font-size: 12.5px;
  color: var(--text-sub);
  margin: 0 0 12px;
  line-height: 1.45;
}

.module-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-sub);
  font-weight: 600;
  transition: color 0.2s;
}

.module-card-item:hover .module-card-footer {
  color: #4f46e5;
}

:global(.dark) .module-card-item:hover .module-card-footer {
  color: #818cf8;
}

.footer-arrow {
  transition: transform 0.2s;
}

.module-card-item:hover .footer-arrow {
  transform: translateX(3px);
}

/* 4. 规范版权与置底页脚 */
.home-footer {
  margin-top: auto;
  padding-top: 36px;
  padding-bottom: 24px;
}

.footer-divider {
  height: 1px;
  background: var(--border-subtle);
  margin-bottom: 18px;
}

.footer-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.footer-meta-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-sub);
  flex-wrap: wrap;
}

.footer-brand {
  font-weight: 700;
  color: var(--text-regular);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.footer-logo-icon {
  color: #4f46e5;
}

.footer-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 6px;
  background: rgba(79, 70, 229, 0.1);
  color: #4f46e5;
}

:global(.dark) .footer-badge {
  background: rgba(99, 102, 241, 0.18);
  color: #a5b4fc;
}

.footer-ver,
.footer-db {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.footer-sep {
  opacity: 0.4;
}

.footer-link-btn {
  background: none;
  border: none;
  padding: 0;
  color: #4f46e5;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.2s;
  font-weight: 600;
}

:global(.dark) .footer-link-btn {
  color: #818cf8;
}

.footer-link-btn:hover {
  color: #3730a3;
}

.footer-copy-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-sub);
  flex-wrap: wrap;
}

.footer-email-link {
  color: #4f46e5;
  text-decoration: none;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  transition: color 0.2s;
}

:global(.dark) .footer-email-link {
  color: #818cf8;
}

.footer-email-link:hover {
  color: #3730a3;
  text-decoration: underline;
}

/* ================= 响应式人体工学适配 ================= */

/* 平板尺寸 (Pad: 769px ~ 1024px) */
@media (max-width: 1024px) {
  .welcome-banner-grid {
    grid-template-columns: 1fr 1fr;
  }
  .banner-center {
    grid-column: span 2;
    order: -1;
  }
  .workspace-grid {
    grid-template-columns: 1fr;
  }
  .module-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.mobile-only {
  display: none !important;
}

.desktop-only {
  display: grid;
}

/* ========================================================== */
/* 手机端深度人机工程学重构 (Mobile <= 768px, iPhone 16 基准)   */
/* ========================================================== */
@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }

  .mobile-only {
    display: block !important;
  }

  .mobile-collapsed {
    display: none !important;
  }

  .home-page {
    padding: 0 0 calc(70px + env(safe-area-inset-bottom)) 0 !important;
    max-width: 100%;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  /* 1. 移动端专享极简高能看板 (Compact Unified Hero) */
  .welcome-section {
    padding: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
    margin-bottom: 10px !important;
    max-width: 100%;
    box-sizing: border-box;
  }

  .mobile-compact-hero {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(99, 102, 241, 0.05) 50%, rgba(14, 165, 233, 0.08) 100%);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 14px;
    padding: 12px 14px 10px;
    box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.06);
    backdrop-filter: blur(10px);
    max-width: 100%;
    box-sizing: border-box;
  }

  :global(.dark) .mobile-compact-hero {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.9) 100%);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.35);
  }

  .mobile-hero-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
    max-width: 100%;
  }

  .mobile-hero-left {
    flex: 1 1 0%;
    min-width: 0;
  }

  .mobile-greeting-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    min-width: 0;
  }

  .mobile-greeting-name {
    font-size: 16.5px;
    font-weight: 700;
    color: var(--text-primary, #0f172a);
    letter-spacing: -0.2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1 1 0%;
  }

  :global(.dark) .mobile-greeting-name {
    color: #f8fafc;
  }

  .mobile-edit-btn {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(255, 255, 255, 0.6);
    color: #64748b;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  :global(.dark) .mobile-edit-btn {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: #94a3b8;
  }

  .mobile-meta-chips {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .mobile-chip-grade {
    font-size: 11.5px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(99, 102, 241, 0.12);
    color: #4f46e5;
  }

  :global(.dark) .mobile-chip-grade {
    background: rgba(99, 102, 241, 0.25);
    color: #a5b4fc;
  }

  .mobile-chip-weather {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11.5px;
    padding: 2px 7px;
    border-radius: 6px;
    background: rgba(148, 163, 184, 0.15);
    color: #475569;
  }

  :global(.dark) .mobile-chip-weather {
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  .weather-chip-icon {
    width: 13px;
    height: 13px;
    color: #f59e0b;
  }

  /* 右侧高考倒计时胶囊 */
  .mobile-hero-right {
    flex-shrink: 0;
    cursor: pointer;
  }

  .mobile-countdown-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%);
    border: 1px solid rgba(245, 158, 11, 0.35);
    padding: 6px 12px 5px;
    border-radius: 10px;
    min-width: 68px;
  }

  :global(.dark) .mobile-countdown-box {
    background: rgba(245, 158, 11, 0.18);
    border-color: rgba(245, 158, 11, 0.45);
  }

  .m-count-num {
    font-size: 22px;
    font-weight: 800;
    line-height: 1;
    color: #d97706;
    font-variant-numeric: tabular-nums;
  }

  :global(.dark) .m-count-num {
    color: #fbbf24;
  }

  .m-count-label {
    font-size: 10px;
    font-weight: 600;
    color: #b45309;
    margin-top: 2px;
  }

  :global(.dark) .m-count-label {
    color: #fde68a;
  }

  /* 极简进度微条 */
  .mobile-hero-progress {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(148, 163, 184, 0.15);
  }

  :global(.dark) .mobile-hero-progress {
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  .m-prog-bar {
    height: 3.5px;
    border-radius: 2px;
    background: rgba(148, 163, 184, 0.2);
    overflow: hidden;
  }

  .m-prog-fill {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%);
    transition: width 0.3s ease;
  }

  .m-prog-meta {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 11px;
    color: #64748b;
  }

  :global(.dark) .m-prog-meta {
    color: #94a3b8;
  }

  /* 2. 今日待办清单移动端黄金工作台 */
  .workspace-section {
    margin-bottom: 8px !important;
  }

  .workspace-grid {
    grid-template-columns: 1fr !important;
    gap: 8px !important;
  }

  .today-tasks-panel {
    padding: 12px 12px 8px !important;
    border-radius: 14px !important;
    margin-bottom: 0 !important;
  }

  .panel-header {
    margin-bottom: 8px !important;
  }

  .panel-title {
    font-size: 15px !important;
  }

  .panel-counter {
    font-size: 12px !important;
  }

  .panel-quick-add-btn {
    height: 28px !important;
    padding: 0 10px !important;
    font-size: 12px !important;
    border-radius: 7px !important;
  }

  .panel-link-btn {
    font-size: 12px !important;
  }

  /* 任务列表在手机端高度自适应，多任务支持内滚动 */
  .tasks-list {
    max-height: 190px !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    gap: 6px !important;
    padding-right: 2px;
  }

  .tasks-list::-webkit-scrollbar {
    width: 3px;
  }

  .task-item-card {
    padding: 8px 10px !important;
    min-height: 42px !important;
    border-radius: 10px !important;
    gap: 8px !important;
    min-width: 0 !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  .task-check-circle {
    width: 24px !important;
    height: 24px !important;
    min-width: 24px !important;
    border-radius: 7px !important;
    flex-shrink: 0 !important;
  }

  .task-subject-tag {
    font-size: 11.5px !important;
    padding: 2px 6px !important;
    border-radius: 5px !important;
    flex-shrink: 0 !important;
  }

  .task-content-text {
    font-size: 13.5px !important;
    font-weight: 500 !important;
    min-width: 0 !important;
    flex: 1 1 0% !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .task-right-meta {
    flex-shrink: 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
  }

  .task-time-pill {
    display: none !important;
  }

  .task-focus-btn {
    height: 26px !important;
    padding: 0 8px !important;
    font-size: 11.5px !important;
    border-radius: 6px !important;
    flex-shrink: 0 !important;
  }

  /* 今日无待办轻量条 */
  .tasks-empty-state {
    padding: 16px 12px !important;
    border-radius: 10px !important;
  }

  .empty-icon-wrap {
    width: 38px !important;
    height: 38px !important;
  }

  .empty-title {
    font-size: 13.5px !important;
  }

  .empty-sub {
    font-size: 11.5px !important;
  }

  .empty-add-btn {
    height: 30px !important;
    font-size: 12px !important;
    padding: 0 12px !important;
  }

  /* 3. 移动端首屏极速快捷轨 (Quick Rail) */
  .mobile-quick-rail {
    display: flex !important;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 8px 0 2px;
    margin-top: 4px;
    border-top: 1px solid rgba(148, 163, 184, 0.12);
  }

  :global(.dark) .mobile-quick-rail {
    border-top-color: rgba(255, 255, 255, 0.06);
  }

  .mobile-quick-rail::-webkit-scrollbar {
    display: none;
  }

  .rail-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 6px 11px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.25);
    color: var(--text-primary, #1e293b);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  :global(.dark) .rail-chip {
    background: rgba(30, 41, 59, 0.85);
    border-color: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
  }

  .rail-icon-box {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    flex-shrink: 0;
  }

  .rail-bg-amber { background: #f59e0b; }
  .rail-bg-emerald { background: #10b981; }
  .rail-bg-rose { background: #f43f5e; }
  .rail-bg-indigo { background: #6366f1; }
  .rail-bg-cyan { background: #06b6d4; }

  .rail-counter {
    padding: 1px 6px;
    border-radius: 10px;
    background: #f43f5e;
    color: #fff;
    font-size: 10.5px;
    font-weight: 700;
  }

  /* 4. 移动端次要功能展开/收起切换栏 */
  .mobile-secondary-toggle-bar {
    display: flex !important;
    justify-content: center;
    padding: 4px 0 6px;
  }

  .mobile-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 14px;
    border-radius: 16px;
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: #64748b;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  :global(.dark) .mobile-toggle-btn {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
  }

  .mobile-toggle-btn .is-rotated {
    transform: rotate(180deg);
  }

  /* 次要内容展开时的样式 */
  .side-overview-panel:not(.mobile-collapsed) {
    display: flex !important;
    flex-direction: column;
    gap: 10px !important;
    margin-top: 6px;
  }

  .modules-section:not(.mobile-collapsed) {
    display: block !important;
    margin-top: 14px;
  }

  .module-cards-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 8px !important;
  }

  .module-card-item {
    padding: 10px !important;
    border-radius: 12px !important;
  }

  .module-icon-wrap {
    width: 32px !important;
    height: 32px !important;
    border-radius: 8px !important;
  }

  .module-title {
    font-size: 13.5px !important;
  }

  .module-desc,
  .module-card-footer {
    display: none !important;
  }

  /* 5. 移动端精炼页脚 */
  .home-footer {
    margin-top: 16px !important;
    padding-top: 12px !important;
    padding-bottom: calc(14px + env(safe-area-inset-bottom)) !important;
  }

  .footer-meta-line {
    display: none !important;
  }

  .footer-copy-line {
    flex-direction: column;
    gap: 2px;
    font-size: 10.5px;
    text-align: center;
    color: #94a3b8;
  }

  .footer-sep {
    display: none;
  }
}

/* 伴学实时同行胶囊徽章 */
.footer-companion-row {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-bottom: 14px;
}

.companion-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px;
  border-radius: 9999px;
  font-size: 13px;
  background: rgba(248, 250, 252, 0.88);
  border: 1px solid rgba(56, 189, 248, 0.28);
  color: #334155;
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 0.25s ease;
  user-select: none;
}

:global(html.dark) .companion-pill {
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(56, 189, 248, 0.25);
  color: #cbd5e1;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

.companion-pill:hover {
  border-color: rgba(56, 189, 248, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(14, 165, 233, 0.16);
}

.live-pulse-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
}

.pulse-beacon {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: #10b981;
  opacity: 0.75;
  animation: companion-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.pulse-dot {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
}

@keyframes companion-pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.8); opacity: 0; }
  100% { transform: scale(0.95); opacity: 0; }
}

.companion-text {
  font-weight: 500;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.companion-count {
  font-size: 14.5px;
  font-weight: 700;
  color: #0284c7;
}

:global(html.dark) .companion-count {
  color: #38bdf8;
}

.companion-badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(249, 115, 22, 0.1);
  color: #ea580c;
  border: 1px solid rgba(249, 115, 22, 0.2);
}

:global(html.dark) .companion-badge-tag {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
  border-color: rgba(249, 115, 22, 0.3);
}

.companion-feature-pill {
  font-size: 11px;
  opacity: 0.72;
  padding-left: 8px;
  border-left: 1px solid rgba(148, 163, 184, 0.35);
}

@media (max-width: 640px) {
  .footer-companion-row {
    margin-bottom: 10px;
  }
  .companion-pill {
    padding: 5px 12px;
    font-size: 11.5px;
    gap: 6px;
    max-width: calc(100vw - 32px);
    justify-content: center;
    white-space: nowrap;
  }
  .companion-count {
    font-size: 13px;
  }
  .companion-feature-pill {
    display: none;
  }
  .companion-badge-tag {
    white-space: nowrap;
    flex-shrink: 0;
    padding: 2px 6px;
    font-size: 10.5px;
  }
}

@media (max-width: 480px) {
  .mobile-hide-inline {
    display: none !important;
  }
}
</style>
