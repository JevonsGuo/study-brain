<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const isCollapse = ref(false)
const isDark = ref(false)

const THEME_KEY = 'sharon_study_theme'

onMounted(() => {
  const savedTheme = localStorage.getItem(THEME_KEY)
  if (savedTheme) {
    isDark.value = savedTheme === 'dark'
  } else {
    isDark.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme(isDark.value)
})

const applyTheme = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

const setTheme = (dark: boolean) => {
  if (isDark.value === dark) return
  isDark.value = dark
  applyTheme(dark)
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
}

const toggleTheme = () => {
  setTheme(!isDark.value)
}

const activeMenu = computed(() => route.path)

const menuItems = [
  { index: '/home', icon: 'HomeFilled', title: '首页' },
  { index: '/knowledge', icon: 'Reading', title: '知识库' },
  { index: '/study-plan', icon: 'Calendar', title: '学习计划' },
  { index: '/wrong-book', icon: 'Notebook', title: '错题本' },
  { index: '/word-card', icon: 'Postcard', title: '单词卡' },
  { index: '/grade-tracker', icon: 'TrendCharts', title: '成绩追踪' },
  { index: '/timer', icon: 'Timer', title: '番茄钟' },
]

const handleSelect = (index: string) => {
  router.push(index)
}

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}
</script>

<template>
  <el-container class="app-container">
    <el-aside :width="isCollapse ? '64px' : '200px'" class="app-aside">
      <div class="logo-area">
        <el-icon :size="24" class="logo-icon"><Star /></el-icon>
        <span v-show="!isCollapse" class="logo-text">Sharon Study</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :collapse-transition="true"
        @select="handleSelect"
        class="app-menu"
      >
        <el-menu-item v-for="item in menuItems" :key="item.index" :index="item.index">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>

      <!-- 侧边栏底部操作区：左下角主题切换 + 侧栏折叠 -->
      <div class="aside-footer">
        <!-- 切换暗色/亮色模板 -->
        <div class="theme-switch-box" :class="{ 'is-collapsed': isCollapse }">
          <template v-if="!isCollapse">
            <div class="theme-pill-track">
              <div
                class="theme-pill-slider"
                :style="{ transform: isDark ? 'translateX(100%)' : 'translateX(0)' }"
              />
              <button
                type="button"
                class="theme-opt-btn"
                :class="{ active: !isDark }"
                @click="setTheme(false)"
                title="亮色模板 (Daylight)"
              >
                <el-icon :size="14" class="opt-icon sun-icon"><Sunny /></el-icon>
                <span class="opt-label">亮色</span>
              </button>
              <button
                type="button"
                class="theme-opt-btn"
                :class="{ active: isDark }"
                @click="setTheme(true)"
                title="暗色模板 (Cyber Night)"
              >
                <el-icon :size="14" class="opt-icon moon-icon"><Moon /></el-icon>
                <span class="opt-label">暗色</span>
              </button>
            </div>
          </template>
          <template v-else>
            <button
              type="button"
              class="theme-single-btn"
              @click="toggleTheme"
              :title="isDark ? '当前暗色模式，点击切换为亮色' : '当前亮色模式，点击切换为暗色'"
            >
              <el-icon :size="18" :class="{ 'icon-sun': !isDark, 'icon-moon': isDark }">
                <component :is="isDark ? 'Moon' : 'Sunny'" />
              </el-icon>
            </button>
          </template>
        </div>

        <!-- 侧栏折叠展开按钮 -->
        <div class="collapse-btn" @click="toggleCollapse" :title="isCollapse ? '展开侧栏' : '收起侧栏'">
          <el-icon :size="18">
            <component :is="isCollapse ? 'Expand' : 'Fold'" />
          </el-icon>
        </div>
      </div>
    </el-aside>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
.app-container {
  height: 100vh;
}

.app-aside {
  background: var(--aside-bg);
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  border-right: 1px solid var(--aside-border);
}

.logo-area {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid var(--aside-border);
  flex-shrink: 0;
}

.logo-icon {
  color: #ffd700;
  filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.5));
}

.logo-text {
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.app-menu {
  flex: 1;
  border-right: none;
  background: transparent;
  overflow-y: auto;
}

.app-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.68);
  font-weight: 500;
  margin: 4px 8px;
  border-radius: 8px;
  height: 44px;
  line-height: 44px;
  transition: all 0.2s ease;
}

.app-menu .el-menu-item:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.09);
}

.app-menu .el-menu-item.is-active {
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  font-weight: 600;
}

/* 底部区域 */
.aside-footer {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--aside-border);
  background: rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

/* 展开状态药丸切换器 */
.theme-switch-box {
  padding: 10px 12px 6px;
  display: flex;
  justify-content: center;
}

.theme-switch-box.is-collapsed {
  padding: 10px 0 6px;
}

.theme-pill-track {
  position: relative;
  display: flex;
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 2px;
  box-sizing: border-box;
}

.theme-pill-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(50% - 2px);
  height: calc(100% - 4px);
  border-radius: 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.theme-opt-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  font-weight: 500;
  transition: color 0.2s;
  padding: 0;
  border-radius: 16px;
}

.theme-opt-btn:hover {
  color: rgba(255, 255, 255, 0.9);
}

.theme-opt-btn.active {
  color: #ffffff;
  font-weight: 600;
}

.theme-opt-btn.active .sun-icon {
  color: #fde047;
}

.theme-opt-btn.active .moon-icon {
  color: #93c5fd;
}

/* 折叠状态单图标按钮 */
.theme-single-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.85);
  transition: all 0.2s ease;
}

.theme-single-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  transform: scale(1.05);
}

.icon-sun {
  color: #fde047;
}

.icon-moon {
  color: #93c5fd;
}

/* 折叠开关 */
.collapse-btn {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s;
}

.collapse-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.app-main {
  background: var(--bg-page);
  color: var(--text-main);
  padding: 24px;
  overflow-y: auto;
  transition: var(--theme-transition);
}
</style>
