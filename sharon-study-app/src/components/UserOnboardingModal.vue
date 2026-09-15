<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserProfileStore } from '../stores/userProfile'
import { ElMessage } from 'element-plus'
import { getGaokaoTarget } from '../utils/gaokaoDate'
import {
  generateRandomPasscode,
  saveSyncConfig,
  pushCloudBackup,
  pullCloudBackup
} from '../utils/cloudSync'
import {
  Key,
  CopyDocument,
  RefreshRight,
  Download
} from '@element-plus/icons-vue'

const userProfile = useUserProfileStore()

// 模式切换：create (新同学开启空间) | restore (已有口令恢复数据)
const activeTab = ref<'create' | 'restore'>('create')

// 新建模式表单
const formName = ref('')
const formGrade = ref('高三冲刺')
const formQuote = ref('')
const formPasscode = ref('')
const isSubmitting = ref(false)

// 恢复模式表单
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
  // 首次打开自动生成高强度安全同步口令（支持自定修改）
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

// 1. 新建空间并开启同步
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
  if (!cleanCode) {
    ElMessage.warning('请保留或设置同步口令')
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

    // 尝试执行首次静默加密上云（离线环境不阻断正常使用）
    pushCloudBackup(cleanCode).catch(() => {})

    ElMessage.success(`欢迎，${trimmedName}同学！专属空间已就绪，已自动为您开启云端加密同步 🚀`)
  } finally {
    isSubmitting.value = false
  }
}

// 2. 使用已有口令一键恢复云端数据
const handleRestoreFromCloud = async () => {
  const code = restorePasscode.value.trim()
  if (!code) {
    ElMessage.warning('请输入你在其他设备生成的同步口令')
    return
  }

  isRestoring.value = true
  try {
    await pullCloudBackup(code)
    ElMessage.success('🎉 成功从云端解密并恢复所有学情数据！正在为您刷新空间...')
    // 重新加载用户信息与界面
    await userProfile.fetchProfile()
    userProfile.showOnboardingModal = false
    setTimeout(() => window.location.reload(), 800)
  } catch (err: any) {
    ElMessage.error(err.message || '恢复失败，请核对同步口令是否正确或云端是否存在备份')
  } finally {
    isRestoring.value = false
  }
}

// 快速跳过（兜底）
const handleSkip = async () => {
  isSubmitting.value = true
  try {
    const defaultCode = formPasscode.value || generateRandomPasscode()
    await userProfile.saveProfile({
      user_name: '同学',
      grade_level: '高三冲刺',
      custom_quote: '全力以赴，不负韶华'
    })
    saveSyncConfig({
      passcode: defaultCode,
      autoSync: true
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
    width="520px"
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
        <p class="sub-title">纯本地私有优先 · 金融级端到端加密 · 跨端无感同步</p>
      </div>

      <!-- 双模式切换胶囊 (新同学开启 vs 已有口令恢复) -->
      <div class="tab-pill-switcher">
        <button
          type="button"
          class="tab-pill"
          :class="{ active: activeTab === 'create' }"
          @click="activeTab = 'create'"
        >
          ✨ 开启全新空间
        </button>
        <button
          type="button"
          class="tab-pill"
          :class="{ active: activeTab === 'restore' }"
          @click="activeTab = 'restore'"
        >
          📥 已有口令恢复
        </button>
      </div>

      <!-- 模式一：新同学录入姓名 + 自动生成口令 + 默认开启同步 -->
      <div v-if="activeTab === 'create'" class="form-container">
        <!-- 姓名录入 -->
        <div class="form-item">
          <label class="item-label">
            <span>你的姓名 / 昵称</span>
            <span class="required-star">*</span>
          </label>
          <el-input
            v-model="formName"
            size="large"
            placeholder="例如：子涵、晨曦、小雨"
            maxlength="12"
            clearable
            @keyup.enter="handleConfirm"
          >
            <template #prefix>
              <span class="input-prefix-icon">👤</span>
            </template>
          </el-input>
        </div>

        <!-- 年级阶段选择 -->
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
          <div class="onboard-gaokao-hint">
            🎯 目标推算：<b>{{ getGaokaoTarget(formGrade).targetYear }}年6月7日</b>
            （倒计时 <b>{{ getGaokaoTarget(formGrade).diffDays }}</b> 天 · {{ getGaokaoTarget(formGrade).stageDesc }}）
          </div>
        </div>

        <!-- 同步口令（自动生成，可编辑、可换一个、可复制） -->
        <div class="form-item">
          <div class="label-with-badge">
            <label class="item-label">
              <el-icon class="icon-amber"><Key /></el-icon>
              <span>你的同步口令 (Passcode)</span>
            </label>
            <span class="safe-badge">端到端加密密钥</span>
          </div>

          <div class="passcode-box">
            <el-input
              v-model="formPasscode"
              placeholder="例如：sb-7k9p-4m2x"
              class="passcode-field"
              clearable
            >
              <template #prefix>
                <span class="passcode-prefix">🔑</span>
              </template>
            </el-input>
            <div class="passcode-actions">
              <el-button :icon="CopyDocument" @click="handleCopyCode" title="复制口令">
                复制
              </el-button>
              <el-button :icon="RefreshRight" @click="handleRegenerate" title="换一组口令">
                换一个
              </el-button>
            </div>
          </div>
          <div class="passcode-tip">
            💡 保存后将自动开启静默同步。在其他电脑或手机输入该口令，即可随时恢复进度。
          </div>
        </div>

        <!-- 极简数据安全亮点标牌 -->
        <div class="security-highlights-card">
          <div class="highlight-item">
            <span class="hl-icon">🛡️</span>
            <div class="hl-content">
              <b>完全自控</b>：数据严格保存在本地浏览器，无中央账户泄露风险
            </div>
          </div>
          <div class="highlight-item">
            <span class="hl-icon">🔐</span>
            <div class="hl-content">
              <b>金融级加密</b>：AES-256 本地加密，零知识中继，不与任何人分享
            </div>
          </div>
        </div>

        <!-- 开启空间主按钮 -->
        <div class="action-footer">
          <button
            type="button"
            class="launch-btn"
            :disabled="isSubmitting"
            @click="handleConfirm"
          >
            <span v-if="isSubmitting">正在定制专属空间并同步...</span>
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

      <!-- 模式二：老用户使用已有口令从云端恢复 -->
      <div v-else class="restore-container">
        <div class="restore-intro-box">
          <div class="restore-intro-title">📥 跨设备恢复数据</div>
          <p class="restore-intro-desc">
            若你在手机或另一台电脑上使用过智学大脑，只需输入当时的<b>同步口令</b>，系统将瞬间解密并拉取你的姓名、错题本、学习计划、专注记录与背词进度。
          </p>
        </div>

        <div class="form-item">
          <label class="item-label">
            <el-icon class="icon-amber"><Key /></el-icon>
            <span>输入你的同步口令</span>
            <span class="required-star">*</span>
          </label>
          <el-input
            v-model="restorePasscode"
            size="large"
            placeholder="例如：sb-7k9p-4m2x 或自定义口令"
            class="restore-input"
            clearable
            @keyup.enter="handleRestoreFromCloud"
          >
            <template #prefix>
              <span class="passcode-prefix">🔑</span>
            </template>
          </el-input>
        </div>

        <div class="restore-action-footer">
          <el-button
            type="primary"
            size="large"
            class="restore-confirm-btn"
            :loading="isRestoring"
            @click="handleRestoreFromCloud"
            :icon="Download"
          >
            从云端恢复我的数据
          </el-button>
          <button
            type="button"
            class="switch-back-btn"
            @click="activeTab = 'create'"
          >
            没有同步口令？返回创建全新空间
          </button>
        </div>
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
  padding: 28px 26px;
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
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
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
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
}

.emblem-emoji {
  font-size: 32px;
}

.onboarding-headings {
  margin-bottom: 16px;
}

.main-title {
  font-size: 21px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0 0 4px;
  letter-spacing: -0.3px;
}

.sub-title {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

/* 双模式切换胶囊 */
.tab-pill-switcher {
  display: flex;
  background: var(--bg-page, #f1f5f9);
  padding: 4px;
  border-radius: 12px;
  gap: 4px;
  width: 100%;
  margin-bottom: 18px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.tab-pill {
  flex: 1;
  padding: 8px 12px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-pill.active {
  background: #ffffff;
  color: #4f46e5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

:global(.dark) .tab-pill.active {
  background: #1e293b;
  color: #a5b4fc;
}

/* 表单结构 */
.form-container, .restore-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: left;
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

.label-with-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.icon-amber {
  color: #f59e0b;
}

.safe-badge {
  font-size: 10.5px;
  padding: 1px 7px;
  border-radius: 9999px;
  background: #fef3c7;
  color: #b45309;
  font-weight: 600;
}

.required-star {
  color: #ef4444;
}

.input-prefix-icon, .passcode-prefix {
  font-size: 14px;
  margin-right: 4px;
}

.grade-pills {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.grade-pill {
  padding: 7px 4px;
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
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.15);
}

.passcode-box {
  display: flex;
  gap: 8px;
  align-items: center;
}

.passcode-field {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.passcode-actions {
  display: flex;
  gap: 6px;
}

.passcode-tip {
  font-size: 11.5px;
  color: var(--text-secondary, #64748b);
  line-height: 1.4;
}

/* 安全亮点简约卡片 */
.security-highlights-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.highlight-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-regular, #334155);
}

.hl-icon {
  font-size: 13px;
  flex-shrink: 0;
  margin-top: 1px;
}

.hl-content b {
  color: #4f46e5;
}

/* 恢复模式专属样式 */
.restore-intro-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 4px;
}

.restore-intro-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #166534;
  margin-bottom: 4px;
}

.restore-intro-desc {
  font-size: 12px;
  color: #15803d;
  line-height: 1.5;
  margin: 0;
}

.restore-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.restore-action-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.restore-confirm-btn {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14.5px;
}

.switch-back-btn {
  background: transparent;
  border: none;
  color: #6366f1;
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  padding: 4px;
}

.switch-back-btn:hover {
  text-decoration: underline;
}

/* 按钮区 */
.action-footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.launch-btn {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  border: none;
  font-size: 14.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
  transition: all 0.2s;
}

.launch-btn:hover {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(99, 102, 241, 0.4);
}

.skip-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary, #94a3b8);
  font-size: 11.5px;
  cursor: pointer;
  transition: color 0.15s;
}

.skip-btn:hover {
  color: var(--text-regular, #475569);
  text-decoration: underline;
}

.onboard-gaokao-hint {
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.08);
  color: #4f46e5;
  font-size: 11px;
}
.onboard-gaokao-hint b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.6; }
  100% { transform: scale(1.08); opacity: 0.9; }
}

:global(.dark) .security-highlights-card {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark) .highlight-item {
  color: #cbd5e1;
}

:global(.dark) .restore-intro-box {
  background: #064e3b;
  border-color: #059669;
}

:global(.dark) .restore-intro-title {
  color: #6ee7b7;
}

:global(.dark) .restore-intro-desc {
  color: #a7f3d0;
}
</style>
