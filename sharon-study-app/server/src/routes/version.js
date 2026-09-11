import { Router } from 'express'
import { getDatabaseVersion, bumpDatabaseVersion } from '../utils/contentSync.js'

const router = Router()

// 获取当前官方数据库版本
router.get('/', (req, res) => {
  const versionMeta = getDatabaseVersion()
  res.json(versionMeta)
})

// 开发模式下手动或自动触发版本递增
router.post('/bump', (req, res) => {
  const { description } = req.body
  const newMeta = bumpDatabaseVersion(description)
  res.json(newMeta)
})

export default router
