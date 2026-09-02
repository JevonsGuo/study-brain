import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local'
config({ path: path.join(__dirname, '..', '..', envFile) })

import express from 'express'
import cors from 'cors'
import { getDb } from './db/index.js'
import studyPlansRouter from './routes/study-plans.js'
import wrongItemsRouter from './routes/wrong-items.js'
import wordsRouter from './routes/words.js'
import gradesRouter from './routes/grades.js'
import knowledgeRouter from './routes/knowledge.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use('/api/study-plans', studyPlansRouter)
app.use('/api/wrong-items', wrongItemsRouter)
app.use('/api/words', wordsRouter)
app.use('/api/grades', gradesRouter)
app.use('/api/knowledge', knowledgeRouter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const staticDir = path.join(__dirname, '..', '..', 'dist')
app.use(express.static(staticDir))
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'))
})

getDb()

app.listen(PORT, () => {
  console.log(`Sharon Study running at http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`)
})
