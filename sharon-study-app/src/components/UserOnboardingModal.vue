<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserProfileStore } from '../stores/userProfile'
import { ElMessage } from 'element-plus'
import { getGaokaoTarget } from '../utils/gaokaoDate'
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
  RefreshRight
} from '@element-plus/icons-vue'

const userProfile = useUserProfileStore()

// 核心选择模式：restore (用 Code 恢复数据) | create (提供新名字使用)
// 默认呈现新名字使用，并在顶部提供醒目的二选一选择卡
const activeMode = ref<'create' | 'restore'>('create')

// 模式一：新同学表单
const formName = ref('')
const formGrade = ref('高三冲刺')
const formQuote = ref('自律给我自由，每一天都在变得更好')
const formPasscode = ref('')
const isSubmitting = ref(false)

// 模式二：恢复数据表单
const restorePasscode = ref('')
const isRestoring = ref(false)

const GRADE_OPTIONS = [
  '高三冲刺',
  '高二培优',
  '高一扎根',
  '高三复读',
  '初三中考',
  '高中自学'
]

onMounted(() => {
  // 首次打开自动预生成高强度同步口令
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
    ElMessage.success('口令已复制！可在手机等其他设备输入以同步学习进度。')
  } catch {
    ElMessage.info('口令为：' + formPasscode.value)
  }
}

const handlePasteRestoreCode = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      restorePasscode.value = text.trim()
      ElMessage.success('已自动粘贴剪贴板中的口令！')
    }
  } catch {
    ElMessage.info('请在输入框中直接使用 Ctrl+V / Cmd+V 粘贴口令')
  }
}

// 1. 提交新名字并开启空间
const handleConfirm = async () => {
  const trimmedName = formName.value.trim()
  if (!trimmedName) {
    ElMessage.warning('请输入你的名字或昵称，让我们为你量身定制空间')
    return
  }
  if (trimmedName.length > 12) {
    ElMessage.warning('名字请在 12 个字以内')
    return
  }

  const cleanCode = formPasscode.value.trim()
  const codeCheck = validatePasscode(cleanCode)
  if (!codeCheck.valid) {
    ElMessage.warning(codeCheck.message || '同步口令需至少包含字母与数字组合，长度不少于 8 位')
    return
  }

  isSubmitting.value = true
  try {
    // 保存用户档案
    await userProfile.saveProfile({
      user_name: trimmedName,
      grade_level: formGrade.value,
      custom_quote: formQuote.value.trim()
    })

    // 保存同步配置并默认开启后台自动静默同步
    saveSyncConfig({
      passcode: cleanCode,
      autoSync: true
    })

    // 尝试执行首次静默加密上云
    pushCloudBackup(cleanCode).catch(() => {})

    userProfile.showOnboardingModal = false
    ElMessage.success(`欢迎，${trimmedName}同学！专属空间已就绪，已为您开启云端加密同步 🚀`)
  } finally {
    isSubmitting.value = false
  }
}

// 2. 用 Code 从云端恢复数据
const handleRestoreFromCloud = async () => {
  const code = restorePasscode.value.trim()
  const codeCheck = validatePasscode(code)
  if (!codeCheck.valid) {
    ElMessage.warning(codeCheck.message || '同步口令需至少包含字母与数字组合，长度不少于 8 位')
    return
  }

  isRestoring.value = true
  try {
    await pullCloudBackup(code)
    ElMessage.success('🎉 成功从云端解密并恢复所有学情数据！正在为您开启空间...')
    // 重新加载用户信息与界面
    await userProfile.fetchProfile()
    userProfile.showOnboardingModal = false
    setTimeout(() => window.location.reload(), 600)
  } catch (err: any) {
    ElMessage.error(err.message || '恢复失败，请核对同步口令是否正确或云端是否存在备份')
  } finally {
    isRestoring.value = false
  }
}

// 3. 快速跳过体验
const handleSkip = async () => {
  isSubmitting.value = true
  try {
    const defaultCode = formPasscode.value || generateRandomPasscode()
    await userProfile.saveProfile({
      user_name: '同学',
      grade_level: '高三冲刺',
      custom_quote: '自律给我自由，每一天都在变得更好'
    })
    saveSyncConfig({
      passcode: defaultCode,
      autoSync: true
    })
    userProfile.showOnboardingModal = false
    ElMessage.info('已开启体验空间，可随时在左下角修改姓名')
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
    width="540px"
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
        <h2 class="main-title">欢迎使用智学大脑</h2>
        <p class="sub-title">纯本地私有引擎 · 金融级端到端加密 · 跨设备无感同步</p>
      </div>

      <!-- 核心选择区：要么用 Code 恢复数据，要么提供新名字使用 -->
      <div class="mode-selector-section">
        <div class="choice-cards-list">
          <!-- 选项一：用 Code 恢复数据 -->
          <div
            class="choice-card"
            :class="{ active: activeMode === 'restore' }"
            @click="activeMode = 'restore'"
          >
            <div class="card-radio">
              <div class="radio-inner" v-if="activeMode === 'restore'"></div>
            </div>
            <div class="card-icon restore-icon-bg">📥</div>
            <div class="card-content">
              <div class="card-title-row">
                <span class="card-title">用 Code 恢复数据</span>
                <span class="card-tag tag-green">已有数据</span>
              </div>
              <div class="card-desc">在其他设备用过？输入同步口令一键还原全部学情与记录</div>
            </div>
          </div>

          <!-- 选项二：提供新名字使用 -->
          <div
            class="choice-card"
            :class="{ active: activeMode === 'create' }"
            @click="activeMode = 'create'"
          >
            <div class="card-radio">
              <div class="radio-inner" v-if="activeMode === 'create'"></div>
            </div>
            <div class="card-icon create-icon-bg">✨</div>
            <div class="card-content">
              <div class="card-title-row">
                <span class="card-title">提供新名字使用</span>
                <span class="card-tag tag-indigo">全新开启</span>
              </div>
              <div class="card-desc">初次体验？输入你的名字，即刻开启专属个性化学习空间</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 面板 A：用 Code 恢复数据 -->
      <div v-if="activeMode === 'restore'" class="panel-content restore-panel">
        <div class="form-item">
          <label class="item-label">
            <el-icon class="icon-amber"><Key /></el-icon>
            <span>输入你的同步口令 (Passcode)</span>
            <span class="required-star">*</span>
          </label>
          <div class="passcode-input-wrapper">
            <el-input
              v-model="restorePasscode"
              size="large"
              placeholder="例如：sb-7k9p-4m2x 或自定义口令"
              class="monospace-input"
              clearable
              autofocus
              @keyup.enter="handleRestoreFromCloud"
            >
              <template #prefix>
                <span class="input-prefix-icon">🔑</span>
              </template>
            </el-input>
            <el-button
              size="large"
              class="paste-btn"
              @click="handlePasteRestoreCode"
              title="从剪贴板粘贴口令"
            >
              粘贴
            </el-button>
          </div>
        </div>

        <div class="benefit-box">
          <span class="benefit-icon">💡</span>
          <span class="benefit-text">输入口令后，系统将从云端自动解密并恢复你的姓名、年级、错题本、学习进度与益智游戏对局记录。</span>
        </div>

        <div class="action-footer">
          <button
            type="button"
            class="primary-action-btn restore-btn"
            :disabled="isRestoring"
            @click="handleRestoreFromCloud"
          >
            <span v-if="isRestoring">正在解密并恢复数据...</span>
            <span v-else>📥 立即从云端恢复我的数据</span>
          </button>

          <button
            type="button"
            class="switch-mode-text-btn"
            @click="activeMode = 'create'"
          >
            没有同步口令？切换为提供新名字使用 ➔
          </button>
        </div>
      </div>

      <!-- 面板 B：提供新名字使用 -->
      <div v-else class="panel-content create-panel">
        <!-- 姓名录入 -->
        <div class="form-item">
          <label class="item-label">
            <span>你的姓名 / 昵称</span>
            <span class="required-star">*</span>
          </label>
          <el-input
            v-model="formName"
            size="large"
            placeholder="例如：小雨、晨曦、子涵"
            maxlength="12"
            clearable
            autofocus
            @keyup.enter="handleConfirm"
          >
            <template #prefix>
              <span class="input-prefix-icon">👤</span>
            </template>
          </el-input>
        </div>

        <!-- 学段选择 -->
        <div class="form-item">
          <label class="item-label">当前学段</label>
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
          <div class="gaokao-badge-row">
            🎯 目标推算：<b>{{ getGaokaoTarget(formGrade).targetYear }}年6月7日</b>
            （倒计时 <b>{{ getGaokaoTarget(formGrade).diffDays }}</b> 天 · {{ getGaokaoTarget(formGrade).stageDesc }}）
          </div>
        </div>

        <!-- 自动生成的同步口令卡片 -->
        <div class="passcode-card-box">
          <div class="passcode-card-header">
            <div class="passcode-card-title">
              <el-icon class="icon-amber"><Key /></el-icon>
              <span>专属同步口令（系统已为你自动生成）</span>
            </div>
            <span class="safe-badge">端到端加密</span>
          </div>

          <div class="passcode-input-row">
            <el-input
              v-model="formPasscode"
              class="monospace-input"
              placeholder="例如：sb-7k9p-4m2x"
            >
              <template #prefix>
                <span class="input-prefix-icon">🔑</span>
              </template>
            </el-input>
            <el-button :icon="CopyDocument" @click="handleCopyCode" title="复制口令">
              复制
            </el-button>
            <el-button :icon="RefreshRight" @click="handleRegenerate" title="换一个口令">
              换一个
            </el-button>
          </div>

          <div class="passcode-card-note">
            💡 数据 100% 保存在你的本地浏览器。凭此口令可在其他设备一键恢复全部学情，已默认开启后台静默同步。
          </div>
        </div>

        <!-- 底部提交与跳过 -->
        <div class="action-footer">
          <button
            type="button"
            class="primary-action-btn create-btn"
            :disabled="isSubmitting"
            @click="handleConfirm"
          >
            <span v-if="isSubmitting">正在定制专属空间并开启同步...</span>
            <span v-else>🚀 开启我的专属学习大脑</span>
          </button>

          <div class="footer-links-row">
            <button
              type="button"
              class="switch-mode-text-btn"
              @click="activeMode = 'restore'"
            >
              已有同步口令？切换为用 Code 恢复数据 ➔
            </button>
            <span class="link-divider">·</span>
            <button
              type="button"
              class="skip-text-btn"
              @click="handleSkip"
            >
              快速体验
            </button>
          </div>
        </div>
      </div>

      <!-- 底部安全承诺 -->
      <div class="modal-trust-footer">
        <span class="trust-item">🛡️ 纯本地私有数据</span>
        <span class="trust-dot">•</span>
        <span class="trust-item">🔐 金融级 AES-256 加密</span>
        <span class="trust-dot">•</span>
        <span class="trust-item">🚫 零服务器数据库</span>
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
  padding: 26px 28px 20px;
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
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
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
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
}

.emblem-emoji {
  font-size: 28px;
}

.onboarding-headings {
  margin-bottom: 14px;
}

.main-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0 0 4px;
  letter-spacing: -0.3px;
}

.sub-title {
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

/* 核心选择区：垂直卡片列表 */
.mode-selector-section {
  width: 100%;
  margin-bottom: 16px;
}

.choice-cards-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.choice-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 14px;
  border: 1.5px solid var(--border-color, #e2e8f0);
  background: var(--bg-page, #f8fafc);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.choice-card:hover {
  border-color: #a5b4fc;
  background: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08);
}

.choice-card.active {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.05);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
}

:global(.dark) .choice-card {
  background: #1e293b;
  border-color: #334155;
}

:global(.dark) .choice-card:hover {
  border-color: #6366f1;
  background: #243048;
}

:global(.dark) .choice-card.active {
  border-color: #818cf8;
  background: rgba(99, 102, 241, 0.15);
}

/* 单选圈指示器 */
.card-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-color, #cbd5e1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.2s;
}

.choice-card.active .card-radio {
  border-color: #6366f1;
}

.radio-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
}

/* 图标容器 */
.card-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  flex-shrink: 0;
}

.restore-icon-bg {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.create-icon-bg {
  background: #eef2ff;
  border: 1px solid #c7d2fe;
}

:global(.dark) .restore-icon-bg {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.4);
}

:global(.dark) .create-icon-bg {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.4);
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.card-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.card-tag {
  font-size: 10.5px;
  padding: 1px 7px;
  border-radius: 9999px;
  font-weight: 600;
}

.tag-green {
  background: #dcfce7;
  color: #15803d;
}

.tag-indigo {
  background: #e0e7ff;
  color: #4338ca;
}

:global(.dark) .tag-green {
  background: rgba(16, 185, 129, 0.25);
  color: #6ee7b7;
}

:global(.dark) .tag-indigo {
  background: rgba(99, 102, 241, 0.25);
  color: #a5b4fc;
}

.card-desc {
  font-size: 11.5px;
  color: var(--text-secondary, #64748b);
  line-height: 1.3;
}

/* 面板内容容器 */
.panel-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
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

.icon-amber {
  color: #f59e0b;
}

.input-prefix-icon {
  font-size: 14px;
  margin-right: 4px;
}

.monospace-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* 恢复口令输入与粘贴按钮 */
.passcode-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.passcode-input-wrapper .el-input {
  flex: 1;
}

.paste-btn {
  border-radius: 10px;
  font-weight: 600;
  color: #4f46e5;
  border-color: #c7d2fe;
  background: #f5f7ff;
}

.paste-btn:hover {
  background: #eef2ff;
  border-color: #818cf8;
}

/* 提示卡片 */
.benefit-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  font-size: 11.5px;
  color: #166534;
  line-height: 1.4;
}

:global(.dark) .benefit-box {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
}

.benefit-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* 年级选择 */
.grade-pills {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.grade-pill {
  padding: 6px 4px;
  border-radius: 9px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-page, #f8fafc);
  color: var(--text-regular, #475569);
  font-size: 11.5px;
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
}

:global(.dark) .grade-pill {
  background: #1e293b;
  border-color: #334155;
  color: #cbd5e1;
}

.gaokao-badge-row {
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.08);
  color: #4f46e5;
  font-size: 11px;
}

:global(.dark) .gaokao-badge-row {
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
}

.gaokao-badge-row b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* 专属口令卡片 */
.passcode-card-box {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:global(.dark) .passcode-card-box {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.passcode-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.passcode-card-title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-regular, #334155);
  display: flex;
  align-items: center;
  gap: 5px;
}

.safe-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 9999px;
  background: #fef3c7;
  color: #b45309;
  font-weight: 600;
}

:global(.dark) .safe-badge {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.passcode-input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.passcode-card-note {
  font-size: 11px;
  color: var(--text-secondary, #64748b);
  line-height: 1.4;
}

/* 按钮与操作区 */
.action-footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
}

.primary-action-btn {
  width: 100%;
  padding: 11px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.create-btn {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.3);
}

.create-btn:hover {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(99, 102, 241, 0.4);
}

.restore-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  box-shadow: 0 6px 18px rgba(16, 185, 129, 0.3);
}

.restore-btn:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(16, 185, 129, 0.4);
}

.switch-mode-text-btn {
  background: transparent;
  border: none;
  color: #6366f1;
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  padding: 3px;
  transition: color 0.15s;
}

.switch-mode-text-btn:hover {
  text-decoration: underline;
  color: #4f46e5;
}

.footer-links-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.link-divider {
  color: var(--text-secondary, #94a3b8);
  font-size: 12px;
}

.skip-text-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary, #94a3b8);
  font-size: 11.5px;
  cursor: pointer;
  padding: 3px;
  transition: color 0.15s;
}

.skip-text-btn:hover {
  color: var(--text-regular, #475569);
  text-decoration: underline;
}

/* 底部信任承诺条 */
.modal-trust-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color, #f1f5f9);
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
}

:global(.dark) .modal-trust-footer {
  border-top-color: #334155;
  color: #64748b;
}

.trust-dot {
  font-size: 9px;
  opacity: 0.6;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.6; }
  100% { transform: scale(1.08); opacity: 0.9; }
}
</style>
