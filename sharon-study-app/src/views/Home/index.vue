<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import { api } from "../../utils/api"
import { useUserProfileStore } from "../../stores/userProfile"
import { useAppConfigStore } from "../../stores/appConfig"
import { useAppVersionStore } from "../../stores/appVersion"
import { useTimerStore } from "../../stores/timer"
import AboutModal from "../../components/AboutModal.vue"
import { Edit } from "@element-plus/icons-vue"

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

const currentTime = ref(new Date())
const greeting = ref("")
const todayWeather = ref<WeatherData | null>(null)
const tomorrowWeather = ref<WeatherData | null>(null)
const weatherLoading = ref(true)
const todayStats = ref<DayStats>({ total: 0, done: 0 })

const userProfile = useUserProfileStore()
const appConfig = useAppConfigStore()
const appVersionStore = useAppVersionStore()
const timerStore = useTimerStore()
const showAboutModal = ref(false)

// 智能高考倒计时联动 userProfile.gaokaoTarget（根据年级动态推算）

// 今日计划进度 (选项 A)
const progressPct = computed(() => {
  if (todayStats.value.total === 0) return 0
  return Math.round((todayStats.value.done / todayStats.value.total) * 100)
})

// 今日专注时长格式化 (选项 A)
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

const modules = [
  { title: "学习计划", desc: "制定和管理每日学习任务", icon: "Calendar", color: "#1890ff", path: "/study-plan" },
  { title: "学科中心", desc: "9科考点重点与错题靶向", icon: "Reading", color: "#13c2c2", path: "/subjects" },
  { title: "单词卡", desc: "英语单词记忆与复习", icon: "Postcard", color: "#52c41a", path: "/word-card" },
  { title: "成绩追踪", desc: "记录成绩，可视化分析", icon: "TrendCharts", color: "#722ed1", path: "/grade-tracker" },
  { title: "番茄钟", desc: "专注计时，高效学习", icon: "Timer", color: "#fa8c16", path: "/timer" },
]

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
  if (code === 0) return "晴"
  if (code <= 3) return "多云"
  if (code <= 48) return "雾"
  if (code <= 57) return "毛毛雨"
  if (code <= 67) return "雨"
  if (code <= 77) return "雪"
  if (code <= 82) return "阵雨"
  if (code <= 86) return "阵雪"
  if (code <= 99) return "雷阵雨"
  return "晴"
}

const weatherIcon = (code: number): string => {
  if (code === 0) return "☀️"
  if (code <= 3) return "⛅"
  if (code <= 48) return "🌫️"
  if (code <= 57) return "🌧️"
  if (code <= 67) return "🌧️"
  if (code <= 77) return "❄️"
  if (code <= 82) return "🌦️"
  if (code <= 86) return "🌨️"
  if (code <= 99) return "⛈️"
  return "⛅"
}

const fetchWeather = async () => {
  weatherLoading.value = true
  try {
    // 1. 读取本地 2 小时缓存，保证秒开
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

    // 2. 超时保护请求
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
    // 3. 兜底数据，保证绝不卡在“加载中”
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

const fetchTodayStats = async () => {
  try {
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`
    const plans = await api.get("/study-plans")
    const todayPlans = (plans as any[]).filter(p => p.date === today)
    todayStats.value = { total: todayPlans.length, done: todayPlans.filter(p => p.done || p.status === "done").length }
  } catch {
    todayStats.value = { total: 0, done: 0 }
  }
}

let timer: ReturnType<typeof setInterval>

onMounted(() => {
  updateGreeting()
  fetchWeather()
  fetchTodayStats()
  timerStore.fetchStats()
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
    <!-- 首页顶部自律大看板 (三栏居中时钟架构) -->
    <div class="welcome-section">
      <div class="welcome-banner-grid">
        <!-- 1. 左栏：学生问候与今日自律战报 (选项 A) -->
        <div class="banner-col banner-left">
          <div class="greeting-row">
            <h1 class="greeting-title">{{ greeting }}</h1>
            <button
              type="button"
              class="edit-name-btn"
              @click="userProfile.showEditModal = true"
              title="修改学生姓名与个人档案"
            >
              <el-icon><Edit /></el-icon>
            </button>
          </div>
          <p v-if="userProfile.customQuote" class="quote-text">
            “{{ userProfile.customQuote }}”
          </p>

          <!-- 今日自律学情胶囊 (选项 A: 专注与计划) -->
          <div class="today-discipline-deck">
            <div
              class="discipline-item"
              @click="$router.push('/timer')"
              title="点击前往番茄钟专注计时"
            >
              <span class="disc-icon">⏱️</span>
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
              <span class="disc-icon">📋</span>
              <div class="disc-info">
                <span class="disc-label">今日计划</span>
                <span class="disc-val">
                  {{ todayStats.total > 0 ? `${todayStats.done}/${todayStats.total} 项 (${progressPct}%)` : "暂无今日计划" }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 中栏：居中沉浸数字时钟 (时钟居中) -->
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

        <!-- 3. 右栏：2027高考倒计时 & 稳健气象 -->
        <div class="banner-col banner-right">
          <!-- 动态高考倒计时（根据所选年级推算目标年份） -->
          <div
            class="gaokao-countdown-card is-clickable"
            @click="userProfile.showEditModal = true"
            title="点击修改学生年级或目标"
          >
            <div class="gaokao-header-row">
              <span class="gaokao-badge">🎯 {{ userProfile.gaokaoTarget.targetYear }}年高考 · 倒计时</span>
              <span class="gaokao-target-date">目标: 6月7日</span>
            </div>
            <div class="gaokao-main-row">
              <span class="gaokao-days-num">{{ userProfile.gaokaoTarget.diffDays }}</span>
              <span class="gaokao-days-unit">天</span>
            </div>
            <div class="gaokao-slogan">【{{ userProfile.gradeLevel }}】{{ userProfile.gaokaoTarget.stageDesc }} · 每一天都算数</div>
          </div>

          <!-- 稳健天气卡片 -->
          <div class="weather-compact-card" v-if="todayWeather">
            <div class="weather-top-row">
              <span class="weather-icon-inline">{{ weatherIcon(todayWeather.weatherCode) }}</span>
              <span class="weather-temp-bold">{{ todayWeather.temp }}°C</span>
              <span class="weather-desc-tag">{{ weatherDesc(todayWeather.weatherCode) }}</span>
              <span class="weather-range">{{ todayWeather.tempMin }}° ~ {{ todayWeather.tempMax }}°</span>
            </div>
            <div class="weather-sub-row">
              <span>上海市</span>
              <span>·</span>
              <span>💧 湿度 {{ todayWeather.humidity }}%</span>
              <span v-if="tomorrowWeather">· 明日 {{ weatherIcon(tomorrowWeather.weatherCode) }} {{ tomorrowWeather.tempMin }}°/{{ tomorrowWeather.tempMax }}°</span>
            </div>
          </div>
          <div class="weather-compact-card loading" v-else-if="weatherLoading">
            <span class="loading-text">正在更新气象...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主功能模块入口网格 -->
    <el-row :gutter="20" class="module-cards">
      <el-col :xs="12" :sm="12" :md="8" v-for="mod in modules" :key="mod.title">
        <el-card shadow="hover" class="module-card" @click="$router.push(mod.path)">
          <div class="module-icon" :style="{ background: mod.color }">
            <el-icon :size="32"><component :is="mod.icon" /></el-icon>
          </div>
          <h3>{{ mod.title }}</h3>
          <p>{{ mod.desc }}</p>
        </el-card>
      </el-col>
    </el-row>

    <!-- 规范页脚：版本、版权与联系反馈 -->
    <footer class="home-footer">
      <div class="footer-divider"></div>
      <div class="footer-inner">
        <div class="footer-meta-line">
          <span class="footer-brand">🎯 智学大脑 · Study Brain</span>
          <span class="footer-badge">个人自律学习助手</span>
          <span class="footer-sep">·</span>
          <span class="footer-ver">应用版本 v{{ appVersionStore.currentVersion }}</span>
          <span class="footer-sep">·</span>
          <span class="footer-db">考点词库 v{{ appConfig.currentDbVersion }}</span>
          <span class="footer-sep">·</span>
          <button type="button" class="footer-link-btn" @click="showAboutModal = true">
            关于
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

    <AboutModal v-model="showAboutModal" />
  </div>
</template>

<style scoped>
.home-page {
  max-width: 1280px;
  margin: 0 auto;
}

/* 顶部学情欢迎大看板 */
.welcome-section {
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 40%, #7c3aed 100%);
  border-radius: 20px;
  padding: 26px 30px;
  margin-bottom: 24px;
  color: #ffffff;
  box-shadow: 0 10px 30px rgba(79, 70, 229, 0.25);
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

/* 1. 左栏样式 */
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
  font-size: 24px;
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
  transition: all 0.2s;
  font-size: 13px;
}

.edit-name-btn:hover {
  background: rgba(255, 255, 255, 0.35);
  transform: scale(1.1);
}

.quote-text {
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.9);
  font-style: italic;
  margin: 0 0 4px;
  line-height: 1.4;
}

/* 今日自律学情胶囊卡 (选项 A) */
.today-discipline-deck {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 8px 14px;
  margin-top: 4px;
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
  opacity: 0.85;
}

.disc-icon {
  font-size: 18px;
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
  background: rgba(239, 68, 68, 0.35);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #fee2e2;
  font-weight: 600;
}

.disc-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.2);
}

/* 2. 中栏：居中时钟 */
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

/* 3. 右栏：2027高考与气象 */
.banner-right {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gaokao-countdown-card.is-clickable { cursor: pointer; transition: transform 0.2s, background 0.2s; }
.gaokao-countdown-card.is-clickable:hover { background: rgba(0, 0, 0, 0.26); transform: translateY(-1px); }
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

/* 稳健天气卡片 */
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
  padding: 14px;
}

.weather-top-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 2px;
}

.weather-icon-inline {
  font-size: 18px;
  line-height: 1;
}

.weather-temp-bold {
  font-size: 15px;
  font-weight: 800;
}

.weather-desc-tag {
  font-size: 12px;
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

/* 主功能卡片 */
.module-cards {
  margin-top: 0;
}

.module-card {
  margin-bottom: 20px;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
  text-align: center;
  border-radius: 14px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.module-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.module-icon {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  color: #fff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.module-card h3 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.module-card p {
  color: var(--text-sub, #64748b);
  font-size: 13.5px;
  margin: 0;
}

/* 规范版权与页脚 */
.home-footer {
  margin-top: 36px;
  padding-bottom: 26px;
}

.footer-divider {
  height: 1px;
  background: var(--border-color, rgba(226, 232, 240, 0.8));
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
  color: var(--text-sub, #64748b);
  flex-wrap: wrap;
}

.footer-brand {
  font-weight: 700;
  color: var(--text-main, #334155);
}

.footer-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
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
  color: #3b82f6;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.2s;
  font-weight: 600;
}

.footer-link-btn:hover {
  color: #1d4ed8;
}

.footer-copy-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-sub, #94a3b8);
  flex-wrap: wrap;
}

.footer-email-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  transition: color 0.2s;
}

.footer-email-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

/* 移动端与小屏适配 */
@media (max-width: 960px) {
  .welcome-banner-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .banner-center {
    order: -1;
  }
}

/* 手机端深度精简与去繁化简适配 (< 768px) */
@media (max-width: 768px) {
  .welcome-section {
    padding: 16px 14px 14px;
    border-radius: 16px;
    margin-bottom: 16px;
  }

  /* 隐藏居中大时钟：手机系统顶栏已有时间，省出核心视口高度 */
  .banner-center {
    display: none !important;
  }

  .welcome-banner-grid {
    gap: 12px !important;
  }

  .greeting-title {
    font-size: 19px;
  }

  .quote-text {
    font-size: 12px;
    margin-bottom: 2px;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .today-discipline-deck {
    padding: 6px 10px;
    gap: 8px;
    border-radius: 10px;
  }

  .disc-val {
    font-size: 12.5px;
  }

  .disc-label {
    font-size: 10px;
  }

  .banner-right {
    gap: 8px !important;
  }

  .gaokao-countdown-card {
    padding: 10px 14px !important;
    border-radius: 12px !important;
  }

  .gaokao-days-num {
    font-size: 28px !important;
  }

  .gaokao-slogan {
    font-size: 11px !important;
  }

  /* 隐藏天气卡片的多余湿度、风速和明日预报，只保留紧凑单行 */
  .weather-compact-card {
    padding: 6px 12px !important;
    border-radius: 10px !important;
  }

  .weather-sub-row {
    display: none !important;
  }

  .weather-top-row {
    gap: 6px !important;
    font-size: 12px !important;
  }

  .weather-temp-bold {
    font-size: 14px !important;
  }

  /* 手机端两列紧凑模块卡片 */
  .module-cards {
    margin: 0 -6px !important;
  }

  .module-cards .el-col {
    padding: 0 6px !important;
    margin-bottom: 12px;
  }

  .module-card {
    padding: 14px 10px !important;
    border-radius: 14px !important;
  }

  .module-card :deep(.el-card__body) {
    padding: 0 !important;
  }

  .module-icon {
    width: 44px !important;
    height: 44px !important;
    border-radius: 12px !important;
    margin-bottom: 8px !important;
  }

  .module-icon .el-icon {
    font-size: 22px !important;
  }

  .module-card h3 {
    font-size: 14px !important;
    margin-bottom: 4px !important;
  }

  .module-card p {
    font-size: 11px !important;
    line-height: 1.3 !important;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* 手机端精简页脚：仅保留单行紧凑版权 */
  .home-footer {
    margin-top: 14px !important;
    padding-top: 10px !important;
  }

  .footer-meta-line {
    display: none !important;
  }

  .footer-copy-line {
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    text-align: center;
  }

  .footer-sep {
    display: none;
  }
}

</style>
