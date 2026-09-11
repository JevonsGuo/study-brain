import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const contentDir = path.join(rootDir, 'content')
const publicContentDir = path.join(rootDir, 'sharon-study-app', 'public', 'content')

if (!fs.existsSync(publicContentDir)) {
  fs.mkdirSync(publicContentDir, { recursive: true })
}

if (fs.existsSync(contentDir)) {
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.json'))
  const wordLists = []

  for (const file of files) {
    const src = path.join(contentDir, file)
    const dest = path.join(publicContentDir, file)
    fs.copyFileSync(src, dest)

    if (file.startsWith('words-') && file.endsWith('.json')) {
      const wordList = file.slice(6, -5)
      try {
        const raw = fs.readFileSync(src, 'utf8')
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          wordLists.push({
            word_list: wordList,
            count: items.length
          })
        }
      } catch (e) {
        console.warn(`[sync-public-content] 解析 ${file} 失败:`, e.message)
      }
    }
  }

  // 排序优先级：上海高阶 -> 高考核心 -> 六级 -> 雅思 -> 托福 -> GRE
  const orderMap = {
    shanghai: 1,
    default: 2,
    cet6: 3,
    ielts: 4,
    toefl: 5,
    gre: 6
  }
  wordLists.sort((a, b) => (orderMap[a.word_list] || 99) - (orderMap[b.word_list] || 99))

  fs.writeFileSync(
    path.join(publicContentDir, 'word-lists.json'),
    JSON.stringify(wordLists, null, 2),
    'utf8'
  )

  console.log(`[sync-public-content] 成功将 ${files.length} 个公共学科 JSON 文件同步至 sharon-study-app/public/content/`)
  console.log(`[sync-public-content] 生成词库索引 word-lists.json (包含 ${wordLists.length} 个词库)`)
} else {
  console.warn(`[sync-public-content] 未找到 content 目录: ${contentDir}`)
}

