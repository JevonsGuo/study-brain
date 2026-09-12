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

export interface SubjectMeta {
  subject: string
  emoji: string
  slogan: string
  edition: string
  color: string
  gradient: string
  previewTopics: string[]
}

export const SUBJECT_METAS: Record<string, SubjectMeta> = {
  数学: {
    subject: '数学',
    emoji: '📐',
    slogan: '10大高考核心专题 · 55个高分提分点',
    edition: '沪教版 (2020)',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    previewTopics: ['函数与反函数', '平面解析几何', '导数及其应用', '数列与归纳法', '空间向量与立几', '二阶行列式']
  },
  物理: {
    subject: '物理',
    emoji: '⚡',
    slogan: '力学模型 · 电磁感应 · 气体状态与近代物理',
    edition: '沪科版',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    previewTopics: ['牛顿定律与动力学', '平抛与圆周临界', '动能定理与动量守恒', '静电场与闭合电路', '电磁感应与双棒', '气体定律与光电效应']
  },
  化学: {
    subject: '化学',
    emoji: '🧪',
    slogan: '反应原理 · 水溶液平衡 · 物质结构与有机合成',
    edition: '沪教版',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    previewTopics: ['离子反应与氧化还原', '化学平衡常数与反应热', '水溶液三大守恒与Ksp', '原电池与电解池', '物质结构与杂化晶胞', '有机合成与同分异构']
  },
  生物: {
    subject: '生物',
    emoji: '🧬',
    slogan: '分子细胞 · 遗传进化 · 稳态调节与生物工程',
    edition: '沪科教版',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    previewTopics: ['蛋白质与光合呼吸', '孟德尔定律与伴性遗传', 'DNA复制与中心法则', '神经体液免疫调节', '种群增长与生态系统', '基因工程与单克隆抗体']
  },
  语文: {
    subject: '语文',
    emoji: '📜',
    slogan: '古诗文名篇 · 文言虚实词句式 · 哲理思辨写作',
    edition: '统编版',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    previewTopics: ['唐宋诗词名篇意象', '先秦诸子说理文风', '120实词与特殊句式', '现代文思辨逻辑链', '上海独家哲理思辨作文']
  },
  英语: {
    subject: '英语',
    emoji: '🌍',
    slogan: '语法核心体系 · 长难句突破 · 概要写作提分大招',
    edition: '上外版',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    previewTopics: ['时态语态与三大从句', '非谓语动词系统精解', '独立主格与虚拟语气', '倒装句与强调句型', '概要写作(Summary)提分', '十一选十词性矩阵']
  },
  政治: {
    subject: '政治',
    emoji: '⚖️',
    slogan: '中国特色社会主义 · 市场经济 · 哲学思辨与法律生活',
    edition: '统编版',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    previewTopics: ['科学社会主义中国实践', '市场经济与高质量发展', '全过程人民民主与法治', '辩证唯物论与矛盾分析', '国际政治与人类命运', '民事权利与诉讼举证']
  },
  历史: {
    subject: '历史',
    emoji: '🏛️',
    slogan: '中华文明源流 · 中外历史纲要 · 国家制度与社会治理',
    edition: '统编版',
    color: '#d97706',
    gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
    previewTopics: ['先秦分封宗法与秦汉一统', '隋唐盛世与两税法改革', '辛亥革命与新民主主义', '世界古代文明与新航路', '两次工业革命与冷战', '古代选官制度与监察']
  },
  地理: {
    subject: '地理',
    emoji: '🗺️',
    slogan: '自然地理运动 · 人文区位 · 区域协同与长三角战略',
    edition: '沪教版',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
    previewTopics: ['地球运动地方时与太阳高度', '大气受热过程与热力环流', '常见天气系统与气候洋流', '地表形态与山地自然带', '城镇化与产业区位选择', '长三角一体化国家战略']
  }
}

export const PHY_GAOKAO_TOPICS: GaokaoTopic[] = [
  {
    id: 'phy-t1',
    subject: '物理',
    name: '专题一：质点运动学与匀变速直线运动',
    shortName: '直线运动与推论',
    tag: '力学基石',
    icon: '🏃',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    desc: '质点模型与速度加速度 · 匀变速直线运动三大公式与五大推论 · 纸带测加速度与相遇追及问题',
    match: p => p.chapter.startsWith('1.') || p.chapter.startsWith('2.') || p.title.includes('质点') || p.title.includes('匀变速')
  },
  {
    id: 'phy-t2',
    subject: '物理',
    name: '专题二：相互作用与牛顿运动定律',
    shortName: '相互作用与牛顿定律',
    tag: '动力学核心',
    icon: '⚖️',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    desc: '重力弹力摩擦力微观机制 · 力的合成与正交分解 · 牛顿第二定律瞬时性与两类动力学动力问题',
    match: p => p.chapter.startsWith('3.') || p.chapter.startsWith('4.') || p.title.includes('牛顿') || p.title.includes('正交分解')
  },
  {
    id: 'phy-t3',
    subject: '物理',
    name: '专题三：抛体运动、圆周与天体引力',
    shortName: '抛体圆周与天体',
    tag: '高考高频',
    icon: '🪐',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    desc: '平抛运动轨迹与偏转角 · 竖直平面圆周运动轻绳轻杆临界 · 开普勒定律与万有引力天体变轨',
    match: p => p.chapter.startsWith('5.') || p.chapter.startsWith('6.') || p.title.includes('平抛') || p.title.includes('圆周') || p.title.includes('万有引力')
  },
  {
    id: 'phy-t4',
    subject: '物理',
    name: '专题四：机械能守恒与动量守恒',
    shortName: '机械能与动量守恒',
    tag: '能量动量',
    icon: '💥',
    color: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    desc: '动能定理功与动能 · 机械能守恒定律判定 · 动量定理与动量守恒定律（弹性/完全非弹性碰撞模型）',
    match: p => p.chapter.includes('动能定理') || p.chapter.includes('动量') || p.title.includes('动能') || p.title.includes('动量')
  },
  {
    id: 'phy-t5',
    subject: '物理',
    name: '专题五：静电场与恒定闭合电路',
    shortName: '静电场与闭合电路',
    tag: '电场电路',
    icon: '⚡',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    desc: '电场强度与电势差综合 · 带电粒子在匀强电场中偏转 · 闭合电路欧姆定律 · 伏安法测电阻与电源内阻',
    match: p => p.chapter.includes('静电场') || p.chapter.includes('电路') || p.title.includes('电场') || p.title.includes('电路')
  },
  {
    id: 'phy-t6',
    subject: '物理',
    name: '专题六：磁场、电磁感应与交变电流',
    shortName: '磁场与电磁感应',
    tag: '综合压轴',
    icon: '🧲',
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    desc: '洛伦兹力与质谱仪圆周 · 楞次定律与法拉第电磁感应 · 双棒切割动态收尾速度 · 理想变压器与远距离输电',
    match: p => p.chapter.includes('电磁感应') || p.chapter.includes('交变电流') || p.chapter.includes('磁场') || p.chapter.includes('电磁波') || p.title.includes('磁场') || p.title.includes('电磁感应') || p.title.includes('变压器')
  },
  {
    id: 'phy-t7',
    subject: '物理',
    name: '专题七：气体状态方程、波动与近代物理',
    shortName: '气体热学与近代物理',
    tag: '上海必考',
    icon: '🔬',
    color: '#f97316',
    bgGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    desc: '理想气体状态方程与玻马定律 · 机械波图象与光的折射干涉 · 光电效应爱因斯坦方程 · 原子核衰变与质能方程',
    match: p => p.chapter.includes('热力学') || p.chapter.includes('机械波') || p.chapter.includes('光') || p.chapter.includes('原子') || p.title.includes('气体') || p.title.includes('波') || p.title.includes('光') || p.title.includes('衰变')
  }
]

export const CHEM_GAOKAO_TOPICS: GaokaoTopic[] = [
  {
    id: 'chem-t1',
    subject: '化学',
    name: '专题一：化学计量与分散系胶体',
    shortName: '化学计量与胶体',
    tag: '微观工具',
    icon: '🧪',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    desc: '分散系分类与丁达尔效应 · 物质的量、摩尔质量、气体摩尔体积与 NA 经典陷阱避坑',
    match: p => p.chapter.includes('分散系') || p.chapter.includes('物质的量') || p.title.includes('分散系') || p.title.includes('物质的量')
  },
  {
    id: 'chem-t2',
    subject: '化学',
    name: '专题二：离子反应与氧化还原反应',
    shortName: '离子反应与氧化还原',
    tag: '核心原理',
    icon: '⚡',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    desc: '电解质电离与离子方程式书写 · 氧化还原本质与双线桥升降配平',
    match: p => p.chapter.includes('离子反应') || p.chapter.includes('氧化还原') || p.title.includes('离子') || p.title.includes('氧化还原')
  },
  {
    id: 'chem-t3',
    subject: '化学',
    name: '专题三：元素化合物性质与周期律',
    shortName: '周期律与元素化合物',
    tag: '递变规律',
    icon: '📊',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    desc: '元素周期律与位构性推断 · 硫的循环与浓硫酸强氧化性 · 氨气喷泉与硝酸强氧化性',
    match: p => p.chapter.includes('周期律') || p.chapter.includes('二氧化硫') || p.chapter.includes('氨气') || p.title.includes('周期律') || p.title.includes('硫') || p.title.includes('氨气')
  },
  {
    id: 'chem-t4',
    subject: '化学',
    name: '专题四：化学反应热与化学平衡',
    shortName: '反应热与化学平衡',
    tag: '热力学动力学',
    icon: '⏳',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    desc: '盖斯定律与反应热计算 · 化学反应速率与活化能 · 化学平衡常数 K 与勒夏特列移动规律',
    match: p => p.chapter.includes('热效应') || p.chapter.includes('反应速率') || p.title.includes('反应热') || p.title.includes('化学平衡') || p.title.includes('反应速率')
  },
  {
    id: 'chem-t5',
    subject: '化学',
    name: '专题五：水溶液中的离子平衡三大守恒',
    shortName: '水溶液三大平衡',
    tag: '大题压轴',
    icon: '💧',
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    desc: '弱电解质电离平衡与 pH · 盐类水解与三大守恒定律 · 难溶电解质沉淀溶解平衡与 Ksp 计算',
    match: p => p.chapter.includes('水溶液') || p.title.includes('弱电解质') || p.title.includes('水解') || p.title.includes('沉淀溶解')
  },
  {
    id: 'chem-t6',
    subject: '化学',
    name: '专题六：原电池与电解池电化学',
    shortName: '原电池与电解池',
    tag: '能源科技',
    icon: '🔋',
    color: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    desc: '原电池电极反应与新型化学电源 · 电解池原理、放电顺序与工业精炼电镀',
    match: p => p.chapter.includes('原电池') || p.chapter.includes('电能') || p.title.includes('原电池') || p.title.includes('电解池')
  },
  {
    id: 'chem-t7',
    subject: '化学',
    name: '专题七：微观物质结构与晶体晶胞',
    shortName: '物质结构与晶胞',
    tag: '选考进阶',
    icon: '💎',
    color: '#f97316',
    bgGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    desc: '基态原子核外电子排布洪特规则 · VSEPR理论与轨道杂化 · 四类晶体与晶胞均摊法密度公式',
    match: p => p.book.includes('物质结构') || p.title.includes('原子核外') || p.title.includes('杂化') || p.title.includes('晶体')
  },
  {
    id: 'chem-t8',
    subject: '化学',
    name: '专题八：有机化学基础与合成推断',
    shortName: '有机化学与合成',
    tag: '结构逆推',
    icon: '🧬',
    color: '#6366f1',
    bgGradient: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    desc: '同分异构体分类书写 · 烃及烃的衍生物官能团性质转化 · 有机合成路线设计与逆推法策略',
    match: p => p.book.includes('有机化学') || p.title.includes('同分异构') || p.title.includes('烃') || p.title.includes('官能团') || p.title.includes('合成路线')
  }
]

export const BIO_GAOKAO_TOPICS: GaokaoTopic[] = [
  {
    id: 'bio-t1',
    subject: '生物',
    name: '专题一：分子细胞与细胞代谢',
    shortName: '细胞分子与代谢',
    tag: '生命基础',
    icon: '🔬',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    desc: '蛋白质核酸等生命大分子 · 生物膜流动镶嵌模型与跨膜运输 · 酶ATP与光合呼吸代谢综合',
    match: p => p.book.includes('分子与细胞') || p.title.includes('蛋白质') || p.title.includes('跨膜') || p.title.includes('酶') || p.title.includes('光合作用')
  },
  {
    id: 'bio-t2',
    subject: '生物',
    name: '专题二：细胞分裂与孟德尔遗传定律',
    shortName: '遗传规律与伴性遗传',
    tag: '遗传核心',
    icon: '🧬',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    desc: '有丝减数分裂对比 · 孟德尔分离与自由组合定律9:3:3:1变型 · 伴性遗传与系谱图判定口诀',
    match: p => p.chapter.includes('减数分裂') || p.chapter.includes('分离定律') || p.chapter.includes('自由组合') || p.chapter.includes('伴性遗传') || p.title.includes('分离定律') || p.title.includes('自由组合') || p.title.includes('伴性遗传') || p.title.includes('减数分裂')
  },
  {
    id: 'bio-t3',
    subject: '生物',
    name: '专题三：中心法则与生物进化理论',
    shortName: '中心法则与进化',
    tag: '分子遗传',
    icon: '🔄',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    desc: 'DNA半保留复制与双螺旋 · 转录翻译中心法则全流程 · 现代生物进化理论与基因频率演变',
    match: p => p.chapter.includes('DNA分子的结构') || p.chapter.includes('进化') || p.title.includes('中心法则') || p.title.includes('DNA') || p.title.includes('进化')
  },
  {
    id: 'bio-t4',
    subject: '生物',
    name: '专题四：生命活动稳态调节系统',
    shortName: '生命活动稳态调节',
    tag: '综合大题',
    icon: '🧠',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    desc: '内环境理化性质与稳态机制 · 兴奋传导突触传递 · 血糖体温分级调节 · 特异性免疫 · 植物生长素',
    match: p => p.book.includes('稳态与调节') || p.title.includes('内环境') || p.title.includes('神经') || p.title.includes('体液') || p.title.includes('免疫') || p.title.includes('生长素')
  },
  {
    id: 'bio-t5',
    subject: '生物',
    name: '专题五：种群群落与生态系统保护',
    shortName: '种群与生态系统',
    tag: '宏观生态',
    icon: '🌱',
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    desc: '种群数量特征与JS型增长曲线 · 群落演替结构 · 生态系统能量流动单向递减与碳循环',
    match: p => p.book.includes('生物与环境') || p.title.includes('种群') || p.title.includes('生态系统')
  },
  {
    id: 'bio-t6',
    subject: '生物',
    name: '专题六：现代生物技术与生物工程',
    shortName: '细胞工程与基因工程',
    tag: '工程前沿',
    icon: '🧫',
    color: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    desc: '植物组织培养与单克隆抗体制备 · 基因工程四步曲、工具酶与 PCR 体外扩增',
    match: p => p.book.includes('生物技术与工程') || p.title.includes('细胞工程') || p.title.includes('基因工程')
  }
]

export const CHI_GAOKAO_TOPICS: GaokaoTopic[] = [
  {
    id: 'chi-t0',
    subject: '语文',
    name: '专题：古诗文名篇必背与情境默写',
    shortName: '古诗文名篇必背',
    tag: '高考必背6分',
    icon: '🎙️',
    color: '#e11d48',
    bgGradient: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
    desc: '上海统编教材全套21篇名篇名句背诵库 · 高频情境题眼雷达 · 易错生僻字避坑字库 · 思维脉络图解',
    match: p => p.chapter.includes('必背') || p.title.includes('背诵') || p.title.includes('题眼避坑')
  },
  {
    id: 'chi-t1',
    subject: '语文',
    name: '专题一：古代诗歌鉴赏与名篇意象',
    shortName: '诗词名篇意象',
    tag: '审美鉴赏',
    icon: '📜',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    desc: '李白杜甫唐诗巅峰赏析 · 屈原离骚香草美人精神 · 古代诗歌意象密码体系',
    match: p => !p.chapter.includes('必背') && (p.chapter.includes('唐诗高峰') || p.chapter.includes('诗歌意象') || p.chapter.includes('古代诗歌专题') || p.title.includes('诗') || p.title.includes('离骚') || p.title.includes('名句'))
  },
  {
    id: 'chi-t2',
    subject: '语文',
    name: '专题二：文言文名篇与叙事说理',
    shortName: '文言名篇说理',
    tag: '经典研读',
    icon: '📖',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    desc: '荀子劝学韩愈师说论证逻辑 · 苏轼赤壁赋主客问答 · 鸿门宴叙事波澜与史传文学史家笔法',
    match: p => !p.chapter.includes('必背') && (p.chapter.includes('劝学') || p.chapter.includes('赤壁赋') || p.chapter.includes('鸿门宴') || p.chapter.includes('侍坐') || p.chapter.includes('先秦诸子') || p.chapter.includes('史传文学') || p.chapter.includes('项脊轩志') || p.title.includes('劝学') || p.title.includes('赤壁赋') || p.title.includes('鸿门宴') || p.title.includes('先秦诸子') || p.title.includes('过秦论') || p.title.includes('项脊轩志'))
  },
  {
    id: 'chi-t3',
    subject: '语文',
    name: '专题三：文言实虚词与特殊句式',
    shortName: '文言实虚词句式',
    tag: '文言基础',
    icon: '🔤',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    desc: '120个高频文言实词推断法则 · 18个核心文言虚词用法 · 四大文言倒装句式与断句翻译踩分点',
    match: p => p.title.includes('实词') || p.title.includes('断句') || p.title.includes('句式') || p.title.includes('官职')
  },
  {
    id: 'chi-t4',
    subject: '语文',
    name: '专题四：现代文阅读与小说散文审美',
    shortName: '现代文阅读与审美',
    tag: '阅读理解',
    icon: '🖋️',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    desc: '社科类论述文本思辨链全拆解 · 抒情散文故都的秋意境 · 雷雨祝福戏剧小说叙事视角与人性多维',
    match: p => p.chapter.includes('故都的秋') || p.chapter.includes('雷雨') || p.chapter.includes('祝福') || p.title.includes('现代文阅读') || p.title.includes('散文') || p.title.includes('雷雨') || p.title.includes('祝福')
  },
  {
    id: 'chi-t5',
    subject: '语文',
    name: '专题五：逻辑思维与思辨推理',
    shortName: '逻辑思维与推理',
    tag: '思维品质',
    icon: '💡',
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    desc: '形式逻辑概念与命题推理 · 归纳演绎与常见逻辑谬误识别 · 论述逻辑严密性建构',
    match: p => p.chapter.includes('逻辑与思维') || p.title.includes('逻辑')
  },
  {
    id: 'chi-t6',
    subject: '语文',
    name: '专题六：上海高考特色哲理思辨作文',
    shortName: '哲理思辨作文',
    tag: '70分大招',
    icon: '🏆',
    color: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    desc: '上海卷独家思辨作文思维模型：核心概念界定 · 对立统一辩证剖析 · 情境辨析与层进式论述升华',
    match: p => p.title.includes('哲理思辨作文') || p.title.includes('写作突破')
  }
]

export const ENG_GAOKAO_TOPICS: GaokaoTopic[] = [
  {
    id: 'eng-t1',
    subject: '英语',
    name: '专题一：高中时态语态与主谓一致',
    shortName: '时态语态体系',
    tag: '语法骨架',
    icon: '⏱️',
    color: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    desc: '高中核心八大时态结构特征与时间标志词 · 被动语态特殊结构 · 主谓一致三大黄金法则',
    match: p => p.chapter.includes('时态') || p.chapter.includes('主谓一致') || p.title.includes('时态') || p.title.includes('主谓一致')
  },
  {
    id: 'eng-t2',
    subject: '英语',
    name: '专题二：三大从句与复合句体系',
    shortName: '三大从句精解',
    tag: '从句核心',
    icon: '🔗',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    desc: '限制/非限制定语从句关系代词副词选用 · 主宾表同四大名词性从句 · 九大状语从句引导词及省略',
    match: p => p.chapter.includes('定语从句') || p.chapter.includes('名词性从句') || p.chapter.includes('状语从句') || p.title.includes('定语从句') || p.title.includes('名词性从句') || p.title.includes('状语从句')
  },
  {
    id: 'eng-t3',
    subject: '英语',
    name: '专题三：非谓语动词系统突破',
    shortName: '非谓语动词系统',
    tag: '非谓语体系',
    icon: '🎯',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    desc: 'doing / done 作定语状语的主被动逻辑判断 · 动名词与不定式语义差异及高频固定搭配',
    match: p => p.chapter.includes('非谓语') || p.chapter.includes('动名词') || p.title.includes('非谓语') || p.title.includes('动名词')
  },
  {
    id: 'eng-t4',
    subject: '英语',
    name: '专题四：虚拟语气、独立主格与特殊句式',
    shortName: '虚拟与特殊句式',
    tag: '高分句型',
    icon: '⚡',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    desc: '独立主格与 with 复合结构 · 虚拟语气三大经典模型 · 部分倒装完全倒装 · 强调句型还原法',
    match: p => p.chapter.includes('独立主格') || p.chapter.includes('虚拟') || p.chapter.includes('倒装') || p.chapter.includes('强调') || p.title.includes('独立主格') || p.title.includes('虚拟语气') || p.title.includes('倒装') || p.title.includes('强调')
  },
  {
    id: 'eng-t5',
    subject: '英语',
    name: '专题五：构词法派生与高级修辞',
    shortName: '构词法与高级修辞',
    tag: '词汇修辞',
    icon: '💎',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    desc: '前缀后缀词性派生家族矩阵 · 无灵主语、双重否定与比较级表最高级等高级修辞表达',
    match: p => p.chapter.includes('构词法') || p.chapter.includes('高级修辞') || p.title.includes('构词法') || p.title.includes('修辞')
  },
  {
    id: 'eng-t6',
    subject: '英语',
    name: '专题六：上海高考特色题型专项突破',
    shortName: '上海卷独家大招',
    tag: '上海特色',
    icon: '🌟',
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    desc: '概要写作(Summary Writing)五步提分法 · 十一选十词性矩阵推断 · 完形逻辑链与英汉互译切分重构',
    match: p => p.chapter.includes('语法填空与读后续写') || p.title.includes('概要写作') || p.title.includes('十一选十') || p.title.includes('完形填空') || p.title.includes('英汉互译') || p.title.includes('书面表达')
  }
]

export const POL_GAOKAO_TOPICS: GaokaoTopic[] = [
  {
    id: 'pol-t1',
    subject: '政治',
    name: '专题一：中国特色社会主义发展历程',
    shortName: '中国特色社会主义',
    tag: '思想航标',
    icon: '🇨🇳',
    color: '#ef4444',
    bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    desc: '生产力与生产关系矛盾运动 · 科学社会主义理论与新民主主义革命 · 改革开放与新时代主要矛盾',
    match: p => p.book.includes('中国特色社会主义') || p.title.includes('科学社会主义') || p.title.includes('改革开放')
  },
  {
    id: 'pol-t2',
    subject: '政治',
    name: '专题二：经济与社会高质量发展',
    shortName: '经济与社会发展',
    tag: '经济运行',
    icon: '📈',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    desc: '生产资料公有制与两个毫不动摇 · 社会主义市场经济体制 · 新发展理念与现代化产业体系 · 个人收入分配',
    match: p => p.book.includes('经济与社会') || p.title.includes('生产资料') || p.title.includes('市场经济') || p.title.includes('新发展理念') || p.title.includes('收入分配')
  },
  {
    id: 'pol-t3',
    subject: '政治',
    name: '专题三：政治与法治民主政治制度',
    shortName: '政治与法治体系',
    tag: '政治制度',
    icon: '⚖️',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    desc: '党的领导地位与执政理念 · 人民民主专政国体与全过程人民民主 · 人大与基本政治制度 · 全面依法治国',
    match: p => p.book.includes('政治与法治') || p.title.includes('党的领导') || p.title.includes('人民民主') || p.title.includes('人民代表大会') || p.title.includes('全面依法治国')
  },
  {
    id: 'pol-t4',
    subject: '政治',
    name: '专题四：哲学思辨与辩证唯物论',
    shortName: '哲学思辨方法论',
    tag: '思维智慧',
    icon: '🧠',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    desc: '物质与意识辩证关系 · 联系观与发展观 · 矛盾对立统一与主次矛盾 · 认识论实践真理 · 唯物史观群众路线',
    match: p => p.book.includes('哲学与文化') || p.title.includes('辩证唯物论') || p.title.includes('联系观') || p.title.includes('矛盾') || p.title.includes('实践观') || p.title.includes('历史唯物主义')
  },
  {
    id: 'pol-t5',
    subject: '政治',
    name: '专题五：当代国际政治与经济',
    shortName: '国际政治与多极化',
    tag: '全球视野',
    icon: '🌐',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    desc: '国家本质与国体政体类型 · 世界多极化格局演变 · 国际关系决定性因素与构建人类命运共同体',
    match: p => p.book.includes('当代国际政治与经济') || p.title.includes('国家') || p.title.includes('多极化')
  },
  {
    id: 'pol-t6',
    subject: '政治',
    name: '专题六：法律与生活民事权利维权',
    shortName: '法律与生活维权',
    tag: '法治生活',
    icon: '🛡️',
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    desc: '民事权利与财产物权保护 · 知识产权 · 合同履行与违约责任 · 侵权责任四要件与诉讼举证规则',
    match: p => p.book.includes('法律与生活') || p.title.includes('民事权利') || p.title.includes('侵权') || p.title.includes('诉讼')
  }
]

export const HIS_GAOKAO_TOPICS: GaokaoTopic[] = [
  {
    id: 'his-t1',
    subject: '历史',
    name: '专题一：中华文明起源与先秦秦汉大一统',
    shortName: '先秦诸子与秦汉一统',
    tag: '文明源流',
    icon: '🏛️',
    color: '#d97706',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    desc: '早期中华文明与分封宗法礼乐 · 春秋战国大变革与百家争鸣 · 秦汉大一统中央集权创立与推恩令独尊儒术',
    match: p => p.chapter.includes('早期国家') || p.title.includes('分封') || p.title.includes('商鞅') || p.title.includes('秦汉')
  },
  {
    id: 'his-t2',
    subject: '历史',
    name: '专题二：魏晋隋唐至明清封建盛世演进',
    shortName: '隋唐盛世至明清',
    tag: '制度演进',
    icon: '📜',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    desc: '魏晋政权分立与民族交融 · 隋唐三省六部制科举制与两税法 · 宋代重文抑武与商业革命 · 明清君主专制强化',
    match: p => p.chapter.includes('三国两晋') || p.chapter.includes('辽宋夏金元') || p.chapter.includes('明清') || p.title.includes('隋唐') || p.title.includes('宋代') || p.title.includes('明清')
  },
  {
    id: 'his-t3',
    subject: '历史',
    name: '专题三：近代救亡图存与新中国现代探索',
    shortName: '近代救亡与新中国',
    tag: '民族复兴',
    icon: '🚩',
    color: '#ef4444',
    bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    desc: '晚清危机与辛亥革命推翻帝制 · 新民主主义革命与抗战胜利 · 新中国成立与改革开放现代化伟大成就',
    match: p => p.chapter.includes('晚清') || p.chapter.includes('抗日战争') || p.title.includes('救亡') || p.title.includes('新民主主义') || p.title.includes('新中国')
  },
  {
    id: 'his-t4',
    subject: '历史',
    name: '专题四：世界古代文明与全球航路扩展',
    shortName: '古代世界与新航路',
    tag: '全球视野',
    icon: '🧭',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    desc: '古代文明多元面貌与古希腊民主 · 中古西欧庄园封君封臣制 · 新航路开辟商业革命与早期殖民扩张',
    match: p => p.chapter.includes('古代文明') || p.chapter.includes('中古时期') || p.chapter.includes('走向整体') || p.title.includes('雅典') || p.title.includes('西欧') || p.title.includes('新航路')
  },
  {
    id: 'his-t5',
    subject: '历史',
    name: '专题五：资本主义确立、工业革命与多极化',
    shortName: '资本主义与两次工革',
    tag: '现代转型',
    icon: '🏭',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    desc: '思想解放运动与西方代议制确立 · 两次工业革命世界市场形成与马克思主义诞生 · 两次世界大战与雅尔塔冷战',
    match: p => p.chapter.includes('资本主义制度') || p.chapter.includes('工业革命') || p.chapter.includes('两次世界大战') || p.title.includes('资产阶级') || p.title.includes('工业革命') || p.title.includes('冷战')
  },
  {
    id: 'his-t6',
    subject: '历史',
    name: '专题六：国家制度演变与选官监察治理',
    shortName: '选官监察与制度治理',
    tag: '国家治理',
    icon: '👑',
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    desc: '中国古代世卿世禄察举九品科举选官演变 · 御史台都察院古代监察体制与乡里基层治理社会救济',
    match: p => p.book.includes('国家制度与社会治理') || p.title.includes('选官') || p.title.includes('监察')
  }
]

export const GEO_GAOKAO_TOPICS: GaokaoTopic[] = [
  {
    id: 'geo-t1',
    subject: '地理',
    name: '专题一：地球运动与宇宙环境',
    shortName: '地球运动与光照',
    tag: '自然基础',
    icon: '🌍',
    color: '#14b8a6',
    bgGradient: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
    desc: '自转地方时区时计算与晨昏线判读 · 公转正午太阳高度角变化公式与昼夜长短周年演变',
    match: p => p.chapter.includes('宇宙中的地球') || p.title.includes('自转') || p.title.includes('公转')
  },
  {
    id: 'geo-t2',
    subject: '地理',
    name: '专题二：大气受热、气压带风带与天气系统',
    shortName: '大气环流与天气',
    tag: '大气原理',
    icon: '⛅',
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    desc: '太阳暖大地大地暖大气受热过程 · 三圈环流与季风环流 · 锋面气旋反气旋常见天气系统与气象灾害',
    match: p => p.chapter.includes('大气') || p.title.includes('大气') || p.title.includes('三圈环流') || p.title.includes('天气系统')
  },
  {
    id: 'geo-t3',
    subject: '地理',
    name: '专题三：水循环、地质构造与自然环境整体性',
    shortName: '水体洋流与地质地貌',
    tag: '圈层交互',
    icon: '💧',
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    desc: '水循环环节与洋流地理效应 · 褶皱断层内外力地貌塑造 · 自然环境整体性与垂直地域分异规律',
    match: p => p.chapter.includes('水') || p.chapter.includes('表面形态') || p.chapter.includes('植被') || p.title.includes('水循环') || p.title.includes('地质构造') || p.title.includes('自然带')
  },
  {
    id: 'geo-t4',
    subject: '地理',
    name: '专题四：人口分布、乡村城镇与产业区位',
    shortName: '人口城镇与产业区位',
    tag: '人文地理',
    icon: '🏙️',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    desc: '人口迁移推拉力模型 · 城镇内部功能分区与城镇化特征 · 农业工业主导区位因素评价与交通网规划',
    match: p => p.book === '必修第二册' || p.title.includes('人口') || p.title.includes('城镇') || p.title.includes('农业') || p.title.includes('工业') || p.title.includes('交通')
  },
  {
    id: 'geo-t5',
    subject: '地理',
    name: '专题五：区域生态保护与产业转型协同',
    shortName: '区域生态与资源转型',
    tag: '区域发展',
    icon: '🌲',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    desc: '黄土高原荒漠化等生态脆弱区治理 · 鲁尔区与辽中南资源枯竭转型 · 长江经济带共抓大保护',
    match: p => p.chapter.includes('生态环境') || p.chapter.includes('产业转型') || p.title.includes('生态脆弱') || p.title.includes('转型') || p.title.includes('长江经济带')
  },
  {
    id: 'geo-t6',
    subject: '地理',
    name: '专题六：长三角一体化战略与国家资源安全',
    shortName: '长三角战略与国家安全',
    tag: '上海特色',
    icon: '🚢',
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    desc: '长三角区域一体化高质量发展国家战略 · 上海核心城市辐射带动 · 国家资源环境与双碳海洋安全',
    match: p => p.chapter.includes('区域协调') || p.book.includes('资源、环境与国家安全') || p.title.includes('长三角') || p.title.includes('国家安全')
  }
]

export const SUBJECT_TOPICS_REGISTRY: Record<string, GaokaoTopic[]> = {
  数学: MATH_GAOKAO_TOPICS,
  物理: PHY_GAOKAO_TOPICS,
  化学: CHEM_GAOKAO_TOPICS,
  生物: BIO_GAOKAO_TOPICS,
  语文: CHI_GAOKAO_TOPICS,
  英语: ENG_GAOKAO_TOPICS,
  政治: POL_GAOKAO_TOPICS,
  历史: HIS_GAOKAO_TOPICS,
  地理: GEO_GAOKAO_TOPICS
}

export function getTopicsForSubject(
  subject: string,
  points?: Array<{ title: string; chapter: string; book: string; grade?: string }>
): GaokaoTopic[] {
  if (SUBJECT_TOPICS_REGISTRY[subject]) {
    return SUBJECT_TOPICS_REGISTRY[subject]
  }

  // 兜底：若有自建动态学科，按课本分册或章节聚合
  const pList = points || []
  const chapters = Array.from(new Set(pList.map(p => p.chapter || p.book).filter(Boolean)))
  return chapters.map((ch, idx) => {
    const pal = PALETTE[idx % PALETTE.length]
    return {
      id: `${subject}-t${idx + 1}`,
      subject,
      name: ch,
      shortName: ch.replace(/^第\d+[章|单元|课]\s*/, '').slice(0, 10),
      tag: '核心模块',
      icon: SUBJECT_ICONS[subject] || '📖',
      color: pal.color,
      bgGradient: pal.bg,
      desc: `${subject}学科核心模块 · ${ch}`,
      match: p => p.chapter === ch || (!p.chapter && p.book === ch)
    }
  })
}

export function getBooksForSubject(
  points: Array<{ book: string; grade?: string }>
): Array<{ book: string; count: number }> {
  const bookCount = new Map<string, number>()
  for (const p of points) {
    if (p.book) {
      bookCount.set(p.book, (bookCount.get(p.book) || 0) + 1)
    }
  }

  const getOrder = (b: string): number => {
    if (b.includes('必修第一册') || b.includes('必修上册') || b.includes('必修1')) return 1
    if (b.includes('必修第二册') || b.includes('必修下册') || b.includes('必修2')) return 2
    if (b.includes('必修第三册') || b.includes('必修3')) return 3
    if (b.includes('必修4')) return 4
    if (b.includes('选择性必修第一册') || b.includes('选择性必修上册') || b.includes('选择性必修1')) return 10
    if (b.includes('选择性必修第二册') || b.includes('选择性必修中册') || b.includes('选择性必修2')) return 11
    if (b.includes('选择性必修第三册') || b.includes('选择性必修下册') || b.includes('选择性必修3')) return 12
    if (b.includes('中外历史纲要(上)')) return 1
    if (b.includes('中外历史纲要(下)')) return 2
    if (b.includes('拓展') || b.includes('总复习')) return 20
    return 50
  }

  return Array.from(bookCount.entries())
    .sort((a, b) => getOrder(a[0]) - getOrder(b[0]))
    .map(([book, count]) => ({ book, count }))
}
