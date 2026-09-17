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
import { subjectEmojis } from '../../utils/subjects'

interface CuratedResource {
  id: string
  title: string
  tag?: string
  tag_name?: string
  category: string
  category_name: string
  subjects?: string[]
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
  name: string
  subject: string
  subjects?: string[]
  category: string
  desc: string
  url: string
  badge?: string
  sort_order: number
}

const resources = ref<CuratedResource[]>([])
const subjectTools = ref<SubjectResource[]>([])
const loading = ref(true)
const activeTag = ref('all')
const activeCategory = ref('all')
const searchQuery = ref('')
const onlyFavorites = ref(false)
const favorites = ref<Set<string>>(new Set())

const FAVORITES_KEY = 'study_curated_resource_favorites'

// 动态提取与聚合资源标签（自动支持国家级学习资源，以及未来任意新增的各类标签）
const availableTags = computed(() => {
  const map = new Map<string, { key: string; name: string; icon: string; count: number }>()

  // 全部资源
  map.set('all', {
    key: 'all',
    name: '全部资源',
    icon: '🌟',
    count: resources.value.length + subjectTools.value.length
  })

  // 动态扫描并归集各类标签（当前 9 大平台归属于 national: 国家级学习资源）
  resources.value.forEach(item => {
    const key = item.tag || 'national'
    const name = item.tag_name || '国家级学习资源'
    const icon = key === 'national' ? '🏛️' : (item.icon || '📚')
    if (!map.has(key)) {
      map.set(key, { key, name, icon, count: 0 })
    }
    map.get(key)!.count++
  })

  // 高考全科提分神器作为专属标签
  map.set('subject_tools', {
    key: 'subject_tools',
    name: '高考学科提分神器',
    icon: '🧮',
    count: subjectTools.value.length
  })

  return Array.from(map.values())
})

// 切换一级主标签
const handleTagChange = (tagKey: string) => {
  activeTag.value = tagKey
  activeCategory.value = 'all'
}

// 动态提取当前主标签下的二级分类
const currentCategories = computed(() => {
  if (activeTag.value === 'all') {
    return [
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
  }

  if (activeTag.value === 'subject_tools') {
    const subjects = ['全部学科', '语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']
    return subjects.map(s => ({
      key: s === '全部学科' ? 'all' : s,
      name: s,
      icon: s === '全部学科' ? '🌟' : (subjectEmojis[s] || '📚')
    }))
  }

  // 针对特定标签（如 national: 国家级学习资源，或其他未来新标签）
  const list = resources.value.filter(item => (item.tag || 'national') === activeTag.value)
  const cats: { key: string; name: string; icon: string }[] = [
    { key: 'all', name: '全部分类', icon: '🌟' }
  ]
  const seen = new Set<string>()
  list.forEach(item => {
    if (!seen.has(item.category)) {
      seen.add(item.category)
      cats.push({
        key: item.category,
        name: item.category_name,
        icon: item.icon
      })
    }
  })
  return cats
})

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

  const mapSubjectToolToCurated = (st: SubjectResource): CuratedResource => {
    let domain = ''
    try {
      domain = new URL(st.url.startsWith('http') ? st.url : `https://${st.url}`).hostname.replace('www.', '')
    } catch {
      domain = st.url
    }
    const subjects = st.subjects || [st.subject]
    const isMultiSubject = subjects.length > 1 || subjects.includes('全科') || subjects.includes('数理化生') || subjects.includes('理化生')
    return {
      id: `tool-${st.id}`,
      title: st.name,
      tag: 'subject_tools',
      tag_name: '高考学科提分神器',
      category: st.subject,
      category_name: `${st.subject}学科神器`,
      subjects,
      icon: subjectEmojis[st.subject] || (st.category === 'tool' ? '🧮' : st.category === 'practice' ? '📝' : '🎬'),
      domain,
      url: st.url,
      badge: st.badge || (isMultiSubject ? '多科/全科' : `${st.subject}专项`),
      badge_type: 'info' as const,
      target_audience: isMultiSubject ? '高中多学科综合备考' : `高中${st.subject}专项备考拔高`,
      desc: st.desc,
      highlights: isMultiSubject
        ? [`涵盖 ${subjects.filter(s => s !== '全科' && s !== '数理化生' && s !== '理化生').slice(0, 4).join('、')} 等学科`]
        : ['精准对标高中核心考点'],
      sort_order: st.sort_order || 99
    }
  }

  // 1. 根据主标签 (activeTag) 预筛选
  if (activeTag.value === 'subject_tools') {
    list = subjectTools.value.map(mapSubjectToolToCurated)
    if (activeCategory.value !== 'all') {
      list = list.filter(item => {
        if (item.subjects && item.subjects.length > 0) {
          return item.subjects.includes(activeCategory.value) || item.subjects.includes('全科')
        }
        return item.category === activeCategory.value
      })
    }
  } else if (activeTag.value === 'all') {
    const convertedTools: CuratedResource[] = subjectTools.value.map(mapSubjectToolToCurated)
    list = [...resources.value, ...convertedTools]
    if (activeCategory.value !== 'all') {
      list = list.filter(item => {
        if (item.subjects && item.subjects.length > 0) {
          return item.subjects.includes(activeCategory.value) || item.subjects.includes('全科')
        }
        return item.category === activeCategory.value
      })
    }
  } else {
    // 选定某个特定标签（如 'national' 国家级学习资源，或未来任意新标签）
    list = resources.value.filter(item => (item.tag || 'national') === activeTag.value)
    if (activeCategory.value !== 'all') {
      list = list.filter(item => item.category === activeCategory.value)
    }
  }

  // 收藏筛选
  if (onlyFavorites.value) {
    list = list.filter(item => favorites.value.has(item.id))
  }

  // 搜索关键字筛选（包含 tag_name）
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(item =>
      item.title.toLowerCase().includes(q) ||
      (item.tag_name && item.tag_name.toLowerCase().includes(q)) ||
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
  activeTag.value = 'all'
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
          <span class="hero-badge">权威推荐 · 公益赋能</span>
        </div>
        <p class="hero-desc">
          精选国家级公益平台、各学科提分神器与正版优质自学门户，无商业广告、不搞VIP套路，全方位助力自律高效提分。
        </p>

        <!-- 关键承诺指标徽章 -->
        <div class="hero-stat-chips">
          <div class="stat-chip">
            <el-icon class="stat-icon"><CircleCheck /></el-icon>
            <span><b>🏛️ 国家级</b>权威公益学习平台</span>
          </div>
          <div class="stat-chip">
            <span class="chip-dot-green"></span>
            <span><b>100%</b> 永久免费官方域名</span>
          </div>
          <div class="stat-chip">
            <el-icon class="stat-icon"><Compass /></el-icon>
            <span>多维度标签分类扩展</span>
          </div>
          <div class="stat-chip highlight-chip">
            <span>省下每年上千元多平台会员费 💰</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 筛选控制与分类导航栏 -->
    <section class="hub-filter-section">
      <!-- 一级大类标签选项卡 (动态支持：国家级学习资源 / 高考学科提分神器 / 以及未来任意新类型标签) -->
      <div class="resource-tag-tabs-wrap">
        <div class="resource-tag-tabs">
          <button
            v-for="t in availableTags"
            :key="t.key"
            type="button"
            class="tag-tab-btn"
            :class="{ 'is-active': activeTag === t.key }"
            @click="handleTagChange(t.key)"
          >
            <span class="tab-icon">{{ t.icon }}</span>
            <span class="tab-name">{{ t.name }}</span>
            <span class="tab-count-badge">{{ t.count }}</span>
          </button>
        </div>
      </div>

      <!-- 搜索与控制行 -->
      <div class="filter-controls-row">
        <div class="search-input-wrap">
          <el-input
            v-model="searchQuery"
            placeholder="搜索资源名称、标签、考研、论文、纪录片、科普、域名等关键词..."
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
            v-if="searchQuery || activeTag !== 'all' || activeCategory !== 'all' || onlyFavorites"
            plain
            :icon="RefreshRight"
            @click="resetFilter"
            class="action-pill-btn"
          >
            重置筛选
          </el-button>
        </div>
      </div>

      <!-- 二级细分类目胶囊滑动栏 -->
      <div class="category-pills-bar">
        <button
          v-for="cat in currentCategories"
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
            <div class="card-identity">
              <div class="card-icon-wrap">
                <span class="card-emoji">{{ item.icon }}</span>
              </div>
              <div class="card-titles">
                <div class="card-title-row">
                  <h2 class="card-title" @click="openExternal(item.url)">
                    {{ item.title }}
                  </h2>
                  <span class="official-badge" :class="`badge-${item.badge_type}`">
                    {{ item.badge }}
                  </span>
                </div>
                <div class="card-meta-line">
                  <span class="card-domain" :title="item.domain">{{ item.domain }}</span>
                  <span v-if="item.subjects && item.subjects.length > 1" class="multi-subject-chip">
                    {{ item.subjects.includes('全科') ? '全科覆盖' : item.subjects.filter(s => s !== '数理化生' && s !== '理化生').slice(0, 3).join('/') }}
                  </span>
                </div>
              </div>
            </div>
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

          <!-- 卡片主体 -->
          <div class="card-body">
            <p class="card-desc">{{ item.desc }}</p>
            <div v-if="item.highlights && item.highlights.length > 0" class="highlights-pill-row">
              <span v-for="(h, idx) in item.highlights.slice(0, 2)" :key="idx" class="highlight-chip">
                <span class="check-icon">✓</span>{{ h }}
              </span>
            </div>
          </div>

          <!-- 卡片底栏操作区 -->
          <div class="card-footer">
            <button
              type="button"
              class="btn-copy-link"
              @click="copyUrl(item.url)"
              title="复制官方网站链接"
            >
              <el-icon :size="13"><DocumentCopy /></el-icon>
              <span>复制</span>
            </button>

            <button
              type="button"
              class="btn-open-link"
              @click="openExternal(item.url)"
              title="在新窗口直达官网"
            >
              <span>直达官网</span>
              <el-icon :size="13"><Link /></el-icon>
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

/* 一级主标签切换选项卡 */
.resource-tag-tabs-wrap {
  margin-bottom: 16px;
}

.resource-tag-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-card, #ffffff);
  padding: 6px;
  border-radius: 16px;
  border: 1px solid var(--border-color, #e2e8f0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  overflow-x: auto;
  scrollbar-width: none;
}

.resource-tag-tabs::-webkit-scrollbar {
  display: none;
}

.tag-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-color, #475569);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.tag-tab-btn:hover {
  background: rgba(59, 130, 246, 0.08);
  color: #2563eb;
}

.tag-tab-btn.is-active {
  background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
}

.tab-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.2);
  color: inherit;
  font-size: 11px;
  font-weight: 700;
}

.tag-tab-btn.is-active .tab-count-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
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
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.resource-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 16px;
  transition: all 0.22s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.resource-card:hover {
  transform: translateY(-3px);
  border-color: #93c5fd;
  box-shadow: 0 8px 24px -4px rgba(37, 99, 235, 0.12);
}

.resource-card.is-favorited {
  border-color: #fbbf24;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.08);
}

/* 卡片顶部 */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.card-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.card-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.9) 0%, rgba(219, 234, 254, 0.5) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-emoji {
  font-size: 20px;
}

.card-titles {
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-color, #1e293b);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}

.card-title:hover {
  color: #2563eb;
}

.card-meta-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-domain {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #64748b;
  background: rgba(148, 163, 184, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.multi-subject-chip {
  font-size: 11px;
  font-weight: 600;
  color: #0284c7;
  background: rgba(14, 165, 233, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.official-badge {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 8px;
  white-space: nowrap;
  flex-shrink: 0;
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

/* 简述与微胶囊 */
.card-desc {
  margin: 0 0 8px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #475569;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.highlights-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.highlight-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #334155;
  background: rgba(241, 245, 249, 0.85);
  padding: 2px 7px;
  border-radius: 6px;
}

:global(.dark) .highlight-chip {
  background: rgba(51, 65, 85, 0.6);
  color: #cbd5e1;
}

.check-icon {
  color: #10b981;
  font-weight: 800;
  font-size: 12px;
  flex-shrink: 0;
}

/* 卡片底栏 */
.card-footer {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color, #f1f5f9);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.btn-copy-link,
.btn-open-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
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
    padding: 20px 16px 16px;
    border-radius: 0;
  }
  .hero-title {
    font-size: 20px;
  }
  .hero-desc {
    font-size: 12.5px;
    margin-bottom: 12px;
  }
  .hero-stat-chips {
    gap: 6px;
  }
  .stat-chip {
    font-size: 11px;
    padding: 3px 8px;
  }
  .hub-filter-section,
  .hub-cards-container,
  .hub-footer-notice {
    padding: 0 12px;
  }
  .resource-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .resource-card {
    padding: 10px 12px;
    border-radius: 12px;
  }
  .card-icon-wrap {
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }
  .card-emoji {
    font-size: 17px;
  }
  .card-title {
    font-size: 14px;
  }
  .card-desc {
    font-size: 11.5px;
    line-height: 1.45;
    margin-bottom: 6px;
  }
  .highlights-pill-row {
    display: none;
  }
  .card-footer {
    padding-top: 6px;
    gap: 6px;
  }
  .btn-copy-link,
  .btn-open-link {
    padding: 4px 10px;
    font-size: 11.5px;
    border-radius: 6px;
  }
}
</style>
