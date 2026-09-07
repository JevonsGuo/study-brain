<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Picture,
  Document,
  MagicStick,
  Delete,
  Brush
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    minHeight?: string
  }>(),
  {
    modelValue: '',
    placeholder: '在此输入题目内容... 💡光标停在任意位置按 Ctrl+V / Cmd+V 可直接插入截图，所见即所得',
    minHeight: '180px'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorRef = ref<HTMLDivElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const activeImg = ref<HTMLImageElement | null>(null)
const toolbarPos = ref({ top: 0, left: 0, visible: false })
const savedSelectionRange = ref<Range | null>(null)

// 智能压缩图片 (限制最大边长 1280px, quality 0.82)
const compressImageFile = (file: File | Blob, maxWidth = 1280, quality = 0.82): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', quality)
        resolve(compressed)
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

// 保存当前选区，便于弹窗或点击外部后能把图片/模板插回到原来的光标处
const saveSelection = () => {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    if (editorRef.value && editorRef.value.contains(range.commonAncestorContainer)) {
      savedSelectionRange.value = range.cloneRange()
    }
  }
}

// 恢复选区
const restoreSelection = () => {
  if (savedSelectionRange.value) {
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(savedSelectionRange.value)
    }
  } else if (editorRef.value) {
    editorRef.value.focus()
  }
}

// 监听编辑内容变化并向上同步
const handleInput = () => {
  if (!editorRef.value) return
  saveSelection()
  emit('update:modelValue', editorRef.value.innerHTML)
}

// 在当前光标位置插入 HTML 内容
const insertHtmlAtCursor = (html: string) => {
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !editorRef.value) {
    if (editorRef.value) {
      editorRef.value.innerHTML += html
      handleInput()
    }
    return
  }

  const range = sel.getRangeAt(0)
  range.deleteContents()

  const el = document.createElement('div')
  el.innerHTML = html
  const frag = document.createDocumentFragment()
  let node: ChildNode | null
  let lastNode: ChildNode | null = null
  while ((node = el.firstChild)) {
    lastNode = frag.appendChild(node)
  }
  range.insertNode(frag)

  // 将光标移到插入内容的后面
  if (lastNode) {
    const newRange = range.cloneRange()
    newRange.setStartAfter(lastNode)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
    savedSelectionRange.value = newRange
  }

  handleInput()
}

// 光标处插入图片
const insertImageToCursor = (base64Src: string) => {
  const imgHtml = `
    <div class="rich-img-wrapper" style="text-align: left; margin: 8px 0;">
      <img
        src="${base64Src}"
        class="rich-question-img"
        style="width: 50%; max-width: 100%; border-radius: 6px; cursor: pointer; display: inline-block; box-shadow: 0 2px 6px rgba(0,0,0,0.08);"
        alt="错题图"
      />
    </div>
    <p><br></p>
  `
  insertHtmlAtCursor(imgHtml)
  ElMessage.success('已将截图插入到当前光标所在行！点击图片可调节尺寸')
}

// 处理粘贴事件 (Ctrl+V / Cmd+V)
const handlePaste = async (e: ClipboardEvent) => {
  saveSelection()
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault()
      const blob = items[i].getAsFile()
      if (blob) {
        try {
          const compressed = await compressImageFile(blob)
          insertImageToCursor(compressed)
        } catch {
          ElMessage.error('图片压缩失败')
        }
      }
      return
    }
  }
}

// 文件选择上传
const triggerFileInput = () => {
  saveSelection()
  fileInputRef.value?.click()
}

const handleFileSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const compressed = await compressImageFile(file)
    insertImageToCursor(compressed)
  } catch {
    ElMessage.error('图片读取失败')
  } finally {
    input.value = ''
  }
}

// 图片交互与浮动工具条
const updateToolbarPosition = () => {
  if (!activeImg.value || !editorRef.value) {
    toolbarPos.value.visible = false
    return
  }

  const imgRect = activeImg.value.getBoundingClientRect()
  const editorRect = editorRef.value.getBoundingClientRect()

  const top = imgRect.top - editorRect.top - 46
  const left = Math.max(10, imgRect.left - editorRect.left + (imgRect.width / 2) - 130)

  toolbarPos.value = {
    top: Math.max(top, 8),
    left,
    visible: true
  }
}

// 点击编辑器内部，判断是否点击了图片
const handleEditorClick = (e: MouseEvent) => {
  saveSelection()
  const target = e.target as HTMLElement
  if (target && target.tagName === 'IMG') {
    activeImg.value = target as HTMLImageElement
    editorRef.value?.querySelectorAll('img').forEach((img) => {
      img.classList.remove('selected-img')
    })
    target.classList.add('selected-img')
    updateToolbarPosition()
  } else {
    activeImg.value = null
    toolbarPos.value.visible = false
    editorRef.value?.querySelectorAll('img').forEach((img) => {
      img.classList.remove('selected-img')
    })
  }
}

// 调整选中图片的宽度
const setImgWidth = (widthPercent: string) => {
  if (!activeImg.value) return
  activeImg.value.style.width = widthPercent
  handleInput()
  nextTick(() => {
    updateToolbarPosition()
  })
}

// 调整选中图片的对齐方式
const setImgAlign = (align: 'left' | 'center' | 'right') => {
  if (!activeImg.value) return
  const wrapper = activeImg.value.closest('.rich-img-wrapper') as HTMLElement
  if (wrapper) {
    wrapper.style.textAlign = align
  } else {
    if (align === 'center') {
      activeImg.value.style.display = 'block'
      activeImg.value.style.margin = '8px auto'
    } else if (align === 'right') {
      activeImg.value.style.display = 'block'
      activeImg.value.style.margin = '8px 0 8px auto'
    } else {
      activeImg.value.style.display = 'inline-block'
      activeImg.value.style.margin = '8px 0'
    }
  }
  handleInput()
  nextTick(() => {
    updateToolbarPosition()
  })
}

// 移除选中的图片
const removeActiveImg = () => {
  if (!activeImg.value) return
  const wrapper = activeImg.value.closest('.rich-img-wrapper')
  if (wrapper) {
    wrapper.remove()
  } else {
    activeImg.value.remove()
  }
  activeImg.value = null
  toolbarPos.value.visible = false
  handleInput()
  ElMessage.info('已移除图片')
}

// 快捷排版工具
const formatText = (cmd: string, val: string | undefined = undefined) => {
  restoreSelection()
  document.execCommand(cmd, false, val)
  handleInput()
}

// 插入模板
const insertTemplate = (type: 'choice' | 'fill' | 'solve') => {
  let templateHtml = ''
  if (type === 'choice') {
    templateHtml = `
      <p><b>【题目】：</b>在此输入题目描述...</p>
      <p>A. </p>
      <p>B. </p>
      <p>C. </p>
      <p>D. </p>
      <p><b>【我的选择】：</b>&nbsp;&nbsp;&nbsp;&nbsp;<b>【正确答案】：</b></p>
      <p><br></p>
    `
  } else if (type === 'fill') {
    templateHtml = `
      <p><b>【题目】：</b>在此输入填空题题干...</p>
      <p><b>【我的答案】：</b></p>
      <p><b>【正确答案】：</b></p>
      <p><br></p>
    `
  } else if (type === 'solve') {
    templateHtml = `
      <p><b>【题干】：</b>在此输入题目背景与已知条件...</p>
      <p><b>（1）设问一：</b></p>
      <p><b>（2）设问二：</b></p>
      <p><b>【解题关键点与易错卡点】：</b></p>
      <p><br></p>
    `
  }
  insertHtmlAtCursor(templateHtml)
}

// 清空编辑器
const clearContent = () => {
  if (editorRef.value) {
    editorRef.value.innerHTML = ''
    activeImg.value = null
    toolbarPos.value.visible = false
    handleInput()
  }
}

// 监听外部 modelValue 变化，同步到 DOM（仅当内容有实质变化时，避免打字光标跳动）
watch(
  () => props.modelValue,
  (newVal) => {
    if (editorRef.value && editorRef.value.innerHTML !== newVal) {
      editorRef.value.innerHTML = newVal || ''
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (editorRef.value && props.modelValue) {
    editorRef.value.innerHTML = props.modelValue
  }
})

onBeforeUnmount(() => {
  activeImg.value = null
})
</script>

<template>
  <div class="rich-editor-box">
    <!-- 顶部快捷格式与模板工具条 -->
    <div class="editor-top-toolbar">
      <div class="tool-left-group">
        <button
          type="button"
          class="tool-btn bold-btn"
          title="文字加粗 (Ctrl+B)"
          @mousedown.prevent="formatText('bold')"
        >
          <b>B</b>
        </button>
        <button
          type="button"
          class="tool-btn hilite-btn"
          title="重点荧光标注"
          @mousedown.prevent="formatText('hiliteColor', '#fef08a')"
        >
          <el-icon><Brush /></el-icon>
        </button>

        <span class="tool-divider" />

        <button
          type="button"
          class="tool-btn action-btn highlight-pic-btn"
          title="插入图片或截图"
          @mousedown.prevent="triggerFileInput"
        >
          <el-icon><Picture /></el-icon>
          <span>插入图片</span>
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleFileSelected"
        />

        <span class="tool-divider" />

        <!-- 模板快速按钮 -->
        <button
          type="button"
          class="tool-btn template-btn"
          title="插入选择题骨架"
          @mousedown.prevent="insertTemplate('choice')"
        >
          <el-icon><Document /></el-icon>
          <span>选择题</span>
        </button>
        <button
          type="button"
          class="tool-btn template-btn"
          title="插入填空题骨架"
          @mousedown.prevent="insertTemplate('fill')"
        >
          <el-icon><Document /></el-icon>
          <span>填空题</span>
        </button>
        <button
          type="button"
          class="tool-btn template-btn"
          title="插入解答题骨架"
          @mousedown.prevent="insertTemplate('solve')"
        >
          <el-icon><MagicStick /></el-icon>
          <span>解答大题</span>
        </button>
      </div>

      <div class="tool-right-group">
        <button
          type="button"
          class="tool-btn clear-btn"
          title="清空内容"
          @mousedown.prevent="clearContent"
        >
          清空
        </button>
      </div>
    </div>

    <!-- 主编辑区域 (支持 contenteditable) -->
    <div class="editor-area-container">
      <div
        ref="editorRef"
        class="rich-editor-content"
        contenteditable="true"
        :style="{ minHeight }"
        :data-placeholder="placeholder"
        @input="handleInput"
        @paste="handlePaste"
        @click="handleEditorClick"
        @blur="saveSelection"
      />

      <!-- 选中图片时上方浮动的专属控制条 (快捷调大小、对齐、删除) -->
      <transition name="fade">
        <div
          v-if="toolbarPos.visible"
          class="floating-img-toolbar"
          :style="{ top: `${toolbarPos.top}px`, left: `${toolbarPos.left}px` }"
          @mousedown.prevent
        >
          <span class="float-tag">图片尺寸</span>
          <button type="button" class="float-btn" @click="setImgWidth('25%')">25%</button>
          <button type="button" class="float-btn" @click="setImgWidth('50%')">50%</button>
          <button type="button" class="float-btn" @click="setImgWidth('75%')">75%</button>
          <button type="button" class="float-btn" @click="setImgWidth('100%')">全宽</button>

          <span class="float-divider" />

          <button type="button" class="float-btn" title="居左" @click="setImgAlign('left')">左</button>
          <button type="button" class="float-btn" title="居中" @click="setImgAlign('center')">中</button>
          <button type="button" class="float-btn" title="居右" @click="setImgAlign('right')">右</button>

          <span class="float-divider" />

          <button type="button" class="float-btn del-btn" title="删除图片" @click="removeActiveImg">
            <el-icon><Delete /></el-icon>
          </button>
        </div>
      </transition>
    </div>

    <!-- 底部状态与操作小贴士 -->
    <div class="editor-status-bar">
      <span>💡 光标停在任意行直接按 <b>Ctrl+V</b> (Mac用 <b>Cmd+V</b>) 即可精准插入截图；点击插入的图片可随时调节大小与对齐</span>
    </div>
  </div>
</template>

<style scoped>
.rich-editor-box {
  width: 100%;
  border: 1px solid var(--border-subtle, #dcdfe6);
  border-radius: 8px;
  background: var(--bg-card, #ffffff);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s, background-color 0.28s;
}

.rich-editor-box:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
}

/* 工具条 */
.editor-top-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--bg-card-secondary, #f8fafc);
  border-bottom: 1px solid var(--border-subtle, #e2e8f0);
  gap: 8px;
  flex-wrap: wrap;
  transition: background-color 0.28s, border-color 0.28s;
}

.tool-left-group,
.tool-right-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-sub, #475569);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  height: 26px;
}

.tool-btn:hover {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-main, #0f172a);
}

.bold-btn {
  font-weight: 800;
  font-size: 13px;
  width: 26px;
  justify-content: center;
}

.highlight-pic-btn {
  background: rgba(37, 99, 235, 0.1);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.25);
  font-weight: 600;
}

.highlight-pic-btn:hover {
  background: rgba(37, 99, 235, 0.2);
}

.template-btn {
  font-size: 11px;
}

.clear-btn {
  color: var(--text-sub, #94a3b8);
  font-size: 11px;
}

.clear-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.tool-divider {
  width: 1px;
  height: 14px;
  background: var(--border-subtle, #cbd5e1);
  margin: 0 3px;
}

/* 编辑器容器与内容 */
.editor-area-container {
  position: relative;
  width: 100%;
}

.rich-editor-content {
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-main, #1e293b);
  outline: none;
  overflow-y: auto;
  word-break: break-word;
}

/* 占位符效果 */
.rich-editor-content:empty:before {
  content: attr(data-placeholder);
  color: var(--text-sub, #94a3b8);
  pointer-events: none;
  display: block;
}

/* 内容样式定制 */
:deep(.rich-editor-content p) {
  margin: 4px 0;
}

:deep(.rich-editor-content img) {
  transition: outline 0.15s, box-shadow 0.15s;
}

:deep(.rich-editor-content img.selected-img) {
  outline: 2px solid #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.25);
}

/* 浮动图片尺寸与对齐工具条 */
.floating-img-toolbar {
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #1e293b;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  color: #ffffff;
}

.float-tag {
  font-size: 10px;
  color: #94a3b8;
  margin-right: 2px;
}

.float-btn {
  background: rgba(255, 255, 255, 0.12);
  border: none;
  border-radius: 4px;
  color: #f8fafc;
  font-size: 11px;
  padding: 3px 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.float-btn:hover {
  background: #3b82f6;
  color: #ffffff;
}

.float-btn.del-btn {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.float-btn.del-btn:hover {
  background: #ef4444;
  color: #ffffff;
}

.float-divider {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 2px;
}

/* 底部状态条 */
.editor-status-bar {
  padding: 5px 10px;
  background: var(--bg-card-secondary, #f8fafc);
  border-top: 1px solid var(--border-subtle, #f1f5f9);
  font-size: 11px;
  color: var(--text-sub, #64748b);
  display: flex;
  align-items: center;
  transition: background-color 0.28s, border-color 0.28s;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
