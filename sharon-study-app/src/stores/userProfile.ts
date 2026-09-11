import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../utils/api'
import { ElMessage } from 'element-plus'

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

export const useUserProfileStore = defineStore('userProfile', () => {
  const userName = ref('')
  const appCustomTitle = ref('')
  const gradeLevel = ref('高三')
  const targetExam = ref('高考')
  const customQuote = ref('')
  const hasConfigured = ref(false)
  const isLoaded = ref(false)

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

  // 同步更新浏览器标签页标题
  const syncDocumentTitle = () => {
    const title = appTitle.value
    document.title = `${title} - 高考自律智学系统`
  }

  // 加载用户档案
  const fetchProfile = async () => {
    try {
      const data = await api.get('/user-profile') as UserProfile
      if (data) {
        userName.value = data.user_name || ''
        appCustomTitle.value = data.app_title || ''
        gradeLevel.value = data.grade_level || '高三'
        targetExam.value = data.target_exam || '高考'
        customQuote.value = data.custom_quote || ''
        hasConfigured.value = data.has_configured
        isLoaded.value = true

        // 如果用户尚未填写名字，自动打开首次引导弹窗
        if (!data.has_configured) {
          showOnboardingModal.value = true
        }

        syncDocumentTitle()
      }
    } catch (err) {
      console.warn('Failed to fetch user profile', err)
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
      const res = await api.put('/user-profile', payload) as UserProfile
      userName.value = res.user_name || ''
      appCustomTitle.value = res.app_title || ''
      gradeLevel.value = res.grade_level || '高三'
      targetExam.value = res.target_exam || '高考'
      customQuote.value = res.custom_quote || ''
      hasConfigured.value = res.has_configured

      showOnboardingModal.value = false
      showEditModal.value = false

      syncDocumentTitle()
      ElMessage.success(`欢迎，${res.user_name}同学！专属学习空间已就绪 🚀`)
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
    fetchProfile,
    saveProfile,
    syncDocumentTitle
  }
})
