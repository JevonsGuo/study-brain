<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { ElMessage } from 'element-plus'

interface KnowledgePoint {
  id: number
  subject: string
  chapter: string
  title: string
  content: string
  key_formulas: string
  tips: string
  sort_order: number
}

interface ChapterInfo {
  subject: string
  chapter: string
}

const chineseNumMap: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
  '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
}

const extractChapterNum = (ch: string): number => {
  const match = ch.match(/第(.+?)章/)
  if (match && chineseNumMap[match[1]]) return chineseNumMap[match[1]]
  if (match && match[1]) {
    const n = parseInt(match[1], 10)
    if (!isNaN(n)) return n
  }
  return 999
}

const route = useRoute()
const router = useRouter()
const subject = computed(() => decodeURIComponent(route.params.subject as string))

const points = ref<KnowledgePoint[]>([])
const chapters = ref<string[]>([])
const allChapters = ref<ChapterInfo[]>([])
const activeChapter = ref('')
const selectedPoint = ref<KnowledgePoint | null>(null)
const loading = ref(false)
const addDialogVisible = ref(false)
const editDialogVisible = ref(false)
const searchQuery = ref('')
const manageMode = ref(false)

const subjectEmojis: Record<string, string> = {
  '数学': '📐', '英语': '🔤', '物理': '⚡', '化学': '🧪',
  '生物': '🧬', '语文': '📖', '历史': '🏛️', '地理': '🌍', '政治': '📜',
}

const currentEmoji = computed(() => subjectEmojis[subject.value] || '📚')

const sortedChapters = computed(() => {
  return [...chapters.value].sort((a, b) => extractChapterNum(a) - extractChapterNum(b))
})

const filteredPoints = computed(() => {
  let list = points.value
  if (activeChapter.value) {
    list = list.filter(p => p.chapter === activeChapter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.key_formulas.toLowerCase().includes(q)
    )
  }
  return list
})

const fetchChapters = async () => {
  try {
    const data = await api.get('/knowledge/subjects')
    allChapters.value = data.chapters
    chapters.value = data.chapters
      .filter((c: ChapterInfo) => c.subject === subject.value)
      .map((c: ChapterInfo) => c.chapter)
  } catch {
    // silent
  }
}

const fetchPoints = async () => {
  loading.value = true
  try {
    points.value = await api.get(`/knowledge?subject=${encodeURIComponent(subject.value)}`)
    if (points.value.length > 0 && !activeChapter.value) {
      const sorted = sortedChapters.value
      activeChapter.value = sorted.length > 0 ? sorted[0] : points.value[0].chapter
    }
  } catch {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const selectChapter = (chapter: string) => {
  activeChapter.value = chapter
  selectedPoint.value = null
}

const selectPoint = (point: KnowledgePoint) => {
  if (manageMode.value) return
  selectedPoint.value = point
}

const goBack = () => {
  if (selectedPoint.value) {
    selectedPoint.value = null
  } else {
    router.push('/knowledge')
  }
}

const backToSubjects = () => {
  router.push('/knowledge')
}

const toggleManage = () => {
  manageMode.value = !manageMode.value
  if (manageMode.value) {
    selectedPoint.value = null
  }
}

const newPoint = ref({ subject: '', chapter: '', title: '', content: '', key_formulas: '', tips: '' })

const addPoint = async () => {
  if (!newPoint.value.title) return
  try {
    newPoint.value.subject = subject.value
    await api.post('/knowledge', newPoint.value)
    newPoint.value = { subject: '', chapter: '', title: '', content: '', key_formulas: '', tips: '' }
    addDialogVisible.value = false
    await fetchChapters()
    await fetchPoints()
    ElMessage.success('添加成功')
  } catch {
    ElMessage.error('添加失败')
  }
}

const editingPoint = ref<KnowledgePoint | null>(null)
const editForm = ref({ chapter: '', title: '', content: '', key_formulas: '', tips: '' })

const openEdit = (point: KnowledgePoint) => {
  editingPoint.value = point
  editForm.value = {
    chapter: point.chapter,
    title: point.title,
    content: point.content,
    key_formulas: point.key_formulas,
    tips: point.tips,
  }
  editDialogVisible.value = true
}

const saveEdit = async () => {
  if (!editingPoint.value || !editForm.value.title) return
  try {
    await api.put(`/knowledge/${editingPoint.value.id}`, editForm.value)
    editDialogVisible.value = false
    editingPoint.value = null
    await fetchPoints()
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

const removePoint = async (id: number) => {
  try {
    await api.del(`/knowledge/${id}`)
    if (selectedPoint.value?.id === id) selectedPoint.value = null
    await fetchPoints()
    await fetchChapters()
    ElMessage.success('已删除')
  } catch {
    ElMessage.error('删除失败')
  }
}

const chapterPointCount = (chapter: string) => {
  return points.value.filter(p => p.chapter === chapter).length
}

watch(subject, () => {
  activeChapter.value = ''
  selectedPoint.value = null
  manageMode.value = false
  fetchChapters()
  fetchPoints()
})

onMounted(() => {
  fetchChapters()
  fetchPoints()
})
</script>

<template>
  <div class="detail-page">
    <div class="top-nav">
      <el-button text @click="backToSubjects" :icon="'ArrowLeft'" class="back-btn">知识库</el-button>
      <span class="nav-sep">/</span>
      <span class="nav-subject">{{ currentEmoji }} {{ subject }}</span>
      <template v-if="selectedPoint">
        <span class="nav-sep">/</span>
        <span class="nav-chapter">{{ selectedPoint.chapter }}</span>
        <span class="nav-sep">/</span>
        <span class="nav-current">{{ selectedPoint.title }}</span>
      </template>
      <div class="nav-spacer" />
      <el-input
        v-model="searchQuery"
        placeholder="搜索知识点..."
        :prefix-icon="'Search'"
        clearable
        size="small"
        style="width: 200px"
      />
      <el-button
        :type="manageMode ? 'warning' : 'default'"
        size="small"
        @click="toggleManage"
        :icon="'Setting'"
      >
        {{ manageMode ? '退出管理' : '管理' }}
      </el-button>
      <el-button v-if="manageMode" type="primary" size="small" @click="addDialogVisible = true" :icon="'Plus'">添加</el-button>
    </div>

    <div v-if="manageMode" class="manage-hint">
      <el-icon><Warning /></el-icon>
      管理模式：可编辑、删除知识点。点击卡片上的按钮操作，点击下方"退出管理"返回浏览。
    </div>

    <div v-if="!selectedPoint" class="main-layout">
      <div class="chapter-sidebar">
        <div
          class="chapter-item"
          :class="{ active: !activeChapter }"
          @click="activeChapter = ''; selectedPoint = null"
        >
          <span>全部</span>
          <span class="chapter-count">{{ points.length }}</span>
        </div>
        <div
          v-for="ch in sortedChapters"
          :key="ch"
          class="chapter-item"
          :class="{ active: ch === activeChapter }"
          @click="selectChapter(ch)"
        >
          <span class="chapter-name">{{ ch }}</span>
          <span class="chapter-count">{{ chapterPointCount(ch) }}</span>
        </div>
      </div>

      <div class="points-area" v-loading="loading">
        <div v-if="filteredPoints.length === 0 && !loading" class="empty-area">
          <el-empty description="暂无知识点" />
        </div>
        <div
          v-for="p in filteredPoints"
          :key="p.id"
          class="point-card"
          :class="{ 'manage-card': manageMode }"
          @click="selectPoint(p)"
        >
          <div class="point-header">
            <div class="point-title">{{ p.title }}</div>
            <el-tag v-if="!manageMode" size="small" type="info">{{ p.chapter }}</el-tag>
          </div>
          <div class="point-preview">{{ p.content.slice(0, 100) }}{{ p.content.length > 100 ? '...' : '' }}</div>
          <div v-if="p.key_formulas" class="point-formulas-preview">
            <el-icon size="12"><Memo /></el-icon>
            {{ p.key_formulas.split('\n')[0] }}{{ p.key_formulas.split('\n').length > 1 ? ' ...' : '' }}
          </div>
          <div class="point-footer">
            <div v-if="p.tips && !manageMode" class="has-tips">
              <el-icon size="12"><Warning /></el-icon>
              含易错提醒
            </div>
            <div v-if="manageMode" class="manage-actions">
              <el-button size="small" type="primary" text @click.stop="openEdit(p)" :icon="'Edit'">编辑</el-button>
              <el-button size="small" type="danger" text @click.stop="removePoint(p.id)" :icon="'Delete'">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="point-detail-view">
      <el-button text @click="goBack" :icon="'ArrowLeft'" class="detail-back">返回列表</el-button>
      <div class="detail-card">
        <div class="detail-header">
          <h3>{{ selectedPoint.title }}</h3>
          <el-tag>{{ selectedPoint.chapter }}</el-tag>
        </div>

        <div v-if="selectedPoint.content" class="detail-section">
          <h4>📝 核心内容</h4>
          <div class="detail-content" v-html="selectedPoint.content.replace(/\n/g, '<br/>')"></div>
        </div>

        <div v-if="selectedPoint.key_formulas" class="detail-section formulas-section">
          <h4>📊 关键公式</h4>
          <div class="formulas-box" v-html="selectedPoint.key_formulas.replace(/\n/g, '<br/>')"></div>
        </div>

        <div v-if="selectedPoint.tips" class="detail-section tips-section">
          <h4>⚠️ 易错提醒</h4>
          <div class="tips-box" v-html="selectedPoint.tips.replace(/\n/g, '<br/>')"></div>
        </div>
      </div>
    </div>

    <el-dialog v-model="addDialogVisible" title="添加知识点" width="600px" destroy-on-close>
      <el-form @submit.prevent="addPoint" label-width="90px">
        <el-form-item label="章节">
          <el-select v-model="newPoint.chapter" filterable allow-create placeholder="选择或输入章节">
            <el-option v-for="ch in sortedChapters" :key="ch" :label="ch" :value="ch" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="newPoint.title" placeholder="如：集合的概念与表示" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="newPoint.content" type="textarea" :rows="5" placeholder="知识点详细内容" />
        </el-form-item>
        <el-form-item label="关键公式">
          <el-input v-model="newPoint.key_formulas" type="textarea" :rows="3" placeholder="重要公式、定理" />
        </el-form-item>
        <el-form-item label="易错提醒">
          <el-input v-model="newPoint.tips" type="textarea" :rows="3" placeholder="常见易错点" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addPoint">添加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑知识点" width="600px" destroy-on-close>
      <el-form @submit.prevent="saveEdit" label-width="90px">
        <el-form-item label="章节">
          <el-select v-model="editForm.chapter" filterable allow-create placeholder="选择或输入章节">
            <el-option v-for="ch in sortedChapters" :key="ch" :label="ch" :value="ch" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="editForm.title" placeholder="如：集合的概念与表示" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="editForm.content" type="textarea" :rows="5" placeholder="知识点详细内容" />
        </el-form-item>
        <el-form-item label="关键公式">
          <el-input v-model="editForm.key_formulas" type="textarea" :rows="3" placeholder="重要公式、定理" />
        </el-form-item>
        <el-form-item label="易错提醒">
          <el-input v-model="editForm.tips" type="textarea" :rows="3" placeholder="常见易错点" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.detail-page {
  padding: 0;
}

.top-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  margin-bottom: 16px;
}

.back-btn {
  font-size: 14px;
  color: #409eff;
  padding: 0;
}

.nav-sep {
  color: #c0c4cc;
  font-size: 12px;
}

.nav-subject {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.nav-chapter {
  font-size: 14px;
  color: #606266;
}

.nav-current {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.nav-spacer {
  flex: 1;
}

.manage-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 8px;
  color: #e6a23c;
  font-size: 13px;
  margin-bottom: 16px;
}

.main-layout {
  display: flex;
  gap: 16px;
  min-height: 500px;
}

.chapter-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 10px;
  padding: 8px 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  max-height: 600px;
  overflow-y: auto;
}

.chapter-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chapter-item:hover {
  background: #f5f7fa;
  color: #303133;
}

.chapter-item.active {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 500;
}

.chapter-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  margin-right: 8px;
}

.chapter-count {
  font-size: 11px;
  background: #f0f2f5;
  color: #909399;
  border-radius: 10px;
  padding: 1px 8px;
  flex-shrink: 0;
}

.chapter-item.active .chapter-count {
  background: #d9ecff;
  color: #409eff;
}

.points-area {
  flex: 1;
  min-width: 0;
}

.empty-area {
  padding: 80px 0;
}

.point-card {
  background: #fff;
  border-radius: 10px;
  padding: 18px 22px;
  margin-bottom: 12px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  transition: all 0.25s;
}

.point-card:hover {
  box-shadow: 0 6px 20px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.point-card.manage-card {
  border: 2px dashed #e6a23c;
  cursor: default;
}

.point-card.manage-card:hover {
  transform: none;
}

.point-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.point-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.point-preview {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 6px;
}

.point-formulas-preview {
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}

.point-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.has-tips {
  font-size: 12px;
  color: #e6a23c;
  display: flex;
  align-items: center;
  gap: 4px;
}

.manage-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.point-detail-view {
  max-width: 900px;
}

.detail-back {
  margin-bottom: 12px;
  color: #409eff;
}

.detail-card {
  background: #fff;
  border-radius: 12px;
  padding: 28px 32px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.detail-header h3 {
  margin: 0;
  font-size: 22px;
  color: #303133;
}

.detail-section {
  margin-top: 24px;
}

.detail-section h4 {
  font-size: 15px;
  color: #606266;
  margin: 0 0 10px;
}

.detail-content {
  font-size: 14px;
  line-height: 2;
  color: #303133;
}

.formulas-box {
  background: #f8f9fb;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px 20px;
  font-size: 14px;
  line-height: 2.2;
  font-family: 'Times New Roman', 'STSong', serif;
  color: #303133;
}

.tips-box {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 8px;
  padding: 16px 20px;
  font-size: 14px;
  line-height: 2;
  color: #f56c6c;
}
</style>
