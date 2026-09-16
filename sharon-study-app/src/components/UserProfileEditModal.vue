<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUserProfileStore } from '../stores/userProfile'
import { ElMessage } from 'element-plus'
import { getGaokaoTarget } from '../utils/gaokaoDate'

const userProfile = useUserProfileStore()

const formName = ref('')
const formCustomTitle = ref('')
const formGrade = ref('高三')
const formQuote = ref('')
const isSubmitting = ref(false)

const GRADE_OPTIONS = ['高一', '高二', '高三']

function normalizeGrade(val?: string) {
  if (!val) return '高三'
  if (val.includes('高一')) return '高一'
  if (val.includes('高二')) return '高二'
  return '高三'
}

// 弹窗打开时回填已有数据
watch(() => userProfile.showEditModal, (val) => {
  if (val) {
    formName.value = userProfile.userName || ''
    formCustomTitle.value = userProfile.appCustomTitle || ''
    formGrade.value = normalizeGrade(userProfile.gradeLevel)
    formQuote.value = userProfile.customQuote || ''
  }
})

const handleSave = async () => {
  const trimmed = formName.value.trim()
  if (!trimmed) {
    ElMessage.warning('姓名不能为空')
    return
  }

  isSubmitting.value = true
  try {
    const success = await userProfile.saveProfile({
      user_name: trimmed,
      app_title: formCustomTitle.value.trim(),
      grade_level: formGrade.value,
      custom_quote: formQuote.value.trim()
    })
    if (success) {
      userProfile.showEditModal = false
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="userProfile.showEditModal"
    title="修改个人档案与空间名称"
    width="460px"
    class="profile-edit-dialog"
    destroy-on-close
  >
    <div class="edit-form">
      <div class="form-row">
        <label class="field-label">
          <span>学生姓名 / 昵称</span>
          <span class="star">*</span>
        </label>
        <el-input
          v-model="formName"
          placeholder="例如：子涵、小雨"
          maxlength="12"
          clearable
        />
        <span class="field-hint">将作为系统问候语与默认空间归属名</span>
      </div>

      <div class="form-row">
        <label class="field-label">
          <span>专属系统标题</span>
          <span class="optional">(选填)</span>
        </label>
        <el-input
          v-model="formCustomTitle"
          :placeholder="`${formName ? formName : '我'} 的学习大脑`"
          maxlength="20"
          clearable
        />
        <span class="field-hint">留空则自动显示为「{{ formName ? formName : '同学' }} 的学习大脑」</span>
      </div>

      <div class="form-row">
        <label class="field-label">当前阶段</label>
        <div class="grade-selector">
          <button
            v-for="g in GRADE_OPTIONS"
            :key="g"
            type="button"
            class="grade-btn"
            :class="{ active: formGrade === g }"
            @click="formGrade = g"
          >
            {{ g }}
          </button>
        </div>
        <div class="field-hint gaokao-calc-hint">
          🎯 智能推算高考年份：<b>{{ getGaokaoTarget(formGrade).targetYear }}年6月7日</b>
          （倒计时 <b>{{ getGaokaoTarget(formGrade).diffDays }}</b> 天 · {{ getGaokaoTarget(formGrade).stageDesc }}）
        </div>
      </div>

      <div class="form-row">
        <label class="field-label">
          <span>励志座右铭 / 奋斗目标</span>
          <span class="optional">(选填)</span>
        </label>
        <el-input
          v-model="formQuote"
          placeholder="例如：金榜题名，全力以赴！"
          maxlength="40"
          clearable
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <el-button @click="userProfile.showEditModal = false">取消</el-button>
        <el-button type="primary" :loading="isSubmitting" @click="handleSave">
          保存修改
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  display: flex;
  align-items: center;
  gap: 4px;
}

.star {
  color: #ef4444;
}

.optional {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary, #94a3b8);
}

.field-hint {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

.grade-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.grade-btn {
  padding: 6px 4px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-page, #f8fafc);
  color: var(--text-regular, #475569);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.grade-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.grade-btn.active {
  background: rgba(99, 102, 241, 0.12);
  border-color: #6366f1;
  color: #6366f1;
  font-weight: 700;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.gaokao-calc-hint {
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: #4f46e5;
  font-size: 12px;
}
.gaokao-calc-hint b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

</style>
