import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.resolve(__dirname, '../../../../content')

export function getDatabaseVersion() {
  const versionFile = path.join(CONTENT_DIR, 'version.json')
  if (fs.existsSync(versionFile)) {
    try {
      return JSON.parse(fs.readFileSync(versionFile, 'utf8'))
    } catch (e) {
      console.error('Failed to parse version.json', e)
    }
  }
  return {
    database_version: '20260911-001',
    updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    description: '初始官方数据库版本'
  }
}

export function bumpDatabaseVersion(description) {
  const versionFile = path.join(CONTENT_DIR, 'version.json')
  const curMeta = getDatabaseVersion()
  const curVer = curMeta.database_version || '20260911-001'
  const parts = curVer.split('-')
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  let seq = 1
  if (parts[1]) {
    seq = parseInt(parts[1], 10) + 1
  }
  const newSeqStr = String(seq).padStart(3, '0')
  const newVersion = `${todayStr}-${newSeqStr}`

  const newMeta = {
    database_version: newVersion,
    updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    description: description || curMeta.description || `维护更新版本 ${newVersion}`
  }

  try {
    fs.writeFileSync(versionFile, JSON.stringify(newMeta, null, 2) + '\n')
    console.log(`[ContentSync] Database version bumped to ${newVersion}`)
  } catch (err) {
    console.error('[ContentSync] Failed to write version.json', err)
  }
  return newMeta
}

export function dumpKnowledgePoints(db) {
  try {
    const rows = db.prepare(`
      SELECT subject, grade, book, chapter, title, content, key_formulas, tips, visual_desc, video_url, sort_order
      FROM knowledge_points
      ORDER BY sort_order ASC, id ASC
    `).all()

    const targetFile = path.join(CONTENT_DIR, 'knowledge.json')
    fs.writeFileSync(targetFile, JSON.stringify(rows, null, 2) + '\n')
    console.log(`[ContentSync] Dumped ${rows.length} knowledge points to content/knowledge.json`)
    return { ok: true, count: rows.length }
  } catch (err) {
    console.error('[ContentSync] Failed to dump knowledge points', err)
    return { ok: false, error: err.message }
  }
}

export function dumpLearningResources(db) {
  try {
    const rows = db.prepare(`
      SELECT subject, category, name, desc, url, sort_order
      FROM learning_resources
      ORDER BY subject ASC, category ASC, sort_order ASC, id ASC
    `).all()

    const targetFile = path.join(CONTENT_DIR, 'learning-resources.json')
    fs.writeFileSync(targetFile, JSON.stringify(rows, null, 2) + '\n')
    console.log(`[ContentSync] Dumped ${rows.length} learning resources to content/learning-resources.json`)
    return { ok: true, count: rows.length }
  } catch (err) {
    console.error('[ContentSync] Failed to dump learning resources', err)
    return { ok: false, error: err.message }
  }
}
