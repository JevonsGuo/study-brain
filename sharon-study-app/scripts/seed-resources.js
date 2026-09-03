import Database from '../server/node_modules/better-sqlite3/lib/index.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dbPath = join(__dirname, '..', 'data', 'test.db')

const db = new Database(dbPath)

const insert = db.prepare('INSERT INTO learning_resources (subject, category, name, desc, url, sort_order) VALUES (?, ?, ?, ?, ?, ?)')

const resources = [
  // 数学
  ['数学', 'video', '一数', '高中数学系统讲解+专题突破', 'https://space.bilibili.com/190099', 1],
  ['数学', 'video', '高中数学蔡老师', '上海高考数学针对性讲解', 'https://search.bilibili.com/all?keyword=上海高考数学', 2],
  ['数学', 'video', '国家智慧教育平台', '教育部官方，课程与教材对应', 'https://www.smart-edu.cn/zone/fxztjc/xueke/xx_sx', 3],
  ['数学', 'practice', '组卷网', '按知识点组卷，含上海高考真题', 'https://www.zujuan.com', 1],
  ['数学', 'practice', '菁优网', '题库+解析，支持按地区筛选', 'https://www.jyeoo.com', 2],
  ['数学', 'tool', 'GeoGebra', '数学动态几何与函数绘图', 'https://www.geogebra.org', 1],
  ['数学', 'tool', 'Desmos', '在线图形计算器', 'https://www.desmos.com/calculator', 2],

  // 物理
  ['物理', 'video', '物理老师', '高中物理系统课程+实验讲解', 'https://search.bilibili.com/all?keyword=高中物理+系统讲解', 1],
  ['物理', 'video', '坤哥物理', '物理模型与解题方法', 'https://search.bilibili.com/all?keyword=坤哥物理', 2],
  ['物理', 'video', '国家智慧教育平台', '教育部官方物理课程', 'https://www.smart-edu.cn/zone/fxztjc/xueke/xx_wl', 3],
  ['物理', 'practice', '组卷网', '物理按知识点组卷', 'https://www.zujuan.com', 1],
  ['物理', 'practice', '菁优网', '物理题库+详细解析', 'https://www.jyeoo.com/physics', 2],
  ['物理', 'tool', 'PhET 互动仿真', '物理实验互动模拟', 'https://phet.colorado.edu/zh_CN/simulations/filter?subjects=physics', 1],
  ['物理', 'tool', 'Algodoo', '2D物理沙盒模拟', 'https://www.algodoo.com', 2],

  // 化学
  ['化学', 'video', '化学超人', '高中化学知识体系+专题', 'https://search.bilibili.com/all?keyword=化学超人+高中', 1],
  ['化学', 'video', '化学老师', '实验演示+方程式精讲', 'https://search.bilibili.com/all?keyword=高中化学+实验', 2],
  ['化学', 'video', '国家智慧教育平台', '教育部官方化学课程', 'https://www.smart-edu.cn/zone/fxztjc/xueke/xx_hx', 3],
  ['化学', 'practice', '组卷网', '化学按知识点组卷', 'https://www.zujuan.com', 1],
  ['化学', 'practice', '菁优网', '化学题库+详细解析', 'https://www.jyeoo.com/chemistry', 2],
  ['化学', 'tool', 'PhET 互动仿真', '化学实验互动模拟', 'https://phet.colorado.edu/zh_CN/simulations/filter?subjects=chemistry', 1],
  ['化学', 'tool', 'Ptable', '互动元素周期表', 'https://ptable.com/?lang=zh-Hans', 2],

  // 英语
  ['英语', 'video', '英语兔', '语法体系+听力训练', 'https://space.bilibili.com/290800966', 1],
  ['英语', 'video', '国家智慧教育平台', '教育部官方英语课程', 'https://www.smart-edu.cn/zone/fxztjc/xueke/xx_yy', 2],
  ['英语', 'practice', '百词斩', '英语词汇记忆', 'https://www.baicizhan.com', 1],
  ['英语', 'tool', 'YouGlish', '真实语境中听发音', 'https://youglish.com', 1],
]

const transaction = db.transaction(() => {
  let count = 0
  for (const r of resources) {
    insert.run(r[0], r[1], r[2], r[3], r[4], r[5])
    count++
  }
  console.log(`Seeded ${count} learning resources`)
})

transaction()
db.close()
