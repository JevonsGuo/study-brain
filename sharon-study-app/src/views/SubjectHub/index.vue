<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { ElMessage } from 'element-plus'
import SubjectHall from './SubjectHall.vue'
import SubjectWorkbench from './SubjectWorkbench.vue'
import RichQuestionEditor from '../../components/RichQuestionEditor.vue'

interface KnowledgePoint {
  id: number
  subject: string
  book: string
  chapter: string
  title: string
}

const route = useRoute()
const router = useRouter()

const currentSubject = computed(() => {
  return (route.params.subject as string) || ''
})

// 大厅快捷录入新错题弹窗
const addDialogVisible = ref(false)
const submitting = ref(false)
const pointsForSubject = ref<KnowledgePoint[]>([])

const newWrong = ref({
  subject: '数学',
  question: '',
  reason: '',
  mastery_status: 'unmastered' as const,
  knowledge_point_id: null as number | null
})

const reasonPresets = ['计算失误', '审题不清', '概念模糊', '公式记错', '缺乏思路', '忽略隐含条件', '步骤不规范']
const appendReason = (tag: string) => {
  if (!newWrong.value.reason) {
    newWrong.value.reason = tag
  } else if (!newWrong.value.reason.includes(tag)) {
    newWrong.value.reason += `、${tag}`
  }
}

const fetchPointsForSubject = async (sub: string) => {
  try {
    const res = await api.get(`/knowledge?subject=${encodeURIComponent(sub)}`)
    pointsForSubject.value = res as KnowledgePoint[]
  } catch {
    pointsForSubject.value = []
  }
}

const openAddFromHall = (presetSubject?: string) => {
  newWrong.value = {
    subject: presetSubject || '数学',
    question: '',
    reason: '',
    mastery_status: 'unmastered',
    knowledge_point_id: null
  }
  fetchPointsForSubject(newWrong.value.subject)
  addDialogVisible.value = true
}

const onSubjectChange = (newSub: string) => {
  newWrong.value.knowledge_point_id = null
  fetchPointsForSubject(newSub)
}

const submitNewWrong = async () => {
  const textCheck = newWrong.value.question.replace(/<[^>]+>/g, '').trim()
  const hasImg = /<img/i.test(newWrong.value.question)
  if (!textCheck && !hasImg) {
    ElMessage.warning('题目内容不能为空')
    return
  }

  submitting.value = true
  try {
    await api.post('/wrong-items', {
      subject: newWrong.value.subject,
      question: newWrong.value.question.trim(),
      reason: newWrong.value.reason.trim() || '未注明原因',
      mastery_status: newWrong.value.mastery_status,
      knowledge_point_id: newWrong.value.knowledge_point_id
    })
    addDialogVisible.value = false
    ElMessage.success('错题录入成功！')
    // 跳转到该学科的错题本
    router.push(`/subjects/${encodeURIComponent(newWrong.value.subject)}?tab=wrong-book`)
  } catch {
    ElMessage.error('录入错题失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="subject-hub-container">
    <transition name="fade" mode="out-in">
      <SubjectWorkbench
        v-if="currentSubject"
        :key="currentSubject"
        :subject="currentSubject"
      />
      <SubjectHall
        v-else
        key="hall"
        @open-add-dialog="openAddFromHall"
      />
    </transition>

    <!-- 大厅录入错题弹窗 -->
    <el-dialog
      v-model="addDialogVisible"
      title="录入新错题"
      width="680px"
      destroy-on-close
    >
      <el-form :model="newWrong" label-width="80px">
        <el-form-item label="所属科目" required>
          <el-select v-model="newWrong.subject" @change="onSubjectChange" style="width: 100%">
            <el-option
              v-for="s in ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']"
              :key="s"
              :label="s"
              :value="s"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="关联考点">
          <el-select
            v-model="newWrong.knowledge_point_id"
            placeholder="选择关联考点 (可搜索，支持留空)"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="p in pointsForSubject"
              :key="p.id"
              :label="p.title"
              :value="p.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="题目内容" required>
          <RichQuestionEditor v-model="newWrong.question" placeholder="输入题目文字或粘贴题目截图..." />
        </el-form-item>

        <el-form-item label="错因分析">
          <div class="reason-preset-row">
            <span
              v-for="tag in reasonPresets"
              :key="tag"
              class="preset-chip"
              @click="appendReason(tag)"
            >
              + {{ tag }}
            </span>
          </div>
          <el-input
            v-model="newWrong.reason"
            type="textarea"
            :rows="2"
            placeholder="做错原因分析..."
          />
        </el-form-item>

        <el-form-item label="掌握状态">
          <el-radio-group v-model="newWrong.mastery_status">
            <el-radio value="unmastered">🔴 待攻克</el-radio>
            <el-radio value="learning">🟡 练习中</el-radio>
            <el-radio value="mastered">🟢 已掌握</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitNewWrong">
          保存错题
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.subject-hub-container {
  width: 100%;
}

.reason-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.preset-chip {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.04);
  color: #64748b;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-chip:hover {
  background: #eff6ff;
  color: #2563eb;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
