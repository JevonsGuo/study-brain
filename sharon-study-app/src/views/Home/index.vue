<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../utils/api'

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
const greeting = ref('')
const todayWeather = ref<WeatherData | null>(null)
const tomorrowWeather = ref<WeatherData | null>(null)
const weatherLoading = ref(true)
const todayStats = ref<DayStats>({ total: 0, done: 0 })

const gaokaoDate = new Date('2027-06-07')
const gaokaoDays = computed(() => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = gaokaoDate.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const progressPct = computed(() => {
  if (todayStats.value.total === 0) return 0
  return Math.round((todayStats.value.done / todayStats.value.total) * 100)
})

const modules = [
  { title: '学习计划', desc: '制定和管理每日学习任务', icon: 'Calendar', color: '#1890ff', path: '/study-plan' },
  { title: '学科中心', desc: '9科考点重点与错题靶向', icon: 'Reading', color: '#13c2c2', path: '/subjects' },
  { title: '单词卡', desc: '英语单词记忆与复习', icon: 'Postcard', color: '#52c41a', path: '/word-card' },
  { title: '成绩追踪', desc: '记录成绩，可视化分析', icon: 'TrendCharts', color: '#722ed1', path: '/grade-tracker' },
  { title: '番茄钟', desc: '专注计时，高效学习', icon: 'Timer', color: '#fa8c16', path: '/timer' },
]

import { useUserProfileStore } from '../../stores/userProfile'
import { useAppConfigStore } from '../../stores/appConfig'
import AboutModal from '../../components/AboutModal.vue'
import { Edit } from '@element-plus/icons-vue'

const userProfile = useUserProfileStore()
const appConfig = useAppConfigStore()
const showAboutModal = ref(false)

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
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${days[date.getDay()]}`
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const weatherDesc = (code: number): string => {
  if (code === 0) return '晴'
  if (code <= 3) return '多云'
  if (code <= 48) return '雾'
  if (code <= 57) return '毛毛雨'
  if (code <= 67) return '雨'
  if (code <= 77) return '雪'
  if (code <= 82) return '阵雨'
  if (code <= 86) return '阵雪'
  if (code <= 99) return '雷阵雨'
  return '多云'
}

const weatherIcon = (code: number): string => {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌧️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '🌨️'
  if (code <= 99) return '⛈️'
  return '⛅'
}

const fetchWeather = async () => {
  weatherLoading.value = true
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=31.23&longitude=121.47&daily=temperature_2m_max,temperature_2m_min,weathercode&current=temperature_2m,relative_humidity_2m,weathercode,wind_speed_10m&timezone=Asia/Shanghai&forecast_days=2')
    const data = await res.json()
    todayWeather.value = {
      temp: Math.round(data.current.temperature_2m),
      tempMax: Math.round(data.daily.temperature_2m_max[0]),
      tempMin: Math.round(data.daily.temperature_2m_min[0]),
      weatherCode: data.current.weathercode,
      windSpeed: Math.round(data.current.wind_speed_10m),
      humidity: data.current.relative_humidity_2m,
    }
    tomorrowWeather.value = {
      temp: Math.round(data.daily.temperature_2m_max[1]),
      tempMax: Math.round(data.daily.temperature_2m_max[1]),
      tempMin: Math.round(data.daily.temperature_2m_min[1]),
      weatherCode: data.daily.weathercode[1],
      windSpeed: 0,
      humidity: 0,
    }
  } catch {
    todayWeather.value = null
    tomorrowWeather.value = null
  } finally {
    weatherLoading.value = false
  }
}

const fetchTodayStats = async () => {
  try {
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    const plans = await api.get('/study-plans')
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
    <div class="welcome-section">
      <div class="welcome-top">
        <div class="welcome-text">
          <div class="greeting-row">
            <h1>{{ greeting }}</h1>
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
          <p class="date-text">{{ formatDate(currentTime) }}</p>
          <p class="time-text">{{ formatTime(currentTime) }}</p>
        </div>
        <div class="info-cards">
          <div class="weather-card" v-if="todayWeather">
            <div class="weather-main">
              <span class="weather-icon-big">{{ weatherIcon(todayWeather.weatherCode) }}</span>
              <div class="weather-detail">
                <div class="weather-temp">{{ todayWeather.temp }}°C</div>
                <div class="weather-desc">{{ weatherDesc(todayWeather.weatherCode) }}</div>
              </div>
            </div>
            <div class="weather-extra">
              <span>{{ todayWeather.tempMin }}°/{{ todayWeather.tempMax }}°</span>
              <span>💧{{ todayWeather.humidity }}%</span>
            </div>
            <div class="weather-tomorrow" v-if="tomorrowWeather">
              <span class="tmr-label">明日</span>
              <span>{{ weatherIcon(tomorrowWeather.weatherCode) }}</span>
              <span>{{ weatherDesc(tomorrowWeather.weatherCode) }}</span>
              <span>{{ tomorrowWeather.tempMin }}°/{{ tomorrowWeather.tempMax }}°</span>
            </div>
          </div>
          <div class="weather-card loading" v-else-if="weatherLoading">
            <span class="loading-text">加载天气...</span>
          </div>

          <div class="gaokao-card">
            <div class="gaokao-num">{{ gaokaoDays }}</div>
            <div class="gaokao-label">距高考（天）</div>
          </div>

          <div class="progress-card" v-if="todayStats.total > 0">
            <div class="progress-ring">
              <svg viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="4" />
                <circle cx="20" cy="20" r="16" fill="none" stroke="#fff" stroke-width="4"
                  :stroke-dasharray="`${progressPct * 1.005} ${101 - progressPct * 1.005}`"
                  stroke-linecap="round"
                  transform="rotate(-90 20 20)" />
              </svg>
              <span class="ring-text">{{ progressPct }}%</span>
            </div>
            <div class="progress-label">今日完成 {{ todayStats.done }}/{{ todayStats.total }}</div>
          </div>
        </div>
      </div>
    </div>

    <el-row :gutter="20" class="module-cards">
      <el-col :xs="24" :sm="12" :md="8" v-for="mod in modules" :key="mod.title">
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
          <span class="footer-ver">应用版本 v1.0.0</span>
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
.home-page { max-width: 1200px; margin: 0 auto; }

.welcome-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 32px 36px;
  margin-bottom: 24px;
  color: #fff;
}

.welcome-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.welcome-text h1 { font-size: 26px; margin: 0 0 6px; }
.date-text { font-size: 14px; opacity: 0.8; margin: 4px 0; }
.time-text { font-size: 36px; font-weight: 300; margin: 6px 0 0; font-variant-numeric: tabular-nums; letter-spacing: 2px; }

.info-cards {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.weather-card {
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 160px;
}

.weather-card.loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-text { font-size: 13px; opacity: 0.7; }

.weather-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.weather-icon-big { font-size: 32px; line-height: 1; }

.weather-detail { display: flex; flex-direction: column; }
.weather-temp { font-size: 20px; font-weight: 700; line-height: 1.2; }
.weather-desc { font-size: 12px; opacity: 0.8; }

.weather-extra {
  display: flex;
  gap: 12px;
  font-size: 11px;
  opacity: 0.7;
  margin-bottom: 6px;
}

.weather-tomorrow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.2);
}

.tmr-label { opacity: 0.6; }

.gaokao-card {
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 12px 16px;
  text-align: center;
  min-width: 100px;
}

.gaokao-num { font-size: 28px; font-weight: 800; line-height: 1.2; }
.gaokao-label { font-size: 11px; opacity: 0.7; margin-top: 2px; }

.progress-card {
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 12px 16px;
  text-align: center;
  min-width: 100px;
}

.progress-ring {
  position: relative;
  width: 44px;
  height: 44px;
  margin: 0 auto 4px;
}

.progress-ring svg { width: 100%; height: 100%; transform: rotate(-0deg); }

.ring-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  font-weight: 700;
}

.progress-label { font-size: 11px; opacity: 0.7; }

.module-cards { margin-top: 0; }
.module-card { margin-bottom: 20px; cursor: pointer; transition: transform 0.3s; text-align: center; }
.module-card:hover { transform: translateY(-4px); }
.module-icon { width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #fff; }
.module-card h3 { margin: 0 0 8px; font-size: 18px; color: var(--text-main, #303133); }
.module-card p { color: var(--text-sub, #999); font-size: 14px; margin: 0; }

.greeting-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.edit-name-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #ffffff;
  border-radius: 50%;
  width: 28px;
  height: 28px;
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
  color: rgba(255, 255, 255, 0.88);
  font-style: italic;
  margin: 4px 0 6px;
  letter-spacing: 0.3px;
}

/* 规范版权与页脚 */
.home-footer {
  margin-top: 40px;
  padding-bottom: 30px;
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

</style>
