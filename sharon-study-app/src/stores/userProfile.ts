import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../utils/api'
import { getGaokaoTarget, type GaokaoTargetInfo } from '../utils/gaokaoDate'
import { ElMessage } from 'element-plus'

const USER_PROFILE_CACHE_KEY = 'study_user_profile_cache'

export interface UserProfile {
  id: number
  user_name: string
  app_title: string
  grade_level: string
  target_exam: string
  custom_quote: string
  created_at?: string
  updated_at?: string
  has_configured: boolean
}

function loadCachedProfile(): Partial<UserProfile> {
  try {
    const raw = localStorage.getItem(USER_PROFILE_CACHE_KEY) || localStorage.getItem('sharon_user_profile_cache')
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.warn('Failed to parse cached user profile', e)
  }
  return {}
}

export const useUserProfileStore = defineStore('userProfile', () => {
  const cached = loadCachedProfile()

  const userName = ref(cached.user_name || '')
  const appCustomTitle = ref(cached.app_title || '')
  const gradeLevel = ref(cached.grade_level || '高三')
  const targetExam = ref(cached.target_exam || '高考')
  const customQuote = ref(cached.custom_quote || '')
  const hasConfigured = ref(cached.has_configured ?? Boolean(cached.user_name && cached.user_name.trim()))
  const isLoaded = ref(Boolean(cached.user_name))

  // 弹窗状态控制
  const showOnboardingModal = ref(false)
  const showEditModal = ref(false)

  // 动态品牌名称：若已填名字，如"子涵 的学习大脑"；否则为通用名"智学大脑"
  const appTitle = computed(() => {
    if (appCustomTitle.value && appCustomTitle.value.trim()) {
      return appCustomTitle.value.trim()
    }
    const name = userName.value.trim()
    return name ? `${name} 的学习大脑` : '智学大脑'
  })

  // 问候语中的名字
  const greetingName = computed(() => {
    return userName.value.trim() || '同学'
  })

  // 根据当前年级智能推算高考年份与倒计时天数
  const gaokaoTarget = computed<GaokaoTargetInfo>(() => {
    return getGaokaoTarget(gradeLevel.value)
  })

  // 同步更新浏览器标签页标题
  const syncDocumentTitle = () => {
    const title = appTitle.value
    document.title = `${title} - 智学大脑`
  }

  // 加载用户档案
  const fetchProfile = async () => {
    try {
      const data = await api.get('/user-profile') as UserProfile
      if (data) {
        // 如果本地缓存已有名字，但 IndexedDB 是空的新环境，优先用已有名字保持
        if (!data.user_name && userName.value.trim()) {
          data.user_name = userName.value.trim()
          data.app_title = appCustomTitle.value.trim()
          data.has_configured = true
          api.put('/user-profile', data).catch(() => {})
        } else {
          userName.value = data.user_name || userName.value || ''
          appCustomTitle.value = data.app_title || appCustomTitle.value || ''
          gradeLevel.value = data.grade_level || gradeLevel.value || '高三'
          targetExam.value = data.target_exam || targetExam.value || '高考'
          customQuote.value = data.custom_quote || customQuote.value || ''
          hasConfigured.value = data.has_configured || Boolean(userName.value.trim())
        }

        isLoaded.value = true

        // 写入 LocalStorage 备份
        localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify({
          user_name: userName.value,
          app_title: appCustomTitle.value,
          grade_level: gradeLevel.value,
          target_exam: targetExam.value,
          custom_quote: customQuote.value,
          has_configured: hasConfigured.value
        }))

        // 仅在确认真的未配置名字时，弹出首次引导框
        if (!hasConfigured.value && !userName.value.trim()) {
          showOnboardingModal.value = true
        } else {
          showOnboardingModal.value = false
        }

        syncDocumentTitle()
      }
    } catch (err) {
      console.warn('Failed to fetch user profile', err)
      // 降级使用本地已有数据
      if (!userName.value.trim()) {
        showOnboardingModal.value = true
      }
    }
  }

  // 保存/更新档案
  const saveProfile = async (payload: {
    user_name: string
    app_title?: string
    grade_level?: string
    target_exam?: string
    custom_quote?: string
  }) => {
    try {
      const trimmedName = payload.user_name?.trim() || ''
      const profileData = {
        user_name: trimmedName,
        app_title: payload.app_title?.trim() || '' ,
        grade_level: payload.grade_level || '高三冲刺',
        target_exam: payload.target_exam || '高考',
        custom_quote: payload.custom_quote?.trim() || '',
        has_configured: Boolean(trimmedName)
      }

      // 1. 同步毫秒级直接存入 LocalStorage，确保下次冷启动立即可用
      localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(profileData))

      userName.value = profileData.user_name
      appCustomTitle.value = profileData.app_title
      gradeLevel.value = profileData.grade_level
      targetExam.value = profileData.target_exam
      customQuote.value = profileData.custom_quote
      hasConfigured.value = profileData.has_configured

      showOnboardingModal.value = false
      showEditModal.value = false

      syncDocumentTitle()

      // 2. 异步持久化至 IndexedDB
      await api.put('/user-profile', profileData)

      ElMessage.success(`欢迎，${trimmedName}同学！专属学习空间已就绪 🚀`)
      return true
    } catch (err) {
      console.error('Failed to save user profile', err)
      ElMessage.error('保存个人档案失败，请稍后重试')
      return false
    }
  }

  return {
    userName,
    appCustomTitle,
    gradeLevel,
    targetExam,
    customQuote,
    hasConfigured,
    isLoaded,
    showOnboardingModal,
    showEditModal,
    appTitle,
    greetingName,
    gaokaoTarget,
    fetchProfile,
    saveProfile,
    syncDocumentTitle
  }
})
