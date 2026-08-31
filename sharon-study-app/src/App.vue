<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const isCollapse = ref(false)

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
      <div class="collapse-btn" @click="toggleCollapse">
        <el-icon :size="18">
          <component :is="isCollapse ? 'Expand' : 'Fold'" />
        </el-icon>
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
  background: #001529;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  overflow: hidden;
}

.logo-area {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-icon {
  color: #ffd700;
}

.logo-text {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}

.app-menu {
  flex: 1;
  border-right: none;
  background: #001529;
}

.app-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.65);
}

.app-menu .el-menu-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.app-menu .el-menu-item.is-active {
  color: #fff;
  background: #1890ff;
}

.collapse-btn {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.65);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  transition: color 0.3s;
}

.collapse-btn:hover {
  color: #fff;
}

.app-main {
  background: #f0f2f5;
  padding: 24px;
}
</style>
