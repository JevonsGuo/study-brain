<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '../../utils/api'
import { useAppConfigStore } from '../../stores/appConfig'
import { useUserProfileStore } from '../../stores/userProfile'
import {
  subjectEmojis,
  MANDATORY_SUBJECTS,
  ALL_SUBJECTS
} from '../../utils/subjects'
import { SUBJECT_METAS } from '../../utils/gaokaoTopics'
import {
  Reading,
  Notebook,
  Right,
  RefreshRight,
  Plus,
  Check,
  Filter
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
const userProfile = useUserProfileStore()

// 视图过滤模式：all (全部9科) | my3plus3 (语数英+自选3副科=6科) | electives (仅自选副科)
export type SubjectFilterMode = 'all' | 'my3plus3' | 'electives'
const FILTER_STORAGE_KEY = 'study_subject_filter_mode'
const filterMode = ref<SubjectFilterMode>(
  (localStorage.getItem(FILTER_STORAGE_KEY) as SubjectFilterMode) || 'all'
)

const setFilterMode = (mode: SubjectFilterMode) => {
  filterMode.value = mode
  localStorage.setItem(FILTER_STORAGE_KEY, mode)
}

// 判定科目类别
const isMandatory = (sub: string) => MANDATORY_SUBJECTS.includes(sub)
const isElectiveSelected = (sub: string) => userProfile.electiveSubjects.includes(sub)

// 切换选考副科标记
const toggleElectiveSubject = async (sub: string) => {
  if (isMandatory(sub)) return

  const current = [...userProfile.electiveSubjects]
  const index = current.indexOf(sub)

  if (index > -1) {
    // 取消选中
    current.splice(index, 1)
    await userProfile.updateElectiveSubjects(current)
    ElMessage.info(`已取消【${sub}】选考副科标记`)
  } else {
    // 选中新科目（限制 3 门）
    if (current.length >= 3) {
      ElMessage.warning('上海新高考为 3+3 模式（3门必考 + 3门副科），当前已选满 3 门副科。请先取消某一门再添加！')
      return
    }
    current.push(sub)
    await userProfile.updateElectiveSubjects(current)
    ElMessage.success(`已将【${sub}】设为我的 3+3 选考副科`)
  }
}

// 根据当前视图模式过滤要呈现的学科
const displayedSubjects = computed(() => {
  if (filterMode.value === 'my3plus3') {
    const chosen = new Set(userProfile.electiveSubjects)
    return ALL_SUBJECTS.filter(s => MANDATORY_SUBJECTS.includes(s) || chosen.has(s))
  }
  if (filterMode.value === 'electives') {
    const chosen = new Set(userProfile.electiveSubjects)
    return ALL_SUBJECTS.filter(s => chosen.has(s))
  }
  return ALL_SUBJECTS
})

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

// 依据当前视图过滤范围，动态计算看板总览
const overallStats = computed(() => {
  const targetSubjectSet = new Set(displayedSubjects.value)
  const scopedPoints = allPoints.value.filter(p => targetSubjectSet.has(p.subject))
  const totalPoints = scopedPoints.length
  const masteredPoints = scopedPoints.filter(p => masteredPointIds.value.has(p.id)).length
  const pointRate = totalPoints > 0 ? Math.round((masteredPoints / totalPoints) * 100) : 0

  const scopedWrongs = allWrongItems.value.filter(w => targetSubjectSet.has(w.subject))
  const totalWrong = scopedWrongs.length
  const unmasteredWrong = scopedWrongs.filter(w => w.mastery_status === 'unmastered').length
  const learningWrong = scopedWrongs.filter(w => w.mastery_status === 'learning').length
  const masteredWrong = scopedWrongs.filter(w => w.mastery_status === 'mastered').length
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
          <div class="sync-banner-title">正在加载 9 大学科核心考点库...</div>
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
              <div class="capsule-title">
                {{ filterMode === 'all' ? '全科核心考点库' : filterMode === 'my3plus3' ? '我的 3+3 核心考点库' : '自选副科考点库' }}
              </div>
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
              <div class="capsule-title">
                {{ filterMode === 'all' ? '全科实战错题集' : filterMode === 'my3plus3' ? '3+3 实战错题集' : '自选副科错题集' }}
              </div>
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

    <!-- 学科视图范围切换工具栏 -->
    <section class="hall-filter-bar">
      <div class="filter-switch-area">
        <div class="filter-label">
          <el-icon class="filter-icon"><Filter /></el-icon>
          <span class="label-text">学科视图：</span>
        </div>
        <div class="filter-tabs">
          <button
            type="button"
            class="filter-tab-btn"
            :class="{ active: filterMode === 'all' }"
            @click="setFilterMode('all')"
          >
            <span>全部学科</span>
            <span class="tab-count-badge">9</span>
          </button>
          <button
            type="button"
            class="filter-tab-btn"
            :class="{ active: filterMode === 'my3plus3' }"
            @click="setFilterMode('my3plus3')"
            title="上海新高考 3+3 体系：语文、数学、英语 + 3门自选副科"
          >
            <span class="badge-icon">🎯</span>
            <span>我的 3+3</span>
            <span class="tab-count-badge highlight">{{ 3 + userProfile.electiveSubjects.length }}</span>
          </button>
          <button
            type="button"
            class="filter-tab-btn"
            :class="{ active: filterMode === 'electives' }"
            @click="setFilterMode('electives')"
            title="仅显示自己选择的选考副科"
          >
            <span class="badge-icon">⚡</span>
            <span>仅自选副科</span>
            <span class="tab-count-badge">{{ userProfile.electiveSubjects.length }}</span>
          </button>
        </div>
      </div>

      <div class="filter-status-area">
        <div class="status-badge mandatory-badge" title="高考必考科目：语文、数学、英语（不可更改）">
          <span class="dot mandatory-dot"></span>
          <span class="badge-text">必考：语 · 数 · 英</span>
        </div>
        <div
          class="status-badge elective-badge"
          :class="{ 'is-complete': userProfile.electiveSubjects.length === 3 }"
          title="上海新高考 6 门选考副科中自选 3 门"
        >
          <span class="dot elective-dot"></span>
          <span class="badge-text">
            自选副科 ({{ userProfile.electiveSubjects.length }}/3)：
            <strong v-if="userProfile.electiveSubjects.length > 0">{{ userProfile.electiveSubjects.join(' · ') }}</strong>
            <span v-else class="text-hint">未选（请在下方卡片点击标记）</span>
          </span>
        </div>
      </div>
    </section>

    <!-- 学科卡片网格 (依据视图显示全部/3+3/自选副科) -->
    <main v-if="displayedSubjects.length > 0" class="subjects-grid">
      <div
        v-for="s in displayedSubjects"
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
                <div class="subject-name-row">
                  <h3 class="subject-name">{{ s }}</h3>
                  <!-- 必考科目只读徽章 -->
                  <span
                    v-if="isMandatory(s)"
                    class="subject-kind-pill mandatory-pill"
                    title="上海新高考 3+3 必考主科（全员必修）"
                  >
                    必考
                  </span>
                  <!-- 选考副科交互按钮 -->
                  <button
                    v-else
                    type="button"
                    class="subject-kind-pill elective-pill"
                    :class="{ 'is-selected': isElectiveSelected(s) }"
                    @click.stop="toggleElectiveSubject(s)"
                    :title="isElectiveSelected(s) ? '点击取消选考标记' : '点击设为我的 3+3 选考副科'"
                  >
                    <el-icon v-if="isElectiveSelected(s)" class="pill-icon"><Check /></el-icon>
                    <el-icon v-else class="pill-icon"><Plus /></el-icon>
                    <span>{{ isElectiveSelected(s) ? '我的选科' : '设为选科' }}</span>
                  </button>
                </div>
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

    <!-- 副科为空时的引导占位箱 -->
    <div v-else class="hall-empty-box">
      <div class="empty-emoji">📌</div>
      <h3 class="empty-title">暂未标记自选副科</h3>
      <p class="empty-desc">
        上海新高考为 3+3 模式（语数英为必考科目，其余 6 门自选 3 门副科）。请切换到“全部学科”，在物理、化学、生物、历史、地理、政治卡片上点击【设为选科】进行标记。
      </p>
      <el-button type="primary" size="default" @click="setFilterMode('all')">
        切换到全部学科开始标记
      </el-button>
    </div>
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

@media (hover: hover) {
  .subject-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
    border-color: var(--card-color);
  }
}

.subject-card:active {
  transform: scale(0.985);
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
  gap: 2px;
}

.subject-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.subject-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

/* 必考与选考类别徽章 */
.subject-kind-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 3px 8px;
  border-radius: 6px;
  user-select: none;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
}

.mandatory-pill {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  border-color: rgba(37, 99, 235, 0.22);
  cursor: default;
}

.elective-pill {
  cursor: pointer;
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
  color: #64748b;
  outline: none;
}

.elective-pill:hover {
  border-color: #3b82f6;
  color: #2563eb;
  background: #eff6ff;
  transform: translateY(-1px);
}

.elective-pill.is-selected {
  border-style: solid;
  border-color: #0284c7;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  color: #0369a1;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(2, 132, 199, 0.15);
}

.elective-pill.is-selected:hover {
  background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%);
  border-color: #0369a1;
  color: #075985;
}

.pill-icon {
  font-size: 11px;
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

/* 学科视图范围切换工具栏 */
.hall-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 10px 18px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  flex-wrap: wrap;
}

.filter-switch-area {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #1e293b);
}

.filter-icon {
  color: #3b82f6;
  font-size: 15px;
}

.filter-tabs {
  display: inline-flex;
  align-items: center;
  background: var(--bg-page, #f1f5f9);
  padding: 3px;
  border-radius: 10px;
  gap: 4px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.filter-tab-btn {
  border: none;
  outline: none;
  background: transparent;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}

.filter-tab-btn:hover {
  color: var(--text-main, #0f172a);
}

.filter-tab-btn.active {
  background: #ffffff;
  color: #2563eb;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.tab-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.06);
  color: inherit;
  font-weight: 700;
}

.filter-tab-btn.active .tab-count-badge {
  background: #dbeafe;
  color: #1d4ed8;
}

.tab-count-badge.highlight {
  background: #fef3c7;
  color: #b45309;
}

.filter-tab-btn.active .tab-count-badge.highlight {
  background: #fde68a;
  color: #92400e;
}

.filter-status-area {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  border: 1px solid transparent;
}

.mandatory-badge {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e40af;
}

.mandatory-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
}

.elective-badge {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #475569;
}

.elective-badge.is-complete {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.elective-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
}

.elective-badge.is-complete .elective-dot {
  background: #10b981;
}

.text-hint {
  color: #94a3b8;
  font-style: italic;
}

/* 空状态占位箱 */
.hall-empty-box {
  background: var(--bg-card, #ffffff);
  border: 2px dashed var(--border-color, #cbd5e1);
  border-radius: 16px;
  padding: 48px 24px;
  text-align: center;
  max-width: 600px;
  margin: 20px auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-emoji {
  font-size: 40px;
}

.empty-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.empty-desc {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-muted, #64748b);
  line-height: 1.6;
  max-width: 480px;
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

:global(.dark) .hall-filter-bar {
  background: #131b2e;
  border-color: #1e293b;
}

:global(.dark) .filter-label {
  color: #f8fafc;
}

:global(.dark) .filter-tabs {
  background: #0b1120;
}

:global(.dark) .filter-tab-btn {
  color: #94a3b8;
}

:global(.dark) .filter-tab-btn:hover {
  color: #f8fafc;
}

:global(.dark) .filter-tab-btn.active {
  background: #1e293b;
  color: #60a5fa;
}

:global(.dark) .mandatory-badge {
  background: rgba(37, 99, 235, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

:global(.dark) .mandatory-pill {
  background: rgba(37, 99, 235, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

:global(.dark) .elective-badge {
  background: #0b1120;
  border-color: #1e293b;
  color: #cbd5e1;
}

:global(.dark) .elective-badge.is-complete {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
}

:global(.dark) .elective-pill {
  background: #0b1120;
  border-color: #334155;
  color: #94a3b8;
}

:global(.dark) .elective-pill:hover {
  background: #1e293b;
  color: #60a5fa;
  border-color: #3b82f6;
}

:global(.dark) .elective-pill.is-selected {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(14, 165, 233, 0.25) 100%);
  border-color: #0284c7;
  color: #38bdf8;
}

:global(.dark) .hall-empty-box {
  background: #131b2e;
  border-color: #334155;
}

:global(.dark) .empty-title {
  color: #f8fafc;
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


/* ========================================================== */
/* 学科大厅移动端与小屏精简适配 (< 768px)                      */
/* ========================================================== */
@media (max-width: 768px) {
  .hall-hero {
    padding: 16px 14px !important;
    border-radius: 16px !important;
    margin-bottom: 14px !important;
  }

  /* 隐藏非核心副标题与长描述文字，首屏直达学科入口 */
  .hero-subbadge,
  .hero-desc {
    display: none !important;
  }

  .hero-title {
    font-size: 18px !important;
    margin: 4px 0 10px !important;
  }

  .dual-overview-deck {
    flex-direction: column !important;
    gap: 8px !important;
  }

  .overview-capsule {
    padding: 8px 12px !important;
    border-radius: 10px !important;
  }

  .capsule-icon-box {
    width: 32px !important;
    height: 32px !important;
  }

  .capsule-title {
    font-size: 12px !important;
  }

  .metric-num {
    font-size: 15px !important;
  }

  .metric-label,
  .metric-sub {
    font-size: 11px !important;
  }

  .overview-actions {
    width: 100% !important;
  }

  .quick-record-btn {
    width: 100% !important;
  }

  .subjects-grid {
    gap: 12px !important;
  }

  .hall-filter-bar {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 10px !important;
    padding: 10px 12px !important;
  }

  .filter-switch-area {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
  }

  .filter-tabs {
    width: 100% !important;
    display: flex !important;
  }

  .filter-tab-btn {
    flex: 1 !important;
    justify-content: center !important;
    padding: 6px 4px !important;
    font-size: 11.5px !important;
  }

  .filter-status-area {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 6px !important;
  }

  .status-badge {
    font-size: 11px !important;
    padding: 3px 8px !important;
  }
}

</style>
