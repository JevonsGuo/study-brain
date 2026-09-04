import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_DIR = path.join(__dirname, '..')
const APP_DIR = path.join(REPO_DIR, 'sharon-study-app')
const CONTENT_DIR = path.join(REPO_DIR, 'content')

const dbArg = process.argv[2]
const typeArgs = process.argv.slice(3)
if (dbArg && !dbArg.endsWith('.db')) {
  typeArgs.unshift(dbArg)
} else if (dbArg) {
  process.env.DB_PATH = path.resolve(REPO_DIR, dbArg)
}
const types = typeArgs.length > 0 ? typeArgs : ['words', 'knowledge', 'learning-resources']

const { getDb, getDbPath } = await import(pathToFileURL(path.join(APP_DIR, 'server', 'src', 'db', 'index.js')).href)

function writeJson(name, data) {
  const file = path.join(CONTENT_DIR, name)
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
  console.log(`  ${name}: ${data.length} 条`)
}

fs.mkdirSync(CONTENT_DIR, { recursive: true })
const db = getDb()
console.log(`[export] 来源数据库: ${getDbPath()}`)

if (types.includes('words')) {
  const wordRows = db.prepare("SELECT word, phonetic, meaning, example_en, example_cn FROM words ORDER BY LENGTH(example_en) DESC, id ASC").all()
  const words = []
  const seen = new Set()
  for (const row of wordRows) {
    if (seen.has(row.word)) continue
    seen.add(row.word)
    if (row.example_en === '0') row.example_en = ''
    if (row.example_cn === '0') row.example_cn = ''
    words.push(row)
  }
  words.sort((a, b) => a.word.localeCompare(b.word))
  writeJson('words.json', words)
}

if (types.includes('knowledge')) {
  const knowledge = db.prepare('SELECT subject, chapter, title, content, key_formulas, tips, visual_desc, video_url, sort_order FROM knowledge_points ORDER BY sort_order ASC, id ASC').all()
  writeJson('knowledge.json', knowledge)
}

if (types.includes('learning-resources')) {
  const resources = db.prepare('SELECT subject, category, name, desc, url, sort_order FROM learning_resources ORDER BY subject ASC, category ASC, sort_order ASC, id ASC').all()
  writeJson('learning-resources.json', resources)
}

console.log('[export] 完成')
