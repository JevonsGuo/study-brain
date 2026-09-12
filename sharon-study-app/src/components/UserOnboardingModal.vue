<script setup lang="ts">
import { ref } from 'vue'
import { useUserProfileStore } from '../stores/userProfile'
import { ElMessage } from 'element-plus'
import { getGaokaoTarget } from '../utils/gaokaoDate'

const userProfile = useUserProfileStore()

const formName = ref('')
const formGrade = ref('高三冲刺')
const formQuote = ref('')
const isSubmitting = ref(false)

const GRADE_OPTIONS = [
  '高三冲刺',
  '高二培优',
  '高一扎根',
  '高三复读',
  '初三中考',
  '高中自学'
]

const handleConfirm = async () => {
  const trimmed = formName.value.trim()
  if (!trimmed) {
    ElMessage.warning('请输入你的名字或昵称，让我们为你量身定制空间')
    return
  }
  if (trimmed.length > 12) {
    ElMessage.warning('名字请在 12 个字以内')
    return
  }

  isSubmitting.value = true
  try {
    await userProfile.saveProfile({
      user_name: trimmed,
      grade_level: formGrade.value,
      custom_quote: formQuote.value.trim()
    })
  } finally {
    isSubmitting.value = false
  }
}

// 快速填入默认昵称（防卡死逃逸机制）
const handleSkip = async () => {
  isSubmitting.value = true
  try {
    await userProfile.saveProfile({
      user_name: '同学',
      grade_level: '高三冲刺',
      custom_quote: '全力以赴，不负韶华'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="userProfile.showOnboardingModal"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    width="480px"
    class="onboarding-dialog"
    center
    align-center
  >
    <div class="onboarding-wrapper">
      <!-- 顶饰图标与光晕 -->
      <div class="header-emblem">
        <div class="emblem-halo"></div>
        <div class="emblem-core">
          <span class="emblem-emoji">🎓</span>
        </div>
      </div>

      <div class="onboarding-headings">
        <h2 class="main-title">欢迎开启专属智学空间</h2>
        <p class="sub-title">请告诉我们你的名字，我们将为你量身定制专属的高考学习大脑</p>
      </div>

      <div class="form-container">
        <!-- 姓名录入 -->
        <div class="form-item">
          <label class="item-label">
            <span>你的姓名 / 昵称</span>
            <span class="required-star">*</span>
          </label>
          <el-input
            v-model="formName"
            size="large"
            placeholder="例如：子涵、小雨、晨曦"
            maxlength="12"
            clearable
            @keyup.enter="handleConfirm"
          >
            <template #prefix>
              <span class="input-prefix-icon">👤</span>
            </template>
          </el-input>
        </div>

        <!-- 年级选择 -->
        <div class="form-item">
          <label class="item-label">当前阶段</label>
          <div class="grade-pills">
            <button
              v-for="g in GRADE_OPTIONS"
              :key="g"
              type="button"
              class="grade-pill"
              :class="{ active: formGrade === g }"
              @click="formGrade = g"
            >
              {{ g }}
            </button>
          </div>
          <div class="onboard-gaokao-hint">
            🎯 智能推算高考年份：<b>{{ getGaokaoTarget(formGrade).targetYear }}年6月7日</b>
            （倒计时 <b>{{ getGaokaoTarget(formGrade).diffDays }}</b> 天 · {{ getGaokaoTarget(formGrade).stageDesc }}）
          </div>
        </div>

        <!-- 梦想目标 / 座右铭 -->
        <div class="form-item">
          <label class="item-label">
            <span>高考目标 / 励志座右铭</span>
            <span class="optional-tag">选填</span>
          </label>
          <el-input
            v-model="formQuote"
            placeholder="例如：心之所向，素履以往；冲刺 650+！"
            maxlength="40"
            clearable
            @keyup.enter="handleConfirm"
          >
            <template #prefix>
              <span class="input-prefix-icon">🌟</span>
            </template>
          </el-input>
        </div>
      </div>

      <div class="action-footer">
        <button
          type="button"
          class="launch-btn"
          :disabled="isSubmitting"
          @click="handleConfirm"
        >
          <span v-if="isSubmitting">正在定制专属空间...</span>
          <span v-else>开启我的专属学习大脑 🚀</span>
        </button>

        <button
          type="button"
          class="skip-btn"
          @click="handleSkip"
        >
          使用通用名体验，稍后在左下角修改
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:deep(.onboarding-dialog) {
  border-radius: 24px;
  background: var(--bg-card, #ffffff);
  box-shadow: 0 25px 50px -12px rgba(99, 102, 241, 0.25);
  overflow: hidden;
  padding: 0;
}

:deep(.onboarding-dialog .el-dialog__header) {
  display: none;
}

:deep(.onboarding-dialog .el-dialog__body) {
  padding: 32px 30px;
}

.onboarding-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* 顶部徽章 */
.header-emblem {
  position: relative;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.emblem-halo {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(236, 72, 153, 0.3));
  filter: blur(10px);
  animation: pulse 3s infinite alternate;
}

.emblem-core {
  position: relative;
  width: 68px;
  height: 68px;
  border-radius: 20px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
}

.emblem-emoji {
  font-size: 36px;
}

.onboarding-headings {
  margin-bottom: 24px;
}

.main-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0 0 8px;
  letter-spacing: -0.3px;
}

.sub-title {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

/* 表单结构 */
.form-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
  margin-bottom: 24px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-regular, #334155);
  display: flex;
  align-items: center;
  gap: 4px;
}

.required-star {
  color: #ef4444;
}

.optional-tag {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary, #94a3b8);
}

.input-prefix-icon {
  font-size: 14px;
  margin-right: 4px;
}

.grade-pills {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.grade-pill {
  padding: 8px 6px;
  border-radius: 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-page, #f8fafc);
  color: var(--text-regular, #475569);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.grade-pill:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.grade-pill.active {
  background: rgba(99, 102, 241, 0.12);
  border-color: #6366f1;
  color: #6366f1;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.15);
}

/* 按钮区 */
.action-footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.launch-btn {
  width: 100%;
  padding: 13px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  border: none;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
  transition: all 0.2s;
}

.launch-btn:hover {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(99, 102, 241, 0.45);
}

.launch-btn:active {
  transform: translateY(0);
}

.skip-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s;
}

.skip-btn:hover {
  color: var(--text-regular, #475569);
  text-decoration: underline;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.6; }
  100% { transform: scale(1.08); opacity: 0.9; }
}

.onboard-gaokao-hint {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: #4f46e5;
  font-size: 11.5px;
}
.onboard-gaokao-hint b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

</style>
