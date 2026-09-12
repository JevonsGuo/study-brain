<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { api } from '../../../utils/api'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { VideoPlay, Close, Reading, CollectionTag, Warning, View } from '@element-plus/icons-vue'

interface KnowledgePoint {
  id: number
  subject: string
  grade: string
  book: string
  chapter: string
  title: string
  content: string
  key_formulas: string
  tips: string
  visual_desc: string
  video_url: string
  sort_order?: number
  user_note?: string
}

const props = defineProps<{
  modelValue: boolean
  pointId?: number | null
  pointData?: KnowledgePoint | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'open-video', payload: { title: string; url: string }): void
}>()

const point = ref<KnowledgePoint | null>(null)
const loading = ref(false)

const drawerSize = computed(() => {
  if (typeof window !== "undefined" && window.innerWidth < 768) {
    return "100%"
  }
  return "520px"
})

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const fetchPoint = async (id: number) => {
  loading.value = true
  try {
    const res = await api.get(`/knowledge/${id}`)
    point.value = res as KnowledgePoint
  } catch (e) {
    console.error('Failed to fetch knowledge point', e)
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.pointId, props.pointData] as const,
  ([isOpen, id, data]) => {
    if (isOpen) {
      if (data) {
        point.value = data
      } else if (id) {
        fetchPoint(id)
      }
    } else {
      point.value = null
    }
  },
  { immediate: true }
)

const renderMathAndText = (text: string): string => {
  if (!text) return ''
  let result = text.replace(/\n/g, '<br/>')
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false })
    } catch {
      return `$$${formula}$$`
    }
  })
  result = result.replace(/\$([^\$]+?)\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false })
    } catch {
      return `$${formula}$`
    }
  })
  return result
}

const triggerVideo = () => {
  if (!point.value) return
  emit('open-video', {
    title: point.value.title,
    url: point.value.video_url || '',
    subject: point.value.subject,
    chapter: point.value.chapter,
    book: point.value.book
  } as any)
}
</script>

<template>
  <el-drawer
    v-model="visible"
    :size="drawerSize"
    :with-header="false"
    class="knowledge-quick-drawer"
    direction="rtl"
    destroy-on-close
  >
    <div class="drawer-inner" v-loading="loading">
      <!-- 顶栏标题区 -->
      <div class="drawer-header">
        <div class="header-tag-group">
          <span class="subject-tag">{{ point?.subject || '考点速查' }}</span>
          <span class="focus-tag">🎯 考点重点库</span>
        </div>
        <button class="close-btn" @click="visible = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>

      <div v-if="point" class="drawer-body">
        <h3 class="point-main-title">{{ point.title }}</h3>

        <!-- 核心公式区 -->
        <div v-if="point.key_formulas" class="section-card formula-section">
          <div class="sec-label">
            <el-icon class="sec-icon formula-icon"><CollectionTag /></el-icon>
            <span>核心公式与必背定理</span>
          </div>
          <div class="formula-box math-render" v-html="renderMathAndText(point.key_formulas)"></div>
        </div>

        <!-- 核心解析 / 概念 -->
        <div v-if="point.content" class="section-card content-section">
          <div class="sec-label">
            <el-icon class="sec-icon content-icon"><Reading /></el-icon>
            <span>考点精析与知识结构</span>
          </div>
          <div class="content-box math-render" v-html="renderMathAndText(point.content)"></div>
        </div>

        <!-- 避坑指南 Tips -->
        <div v-if="point.tips" class="section-card tips-section">
          <div class="sec-label">
            <el-icon class="sec-icon tips-icon"><Warning /></el-icon>
            <span>高考避坑指南 & 提分大招</span>
          </div>
          <div class="tips-box math-render" v-html="renderMathAndText(point.tips)"></div>
        </div>

        <!-- 思维图景 / 模型 -->
        <div v-if="point.visual_desc" class="section-card visual-section">
          <div class="sec-label">
            <el-icon class="sec-icon visual-icon"><View /></el-icon>
            <span>思维脑图 & 具象模型</span>
          </div>
          <div class="visual-box">{{ point.visual_desc }}</div>
        </div>

        <!-- 个人随堂笔记与避坑心得 -->
        <div v-if="point.user_note" class="section-card note-section">
          <div class="sec-label">
            <el-icon class="sec-icon note-icon"><Reading /></el-icon>
            <span>我的随堂笔记 & 避坑心得</span>
          </div>
          <div class="note-box">{{ point.user_note }}</div>
        </div>

        <!-- 名师视频精讲按钮 -->
        <div class="video-cta-card">
          <div class="video-cta-left">
            <el-icon class="play-indicator"><VideoPlay /></el-icon>
            <div>
              <div class="cta-title">名师考点精讲微课</div>
              <div class="cta-subtitle">B 站 · 国家智慧教育平台权威微课</div>
            </div>
          </div>
          <el-button type="primary" size="small" :icon="VideoPlay" @click="triggerVideo">
            观看微课
          </el-button>
        </div>
      </div>

      <div v-else-if="!loading" class="empty-placeholder">
        <span>未能载入该考点详细信息</span>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-page, #ffffff);
  color: var(--text-main, #1e293b);
  box-sizing: border-box;
}

.drawer-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #f8fafc);
}

.header-tag-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.subject-tag {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}

.focus-tag {
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #64748b;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #0f172a;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.point-main-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  line-height: 1.4;
}

.section-card {
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
}

.sec-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 8px;
}

.sec-icon {
  font-size: 15px;
}

.formula-section {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.04), rgba(99, 102, 241, 0.06));
  border-color: rgba(99, 102, 241, 0.25);
}

.formula-icon {
  color: #2563eb;
}

.formula-box {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-main, #1e293b);
}

.content-section {
  background: rgba(248, 250, 252, 0.8);
}

.content-icon {
  color: #0ea5e9;
}

.content-box {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--text-main, #334155);
}

.tips-section {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.25);
}

.tips-icon {
  color: #d97706;
}

.tips-box {
  font-size: 13px;
  line-height: 1.7;
  color: #92400e;
}

.visual-section {
  background: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.25);
}

.visual-icon {
  color: #059669;
}

.visual-box {
  font-size: 13px;
  line-height: 1.7;
  color: #065f46;
}

.note-section {
  background: rgba(147, 51, 234, 0.05);
  border-color: rgba(147, 51, 234, 0.25);
}

.note-icon {
  color: #7e22ce;
}

.note-box {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-main, #334155);
  white-space: pre-wrap;
  word-break: break-word;
}

.video-cta-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(244, 63, 94, 0.08));
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.video-cta-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.play-indicator {
  font-size: 26px;
  color: #ef4444;
}

.cta-title {
  font-size: 13px;
  font-weight: 700;
  color: #991b1b;
}

.cta-subtitle {
  font-size: 11px;
  color: #b91c1c;
}

.empty-placeholder {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
}

/* 暗色模式适配 */
:global(.dark) .knowledge-quick-drawer .drawer-inner {
  background: #0f172a;
  color: #f1f5f9;
}

:global(.dark) .drawer-header {
  background: #1e293b;
  border-bottom-color: #334155;
}

:global(.dark) .point-main-title {
  color: #f8fafc;
}

:global(.dark) .section-card {
  background: #1e293b;
  border-color: #334155;
}

:global(.dark) .formula-section {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(59, 130, 246, 0.35);
}

:global(.dark) .formula-box,
:global(.dark) .content-box {
  color: #e2e8f0;
}

:global(.dark) .tips-section {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.3);
}

:global(.dark) .tips-box {
  color: #fde68a;
}

:global(.dark) .visual-section {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
}

:global(.dark) .visual-box {
  color: #a7f3d0;
}

:global(.dark) .note-section {
  background: rgba(168, 85, 247, 0.12);
  border-color: rgba(168, 85, 247, 0.35);
}

:global(.dark) .note-box {
  color: #e9d5ff;
}

:global(.dark) .video-cta-card {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.35);
}

:global(.dark) .cta-title {
  color: #fca5a5;
}

:global(.dark) .cta-subtitle {
  color: #f87171;
}

@media (max-width: 768px) {
  .drawer-header {
    padding: 12px 14px;
  }
  .drawer-body {
    padding: 12px 14px 24px;
  }
  .point-main-title {
    font-size: 18px !important;
  }
  .section-card {
    padding: 12px 14px !important;
  }
}

</style>
