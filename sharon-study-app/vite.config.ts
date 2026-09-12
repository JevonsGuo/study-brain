import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    proxy: {
      '/api/nutstore': {
        target: 'https://dav.jianguoyun.com/dav',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nutstore/, ''),
      },
    },
  },
})
