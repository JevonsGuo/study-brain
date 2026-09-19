import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus, { locale: zhCn })
app.use(createPinia())
app.use(router)
app.mount('#app')

// 注册 PWA Service Worker 离线缓存引擎
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swPath = `${import.meta.env.BASE_URL}sw.js`.replace(/\/+/g, '/')
    navigator.serviceWorker
      .register(swPath)
      .then((reg) => {
        console.log('[PWA] 离线引擎 Service Worker 就绪:', reg.scope)
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 注册非致命失败:', err)
      })
  })
}
