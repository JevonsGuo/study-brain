<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../utils/api'

interface SubjectInfo {
  name: string
  icon: string
  color: string
  gradient: string
  emoji: string
  desc: string
  image: string
}

const router = useRouter()
const subjects = ref<string[]>([])
const chapterCounts = ref<Record<string, number>>({})
const pointCounts = ref<Record<string, number>>({})
const loading = ref(true)

const subjectConfig: Record<string, SubjectInfo> = {
  '数学': { name: '数学', icon: 'Histogram', color: '#409eff', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', emoji: '📐', desc: '代数·几何·概率统计', image: '/subjects/math.svg' },
  '英语': { name: '英语', icon: 'Postcard', color: '#67c23a', gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', emoji: '🔤', desc: '词汇·语法·阅读', image: '/subjects/english.svg' },
  '物理': { name: '物理', icon: 'Cpu', color: '#e6a23c', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', emoji: '⚡', desc: '力学·电磁·光学', image: '/subjects/physics.svg' },
  '化学': { name: '化学', icon: 'MagicStick', color: '#f56c6c', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', emoji: '🧪', desc: '有机·无机·反应原理', image: '/subjects/chemistry.svg' },
  '生物': { name: '生物', icon: 'Cherry', color: '#85ce61', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', emoji: '🧬', desc: '细胞·遗传·生态', image: '/subjects/biology.svg' },
  '语文': { name: '语文', icon: 'Notebook', color: '#909399', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', emoji: '📖', desc: '古文·现代文·写作', image: '/subjects/chinese.svg' },
  '历史': { name: '历史', icon: 'Clock', color: '#c45656', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', emoji: '🏛️', desc: '中国史·世界史', image: '/subjects/history.svg' },
  '地理': { name: '地理', icon: 'Place', color: '#2d8cf0', gradient: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)', emoji: '🌍', desc: '自然·人文·区域', image: '/subjects/geography.svg' },
  '政治': { name: '政治', icon: 'Stamp', color: '#ed4014', gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)', emoji: '📜', desc: '经济·哲学·政治', image: '/subjects/politics.svg' },
}

const getInfo = (name: string): SubjectInfo => {
  return subjectConfig[name] || {
    name, icon: 'Document', color: '#909399',
    gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    emoji: '📚', desc: '知识点学习', image: '/subjects/default.svg',
  }
}

const fetchSubjects = async () => {
  loading.value = true
  try {
    const data = await api.get('/knowledge/subjects')
    subjects.value = data.subjects
    const chapData: Record<string, number> = {}
    const ptData: Record<string, number> = {}
    for (const ch of data.chapters as Array<{ subject: string; chapter: string }>) {
      chapData[ch.subject] = (chapData[ch.subject] || 0) + 1
    }
    for (const s of subjects.value) {
      try {
        const pts = await api.get(`/knowledge?subject=${encodeURIComponent(s)}`)
        ptData[s] = (pts as Array<unknown>).length
      } catch {
        ptData[s] = 0
      }
    }
    chapterCounts.value = chapData
    pointCounts.value = ptData
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

const enterSubject = (subject: string) => {
  router.push(`/knowledge/${encodeURIComponent(subject)}`)
}

onMounted(fetchSubjects)
</script>

<template>
  <div class="knowledge-page">
    <div class="page-header">
      <div class="header-left">
        <h2>知识库</h2>
        <span class="header-desc">高中各学科核心知识点</span>
      </div>
    </div>

    <div v-loading="loading" class="subjects-grid">
      <div
        v-for="s in subjects"
        :key="s"
        class="subject-card"
        :style="{ background: getInfo(s).gradient }"
        @click="enterSubject(s)"
      >
        <div class="card-emoji">{{ getInfo(s).emoji }}</div>
        <div class="card-body">
          <div class="card-name">{{ s }}</div>
          <div class="card-desc">{{ getInfo(s).desc }}</div>
          <div class="card-stats">
            <span>{{ chapterCounts[s] || 0 }} 章节</span>
            <span class="stat-dot">·</span>
            <span>{{ pointCounts[s] || 0 }} 知识点</span>
          </div>
        </div>
        <div class="card-arrow">
          <el-icon size="20"><ArrowRight /></el-icon>
        </div>
      </div>

      <div v-if="subjects.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无学科内容，请先添加知识点" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.knowledge-page {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left h2 {
  margin: 0;
  font-size: 22px;
  color: #303133;
}

.header-desc {
  font-size: 13px;
  color: #909399;
  margin-left: 12px;
}

.subjects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.subject-card {
  border-radius: 16px;
  padding: 28px 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 20px;
  transition: all 0.3s ease;
  color: #fff;
  position: relative;
  overflow: hidden;
  min-height: 130px;
}

.subject-card::before {
  content: '';
  position: absolute;
  top: -30px;
  right: -30px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.subject-card::after {
  content: '';
  position: absolute;
  bottom: -40px;
  left: -20px;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}

.subject-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

.card-emoji {
  font-size: 48px;
  flex-shrink: 0;
  z-index: 1;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
}

.card-body {
  flex: 1;
  min-width: 0;
  z-index: 1;
}

.card-name {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.card-desc {
  font-size: 13px;
  opacity: 0.85;
  margin-bottom: 8px;
}

.card-stats {
  font-size: 12px;
  opacity: 0.75;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-dot {
  opacity: 0.5;
}

.card-arrow {
  z-index: 1;
  opacity: 0.6;
  transition: all 0.3s;
}

.subject-card:hover .card-arrow {
  opacity: 1;
  transform: translateX(4px);
}

.empty-state {
  grid-column: 1 / -1;
  padding: 80px 0;
}
</style>
