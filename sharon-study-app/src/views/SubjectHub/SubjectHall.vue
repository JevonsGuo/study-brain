<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { useAppConfigStore } from '../../stores/appConfig'
import { subjectEmojis } from '../../utils/subjects'
import { SUBJECT_METAS } from '../../utils/gaokaoTopics'
import {
  Reading,
  Notebook,
  Right,
  RefreshRight,
  Plus
} from '@element-plus/icons-vue'

interface KnowledgePoint {
  id: number
  subject: string
  title: string
}

interface WrongItem {
  id: number
  subject: string
  mastery_status: 'unmastered' | 'learning' | 'mastered'
}

const emit = defineEmits<{
  (e: 'open-add-dialog', subject?: string): void
}>()

const router = useRouter()
const appConfig = useAppConfigStore()

const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

const loading = ref(false)
const allPoints = ref<KnowledgePoint[]>([])
const allWrongItems = ref<WrongItem[]>([])

const starredPointIds = ref<Set<number>>(new Set())
const masteredPointIds = ref<Set<number>>(new Set())

// 本地持久化掌握状态
const loadLocalStatuses = () => {
  try {
    const rawStarred = localStorage.getItem('study_starred_points') || localStorage.getItem('sharon_starred_points')
    if (rawStarred) starredPointIds.value = new Set(JSON.parse(rawStarred))
    const rawMastered = localStorage.getItem('study_mastered_points') || localStorage.getItem('sharon_mastered_points')
    if (rawMastered) masteredPointIds.value = new Set(JSON.parse(rawMastered))
  } catch (e) {
    console.error('Failed to load point statuses', e)
  }
}

const fetchData = async (silent = false) => {
  if (!silent) loading.value = true
  loadLocalStatuses()
  try {
    const [pointsRes, wrongRes] = await Promise.all([
      api.get('/knowledge'),
      api.get('/wrong-items')
    ])
    allPoints.value = (pointsRes as KnowledgePoint[]) || []
    allWrongItems.value = (wrongRes as WrongItem[]) || []
  } catch (err) {
    console.error('Failed to fetch subject hub data', err)
  } finally {
    if (!silent) loading.value = false
  }
}

// 监听公共数据库版本更新，就地静默同步全科统计与考点总数
watch(() => appConfig.dataVersionCounter, () => {
  console.log('[SubjectHall] 收到公共数据版本更新，自动静默同步考点总览...')
  fetchData(true)
})

// 统计总览
const overallStats = computed(() => {
  const totalPoints = allPoints.value.length
  const masteredPoints = allPoints.value.filter(p => masteredPointIds.value.has(p.id)).length
  const pointRate = totalPoints > 0 ? Math.round((masteredPoints / totalPoints) * 100) : 0

  const totalWrong = allWrongItems.value.length
  const unmasteredWrong = allWrongItems.value.filter(w => w.mastery_status === 'unmastered').length
  const learningWrong = allWrongItems.value.filter(w => w.mastery_status === 'learning').length
  const masteredWrong = allWrongItems.value.filter(w => w.mastery_status === 'mastered').length
  const wrongRate = totalWrong > 0 ? Math.round((masteredWrong / totalWrong) * 100) : 0

  return {
    totalPoints,
    masteredPoints,
    pointRate,
    totalWrong,
    unmasteredWrong,
    learningWrong,
    masteredWrong,
    wrongRate
  }
})

// 各科统计信息
const getSubjectData = (sub: string) => {
  const points = allPoints.value.filter(p => p.subject === sub)
  const totalPoints = points.length
  const masteredPoints = points.filter(p => masteredPointIds.value.has(p.id)).length
  const pointRate = totalPoints > 0 ? Math.round((masteredPoints / totalPoints) * 100) : 0

  const wrongs = allWrongItems.value.filter(w => w.subject === sub)
  const totalWrong = wrongs.length
  const unmasteredWrong = wrongs.filter(w => w.mastery_status === 'unmastered').length
  const learningWrong = wrongs.filter(w => w.mastery_status === 'learning').length
  const masteredWrong = wrongs.filter(w => w.mastery_status === 'mastered').length
  const wrongRate = totalWrong > 0 ? Math.round((masteredWrong / totalWrong) * 100) : 0

  return {
    totalPoints,
    masteredPoints,
    pointRate,
    totalWrong,
    unmasteredWrong,
    learningWrong,
    masteredWrong,
    wrongRate
  }
}

const goToSubject = (sub: string, tab: 'knowledge' | 'wrong-book' = 'knowledge') => {
  router.push(`/subjects/${encodeURIComponent(sub)}?tab=${tab}`)
}

onMounted(fetchData)
</script>

<template>
  <div class="subject-hall-root" v-loading="loading" element-loading-text="正在加载学科中心全景数据..." element-loading-background="rgba(255, 255, 255, 0.7)">
    <!-- 英雄大顶栏：标题与双指标总览 -->
    <!-- 首次载入 / 数据同步中加载提示条 -->
    <div v-if="loading && allPoints.length === 0" class="hall-sync-banner">
      <div class="sync-banner-content">
        <span class="sync-banner-emblem">📚</span>
        <div class="sync-banner-info">
          <div class="sync-banner-title">正在从官方云端下载 9 大学科核心考点库...</div>
          <div class="sync-banner-sub">收录 {{ allPoints.length || 235 }} 个高考必考考点与核心提分思维导图，仅首次进入需要同步，完成后离线秒开！</div>
        </div>
      </div>
      <div class="sync-banner-progress">
        <div class="sync-progress-bar"></div>
      </div>
    </div>

    <header class="hall-hero">
      <div class="hero-main-content">
        <div class="hero-badge-row">
          <span class="hero-badge">🎯 上海新高考 · 9大学科全景中心</span>
          <span class="hero-subbadge">双核驱动 · 考点精讲 × 错题靶向治理</span>
        </div>
        <h1 class="hero-title">学科中心 · 9大学科全景学情工作台</h1>
        <p class="hero-desc">
          以学科为核心归集全科知识点与实战错题，消灭认知盲区，实现“学理、练题、溯源补漏”一体化闭环。
        </p>

        <!-- 双核总览看板 -->
        <div class="dual-overview-deck">
          <!-- 知识考点维度看板 -->
          <div class="overview-capsule knowledge-capsule">
            <div class="capsule-icon-box">
              <el-icon class="capsule-icon"><Reading /></el-icon>
            </div>
            <div class="capsule-info">
              <div class="capsule-title">全科核心考点库</div>
              <div class="capsule-metric-row">
                <span class="metric-num">{{ overallStats.totalPoints }}</span>
                <span class="metric-label">个归集考点</span>
                <span class="metric-divider">/</span>
                <span class="metric-sub">已掌握 {{ overallStats.masteredPoints }}</span>
                <span class="metric-badge">{{ overallStats.pointRate }}% 掌握</span>
              </div>
            </div>
          </div>

          <!-- 错题攻克维度看板 -->
          <div class="overview-capsule wrong-capsule">
            <div class="capsule-icon-box">
              <el-icon class="capsule-icon"><Notebook /></el-icon>
            </div>
            <div class="capsule-info">
              <div class="capsule-title">实战错题集录</div>
              <div class="capsule-metric-row">
                <span class="metric-num">{{ overallStats.totalWrong }}</span>
                <span class="metric-label">道记录错题</span>
                <span class="metric-divider">/</span>
                <span class="metric-unmastered">🔴 {{ overallStats.unmasteredWrong }} 待攻克</span>
                <span class="metric-badge green">{{ overallStats.wrongRate }}% 消灭</span>
              </div>
            </div>
          </div>

          <!-- 快捷操作区 -->
          <div class="overview-actions">
            <el-button
              type="primary"
              size="default"
              :icon="Plus"
              class="quick-record-btn"
              @click="emit('open-add-dialog')"
            >
              录入错题
            </el-button>
            <el-button
              :icon="RefreshRight"
              circle
              size="default"
              class="refresh-btn"
              @click="fetchData"
              title="刷新全科学情"
            />
          </div>
        </div>
      </div>
    </header>

    <!-- 9 大学科双指标网格卡片墙 (3x3 布局) -->
    <main class="subjects-grid">
      <div
        v-for="s in subjects"
        :key="s"
        class="subject-card"
        :style="{
          '--card-color': SUBJECT_METAS[s]?.color || '#3b82f6',
          '--card-gradient': SUBJECT_METAS[s]?.gradient || 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
        }"
        @click="goToSubject(s, 'knowledge')"
      >
        <!-- 顶部流光色带 -->
        <div class="card-top-stripe"></div>

        <div class="card-content">
          <!-- 学科头部信息 -->
          <div class="card-header">
            <div class="subject-info-left">
              <span class="subject-emoji">{{ subjectEmojis[s] || '📚' }}</span>
              <div class="subject-titles">
                <h3 class="subject-name">{{ s }}</h3>
                <span class="subject-edition">
                  {{ SUBJECT_METAS[s]?.edition || '高考标准大纲' }}
                </span>
              </div>
            </div>

            <!-- 学科口号 -->
            <span class="subject-slogan">{{ SUBJECT_METAS[s]?.slogan || '核心题型方法' }}</span>
          </div>

          <!-- 双指标数据面板 -->
          <div class="metrics-panel">
            <!-- 考点指标行 -->
            <div class="metric-row knowledge-row">
              <div class="metric-label-group">
                <el-icon class="row-icon"><Reading /></el-icon>
                <span class="row-title">考点掌握</span>
              </div>
              <div class="metric-values">
                <span class="val-text">
                  <strong>{{ getSubjectData(s).masteredPoints }}</strong> / {{ getSubjectData(s).totalPoints }}
                </span>
                <span class="val-rate">{{ getSubjectData(s).pointRate }}%</span>
              </div>
            </div>
            <div class="progress-track">
              <div
                class="progress-fill knowledge-fill"
                :style="{ width: `${getSubjectData(s).pointRate}%` }"
              ></div>
            </div>

            <!-- 错题指标行 -->
            <div class="metric-row wrong-row">
              <div class="metric-label-group">
                <el-icon class="row-icon"><Notebook /></el-icon>
                <span class="row-title">错题治理</span>
              </div>
              <div class="metric-values">
                <span class="val-text">
                  共 <strong>{{ getSubjectData(s).totalWrong }}</strong> 题
                  <span v-if="getSubjectData(s).unmasteredWrong > 0" class="unmastered-alert">
                    (🔴 {{ getSubjectData(s).unmasteredWrong }} 待攻克)
                  </span>
                </span>
                <span class="val-rate green">{{ getSubjectData(s).wrongRate }}%</span>
              </div>
            </div>
            <div class="progress-track">
              <div
                class="progress-fill wrong-fill"
                :style="{ width: `${getSubjectData(s).wrongRate}%` }"
              ></div>
            </div>
          </div>

          <!-- 重点专题热点预览标签 -->
          <div class="topics-tag-preview">
            <span
              v-for="(tag, idx) in (SUBJECT_METAS[s]?.previewTopics || []).slice(0, 3)"
              :key="idx"
              class="topic-chip"
            >
              {{ tag }}
            </span>
          </div>

          <!-- 底部快速分流动作栏 -->
          <div class="card-footer-actions">
            <button
              class="sub-action-btn knowledge-btn"
              @click.stop="goToSubject(s, 'knowledge')"
              title="进入考点库精讲"
            >
              <el-icon><Reading /></el-icon>
              <span>考点库 ({{ getSubjectData(s).totalPoints }})</span>
            </button>

            <button
              class="sub-action-btn wrong-btn"
              @click.stop="goToSubject(s, 'wrong-book')"
              title="进入错题靶向本"
            >
              <el-icon><Notebook /></el-icon>
              <span>错题本 ({{ getSubjectData(s).totalWrong }})</span>
            </button>

            <div class="enter-arrow-box" title="进入学科工作台">
              <el-icon><Right /></el-icon>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.subject-hall-root {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1400px;
  margin: 0 auto;
  padding-bottom: 40px;
}

/* 英雄顶部横幅 */
.hall-hero {
  background: var(--bg-card, #ffffff);
  border-radius: 16px;
  border: 1px solid var(--border-color, #e2e8f0);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  padding: 24px 28px;
  position: relative;
  overflow: hidden;
}

.hall-hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
}

.hero-badge-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.hero-badge {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  letter-spacing: 0.3px;
}

.hero-subbadge {
  background: rgba(139, 92, 246, 0.1);
  color: #7c3aed;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
}

.hero-title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  letter-spacing: -0.3px;
}

.hero-desc {
  margin: 0 0 18px;
  font-size: 13.5px;
  color: var(--text-muted, #64748b);
  line-height: 1.6;
}

/* 双核总览看板 */
.dual-overview-deck {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.overview-capsule {
  flex: 1;
  min-width: 280px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.knowledge-capsule {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.05));
  border-color: rgba(59, 130, 246, 0.2);
}

.wrong-capsule {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.04), rgba(245, 158, 11, 0.05));
  border-color: rgba(245, 158, 11, 0.2);
}

.capsule-icon-box {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.knowledge-capsule .capsule-icon-box {
  background: #eff6ff;
  color: #2563eb;
}

.wrong-capsule .capsule-icon-box {
  background: #fef2f2;
  color: #dc2626;
}

.capsule-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.capsule-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted, #64748b);
  text-transform: uppercase;
}

.capsule-metric-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.metric-num {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.metric-label {
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.metric-divider {
  color: #cbd5e1;
  font-size: 12px;
}

.metric-sub {
  font-size: 12px;
  color: #3b82f6;
  font-weight: 600;
}

.metric-unmastered {
  font-size: 12px;
  color: #ef4444;
  font-weight: 600;
}

.metric-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
  background: #dbeafe;
  color: #1d4ed8;
}

.metric-badge.green {
  background: #dcfce7;
  color: #15803d;
}

.overview-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.quick-record-btn {
  font-weight: 600;
  border-radius: 10px;
}

.refresh-btn {
  border-radius: 10px;
}

/* 9 大学科网格 (严格 3x3) */
.subjects-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 1100px) {
  .subjects-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 680px) {
  .subjects-grid {
    grid-template-columns: 1fr;
  }
}

.subject-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
}

.subject-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  border-color: var(--card-color);
}

.card-top-stripe {
  height: 5px;
  background: var(--card-gradient);
  width: 100%;
}

.card-content {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.subject-info-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.subject-emoji {
  font-size: 28px;
}

.subject-titles {
  display: flex;
  flex-direction: column;
}

.subject-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.subject-edition {
  font-size: 11px;
  color: var(--text-muted, #64748b);
}

.subject-slogan {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  background: rgba(0, 0, 0, 0.03);
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

/* 双指标面板 */
.metrics-panel {
  background: var(--bg-page, #f8fafc);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--border-color, #edf2f7);
}

.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.metric-label-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--text-main, #334155);
}

.knowledge-row .row-icon {
  color: #2563eb;
}

.wrong-row .row-icon {
  color: #e11d48;
}

.metric-values {
  display: flex;
  align-items: center;
  gap: 6px;
}

.val-text {
  color: var(--text-muted, #64748b);
}

.val-text strong {
  color: var(--text-main, #0f172a);
}

.unmastered-alert {
  color: #ef4444;
  font-weight: 600;
}

.val-rate {
  font-weight: 700;
  color: #2563eb;
}

.val-rate.green {
  color: #10b981;
}

.progress-track {
  height: 5px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.progress-fill.knowledge-fill {
  background: linear-gradient(90deg, #3b82f6, #6366f1);
}

.progress-fill.wrong-fill {
  background: linear-gradient(90deg, #10b981, #059669);
}

/* 重点专题热点标签云 */
.topics-tag-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.topic-chip {
  font-size: 11px;
  color: var(--text-muted, #64748b);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 7px;
  border-radius: 4px;
}

/* 底部操作分流区 */
.card-footer-actions {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color, #edf2f7);
}

.sub-action-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
}

.knowledge-btn {
  background: rgba(59, 130, 246, 0.08);
  color: #2563eb;
}

.knowledge-btn:hover {
  background: rgba(59, 130, 246, 0.18);
}

.wrong-btn {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
}

.wrong-btn:hover {
  background: rgba(239, 68, 68, 0.18);
}

.enter-arrow-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #64748b);
  transition: all 0.2s;
  flex-shrink: 0;
}

.subject-card:hover .enter-arrow-box {
  background: var(--card-color);
  color: #ffffff;
  transform: translateX(2px);
}

/* 暗色模式 */
:global(.dark) .hall-hero {
  background: #131b2e;
  border-color: #1e293b;
}

:global(.dark) .hero-title {
  color: #f8fafc;
}

:global(.dark) .knowledge-capsule {
  background: rgba(30, 58, 138, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
}

:global(.dark) .capsule-icon-box {
  background: rgba(255, 255, 255, 0.06);
}

:global(.dark) .wrong-capsule {
  background: rgba(127, 29, 29, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
}

:global(.dark) .metric-num {
  color: #f8fafc;
}

:global(.dark) .subject-card {
  background: #131b2e;
  border-color: #1e293b;
}

:global(.dark) .subject-name {
  color: #f8fafc;
}

:global(.dark) .subject-slogan {
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
}

:global(.dark) .metrics-panel {
  background: #0b1120;
  border-color: #1e293b;
}

:global(.dark) .val-text strong {
  color: #f8fafc;
}

:global(.dark) .topic-chip {
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
}

:global(.dark) .card-footer-actions {
  border-top-color: #1e293b;
}

:global(.dark) .knowledge-btn {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}

:global(.dark) .wrong-btn {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

:global(.dark) .enter-arrow-box {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}

/* 首次同步加载条美化 */
.hall-sync-banner {
  margin-bottom: 20px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.1));
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sync-banner-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sync-banner-emblem {
  font-size: 28px;
  animation: sync-bounce 2s infinite ease-in-out;
}

.sync-banner-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sync-banner-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
}

.sync-banner-sub {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.sync-banner-progress {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(99, 102, 241, 0.15);
  overflow: hidden;
  position: relative;
}

.sync-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 35%;
  background: linear-gradient(90deg, #6366f1, #ec4899);
  border-radius: 2px;
  animation: sync-slide 1.8s infinite ease-in-out;
}

@keyframes sync-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes sync-slide {
  0% { left: -35%; }
  100% { left: 100%; }
}

</style>
