import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
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
      path: '/subjects',
      name: 'SubjectHub',
      component: () => import('../views/SubjectHub/index.vue'),
    },
    {
      path: '/subjects/:subject',
      name: 'SubjectWorkbench',
      component: () => import('../views/SubjectHub/index.vue'),
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
      path: '/brain-gym',
      name: 'BrainGym',
      component: () => import('../views/BrainGym/index.vue'),
    },
    {
      path: '/resources',
      name: 'ResourceHub',
      component: () => import('../views/ResourceHub/index.vue'),
    },
    {
      path: '/games',
      redirect: '/brain-gym',
    },

    // 历史路径平滑重定向 (保证老链接与书签 100% 兼容)
    {
      path: '/knowledge',
      redirect: { path: '/subjects', query: { tab: 'knowledge' } },
    },
    {
      path: '/knowledge/:subject',
      redirect: (to) => ({
        path: `/subjects/${to.params.subject}`,
        query: { tab: 'knowledge' },
      }),
    },
    {
      path: '/knowledge/:subject/:book',
      redirect: (to) => ({
        path: `/subjects/${to.params.subject}`,
        query: { tab: 'knowledge', book: to.params.book },
      }),
    },
    {
      path: '/wrong-book',
      redirect: { path: '/subjects', query: { tab: 'wrong-book' } },
    },
    {
      path: '/wrong-book/:subject',
      redirect: (to) => ({
        path: `/subjects/${to.params.subject}`,
        query: { tab: 'wrong-book' },
      }),
    },
  ],
})

export default router
