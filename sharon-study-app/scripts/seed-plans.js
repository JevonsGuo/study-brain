import Database from '../server/node_modules/better-sqlite3/lib/index.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomInt } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dbPath = join(__dirname, '..', 'data', 'sharon-study.db')

const db = new Database(dbPath)

const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

const contents = {
  '语文': ['背诵古诗词', '文言文阅读练习', '作文素材整理', '现代文阅读训练', '字音字形练习', '古诗文默写', '名著阅读笔记', '病句修改练习', '语言运用专项', '议论文写作'],
  '数学': ['完成课后习题1-5', '函数专题练习', '几何证明题训练', '错题本整理', '试卷订正', '数列综合练习', '概率统计复习', '导数应用练习', '三角函数专项', '向量运算练习'],
  '英语': ['背Unit3单词', '完形填空训练', '阅读理解练习', '听力模拟题', '语法填空专项', '作文模板背诵', '英语书法练习', '词组搭配整理', '长难句分析', '时态语态复习'],
  '物理': ['力学综合练习', '电学实验复习', '光学笔记整理', '试卷订正分析', '牛顿定律应用', '电磁感应专题', '电路分析练习', '运动学公式推导', '能量守恒练习', '波动光学复习'],
  '化学': ['有机化学笔记', '化学方程式默写', '元素周期表复习', '实验题专项训练', '氧化还原反应', '化学平衡计算', '离子反应练习', '电化学专题', '物质结构复习', '化学计算训练'],
  '生物': ['细胞结构笔记', '遗传学练习', '生态系统复习', '实验设计训练', '分子生物学笔记', '光合作用专题', '呼吸作用复习', 'DNA复制练习', '基因表达整理', '变异与进化'],
  '历史': ['中国近代史复习', '世界史笔记整理', '历史年表梳理', '材料分析题训练', '古代政治制度', '改革开放专题', '二战影响分析', '文艺复兴笔记', '工业革命复习', '历史论述练习'],
  '地理': ['地图判读训练', '气候类型整理', '区域地理笔记', '自然地理复习', '人文地理专题', '洋流与气候', '地形地貌分析', '城市地理笔记', '农业区位复习', '环境保护专题'],
  '政治': ['经济常识复习', '政治制度笔记', '哲学原理整理', '时政热点分析', '文化生活专题', '辩证法练习', '认识论复习', '价值观笔记', '国际政治经济', '法治建设专题'],
}

const insert = db.prepare('INSERT INTO study_plans (subject, content, date, done) VALUES (?, ?, ?, ?)')

const today = new Date()
const transaction = db.transaction(() => {
  let count = 0
  for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
    const d = new Date(today)
    d.setDate(d.getDate() - dayOffset)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const dayOfWeek = d.getDay()
    if (dayOfWeek === 0) continue

    const numTasks = randomInt(3, 8)
    const usedSubjects = new Set()

    for (let i = 0; i < numTasks; i++) {
      let subject
      do {
        subject = subjects[randomInt(0, subjects.length)]
      } while (usedSubjects.has(subject) && usedSubjects.size < subjects.length)
      usedSubjects.add(subject)

      const pool = contents[subject]
      const content = pool[randomInt(0, pool.length)]

      const doneChance = dayOfWeek === 6 ? 0.5 : 0.75
      const done = Math.random() < doneChance ? 1 : 0

      insert.run(subject, content, dateStr, done)
      count++
    }
  }
  console.log(`Seeded ${count} study plan records for past 30 days`)
})

transaction()
db.close()
