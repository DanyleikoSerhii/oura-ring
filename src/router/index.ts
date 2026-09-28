import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      meta: { title: 'Дашборд' },
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/sleep',
      name: 'sleep',
      meta: { title: 'Сон' },
      component: () => import('../views/SleepView.vue'),
    },
    {
      path: '/activity',
      name: 'activity',
      meta: { title: 'Активность' },
      component: () => import('../views/ActivityView.vue'),
    },
    {
      path: '/recovery',
      name: 'recovery',
      meta: { title: 'Восстановление' },
      component: () => import('../views/RecoveryView.vue'),
    },
    {
      path: '/compare',
      name: 'compare',
      meta: { title: 'Сравнение периодов' },
      component: () => import('../views/CompareView.vue'),
    },
    {
      path: '/correlations',
      name: 'correlations',
      meta: { title: 'Корреляции' },
      component: () => import('../views/CorrelationsView.vue'),
    },
    {
      path: '/export',
      name: 'export',
      meta: { title: 'Данные для AI' },
      component: () => import('../views/ExportView.vue'),
    },
    {
      path: '/sync',
      name: 'sync',
      meta: { title: 'Синхронизация' },
      component: () => import('../views/SyncView.vue'),
    },
  ],
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'Oura'} · Oura Ring`
})

export default router
