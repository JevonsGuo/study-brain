import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/home',
    },
    {
      path: '/home',
      name: 'Home',
      component: () => import('../views/Home/index.vue'),
    },
    {
      path: '/study-plan',
      name: 'StudyPlan',
      component: () => import('../views/StudyPlan/index.vue'),
    },
    {
      path: '/wrong-book',
      name: 'WrongBook',
      component: () => import('../views/WrongBook/index.vue'),
    },
    {
      path: '/word-card',
      name: 'WordCard',
      component: () => import('../views/WordCard/index.vue'),
    },
    {
      path: '/grade-tracker',
      name: 'GradeTracker',
      component: () => import('../views/GradeTracker/index.vue'),
    },
    {
      path: '/timer',
      name: 'Timer',
      component: () => import('../views/Timer/index.vue'),
    },
    {
      path: '/knowledge',
      name: 'Knowledge',
      component: () => import('../views/Knowledge/index.vue'),
    },
    {
      path: '/knowledge/:subject',
      name: 'KnowledgeDetail',
      component: () => import('../views/Knowledge/detail.vue'),
    },
  ],
})

export default router
