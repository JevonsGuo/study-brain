import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const contentDir = path.resolve(rootDir, 'content')
const publicContentDir = path.resolve(__dirname, 'public/content')

/**
 * 开发者模式公共数据直写插件
 * 页面在维护模式下修改/新增/删除考点或资源时，直接写回磁盘 content/*.json，
 * 开发者切回 IDE 即可通过 Git Source Control 面板直接对比并提交变更！
 */
function devContentSyncPlugin(): Plugin {
  return {
    name: 'dev-content-sync',
    configureServer(server) {
      server.middlewares.use('/api/dev/save-content', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        let bodyStr = ''
        req.on('data', (chunk) => {
          bodyStr += chunk
        })
        req.on('end', () => {
          try {
            const { file, content } = JSON.parse(bodyStr)
            if (!file || typeof content !== 'string') {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing file or content' }))
              return
            }

                        const safeFile = path.basename(file)
            if (!safeFile.endsWith('.json')) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid file format' }))
              return
            }

            const targetSourceFile = path.join(contentDir, safeFile)
            const targetPublicFile = path.join(publicContentDir, safeFile)

            // 支持单词高精度增量更新（避免全量覆盖损坏词库）
            const { updateWord } = JSON.parse(bodyStr)
            if (updateWord && updateWord.word) {
              if (fs.existsSync(targetSourceFile)) {
                const raw = fs.readFileSync(targetSourceFile, 'utf8')
                const list = JSON.parse(raw)
                let found = false
                for (let i = 0; i < list.length; i++) {
                  if (list[i].word && list[i].word.toLowerCase() === updateWord.word.toLowerCase()) {
                    list[i] = { ...list[i], ...updateWord }
                    found = true
                    break
                  }
                }
                if (!found) {
                  list.push(updateWord)
                }
                const formatted = JSON.stringify(list, null, 2) + '\n'
                fs.writeFileSync(targetSourceFile, formatted, 'utf8')
                if (fs.existsSync(publicContentDir)) {
                  fs.writeFileSync(targetPublicFile, formatted, 'utf8')
                }
                console.log(`[dev-content-sync] 成功更新单词 [${updateWord.word}] 于: content/${safeFile}`)
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true, word: updateWord.word, file: safeFile }))
                return
              }
            }

            const formattedContent = content.endsWith('\n') ? content : content + '\n'

            // 1. 直接更新根目录 content/*.json（用于 IDE Source Control 审查与提交）
            fs.writeFileSync(targetSourceFile, formattedContent, 'utf8')

            // 2. 联动更新 public/content/*.json（保持 Vite 静态服务毫秒级刷新）
            if (fs.existsSync(publicContentDir)) {
              fs.writeFileSync(targetPublicFile, formattedContent, 'utf8')
            }

            console.log(`[dev-content-sync] 成功直接写回本地文件: content/${safeFile}`)

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: safeFile }))
          } catch (err: any) {
            console.error('[dev-content-sync] 写回失败:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), devContentSyncPlugin()],
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
