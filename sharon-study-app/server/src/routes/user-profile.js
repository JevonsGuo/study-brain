import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

// 获取用户个人定制档案
router.get('/', (req, res) => {
  const db = getDb()
  let profile = db.prepare('SELECT * FROM user_profile ORDER BY id ASC LIMIT 1').get()
  if (!profile) {
    db.prepare("INSERT INTO user_profile (id, user_name, app_title, grade_level, target_exam, custom_quote) VALUES (1, '', '', '高三', '高考', '')").run()
    profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get()
  }

  const hasConfigured = Boolean(profile.user_name && profile.user_name.trim())
  res.json({
    ...profile,
    has_configured: hasConfigured
  })
})

// 更新用户个人定制档案
router.put('/', (req, res) => {
  const db = getDb()
  const { user_name, app_title, grade_level, target_exam, custom_quote } = req.body

  let profile = db.prepare('SELECT * FROM user_profile ORDER BY id ASC LIMIT 1').get()
  if (!profile) {
    db.prepare("INSERT INTO user_profile (id, user_name, app_title, grade_level, target_exam, custom_quote) VALUES (1, '', '', '高三', '高考', '')").run()
    profile = { id: 1, user_name: '', app_title: '', grade_level: '高三', target_exam: '高考', custom_quote: '' }
  }

  const newUserName = user_name !== undefined ? String(user_name).trim() : profile.user_name
  const newAppTitle = app_title !== undefined ? String(app_title).trim() : profile.app_title
  const newGradeLevel = grade_level !== undefined ? String(grade_level).trim() : profile.grade_level
  const newTargetExam = target_exam !== undefined ? String(target_exam).trim() : profile.target_exam
  const newCustomQuote = custom_quote !== undefined ? String(custom_quote).trim() : profile.custom_quote

  db.prepare(`
    UPDATE user_profile SET
      user_name = ?,
      app_title = ?,
      grade_level = ?,
      target_exam = ?,
      custom_quote = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(newUserName, newAppTitle, newGradeLevel, newTargetExam, newCustomQuote, profile.id)

  const updated = db.prepare('SELECT * FROM user_profile WHERE id = ?').get(profile.id)
  const hasConfigured = Boolean(updated.user_name && updated.user_name.trim())

  res.json({
    ...updated,
    has_configured: hasConfigured
  })
})

export default router
