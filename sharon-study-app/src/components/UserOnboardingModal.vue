<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserProfileStore } from '../stores/userProfile'
import { ElMessage } from 'element-plus'
import {
  generateRandomPasscode,
  saveSyncConfig,
  pushCloudBackup,
  pullCloudBackup,
  validatePasscode
} from '../utils/cloudSync'
import {
  Key,
  CopyDocument,
  RefreshRight,
  ArrowLeft,
  Reading,
  Download,
  UserFilled,
  User,
  View,
  Hide
} from '@element-plus/icons-vue'

const userProfile = useUserProfileStore()

// 步骤控制：1 = 首页二选一（输入 Code 或 输入名字） | 2 = 新用户设置年级与专属 Code
const currentStep = ref<1 | 2>(1)

// 第一步：已有 Code 恢复
const restorePasscode = ref('')
const showRestorePasscode = ref(false)
const isRestoring = ref(false)

// 第一步：新同学名字
const formName = ref('')

// 第二步：年级与专属 Code
const formGrade = ref('高三')
const formPasscode = ref('')
const showFormPasscode = ref(false)
const isSubmitting = ref(false)

const GRADE_OPTIONS = ['高一', '高二', '高三']

onMounted(() => {
  formPasscode.value = generateRandomPasscode()
})

const handleRegenerate = () => {
  formPasscode.value = generateRandomPasscode()
  ElMessage.success('已生成新口令！')
}

const handleCopyCode = async () => {
  if (!formPasscode.value.trim()) return
  try {
    await navigator.clipboard.writeText(formPasscode.value.trim())
    ElMessage.success('口令已复制！')
  } catch {
    ElMessage.info('口令为：' + formPasscode.value)
  }
}

// 路径 1：输入 Code 恢复数据并直接开始使用
const handleRestoreFromCloud = async () => {
  const code = restorePasscode.value.trim()
  const codeCheck = validatePasscode(code)
  if (!codeCheck.valid) {
    ElMessage.warning(codeCheck.message || '口令需包含字母与数字组合，长度不少于 8 位')
    return
  }

  isRestoring.value = true
  try {
    await pullCloudBackup(code)
    ElMessage.success('🎉 恢复成功！正在进入空间...')
    await userProfile.fetchProfile()
    userProfile.showOnboardingModal = false
    setTimeout(() => window.location.reload(), 600)
  } catch (err: any) {
    ElMessage.error(err.message || '未找到该口令备份，请核对是否正确')
  } finally {
    isRestoring.value = false
  }
}

// 路径 2 第一步：输入名字，进入下一步后续设置
const handleGoToStep2 = () => {
  const trimmed = formName.value.trim()
  if (!trimmed) {
    ElMessage.warning('请输入你的名字或昵称')
    return
  }
  if (trimmed.length > 12) {
    ElMessage.warning('名字请在 12 个字以内')
    return
  }
  currentStep.value = 2
}

// 路径 2 第二步：保存年级和专属 Code，完成并进入
const handleFinishNewUser = async () => {
  const trimmedName = formName.value.trim()
  if (!trimmedName) {
    currentStep.value = 1
    return
  }

  const cleanCode = formPasscode.value.trim()
  const codeCheck = validatePasscode(cleanCode)
  if (!codeCheck.valid) {
    ElMessage.warning(codeCheck.message || '专属 Code 需包含字母与数字，长度不少于 8 位')
    return
  }

  isSubmitting.value = true
  try {
    await userProfile.saveProfile({
      user_name: trimmedName,
      grade_level: formGrade.value,
      custom_quote: '自律给我自由，每一天都在变得更好'
    })

    // 默认开启后台自动静默同步
    saveSyncConfig({
      passcode: cleanCode,
      autoSync: true
    })

    // 首次静默同步上云
    pushCloudBackup(cleanCode).catch(() => {})

    userProfile.showOnboardingModal = false
    ElMessage.success(`欢迎，${trimmedName}同学！已为你开启自动同步 🚀`)
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
    <div class="onboarding-box">
      <!-- 顶部轻量徽标与标题 -->
      <div class="header-section">
        <div class="header-icon-box">
          <el-icon :size="24"><Reading /></el-icon>
        </div>
        <h2 class="header-title">欢迎使用智学大脑</h2>
        <p class="header-desc">本地私有存储 · 端到端加密</p>
      </div>

      <!-- 第一步：只有两个选择（输入 Code 恢复数据 或 输入名字） -->
      <div v-if="currentStep === 1" class="step-view step1-view">
        <!-- 选择 A：输入 Code 恢复数据 -->
        <div class="choice-block restore-block">
          <div class="block-label">
            <el-icon class="block-icon text-emerald"><Download /></el-icon>
            <span>已有数据？输入 Code 恢复</span>
          </div>
          <div class="input-action-row">
            <el-input
              v-model="restorePasscode"
              :type="showRestorePasscode ? 'text' : 'password'"
              placeholder="输入同步 Code (如 sb-7k9p-4m2x)"
              size="large"
              class="monospace-input"
              clearable
              @keyup.enter="handleRestoreFromCloud"
            >
              <template #prefix>
                <el-icon class="input-icon"><Key /></el-icon>
              </template>
              <template #suffix>
                <button
                  type="button"
                  class="passcode-eye-btn"
                  :title="showRestorePasscode ? '隐藏口令' : '显示口令'"
                  @click="showRestorePasscode = !showRestorePasscode"
                >
                  <el-icon :size="16">
                    <View v-if="!showRestorePasscode" />
                    <Hide v-else />
                  </el-icon>
                </button>
              </template>
            </el-input>
            <el-button
              type="success"
              size="large"
              class="action-btn"
              :loading="isRestoring"
              @click="handleRestoreFromCloud"
            >
              恢复并进入
            </el-button>
          </div>
        </div>

        <!-- 极简分割线 -->
        <div class="divider-row">
          <span class="divider-line"></span>
          <span class="divider-text">或者</span>
          <span class="divider-line"></span>
        </div>

        <!-- 选择 B：输入名字开启新空间 -->
        <div class="choice-block create-block">
          <div class="block-label">
            <el-icon class="block-icon text-indigo"><UserFilled /></el-icon>
            <span>新同学？输入名字开启</span>
          </div>
          <div class="input-action-row">
            <el-input
              v-model="formName"
              placeholder="输入你的名字或昵称"
              size="large"
              maxlength="12"
              clearable
              autofocus
              @keyup.enter="handleGoToStep2"
            >
              <template #prefix>
                <el-icon class="input-prefix-icon"><User /></el-icon>
              </template>
            </el-input>
            <el-button
              type="primary"
              size="large"
              class="action-btn"
              @click="handleGoToStep2"
            >
              下一步 ➔
            </el-button>
          </div>
        </div>
      </div>

      <!-- 第二步：输入名字后的后续设置（简单选年级 + 自定义专属 Code） -->
      <div v-else class="step-view step2-view">
        <div class="step2-header">
          <button type="button" class="back-btn" @click="currentStep = 1">
            <el-icon><ArrowLeft /></el-icon> 返回
          </button>
          <span class="welcome-user">欢迎，<b>{{ formName }}</b></span>
        </div>

        <!-- 年级选择 -->
        <div class="form-row">
          <label class="row-label">当前年级</label>
          <div class="grade-group">
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
        </div>

        <!-- 专属同步 Code（可自定义） -->
        <div class="form-row">
          <div class="code-label-row">
            <label class="row-label">专属同步 Code（可自定义）</label>
            <span class="code-rule-hint">字母+数字，8位以上</span>
          </div>
          <div class="code-input-row">
            <el-input
              v-model="formPasscode"
              :type="showFormPasscode ? 'text' : 'password'"
              size="large"
              placeholder="自定义专属 Code"
              class="monospace-input"
              clearable
              @keyup.enter="handleFinishNewUser"
            >
              <template #prefix>
                <el-icon class="input-icon"><Key /></el-icon>
              </template>
              <template #suffix>
                <button
                  type="button"
                  class="passcode-eye-btn"
                  :title="showFormPasscode ? '隐藏口令' : '显示口令'"
                  @click="showFormPasscode = !showFormPasscode"
                >
                  <el-icon :size="16">
                    <View v-if="!showFormPasscode" />
                    <Hide v-else />
                  </el-icon>
                </button>
              </template>
            </el-input>
            <div class="code-action-btns">
              <el-button :icon="CopyDocument" @click="handleCopyCode" title="复制">
                复制
              </el-button>
              <el-button :icon="RefreshRight" @click="handleRegenerate" title="换一个">
                换一个
              </el-button>
            </div>
          </div>
          <p class="code-subtext">用于跨设备同步数据，系统默认开启每小时自动静默同步</p>
        </div>

        <!-- 提交并开始使用 -->
        <button
          type="button"
          class="start-btn"
          :disabled="isSubmitting"
          @click="handleFinishNewUser"
        >
          <span v-if="isSubmitting">正在进入...</span>
          <span v-else>进入智学空间 ➔</span>
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:deep(.onboarding-dialog) {
  border-radius: 20px;
  background: var(--bg-card, #ffffff);
  box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  padding: 0;
}

:deep(.onboarding-dialog .el-dialog__header) {
  display: none;
}

:deep(.onboarding-dialog .el-dialog__body) {
  padding: 24px 26px 22px;
}

.onboarding-box {
  display: flex;
  flex-direction: column;
}

/* 顶部标题 */
.header-section {
  text-align: center;
  margin-bottom: 18px;
}

.header-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--bg-page, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  color: var(--el-color-primary, #3b82f6);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

:global(.dark) .header-icon-box {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
}

.header-title {
  font-size: 19px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0 0 3px;
}

.header-desc {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

/* 视图容器 */
.step-view {
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 第一步布局 */
.choice-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-page, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  padding: 12px 14px;
  text-align: left;
}

.restore-block {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

:global(.dark) .restore-block {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.25);
}

.create-block {
  border-color: #c7d2fe;
  background: #eef2ff;
}

:global(.dark) .create-block {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.25);
}

.block-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.block-icon {
  font-size: 16px;
}

.text-emerald {
  color: #10b981;
}

.text-indigo {
  color: #6366f1;
}

.input-action-row {
  display: flex;
  gap: 8px;
}

.input-action-row .el-input {
  flex: 1;
}

.action-btn {
  font-weight: 700;
  border-radius: 10px;
  padding: 0 16px;
  flex-shrink: 0;
}

.monospace-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
}

.input-icon {
  font-size: 14px;
  color: #64748b;
}

.input-prefix-icon {
  font-size: 14px;
  margin-right: 2px;
}

/* 分割线 */
.divider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--border-color, #e2e8f0);
}

.divider-text {
  font-size: 11.5px;
  color: var(--text-secondary, #94a3b8);
  font-weight: 500;
}

/* 第二步布局 */
.step2-view {
  text-align: left;
  gap: 14px;
}

.step2-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  border: none;
  color: #6366f1;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 0;
}

.back-btn:hover {
  text-decoration: underline;
}

.welcome-user {
  font-size: 13.5px;
  color: var(--text-regular, #334155);
}

.welcome-user b {
  color: #4f46e5;
}

:global(.dark) .welcome-user b {
  color: #a5b4fc;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-regular, #334155);
}

.grade-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.grade-btn {
  padding: 7px 0;
  border-radius: 9px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-page, #f8fafc);
  color: var(--text-regular, #475569);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
}

.grade-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.grade-btn.active {
  background: #6366f1;
  border-color: #6366f1;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

:global(.dark) .grade-btn {
  background: #1e293b;
  border-color: #334155;
  color: #cbd5e1;
}

:global(.dark) .grade-btn.active {
  background: #6366f1;
  color: #ffffff;
}

.code-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.code-rule-hint {
  font-size: 11px;
  color: #94a3b8;
}

.code-input-row {
  display: flex;
  gap: 6px;
}

.code-input-row .el-input {
  flex: 1;
}

:deep(.monospace-input input[type="password"]) {
  letter-spacing: 2px;
}

.passcode-eye-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0 2px;
  cursor: pointer;
  color: var(--text-muted, #94a3b8);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  transition: all 0.2s ease;
  outline: none;
}

.passcode-eye-btn:hover {
  color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
}

.passcode-eye-btn:active {
  transform: scale(0.92);
}

:global(.dark) .passcode-eye-btn {
  color: #94a3b8;
}

:global(.dark) .passcode-eye-btn:hover {
  color: #a5b4fc;
  background: rgba(165, 180, 252, 0.15);
}

.code-subtext {
  font-size: 11px;
  color: var(--text-secondary, #64748b);
  margin: 2px 0 0;
  line-height: 1.3;
}

.start-btn {
  width: 100%;
  padding: 11px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  font-size: 14.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.3);
  margin-top: 4px;
}

.code-action-btns {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

@media (max-width: 560px) {
  .code-input-row {
    flex-direction: column;
    gap: 8px;
  }

  .code-input-row .el-input {
    width: 100% !important;
  }

  .code-action-btns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
  }

  .code-action-btns .el-button {
    margin: 0 !important;
    width: 100%;
    height: 38px;
    justify-content: center;
  }
}
</style>
