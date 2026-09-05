import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_DIR = path.join(__dirname, '..')
const APP_DIR = path.join(REPO_DIR, 'sharon-study-app')
const CONTENT_DIR = path.join(REPO_DIR, 'content')

function loadEnvFile() {
  const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local'
  const envPath = path.join(APP_DIR, envFile)
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim()
  }
}

function readContent(name, validate) {
  const file = path.join(CONTENT_DIR, name)
  if (!fs.existsSync(file)) return null
  let items
  try {
    items = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(`${name} 不是合法 JSON: ${e.message}`)
  }
  if (!Array.isArray(items)) throw new Error(`${name} 应为数组`)
  items.forEach((item, i) => validate(item, i, name))
  return items
}

function requireFields(item, fields, i, name) {
  for (const f of fields) {
    if (!item[f]) throw new Error(`${name} 第 ${i + 1} 条缺少必填字段 ${f}`)
  }
}

function syncWords(db, items, wordList) {
  const get = db.prepare('SELECT * FROM words WHERE word = ? AND word_list = ?')
  const insert = db.prepare("INSERT INTO words (word, phonetic, meaning, example_en, example_cn, word_list, origin) VALUES (?, ?, ?, ?, ?, ?, 'seed')")
  const update = db.prepare('UPDATE words SET phonetic = ?, meaning = ?, example_en = ?, example_cn = ? WHERE id = ?')
  const stats = { total: items.length, inserted: 0, updated: 0, unchanged: 0, skippedUserModified: 0 }
  for (const w of items) {
    const phonetic = w.phonetic || ''
    const meaning = w.meaning || ''
    const exampleEn = w.example_en || ''
    const exampleCn = w.example_cn || ''
    const row = get.get(w.word, wordList)
    if (!row) {
      insert.run(w.word, phonetic, meaning, exampleEn, exampleCn, wordList)
      stats.inserted++
    } else if (row.user_modified) {
      stats.skippedUserModified++
    } else if (row.phonetic === phonetic && row.meaning === meaning && row.example_en === exampleEn && row.example_cn === exampleCn) {
      stats.unchanged++
    } else {
      update.run(phonetic, meaning, exampleEn, exampleCn, row.id)
      stats.updated++
    }
  }
  return stats
}

function syncKnowledge(db, items) {
  const get = db.prepare('SELECT * FROM knowledge_points WHERE subject = ? AND title = ?')
  const insert = db.prepare("INSERT INTO knowledge_points (subject, chapter, title, content, key_formulas, tips, visual_desc, video_url, sort_order, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed')")
  const update = db.prepare('UPDATE knowledge_points SET chapter = ?, content = ?, key_formulas = ?, tips = ?, visual_desc = ?, video_url = ?, sort_order = ? WHERE id = ?')
  const stats = { total: items.length, inserted: 0, updated: 0, unchanged: 0, skippedUserModified: 0 }
  for (const k of items) {
    const chapter = k.chapter || ''
    const content = k.content || ''
    const keyFormulas = k.key_formulas || ''
    const tips = k.tips || ''
    const visualDesc = k.visual_desc || ''
    const videoUrl = k.video_url || ''
    const sortOrder = k.sort_order || 0
    const row = get.get(k.subject, k.title)
    if (!row) {
      insert.run(k.subject, chapter, k.title, content, keyFormulas, tips, visualDesc, videoUrl, sortOrder)
      stats.inserted++
    } else if (row.user_modified) {
      stats.skippedUserModified++
    } else if (row.chapter === chapter && row.content === content && row.key_formulas === keyFormulas && row.tips === tips && row.visual_desc === visualDesc && row.video_url === videoUrl && row.sort_order === sortOrder) {
      stats.unchanged++
    } else {
      update.run(chapter, content, keyFormulas, tips, visualDesc, videoUrl, sortOrder, row.id)
      stats.updated++
    }
  }
  return stats
}

function syncResources(db, items) {
  const get = db.prepare('SELECT * FROM learning_resources WHERE subject = ? AND url = ?')
  const insert = db.prepare("INSERT INTO learning_resources (subject, category, name, desc, url, sort_order, origin) VALUES (?, ?, ?, ?, ?, ?, 'seed')")
  const update = db.prepare('UPDATE learning_resources SET category = ?, name = ?, desc = ?, sort_order = ? WHERE id = ?')
  const stats = { total: items.length, inserted: 0, updated: 0, unchanged: 0, skippedUserModified: 0 }
  for (const r of items) {
    const category = r.category || 'video'
    const name = r.name || ''
    const desc = r.desc || ''
    const sortOrder = r.sort_order || 0
    const row = get.get(r.subject || '', r.url)
    if (!row) {
      insert.run(r.subject || '', category, name, desc, r.url, sortOrder)
      stats.inserted++
    } else if (row.user_modified) {
      stats.skippedUserModified++
    } else if (row.category === category && row.name === name && row.desc === desc && row.sort_order === sortOrder) {
      stats.unchanged++
    } else {
      update.run(category, name, desc, sortOrder, row.id)
      stats.updated++
    }
  }
  return stats
}

loadEnvFile()

const { getDb, getDbPath } = await import(pathToFileURL(path.join(APP_DIR, 'server', 'src', 'db', 'index.js')).href)

const db = getDb()
console.log(`[sync] 数据库: ${getDbPath()}`)

const wordFiles = fs.readdirSync(CONTENT_DIR)
  .filter(f => f.startsWith('words-') && f.endsWith('.json'))
  .sort()

const contents = []
for (const f of wordFiles) {
  const wordList = f.slice(6, -5)
  contents.push({
    name: f,
    validate: (item, i, name) => requireFields(item, ['word', 'meaning'], i, name),
    sync: (db, items) => syncWords(db, items, wordList),
    label: `单词字典[${wordList}]`
  })
}
contents.push(
  { name: 'knowledge.json', validate: (item, i, name) => requireFields(item, ['subject', 'title'], i, name), sync: syncKnowledge, label: '知识库' },
  { name: 'learning-resources.json', validate: (item, i, name) => requireFields(item, ['subject', 'name', 'url'], i, name), sync: syncResources, label: '学习资源' },
)

let failed = false
for (const c of contents) {
  let items
  try {
    items = readContent(c.name, c.validate)
  } catch (e) {
    console.error(`[sync] ${c.label} (${c.name}) 读取失败: ${e.message}`)
    failed = true
    continue
  }
  if (!items) {
    console.log(`[sync] ${c.label}: content/${c.name} 不存在，跳过`)
    continue
  }
  const stats = db.transaction(() => c.sync(db, items))()
  console.log(`[sync] ${c.label}: 共 ${stats.total} | 新增 ${stats.inserted} | 更新 ${stats.updated} | 无变化 ${stats.unchanged} | 跳过用户修改 ${stats.skippedUserModified}`)
}

if (failed) process.exit(1)
