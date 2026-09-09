export interface TextbookBook {
  id: string
  grade: '高一' | '高二' | '高三'
  name: string
  subtitle: string
  coverImg?: string
  coverColor?: string
  coverAccent?: string
  pattern?: string
  chapters: string[]
}

export interface SubjectTextbook {
  subject: string
  edition: string
  publisher: string
  emoji: string
  color: string
  gradient: string
  desc: string
  books: TextbookBook[]
}

export const SHANGHAI_TEXTBOOK_CATALOG: SubjectTextbook[] = [
  {
    subject: '数学',
    edition: '沪教版 (2020)',
    publisher: '上海教育出版社',
    emoji: '📐',
    color: '#409eff',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    desc: '函数·几何·概率·代数',
    books: [
      {
        id: 'math-r1',
        grade: '高一',
        name: '必修第一册',
        subtitle: '集合与逻辑 · 等式与不等式 · 幂指对 · 函数性质与应用 · 反函数',
        coverImg: '/covers/math-r1.jpg',
        chapters: [
          '第1章 集合与逻辑',
          '1.1 集合初步',
          '1.2 常用逻辑用语',
          '第2章 等式与不等式',
          '2.1 等式与不等式的性质',
          '2.2 不等式的求解',
          '2.3 基本不等式及其应用',
          '第3章 幂、指数与对数',
          '3.1 幂与指数',
          '3.2 对数',
          '第4章 幂函数、指数函数与对数函数',
          '4.1 幂函数',
          '4.2 指数函数与对数函数',
          '第5章 函数的概念、性质及应用',
          '5.1 函数的概念与表示',
          '5.2 函数的基本性质',
          '5.3 函数的应用',
          '5.4 反函数'
        ]
      },
      {
        id: 'math-r2',
        grade: '高一',
        name: '必修第二册',
        subtitle: '三角函数 · 平面向量 · 复数',
        coverImg: '/covers/math-r2.jpg',
        chapters: [
          '第6章 三角',
          '6.1 任意角与弧度制',
          '6.2 三角函数的定义与图象',
          '6.3 诱导公式与恒等变换',
          '6.4 正弦定理与余弦定理',
          '第7章 平面向量',
          '7.1 平面向量概念与运算',
          '7.2 平面向量的坐标与数量积',
          '第8章 复数',
          '8.1 复数基础与运算'
        ]
      },
      {
        id: 'math-r3',
        grade: '高二',
        name: '必修第三册',
        subtitle: '空间几何体 · 线面关系 · 空间向量 · 概率统计',
        coverImg: '/covers/math-r3.jpg',
        chapters: [
          '第9章 空间向量与立体几何初步',
          '9.1 空间几何体的结构与外接球模型',
          '9.2 空间位置关系与平行垂直判定',
          '9.3 空间向量与立体几何',
          '第10章 概率与统计初步',
          '10.1 抽样方法与样本分布估计',
          '10.2 概率与古典概型',
          '10.3 事件的相互独立性'
        ]
      },
      {
        id: 'math-sr1',
        grade: '高二',
        name: '选择性必修第一册',
        subtitle: '空间向量与立体几何 · 平面解析几何',
        chapters: [
          '第七章 解析几何',
          '7.1 直线与圆',
          '7.2 椭圆与双曲线',
          '7.3 抛物线与焦点弦',
          '7.4 圆锥曲线综合大招'
        ]
      },
      {
        id: 'math-sr2',
        grade: '高二',
        name: '选择性必修第二册',
        subtitle: '数列 · 一元函数的导数及其应用',
        chapters: [
          '第四章 数列',
          '4.1 等差与等比数列',
          '4.2 数列通项与求和技巧',
          '4.3 数学归纳法及其应用',
          '第五章 一元函数的导数及其应用',
          '5.1 导数几何意义与切线',
          '5.2 单调性讨论与极值最值',
          '5.3 恒成立与切线放缩构造'
        ]
      },
      {
        id: 'math-sr3',
        grade: '高三',
        name: '选择性必修第三册',
        subtitle: '计数原理 · 随机变量及其分布',
        chapters: [
          '第六章 计数原理',
          '6.1 排列组合典型模型',
          '6.2 二项式定理及赋值法',
          '第七章 随机变量及其分布',
          '7.1 条件概率与贝叶斯公式',
          '7.2 离散型随机变量分布列与期望方差',
          '7.3 正态分布与成对数据统计'
        ]
      },
      {
        id: 'math-spec',
        grade: '高三',
        name: '高考专题拓展',
        subtitle: '二阶行列式 · 极坐标与参数方程 · 综合压轴',
        chapters: [
          '上海高考特色专项',
          '二阶行列式及其在几何变换中的应用',
          '参数方程与极坐标系在几何题中的应用'
        ]
      }
    ]
  },
  {
    subject: '物理',
    edition: '沪科版',
    publisher: '上海科学技术出版社',
    emoji: '⚡',
    color: '#e6a23c',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    desc: '力学·电磁·光学·近代物理',
    books: [
      {
        id: 'phy-r1',
        grade: '高一',
        name: '必修第一册',
        subtitle: '运动描述 · 匀变速直线运动 · 相互作用 · 牛顿定律',
        coverImg: '/covers/phy-r1.jpg',
        chapters: [
          '第一章 运动的描述',
          '1.1 质点、参考系与位移',
          '1.2 速度与加速度',
          '第二章 匀变速直线运动',
          '2.1 匀变速直线运动基本规律',
          '2.2 自由落体与运动图像',
          '2.3 相遇与追及问题',
          '第三章 相互作用',
          '3.1 重力与弹力(胡克定律)',
          '3.2 静摩擦力与滑动摩擦力',
          '3.3 力的合成与正交分解',
          '3.4 共点力的平衡条件与应用',
          '第四章 牛顿运动定律',
          '4.1 牛顿第一定律与惯性概念',
          '4.2 牛顿第二定律(F=ma)及其应用',
          '4.3 牛顿第三定律与作用反作用',
          '4.4 超重、失重与动力学两类基本问题'
        ]
      },
      {
        id: 'phy-r2',
        grade: '高一',
        name: '必修第二册',
        subtitle: '曲线运动 · 万有引力与航天 · 机械能守恒',
        coverImg: '/covers/phy-r2.jpg',
        chapters: [
          '第五章 曲线运动与圆周运动',
          '5.1 曲线运动条件与运动合成',
          '5.2 平抛运动的规律与分解',
          '5.3 匀速圆周运动、角速度与向心加速度',
          '5.4 向心力来源与生活中的圆周运动',
          '第六章 万有引力与航天',
          '6.1 开普勒行星运动三大定律',
          '6.2 万有引力定律与天体质量测算',
          '6.3 宇宙速度与人造卫星运行规律',
          '第七章 机械能守恒定律',
          '7.1 恒力做功与瞬时功率',
          '7.2 动能定理及其解题技巧',
          '7.3 重力势能、弹性势能与机械能守恒定律'
        ]
      },
      {
        id: 'phy-r3',
        grade: '高二',
        name: '必修第三册',
        subtitle: '静电场 · 恒定电流 · 电磁场与电磁波初步',
        chapters: ['第八章 静电场', '第九章 电路及其应用', '第十章 电磁场与电磁波']
      },
      {
        id: 'phy-sr1',
        grade: '高二',
        name: '选择性必修第一册',
        subtitle: '动量守恒 · 机械振动与波 · 光的折射与波动',
        chapters: ['第一章 动量守恒定律', '第二章 机械振动', '第三章 机械波', '第四章 光的波动性']
      },
      {
        id: 'phy-sr2',
        grade: '高二',
        name: '选择性必修第二册',
        subtitle: '电磁感应 · 交变电流 · 传感器',
        chapters: ['第五章 电磁感应定律', '第六章 交变电流', '第七章 传感器及应用']
      },
      {
        id: 'phy-sr3',
        grade: '高三',
        name: '选择性必修第三册',
        subtitle: '热力学定律 · 原子物理与波粒二象性',
        chapters: ['第八章 热力学定律', '第九章 原子与原子核', '高考物理综合专题']
      }
    ]
  },
  {
    subject: '化学',
    edition: '沪教版',
    publisher: '上海教育出版社',
    emoji: '🧪',
    color: '#f56c6c',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    desc: '微观结构·元素化学·化学平衡',
    books: [
      {
        id: 'chem-r1',
        grade: '高一',
        name: '必修第一册',
        subtitle: '物质及其变化 · 钠与氯 · 物质的量 · 铁化合物',
        coverImg: '/covers/chem-r1.jpg',
        chapters: [
          '第一章 物质及其变化',
          '1.1 物质的分类方法与分散系(胶体)',
          '1.2 电解质电离与离子反应方程式',
          '1.3 氧化还原反应本质与配平',
          '第二章 海水中的重要元素——钠和氯',
          '2.1 金属钠的性质与过氧化钠',
          '2.2 氯气性质、氯水成分与漂白粉',
          '2.3 物质的量、摩尔质量与NA关系',
          '2.4 气体摩尔体积与溶液物质的量浓度配制',
          '第三章 铁及其化合物',
          '3.1 铁的单质与铁氧化物性质',
          '3.2 铁盐与亚铁盐的转化与Fe3+检验'
        ]
      },
      {
        id: 'chem-r2',
        grade: '高一',
        name: '必修第二册',
        subtitle: '物质结构周期律 · 硫与氮循环 · 能量转化',
        coverImg: '/covers/chem-r2.jpg',
        chapters: [
          '第四章 物质结构 元素周期律',
          '4.1 原子结构与核外电子排布规律',
          '4.2 元素周期表结构与元素周期律',
          '4.3 化学键、离子键与共价键辨析',
          '第五章 硫与氮的循环',
          '5.1 二氧化硫的性质与浓硫酸强氧化性',
          '5.2 氨气喷泉实验、铵盐与硝酸强氧化性',
          '5.3 氮氧化物成因与环境保护',
          '第六章 化学反应与能量',
          '6.1 化学反应中的热效应(吸放热判断)',
          '6.2 化学反应速率影响因素与平衡限度',
          '6.3 原电池工作原理与常见化学电源'
        ]
      },
      {
        id: 'chem-sr1',
        grade: '高二',
        name: '选择性必修1 化学反应原理',
        subtitle: '热力学 · 反应速率与平衡 · 离子反应 · 电化学',
        chapters: ['第一章 化学反应的热效应', '第二章 化学反应速率与化学平衡', '第三章 水溶液中的离子反应', '第四章 化学反应与电能']
      },
      {
        id: 'chem-sr2',
        grade: '高二',
        name: '选择性必修2 物质结构与性质',
        subtitle: '原子结构 · 分子结构与性质 · 晶体结构',
        chapters: ['第一章 原子结构与性质', '第二章 分子结构与性质', '第三章 晶体结构与性质']
      },
      {
        id: 'chem-sr3',
        grade: '高三',
        name: '选择性必修3 有机化学基础',
        subtitle: '烃与烃的衍生物 · 生物大分子 · 合成高分子',
        chapters: ['第一章 有机化合物的结构与性质', '第二章 烃类化合物', '第三章 烃的衍生物', '第四章 生物大分子与合成材料']
      }
    ]
  },
  {
    subject: '生物',
    edition: '沪科教版',
    publisher: '上海科技教育出版社',
    emoji: '🧬',
    color: '#85ce61',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    desc: '细胞·遗传·稳态调节·生态',
    books: [
      {
        id: 'bio-r1',
        grade: '高一',
        name: '必修1 分子与细胞',
        subtitle: '组成细胞分子 · 细胞结构与功能 · 细胞代谢 · 增殖与分化',
        coverImg: '/covers/bio-r1.jpg',
        chapters: [
          '第一章 走近细胞与分子',
          '1.1 原核细胞与真核细胞',
          '1.2 细胞中的元素和化合物(水/无机盐/糖脂)',
          '1.3 生命活动的主要承担者——蛋白质与核酸',
          '第二章 细胞的结构与功能',
          '2.1 细胞膜的流动镶嵌模型与物质跨膜运输',
          '2.2 细胞器之间的分工合作与生物膜系统',
          '2.3 细胞核的结构与功能',
          '第三章 细胞的能量供应和利用',
          '3.1 酶的作用与特性',
          '3.2 ATP的结构与细胞呼吸原理',
          '3.3 光合作用的原理及其应用',
          '第四章 细胞的增殖与分化',
          '4.1 有丝分裂过程与有性生殖',
          '4.2 细胞的分化、衰老与凋亡'
        ]
      },
      {
        id: 'bio-r2',
        grade: '高一',
        name: '必修2 遗传与进化',
        subtitle: '孟德尔定律 · 伴性遗传 · 基因表达 · 现代进化论',
        coverImg: '/covers/bio-r2.jpg',
        chapters: [
          '第一章 遗传因子的发现',
          '1.1 孟德尔一对相对性状的杂交实验(分离定律)',
          '1.2 孟德尔两对相对性状的杂交实验(自由组合)',
          '第二章 基因与染色体的关系',
          '2.1 减数分裂与受精作用',
          '2.2 基因在染色体上与伴性遗传规律',
          '第三章 基因的本质与表达',
          '3.1 DNA是主要遗传物质的实验证据',
          '3.2 DNA分子的结构与半保留复制',
          '3.3 遗传信息的转录与翻译(中心法则)',
          '第四章 生物的变异与进化',
          '4.1 基因突变、基因重组与染色体变异',
          '4.2 现代生物进化理论的核心观点'
        ]
      },
      {
        id: 'bio-sr1',
        grade: '高二',
        name: '选择性必修1 稳态与调节',
        subtitle: '内环境 · 神经-体液-免疫调节 · 植物激素',
        chapters: ['第一章 人体的内环境与稳态', '第二章 神经调节', '第三章 体液调节', '第四章 免疫调节', '第五章 植物生命活动的调节']
      },
      {
        id: 'bio-sr2',
        grade: '高二',
        name: '选择性必修2 生物与环境',
        subtitle: '种群与群落 · 生态系统结构与功能 · 环境保护',
        chapters: ['第一章 种群及其动态', '第二章 群落及其演替', '第三章 生态系统及其稳定性', '第四章 人与环境']
      },
      {
        id: 'bio-sr3',
        grade: '高三',
        name: '选择性必修3 生物技术与工程',
        subtitle: '发酵工程 · 细胞工程 · 基因工程 · 生物安全',
        chapters: ['第一章 传统发酵技术', '第二章 细胞工程', '第三章 基因工程', '第四章 生物技术的安全性与伦理']
      }
    ]
  },
  {
    subject: '语文',
    edition: '统编版',
    publisher: '人民教育出版社',
    emoji: '📖',
    color: '#909399',
    gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    desc: '古诗文·现代文·写作·思辨',
    books: [
      {
        id: 'chi-r1',
        grade: '高一',
        name: '必修上册',
        subtitle: '青春情怀 · 劳动之美 · 诗意栖居 · 家乡文化',
        coverImg: '/covers/chi-r1.jpg',
        chapters: [
          '第一单元 青春情怀',
          '1.1 沁园春·长沙意象与情感',
          '第二单元 劳动之美',
          '2.1 喜看稻菽千重浪——人物通讯与叙事技巧',
          '第三单元 古诗文诵读(一)',
          '3.1 短歌行、归园田居与魏晋风骨',
          '3.2 梦游天姥吟留别、登高与唐诗高峰',
          '3.3 琵琶行叙事抒情艺术',
          '第七单元 自然情怀',
          '7.1 故都的秋与现代抒情散文意境',
          '第八单元 古诗文诵读(二)',
          '8.1 劝学、师说与论述文逻辑',
          '8.2 赤壁赋文赋之美与哲思超脱'
        ]
      },
      {
        id: 'chi-r2',
        grade: '高一',
        name: '必修下册',
        subtitle: '中华传统文化 · 戏剧演说 · 史传散文 · 思辨阅读',
        coverImg: '/covers/chi-r2.jpg',
        chapters: [
          '第一单元 中华优秀传统文化',
          '1.1 子路曾皙冉有公西华侍坐与儒家理想',
          '1.2 齐桓晋文之事与孟子仁政学说',
          '第二单元 戏剧与演说',
          '2.1 窦娥冤戏剧情节与悲剧意蕴',
          '2.2 雷雨戏剧冲突与人物性格',
          '第五单元 史传散文',
          '5.1 鸿门宴人物描写与叙事波澜',
          '第六单元 经典小说',
          '6.1 林黛玉进贾府环境与出场艺术',
          '6.2 祝福祥林嫂悲剧与叙述视角'
        ]
      },
      {
        id: 'chi-sr1',
        grade: '高二',
        name: '选择性必修上册',
        subtitle: '诸子散文 · 诗意山河 · 现代长篇研读',
        chapters: ['第一单元 先秦诸子散文', '第二单元 诗歌意象与意境', '第三单元 现当代小说与长篇名著', '第四单元 逻辑与思维']
      },
      {
        id: 'chi-sr2',
        grade: '高二',
        name: '选择性必修中册',
        subtitle: '历史回响 · 科学精神 · 思想之光',
        chapters: ['第一单元 史传文学与家国情怀', '第二单元 科学精神与理性思维', '第三单元 古代文论与文化经典', '第四单元 散文情思']
      },
      {
        id: 'chi-sr3',
        grade: '高三',
        name: '选择性必修下册',
        subtitle: '中华传统典籍 · 外国文学经典 · 高考复习',
        chapters: ['第一单元 古代学术论著研读', '第二单元 外国经典小说', '第三单元 古代诗歌专题', '高考文言文与写作突破']
      }
    ]
  },
  {
    subject: '英语',
    edition: '上外版',
    publisher: '上海外语教育出版社',
    emoji: '🔤',
    color: '#67c23a',
    gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    desc: '词汇·语法·长难句·文化视界',
    books: [
      {
        id: 'eng-r1',
        grade: '高一',
        name: '必修第一册',
        subtitle: '时态体系 · 定语从句 · 构词派生 · 核心高频搭配',
        coverImg: '/covers/eng-r1.jpg',
        chapters: [
          'Unit 1 A New Start',
          '1.1 高中核心英语时态体系总揽(一般现在/过去/进行/完成)',
          'Unit 2 Exploring English',
          '2.1 限制性定语从句(关系代词that/which/who/whose)',
          '2.2 限制性定语从句(关系副词where/when/why)',
          'Unit 3 Family Matters',
          '3.1 英语构词法(前缀、后缀、转化与合成)',
          'Unit 4 Friends Forever',
          '4.1 介词与动词核心高频搭配短语'
        ]
      },
      {
        id: 'eng-r2',
        grade: '高一',
        name: '必修第二册',
        subtitle: '名词性从句 · 非谓语动词 · 状语从句体系',
        coverImg: '/covers/eng-r2.jpg',
        chapters: [
          'Unit 1 Food for Thought',
          '1.1 名词性从句(主语/宾语/表语/同位语从句连接词选择)',
          'Unit 2 Let’s Celebrate!',
          '2.1 非谓语动词系统精解(现在分词doing与过去分词done作定状)',
          'Unit 3 On the Move',
          '3.1 动名词(gerund)与不定式(to do)的核心差异与固定用法',
          'Unit 4 Stage and Screen',
          '4.1 九大状语从句引导词与省略句型'
        ]
      },
      {
        id: 'eng-r3',
        grade: '高二',
        name: '必修第三册',
        subtitle: 'Nature & Wonders · Disaster & Courage · Sea & Beyond',
        chapters: ['Unit 1 Knowing Me, Knowing You', 'Unit 2 Making a Difference', 'Unit 3 The World Meets China', 'Unit 4 Amazing Art']
      },
      {
        id: 'eng-sr1',
        grade: '高二',
        name: '选择性必修第一册',
        subtitle: 'People of Vision · Media & Society · Literature',
        chapters: ['Unit 1 Laugh Out Loud', 'Unit 2 Looking into the Future', 'Unit 3 The Secrets of Life', 'Unit 4 Meeting the Muse']
      },
      {
        id: 'eng-sr2',
        grade: '高二',
        name: '选择性必修第二册',
        subtitle: 'Inventions & Discovery · Sportsmanship · Global Village',
        chapters: ['Unit 1 Breaking Boundaries', 'Unit 2 Bridging Cultures', 'Unit 3 The Spirit of Sports', 'Unit 4 Protecting our Heritage']
      },
      {
        id: 'eng-sr3',
        grade: '高三',
        name: '选择性必修第三册/总复习',
        subtitle: 'Academic Reading · Writing Precision · Gaokao Drill',
        chapters: ['Unit 1 Critical Thinking', 'Unit 2 Advanced Writing', '高考英语语法填空与读后续写专题']
      }
    ]
  },
  {
    subject: '政治',
    edition: '统编版',
    publisher: '人民教育出版社',
    emoji: '📜',
    color: '#ed4014',
    gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
    desc: '中国特色社会主义·经济·政治·哲学',
    books: [
      {
        id: 'pol-r1',
        grade: '高一',
        name: '必修1 中国特色社会主义',
        subtitle: '人类社会发展规律 · 科学社会主义与中国实践',
        chapters: ['第一课 社会主义从空想到科学', '第二课 只有社会主义才能救中国', '第三课 只有中国特色社会主义才能发展中国', '第四课 只有坚持和发展中国特色社会主义才能实现中华民族伟大复兴']
      },
      {
        id: 'pol-r2',
        grade: '高一',
        name: '必修2 经济与社会',
        subtitle: '生产资料所有制 · 市场经济体制 · 新发展理念',
        chapters: ['第一单元 生产资料所有制与经济体制', '第二单元 经济发展与社会进步']
      },
      {
        id: 'pol-r3',
        grade: '高二',
        name: '必修3 政治与法治',
        subtitle: '党的领导 · 人民当家作主 · 全面依法治国',
        chapters: ['第一单元 中国共产党的领导', '第二单元 人民当家作主', '第三单元 全面依法治国']
      },
      {
        id: 'pol-r4',
        grade: '高二',
        name: '必修4 哲学与文化',
        subtitle: '辩证唯物论与认识论 · 唯物史观 · 文化传承',
        chapters: ['第一单元 探索世界与把握规律', '第二单元 认识社会与价值选择', '第三单元 文化传承与文化创新']
      },
      {
        id: 'pol-sr1',
        grade: '高二',
        name: '选择性必修1 当代国际政治与经济',
        subtitle: '国家与政体 · 经济全球化 · 国际组织',
        chapters: ['第一单元 各具特色的国家', '第二单元 世界多极化', '第三单元 经济全球化', '第四单元 国际组织']
      },
      {
        id: 'pol-sr2',
        grade: '高三',
        name: '选择性必修2 法律与生活',
        subtitle: '民事权利 · 合同与侵权 · 婚姻家庭与劳动就业',
        chapters: ['第一单元 民事权利与义务', '第二单元 家庭与婚姻', '第三单元 就业与创业', '第四单元 社会争议解决']
      }
    ]
  },
  {
    subject: '历史',
    edition: '统编版',
    publisher: '人民教育出版社',
    emoji: '🏛️',
    color: '#c45656',
    gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    desc: '中外历史纲要·社会制度·文化交流',
    books: [
      {
        id: 'his-r1',
        grade: '高一',
        name: '中外历史纲要(上)',
        subtitle: '中华文明起源与古代统一国家 · 近代救亡图存 · 现代建设',
        chapters: ['第一单元 中华文明的起源与早期国家', '第二单元 三国两晋南北朝至隋唐', '第三单元 辽宋夏金元', '第四单元 明清封建盛世与危机', '第五单元 晚清危机与辛亥革命', '第六单元 中华民族的抗日战争与解放战争']
      },
      {
        id: 'his-r2',
        grade: '高一',
        name: '中外历史纲要(下)',
        subtitle: '世界古代文明 · 资本主义确立 · 两次世界大战 · 当代格局',
        chapters: ['第一单元 古代文明的产生与发展', '第二单元 中古时期的世界', '第三单元 走向整体的世界', '第四单元 资本主义制度的确立', '第五单元 工业革命与马克思主义', '第六单元 两次世界大战与世界多极化']
      },
      {
        id: 'his-sr1',
        grade: '高二',
        name: '选择性必修1 国家制度与社会治理',
        subtitle: '政治体制 · 官员选拔 · 法律教化 · 基层治理',
        chapters: ['第一单元 国家制度与国家治理', '第二单元 官员的选拔与管理', '第三单元 法律与教化', '第四单元 民族关系与国家关系']
      },
      {
        id: 'his-sr2',
        grade: '高二',
        name: '选择性必修2 经济与社会生活',
        subtitle: '食物生产 · 工业变迁 · 商业贸易 · 城镇发展',
        chapters: ['第一单元 食物生产与社会生活', '第二单元 生产工具与劳作方式', '第三单元 商业贸易与日常生活', '第四单元 村落、城镇与居住环境']
      },
      {
        id: 'his-sr3',
        grade: '高三',
        name: '选择性必修3 文化交流与传播',
        subtitle: '文明多样性 · 人口迁徙与认同 · 商路贸易与文化',
        chapters: ['第一单元 源远流长的中华文化', '第二单元 丰富多样的世界文化', '第三单元 人口迁徙、文化交融与认同', '第四单元 商路、贸易与文化交流']
      }
    ]
  },
  {
    subject: '地理',
    edition: '沪教版',
    publisher: '上海教育出版社',
    emoji: '🌍',
    color: '#2d8cf0',
    gradient: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
    desc: '自然地理·人文空间·区域协同',
    books: [
      {
        id: 'geo-r1',
        grade: '高一',
        name: '必修第一册',
        subtitle: '宇宙与地球 · 地貌 · 大气 · 水体 · 植被土壤',
        chapters: ['第一章 宇宙中的地球', '第二章 地球表面形态', '第三章 地球上的大气', '第四章 地球上的水', '第五章 植被与土壤']
      },
      {
        id: 'geo-r2',
        grade: '高一',
        name: '必修第二册',
        subtitle: '人口与分布 · 城镇化 · 产业区位 · 区域协同发展',
        chapters: ['第一章 人口分布与迁移', '第二章 乡村和城镇', '第三章 区域产业发展', '第四章 交通运输布局与区域发展', '第五章 环境与发展']
      },
      {
        id: 'geo-sr1',
        grade: '高二',
        name: '选择性必修1 自然地理基础',
        subtitle: '地球运动 · 地貌演变 · 大气环流 · 洋流与水分循环',
        chapters: ['第一章 地球的自转与公转', '第二章 地表形态的塑造', '第三章 大气的受热过程与运动', '第四章 水的运动', '第五章 自然环境的整体性与差异性']
      },
      {
        id: 'geo-sr2',
        grade: '高二',
        name: '选择性必修2 区域发展',
        subtitle: '区域生态与保护 · 资源枯竭转型 · 城市群与协同',
        chapters: ['第一章 区域发展战略', '第二章 区域生态环境保护', '第三章 产业转型与资源开发', '第四章 区域协调发展']
      },
      {
        id: 'geo-sr3',
        grade: '高三',
        name: '选择性必修3 资源、环境与国家安全',
        subtitle: '自然资源安全 · 环境安全与风险 · 全球气候治理',
        chapters: ['第一章 自然环境与人类社会', '第二章 资源安全与国家安全', '第三章 环境安全与国家安全', '第四章 保障国家安全的资源、环境战略']
      }
    ]
  }
]

export const getSubjectCatalog = (subject: string): SubjectTextbook | undefined => {
  return SHANGHAI_TEXTBOOK_CATALOG.find(s => s.subject === subject)
}
