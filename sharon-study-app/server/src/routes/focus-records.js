import { Router } from 'express'
import { getDb } from '../db/index.js'

const router = Router()

// GET /api/focus-records - 列表与多维学情统计
router.get('/', (req, res) => {
  const db = getDb()
  const { limit = 50, subject } = req.query

  let sql = 'SELECT * FROM focus_records'
  const params = []
  if (subject && subject !== '全部') {
    sql += ' WHERE subject = ?'
    params.push(subject)
  }
  sql += ' ORDER BY completed_at DESC, id DESC LIMIT ?'
  params.push(Number(limit) || 50)

  const records = db.prepare(sql).all(...params)

  // 1. 今日指标
  const todayRow = db.prepare(`
    SELECT
      COALESCE(SUM(duration_minutes), 0) as today_minutes,
      COUNT(CASE WHEN mode = 'pomodoro' THEN 1 END) as today_pomodoros,
      COUNT(*) as today_sessions
    FROM focus_records
    WHERE date(completed_at) = date('now', 'localtime')
  `).get()

  // 2. 累计指标
  const totalRow = db.prepare(`
    SELECT
      COALESCE(SUM(duration_minutes), 0) as total_minutes,
      COUNT(CASE WHEN mode = 'pomodoro' THEN 1 END) as total_pomodoros,
      COUNT(*) as total_sessions,
      COUNT(DISTINCT date(completed_at)) as active_days
    FROM focus_records
  `).get()

  // 3. 学科分布
  const bySubject = db.prepare(`
    SELECT
      subject,
      COALESCE(SUM(duration_minutes), 0) as minutes,
      COUNT(*) as count
    FROM focus_records
    GROUP BY subject
    ORDER BY minutes DESC
  `).all()

  // 4. 最近 7 天趋势
  const recentDays = db.prepare(`
    WITH RECURSIVE dates(d) AS (
      SELECT date('now', 'localtime', '-6 days')
      UNION ALL
      SELECT date(d, '+1 day')
      FROM dates
      WHERE d < date('now', 'localtime')
    )
    SELECT
      dates.d as date,
      COALESCE(SUM(f.duration_minutes), 0) as minutes,
      COUNT(f.id) as count
    FROM dates
    LEFT JOIN focus_records f ON date(f.completed_at) = dates.d
    GROUP BY dates.d
    ORDER BY dates.d ASC
  `).all()

  res.json({
    records,
    stats: {
      today_minutes: todayRow.today_minutes,
      today_pomodoros: todayRow.today_pomodoros,
      today_sessions: todayRow.today_sessions,
      total_minutes: totalRow.total_minutes,
      total_pomodoros: totalRow.total_pomodoros,
      total_sessions: totalRow.total_sessions,
      active_days: totalRow.active_days,
      by_subject: bySubject,
      recent_days: recentDays,
    }
  })
})

// POST /api/focus-records - 记录一次专注并可选联动计划完成
router.post('/', (req, res) => {
  const {
    subject = '其他',
    plan_id = null,
    task_name = '',
    mode = 'pomodoro',
    duration_minutes = 25,
    notes = '',
    mark_plan_done = false
  } = req.body

  const mins = Math.max(1, Math.round(Number(duration_minutes) || 25))
  const db = getDb()

  const insert = db.prepare(`
    INSERT INTO focus_records (subject, plan_id, task_name, mode, duration_minutes, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  let planMarkedDone = false
  const runTx = db.transaction(() => {
    const info = insert.run(subject, plan_id || null, task_name || '', mode || 'pomodoro', mins, notes || '')
    if (mark_plan_done && plan_id) {
      const plan = db.prepare('SELECT id, done FROM study_plans WHERE id = ?').get(plan_id)
      if (plan) {
        db.prepare('UPDATE study_plans SET done = 1 WHERE id = ?').run(plan_id)
        planMarkedDone = true
      }
    }
    return info.lastInsertRowid
  })

  const newId = runTx()
  const record = db.prepare('SELECT * FROM focus_records WHERE id = ?').get(newId)

  res.json({
    ok: true,
    record,
    plan_marked_done: planMarkedDone
  })
})

// DELETE /api/focus-records/:id - 删除单条专注记录
router.delete('/:id', (req, res) => {
  const db = getDb()
  const result = db.prepare('DELETE FROM focus_records WHERE id = ?').run(req.params.id)
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Record not found' })
  }
  res.json({ ok: true })
})

export default router
