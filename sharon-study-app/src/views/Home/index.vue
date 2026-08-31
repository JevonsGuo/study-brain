<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const currentTime = ref(new Date())
const greeting = ref('')

const modules = [
  { title: '知识库', desc: '各学科核心知识点', icon: 'Reading', color: '#13c2c2', path: '/knowledge' },
  { title: '学习计划', desc: '制定和管理每日学习任务', icon: 'Calendar', color: '#1890ff', path: '/study-plan' },
  { title: '错题本', desc: '记录错题，针对性复习', icon: 'Notebook', color: '#f5222d', path: '/wrong-book' },
  { title: '单词卡', desc: '英语单词记忆与复习', icon: 'Postcard', color: '#52c41a', path: '/word-card' },
  { title: '成绩追踪', desc: '记录成绩，可视化分析', icon: 'TrendCharts', color: '#722ed1', path: '/grade-tracker' },
  { title: '番茄钟', desc: '专注计时，高效学习', icon: 'Timer', color: '#fa8c16', path: '/timer' },
]

const updateGreeting = () => {
  const hour = currentTime.value.getHours()
  if (hour < 6) greeting.value = '夜深了，注意休息'
  else if (hour < 12) greeting.value = '早上好，Sharon'
  else if (hour < 14) greeting.value = '中午好，Sharon'
  else if (hour < 18) greeting.value = '下午好，Sharon'
  else greeting.value = '晚上好，Sharon'
}

const formatDate = (date: Date) => {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${days[date.getDay()]}`
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

let timer: ReturnType<typeof setInterval>

onMounted(() => {
  updateGreeting()
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
      <div class="welcome-text">
        <h1>{{ greeting }}</h1>
        <p class="date-text">{{ formatDate(currentTime) }}</p>
        <p class="time-text">{{ formatTime(currentTime) }}</p>
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
  </div>
</template>

<style scoped>
.home-page {
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 40px;
  margin-bottom: 24px;
  color: #fff;
}

.welcome-text h1 {
  font-size: 28px;
  margin: 0 0 8px;
}

.date-text {
  font-size: 16px;
  opacity: 0.85;
  margin: 4px 0;
}

.time-text {
  font-size: 36px;
  font-weight: 300;
  margin: 8px 0 0;
  font-variant-numeric: tabular-nums;
}

.module-cards {
  margin-top: 0;
}

.module-card {
  margin-bottom: 20px;
  cursor: pointer;
  transition: transform 0.3s;
  text-align: center;
}

.module-card:hover {
  transform: translateY(-4px);
}

.module-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: #fff;
}

.module-card h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

.module-card p {
  color: #999;
  font-size: 14px;
  margin: 0;
}
</style>
