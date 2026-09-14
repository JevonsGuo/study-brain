<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../../utils/api'
import { ElMessage } from 'element-plus'
import {
  Search,
  Link,
  DocumentCopy,
  Star,
  StarFilled,
  CircleCheck,
  Compass,
  RefreshRight
} from '@element-plus/icons-vue'

interface CuratedResource {
  id: string
  title: string
  category: string
  category_name: string
  icon: string
  domain: string
  url: string
  badge: string
  badge_type: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  target_audience: string
  desc: string
  highlights: string[]
  sort_order: number
}

interface SubjectResource {
  id: number
  subject: string
  category: string
  name: string
  desc: string
  url: string
  sort_order: number
}

const resources = ref<CuratedResource[]>([])
const subjectTools = ref<SubjectResource[]>([])
const loading = ref(true)
const activeCategory = ref('all')
const searchQuery = ref('')
const onlyFavorites = ref(false)
const favorites = ref<Set<string>>(new Set())

const FAVORITES_KEY = 'study_curated_resource_favorites'

const categories = [
  { key: 'all', name: '全部精品', icon: '🌟' },
  { key: 'k12', name: '中小学基础教育', icon: '🏫' },
  { key: 'reading', name: '数字阅读典籍', icon: '📖' },
  { key: 'higher_edu', name: '名校大学与考研', icon: '🎓' },
  { key: 'vocational', name: '职业教育与实操', icon: '🛠️' },
  { key: 'recitation', name: '经典语文示范诵读', icon: '🎙️' },
  { key: 'science', name: '权威科学前沿科普', icon: '🔬' },
  { key: 'academic', name: '学术文献与期刊', icon: '📑' },
  { key: 'documentary', name: '正版高清纪录片', icon: '🎥' },
  { key: 'lifelong', name: '终身教育与百科', icon: '🌱' },
  { key: 'subject_tools', name: '高考全科提分神器', icon: '🧮' }
]

const loadFavorites = () => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (raw) {
      favorites.value = new Set(JSON.parse(raw))
    }
  } catch {
    favorites.value = new Set()
  }
}

const toggleFavorite = (id: string) => {
  if (favorites.value.has(id)) {
    favorites.value.delete(id)
    ElMessage.info('已取消收藏')
  } else {
    favorites.value.add(id)
    ElMessage.success('已加入我的收藏 ⭐')
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites.value)))
}

const fetchResources = async () => {
  loading.value = true
  try {
    const [curatedList, toolsList] = await Promise.all([
      api.get('/curated-resources') as Promise<CuratedResource[]>,
      api.get('/learning-resources') as Promise<SubjectResource[]>
    ])
    resources.value = curatedList || []
    subjectTools.value = toolsList || []
  } catch (err) {
    console.error('Failed to load curated resources', err)
    ElMessage.error('加载学习资源失败，请稍后刷新')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadFavorites()
  fetchResources()
})

const filteredResources = computed(() => {
  let list: CuratedResource[] = []

  if (activeCategory.value === 'subject_tools') {
    // 聚合转换高考 66 项学科神器
    list = subjectTools.value.map(st => ({
      id: `tool-${st.id}`,
      title: st.name,
      category: 'subject_tools',
      category_name: `${st.subject}学科神器`,
      icon: st.category === 'tool' ? '🧮' : st.category === 'practice' ? '📝' : '🎬',
      domain: new URL(st.url.startsWith('http') ? st.url : `https://${st.url}`).hostname.replace('www.', ''),
      url: st.url,
      badge: `${st.subject} · ${st.category === 'tool' ? '专属神器' : st.category === 'practice' ? '精选真题' : '名师课程'}`,
      badge_type: 'info' as const,
      target_audience: `高中${st.subject}专项备考拔高`,
      desc: st.desc,
      highlights: ['精准对标高中核心考点', '省时高效提分利器', '100%免费免充值'],
      sort_order: st.sort_order || 99
    }))
  } else if (activeCategory.value === 'all') {
    list = [...resources.value]
  } else {
    list = resources.value.filter(item => item.category === activeCategory.value)
  }

  // 收藏筛选
  if (onlyFavorites.value) {
    list = list.filter(item => favorites.value.has(item.id))
  }

  // 搜索关键字筛选
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.domain.toLowerCase().includes(q) ||
      item.target_audience.toLowerCase().includes(q) ||
      item.highlights.some(h => h.toLowerCase().includes(q)) ||
      item.badge.toLowerCase().includes(q)
    )
  }

  // 排序：收藏置顶，其次按 sort_order
  return list.sort((a, b) => {
    const aFav = favorites.value.has(a.id) ? 1 : 0
    const bFav = favorites.value.has(b.id) ? 1 : 0
    if (aFav !== bFav) return bFav - aFav
    return (a.sort_order || 0) - (b.sort_order || 0)
  })
})

const copyUrl = async (url: string) => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    ElMessage.success('已复制官网网址到剪贴板！')
  } catch {
    ElMessage.warning(`复制失败，网址为：${url}`)
  }
}

const openExternal = (url: string) => {
  const target = url.startsWith('http') ? url : `https://${url}`
  window.open(target, '_blank', 'noopener,noreferrer')
}

const resetFilter = () => {
  activeCategory.value = 'all'
  searchQuery.value = ''
  onlyFavorites.value = false
}
</script>

<template>
  <div class="resource-hub-view">
    <!-- 顶部极光沉浸式 Banner -->
    <header class="hub-hero">
      <div class="hero-glow-bg"></div>
      <div class="hero-content">
        <div class="hero-title-row">
          <span class="hero-emoji">🌐</span>
          <h1 class="hero-title">网络优质学习资源宝库</h1>
          <span class="hero-badge">央视权威推荐 · 国家级公益</span>
        </div>
        <p class="hero-desc">
          精选国家教育部、中科院、国图与央视总台打造的永久免费优质学习门户，无商业广告、不搞VIP套路，立省上千元网课与会员开销。
        </p>

        <!-- 关键承诺指标徽章 -->
        <div class="hero-stat-chips">
          <div class="stat-chip">
            <el-icon class="stat-icon"><CircleCheck /></el-icon>
            <span><b>9 大</b>国家级公益平台</span>
          </div>
          <div class="stat-chip">
            <span class="chip-dot-green"></span>
            <span><b>100%</b> 永久免费官方域名</span>
          </div>
          <div class="stat-chip">
            <el-icon class="stat-icon"><Compass /></el-icon>
            <span>覆盖小初高全科至终身进修</span>
          </div>
          <div class="stat-chip highlight-chip">
            <span>省下每年上千元多平台会员费 💰</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 筛选控制与分类导航栏 -->
    <section class="hub-filter-section">
      <!-- 搜索与控制行 -->
      <div class="filter-controls-row">
        <div class="search-input-wrap">
          <el-input
            v-model="searchQuery"
            placeholder="搜索资源名称、考研、论文、纪录片、科普、域名等关键词..."
            clearable
            :prefix-icon="Search"
            class="hub-search-input"
          />
        </div>

        <div class="filter-actions-wrap">
          <el-button
            :type="onlyFavorites ? 'warning' : 'default'"
            :plain="!onlyFavorites"
            :icon="onlyFavorites ? StarFilled : Star"
            @click="onlyFavorites = !onlyFavorites"
            class="action-pill-btn"
          >
            仅看我的收藏 ({{ favorites.size }})
          </el-button>

          <el-button
            v-if="searchQuery || activeCategory !== 'all' || onlyFavorites"
            plain
            :icon="RefreshRight"
            @click="resetFilter"
            class="action-pill-btn"
          >
            重置筛选
          </el-button>
        </div>
      </div>

      <!-- 分类胶囊选项卡 -->
      <div class="category-pills-bar">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          class="category-pill"
          :class="{ 'is-active': activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          <span class="pill-icon">{{ cat.icon }}</span>
          <span class="pill-name">{{ cat.name }}</span>
        </button>
      </div>
    </section>

    <!-- 核心资源展示卡片流 -->
    <main class="hub-cards-container" v-loading="loading">
      <div v-if="filteredResources.length > 0" class="resource-grid">
        <article
          v-for="item in filteredResources"
          :key="item.id"
          class="resource-card"
          :class="{ 'is-favorited': favorites.has(item.id) }"
        >
          <!-- 卡片顶栏 -->
          <div class="card-header">
            <div class="card-icon-wrap">
              <span class="card-emoji">{{ item.icon }}</span>
            </div>
            <div class="card-badge-group">
              <span class="official-badge" :class="`badge-${item.badge_type}`">
                {{ item.badge }}
              </span>
              <button
                type="button"
                class="star-btn"
                :class="{ 'is-starred': favorites.has(item.id) }"
                @click="toggleFavorite(item.id)"
                :title="favorites.has(item.id) ? '取消收藏' : '收藏此资源'"
              >
                <el-icon :size="16">
                  <component :is="favorites.has(item.id) ? StarFilled : Star" />
                </el-icon>
              </button>
            </div>
          </div>

          <!-- 卡片主体 -->
          <div class="card-body">
            <div class="card-title-row">
              <h2 class="card-title" @click="openExternal(item.url)">
                {{ item.title }}
              </h2>
              <span class="card-domain" :title="item.domain">{{ item.domain }}</span>
            </div>

            <!-- 适用人群胶囊 -->
            <div class="card-audience-row">
              <span class="audience-label">🎯 适用：</span>
              <span class="audience-text">{{ item.target_audience }}</span>
            </div>

            <!-- 详尽介绍 -->
            <p class="card-desc">{{ item.desc }}</p>

            <!-- 核心亮点清单 -->
            <ul class="highlights-list">
              <li v-for="(h, idx) in item.highlights" :key="idx" class="highlight-item">
                <span class="check-icon">✓</span>
                <span>{{ h }}</span>
              </li>
            </ul>
          </div>

          <!-- 卡片底栏操作区 -->
          <div class="card-footer">
            <button
              type="button"
              class="btn-copy-link"
              @click="copyUrl(item.url)"
              title="复制官方网站链接"
            >
              <el-icon :size="14"><DocumentCopy /></el-icon>
              <span>复制网址</span>
            </button>

            <button
              type="button"
              class="btn-open-link"
              @click="openExternal(item.url)"
              title="在新窗口直达官网"
            >
              <span>直达官网</span>
              <el-icon :size="14"><Link /></el-icon>
            </button>
          </div>
        </article>
      </div>

      <!-- 空状态 -->
      <div v-else class="hub-empty-state">
        <span class="empty-emoji">🔍</span>
        <h3 class="empty-title">未找到匹配的学习资源</h3>
        <p class="empty-subtitle">尝试换个搜索关键词，或者重置分类筛选试试看</p>
        <el-button type="primary" plain @click="resetFilter" :icon="RefreshRight">
          查看全部资源
        </el-button>
      </div>
    </main>

    <!-- 底部温馨防伪提醒 -->
    <footer class="hub-footer-notice">
      <div class="notice-card">
        <span class="notice-icon">🛡️</span>
        <div class="notice-text">
          <b>官方公益安全承诺：</b>
          上述国家级平台资源均为政府公益项目，基础功能永久免费。请认准官方域名访问。网上若有同名仿冒站点提示“充值开通VIP”或“付费解锁题目”，请立即关闭谨防受骗！
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.resource-hub-view {
  min-height: 100%;
  padding-bottom: 40px;
  background-color: var(--bg-page, #f8fafc);
  transition: background-color 0.3s;
}

/* ================= 顶部 Hero 区域 ================= */
.hub-hero {
  position: relative;
  overflow: hidden;
  padding: 36px 32px 30px;
  background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 60%, #1e1b4b 100%);
  border-radius: 0 0 24px 24px;
  color: #ffffff;
  box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.3);
}

.hero-glow-bg {
  position: absolute;
  top: -80px;
  right: -60px;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(99, 102, 241, 0) 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-content {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
}

.hero-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.hero-emoji {
  font-size: 32px;
}

.hero-title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(120deg, #ffffff 0%, #e2e8f0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-badge {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}

.hero-desc {
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.6;
  color: #cbd5e1;
  max-width: 820px;
}

.hero-stat-chips {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  color: #e2e8f0;
}

.stat-icon {
  color: #38bdf8;
}

.chip-dot-green {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.highlight-chip {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.35);
  color: #fde68a;
  font-weight: 600;
}

/* ================= 筛选与工具栏 ================= */
.hub-filter-section {
  max-width: 1200px;
  margin: 24px auto 0;
  padding: 0 24px;
}

.filter-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.search-input-wrap {
  flex: 1;
  min-width: 280px;
}

:deep(.hub-search-input .el-input__wrapper) {
  border-radius: 12px;
  padding: 8px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.filter-actions-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-pill-btn {
  border-radius: 10px;
  font-weight: 600;
}

/* 分类胶囊滑动栏 */
.category-pills-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  scrollbar-width: thin;
}

.category-pills-bar::-webkit-scrollbar {
  height: 4px;
}

.category-pills-bar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 4px;
}

.category-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color, #334155);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.category-pill:hover {
  border-color: #3b82f6;
  color: #2563eb;
  transform: translateY(-1px);
}

.category-pill.is-active {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border-color: #1d4ed8;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

/* ================= 核心卡片网格 ================= */
.hub-cards-container {
  max-width: 1200px;
  margin: 20px auto 0;
  padding: 0 24px;
  min-height: 400px;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.resource-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 18px;
  padding: 20px;
  transition: all 0.25s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
}

.resource-card:hover {
  transform: translateY(-4px);
  border-color: #93c5fd;
  box-shadow: 0 12px 28px -6px rgba(37, 99, 235, 0.12);
}

.resource-card.is-favorited {
  border-color: #fbbf24;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.08);
}

/* 卡片顶部 */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.card-icon-wrap {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.9) 0%, rgba(219, 234, 254, 0.5) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-emoji {
  font-size: 24px;
}

.card-badge-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.official-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
}

.badge-primary {
  background: #dbeafe;
  color: #1d4ed8;
}

.badge-success {
  background: #dcfce7;
  color: #15803d;
}

.badge-warning {
  background: #fef3c7;
  color: #b45309;
}

.badge-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.badge-info {
  background: #f1f5f9;
  color: #475569;
}

.star-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 4px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.star-btn:hover {
  color: #f59e0b;
  transform: scale(1.15);
}

.star-btn.is-starred {
  color: #f59e0b;
}

/* 卡片标题与域名 */
.card-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-color, #1e293b);
  cursor: pointer;
  transition: color 0.2s;
}

.card-title:hover {
  color: #2563eb;
}

.card-domain {
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #64748b;
  background: rgba(148, 163, 184, 0.1);
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

/* 适用人群 */
.card-audience-row {
  font-size: 12px;
  margin-bottom: 10px;
  line-height: 1.4;
}

.audience-label {
  font-weight: 600;
  color: #0284c7;
}

.audience-text {
  color: #475569;
}

/* 介绍文字 */
.card-desc {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
}

/* 亮点清单 */
.highlights-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.highlight-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: #334155;
  line-height: 1.4;
}

.check-icon {
  color: #10b981;
  font-weight: 800;
  font-size: 13px;
  flex-shrink: 0;
}

/* 卡片底栏 */
.card-footer {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px dashed var(--border-color, #f1f5f9);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.btn-copy-link,
.btn-open-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-copy-link {
  background: var(--bg-page, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  color: var(--text-color, #475569);
}

.btn-copy-link:hover {
  background: #f1f5f9;
  color: #1e293b;
  border-color: #cbd5e1;
}

.btn-open-link {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border: none;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);
}

.btn-open-link:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
}

/* ================= 空状态 ================= */
.hub-empty-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--bg-card, #ffffff);
  border-radius: 16px;
  border: 1px dashed var(--border-color, #cbd5e1);
}

.empty-emoji {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.empty-title {
  margin: 0 0 6px;
  font-size: 18px;
  color: var(--text-color, #1e293b);
}

.empty-subtitle {
  margin: 0 0 20px;
  font-size: 14px;
  color: #64748b;
}

/* ================= 底部安全提示 ================= */
.hub-footer-notice {
  max-width: 1200px;
  margin: 36px auto 0;
  padding: 0 24px;
}

.notice-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 14px 18px;
  color: #166534;
  font-size: 13px;
  line-height: 1.6;
}

.notice-icon {
  font-size: 20px;
  flex-shrink: 0;
}

/* ================= 暗色模式支持 ================= */
:global(.dark) .resource-hub-view {
  background-color: #0b1120;
}

:global(.dark) .category-pill {
  background: #1e293b;
  border-color: #334155;
  color: #cbd5e1;
}

:global(.dark) .category-pill:hover {
  border-color: #60a5fa;
  color: #93c5fd;
}

:global(.dark) .category-pill.is-active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
}

:global(.dark) .resource-card {
  background: #1e293b;
  border-color: #334155;
}

:global(.dark) .card-icon-wrap {
  background: rgba(59, 130, 246, 0.15);
}

:global(.dark) .card-title {
  color: #f1f5f9;
}

:global(.dark) .card-desc {
  color: #94a3b8;
}

:global(.dark) .highlight-item {
  color: #cbd5e1;
}

:global(.dark) .audience-text {
  color: #94a3b8;
}

:global(.dark) .btn-copy-link {
  background: #0f172a;
  border-color: #334155;
  color: #cbd5e1;
}

:global(.dark) .notice-card {
  background: #064e3b;
  border-color: #059669;
  color: #d1fae5;
}

@media (max-width: 768px) {
  .hub-hero {
    padding: 24px 20px 20px;
    border-radius: 0;
  }
  .hero-title {
    font-size: 22px;
  }
  .hub-filter-section,
  .hub-cards-container,
  .hub-footer-notice {
    padding: 0 16px;
  }
  .resource-grid {
    grid-template-columns: 1fr;
  }
}
</style>
