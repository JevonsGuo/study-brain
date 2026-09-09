export interface GaokaoTopic {
  id: string
  subject: string
  name: string
  shortName: string
  tag: string
  icon: string
  color: string
  bgGradient: string
  desc: string
  match: (point: { title: string; chapter: string; book: string; grade?: string }) => boolean
}

export const MATH_GAOKAO_TOPICS: GaokaoTopic[] = [
  {
    id: 'math-t1',
    subject: '数学',
    name: '专题一：集合、常用逻辑用语与不等式',
    shortName: '集合与不等式',
    tag: '基础工具',
    icon: '🔣',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    desc: '集合交并补与子集 · 充分必要条件判断 · 基本不等式（均值）最值 · 分式与绝对值不等式',
    match: p => p.book === '必修第一册' && (p.chapter.startsWith('1.') || p.chapter.startsWith('2.'))
  },
  {
    id: 'math-t2',
    subject: '数学',
    name: '专题二：函数概念、性质与反函数',
    shortName: '函数与反函数',
    tag: '高考核心',
    icon: '📈',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    desc: '定义域与求值域六大方法 · 单调奇偶周期性结论大全 · 反函数存在与求法 · 指对幂函数图象性质',
    match: p => p.book === '必修第一册' && (p.chapter.startsWith('3.') || p.chapter.startsWith('4.') || p.chapter.startsWith('5.'))
  },
  {
    id: 'math-t3',
    subject: '数学',
    name: '专题三：三角函数与解三角形',
    shortName: '三角与解三角形',
    tag: '高频考点',
    icon: '📐',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    desc: '终边相同角与弧度制 · 诱导公式与两角和差倍角 · 辅助角公式 · 正余弦定理综合与边角互化',
    match: p => p.book === '必修第二册' && p.chapter.startsWith('6.')
  },
  {
    id: 'math-t4',
    subject: '数学',
    name: '专题四：平面向量与复数',
    shortName: '向量与复数',
    tag: '几何代数化',
    icon: '↗️',
    color: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    desc: '向量共线与基底运算 · 坐标运算与极化恒等式 · 复数的代数四则运算与几何模长最值',
    match: p => p.book === '必修第二册' && (p.chapter.startsWith('7.') || p.chapter.startsWith('8.'))
  },
  {
    id: 'math-t5',
    subject: '数学',
    name: '专题五：数列与数学归纳法',
    shortName: '数列与归纳法',
    tag: '解答题大题',
    icon: '🔢',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    desc: '等差等比通项与求和性质 · 求通项六大核心模型 · 错位相减与裂项求和 · 数学归纳法证明',
    match: p => p.book === '选择性必修第二册' && p.chapter.includes('数列')
  },
  {
    id: 'math-t6',
    subject: '数学',
    name: '专题六：立体几何与空间向量',
    shortName: '立体与空间向量',
    tag: '空间思维',
    icon: '🧊',
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    desc: '外接球三大核心模型 · 线面平行垂直判定定理 · 建系与法向量坐标计算 · 线面角与二面角',
    match: p => p.book === '必修第三册' && (p.chapter.startsWith('9.') || p.chapter.includes('空间') || p.chapter.includes('几何体'))
  },
  {
    id: 'math-t7',
    subject: '数学',
    name: '专题七：平面解析几何',
    shortName: '平面解析几何',
    tag: '压轴攻坚',
    icon: '🎯',
    color: '#ef4444',
    bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    desc: '直线与圆位置关系 · 椭双抛标准方程与几何性质 · 焦半径焦点弦 · 联立韦达弦长面积 · 点差法定点定值',
    match: p => p.book === '选择性必修第一册' || p.chapter.includes('解析几何')
  },
  {
    id: 'math-t8',
    subject: '数学',
    name: '专题八：导数及其应用',
    shortName: '导数及其应用',
    tag: '压轴压阵',
    icon: '⚡',
    color: '#f97316',
    bgGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    desc: '切线方程与导数几何意义 · 单调性含参分类讨论 · 极值最值 · 分离参数法 · 切线放缩与双变量构造',
    match: p => p.book === '选择性必修第二册' && p.chapter.includes('导数')
  },
  {
    id: 'math-t9',
    subject: '数学',
    name: '专题九：计数原理与概率统计',
    shortName: '计数与概率统计',
    tag: '高频应用',
    icon: '🎲',
    color: '#6366f1',
    bgGradient: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    desc: '排列组合典型模型 · 二项式定理与赋值法 · 条件概率与全概率公式 · 离散型分布列与期望方差 · 正态分布',
    match: p => (p.book === '选择性必修第三册') || (p.book === '必修第三册' && (p.chapter.startsWith('10.') || p.chapter.includes('概率')))
  },
  {
    id: 'math-t10',
    subject: '数学',
    name: '专题十：上海高考特色专项',
    shortName: '上海特色拓展',
    tag: '上海特色',
    icon: '🌟',
    color: '#0d9488',
    bgGradient: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
    desc: '二阶行列式与克莱姆法则 · 行列式在图形旋转伸缩中的几何应用 · 极坐标系与参数方程在高考题中的应用',
    match: p => p.book === '高考专题拓展' || p.chapter.includes('特色专项') || p.title.includes('行列式') || p.title.includes('极坐标')
  }
]

const SUBJECT_ICONS: Record<string, string> = {
  物理: '⚡',
  化学: '🧪',
  生物: '🧬',
  语文: '📜',
  英语: '🌍',
  政治: '⚖️',
  历史: '🏛️',
  地理: '🗺️'
}

const PALETTE = [
  { color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' },
  { color: '#10b981', bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' },
  { color: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' },
  { color: '#ec4899', bg: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)' },
  { color: '#8b5cf6', bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' },
  { color: '#06b6d4', bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)' },
  { color: '#f97316', bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)' },
  { color: '#6366f1', bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }
]

export function getTopicsForSubject(
  subject: string,
  points: Array<{ title: string; chapter: string; book: string; grade?: string }>
): GaokaoTopic[] {
  if (subject === '数学') {
    return MATH_GAOKAO_TOPICS
  }

  // 针对其他学科，按课本分册或章节聚合专题模块
  const chapters = Array.from(new Set(points.map(p => p.chapter || p.book).filter(Boolean)))
  return chapters.map((ch, idx) => {
    const pal = PALETTE[idx % PALETTE.length]
    return {
      id: `${subject}-t${idx + 1}`,
      subject,
      name: ch,
      shortName: ch.replace(/^第\d+[章|单元|课]\s*/, '').slice(0, 8),
      tag: '重点模块',
      icon: SUBJECT_ICONS[subject] || '📖',
      color: pal.color,
      bgGradient: pal.bg,
      desc: `${subject}学科核心模块 · ${ch}`,
      match: p => p.chapter === ch || (!p.chapter && p.book === ch)
    }
  })
}
