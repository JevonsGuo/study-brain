import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join('/Users/jevons/myCode/sharon-study/sharon-study-app', 'data', 'sharon-study.db')
const db = new Database(DB_PATH)

const data = [
  { id: 1, visual: '想象一个万能框：集合就是一个框，把满足条件的东西都装进去。\n用 Venn 图画圈：每个集合就是一个圆圈，圈内的元素属于该集合。\n关键形象：$a \\in A$ — a 在 A 的圈里；$a \\notin A$ — a 在圈外。\n表示法三兄弟：列举法 {1,2,3}、描述法 {x| x>0}、图示法(Venn图)。', url: 'https://www.bilibili.com/video/BV11P411s7dd' },
  { id: 2, visual: 'Venn 图理解子集：小圈在大圈里面 → A⊆B\n真子集：小圈严格在大圈内，不完全重合 → A⊊B\n集合相等：两个圈完全重合 → A=B\n记忆口诀：子集是包含，真子集是真包含少一点，相等是一模一样。', url: 'https://www.bilibili.com/video/BV1J341127SA' },
  { id: 3, visual: 'Venn 图是理解集合运算的最佳工具：\n交集 A∩B：两个圈重叠的部分（公共区域）\n并集 A∪B：两个圈覆盖的全部区域\n补集 ∁ᵤA：全集中圈外的区域\n德摩根定律：$$\\overline{A \\cap B} = \\overline{A} \\cup \\overline{B}$$，$$\\overline{A \\cup B} = \\overline{A} \\cap \\overline{B}$$', url: 'https://www.bilibili.com/video/BV15a411A73y' },
  { id: 4, visual: '箭头法判断：如果 A⇒B，则 A 是 B 的充分条件，B 是 A 的必要条件\n形象理解：充分 = 有它就够了，必要 = 没它不行\n充要条件：A⇔B，两个方向都成立\n小技巧：把条件画成链条，箭头方向=推导方向，沿箭头是充分，逆箭头是必要。', url: 'https://www.bilibili.com/video/BV18W4y1v7PG' },
  { id: 5, visual: '不等号像天平：两边加减同一个数，天平方向不变\n乘以正数方向不变，乘以负数方向反转！\n同向不等式可以相加，但不能相减\n关键图像：在数轴上表示不等式，> 向右画，< 向左画，实心=含等号，空心=不含。', url: 'https://www.bilibili.com/video/BV1FRutzXEKd' },
  { id: 6, visual: '几何意义：圆中直径 ≥ 弦长，均值不等式的几何直观\n$$a+b \\geq 2\\sqrt{ab} \\quad (a>0, b>0)$$\n等号成立条件：a = b 时取等\n图形记忆：画一个矩形，面积=ab，周长最短时是正方形(a=b)\n应用三步曲：一正(各量为正) → 二定(积或和为定值) → 三相等(验证等号成立)。', url: 'https://www.bilibili.com/video/BV1yXbFeBE13' },
  { id: 7, visual: '图像法是核心！先画抛物线 $y = ax^2+bx+c$，看开口方向和与x轴交点\n口诀：大于取两边，小于取中间\n三个根的情形：Δ>0 两交点，Δ=0 一个交点，Δ<0 无交点\n对应图像：开口向上时，>0 取交点外侧，<0 取交点内侧。', url: 'https://www.bilibili.com/video/BV1oNxszjE99' },
  { id: 8, visual: '函数 = 加工机：输入x → 机器f → 输出y=f(x)\n关键要素：定义域(允许的输入)、对应法则(加工规则)、值域(所有可能的输出)\n形象比喻：自助饮料机——投币(定义域)→选饮料(对应法则)→出饮料(值域)\n每个x只能对应一个y（唯一性），但多个x可以对应同一个y。', url: 'https://www.bilibili.com/video/BV1ge4y1S7ta' },
  { id: 9, visual: '图像直观看：从左到右往上走=递增，往下走=递减\n定义法证明三步：取值→作差→定号\n$x_1 < x_2$ 时 $f(x_1) < f(x_2)$ → 递增\n记忆：增函数像爬坡，减函数像下坡\n注意：单调性必须在定义域的某个区间内讨论，脱离区间谈单调性无意义。', url: 'https://www.bilibili.com/video/BV1Na8m6QEpU' },
  { id: 10, visual: '图像特征：偶函数关于y轴对称(左右镜像)，奇函数关于原点对称(旋转180°重合)\n判断公式：f(-x)=f(x) → 偶；f(-x)=-f(x) → 奇\n口诀：偶看对称轴，奇看对称心\n注意：定义域必须关于原点对称，否则既不是奇函数也不是偶函数\n特例：f(x)=0 既是奇函数又是偶函数。', url: 'https://www.bilibili.com/video/BV1TE8FzKEMG' },
  { id: 11, visual: '指数函数图像记忆：$y=a^x$(a>1) 从左下到右上，始终过(0,1)点\n底数 a>1 时递增，0<a<1 时递减\n关键特征：恒过定点(0,1)，值域(0,+∞)，永远在x轴上方\n图像对比：底数越大，递增越陡；底数越小(接近0)，递减越陡\n运算法则：$a^m \\cdot a^n = a^{m+n}$，$(a^m)^n = a^{mn}$', url: 'https://www.bilibili.com/video/BV1LU4y1h7z5' },
  { id: 12, visual: '对数 = 指数的逆运算：若 $a^b = N$，则 $b = \\log_a N$\n图像与指数函数关于 y=x 对称\n重要恒等式：$a^{\\log_a N} = N$，$\\log_a a = 1$，$\\log_a 1 = 0$\n换底公式：$\\log_a b = \\frac{\\ln b}{\\ln a}$\n记忆：对数函数是指数函数的镜像，它们互为反函数。', url: 'https://www.bilibili.com/video/BV1QnUjBXEgo' },
  { id: 13, visual: '幂函数族：$y = x^\\alpha$，α不同图像不同\n五种经典图像：α=1 直线，α=2 抛物线，α=3 立方曲线，α=½ 根号曲线，α=-1 双曲线\n共同特征：都过(1,1)点\n第一象限规律：α>0 递增过原点，α<0 递减不过原点\n对比：指数函数底数是常数变量在指数，幂函数变量在底数指数是常数。', url: 'https://www.bilibili.com/video/BV1xv411L77D' },
  { id: 14, visual: '角度→弧度：想象钟表的指针旋转\n$1° = \\frac{\\pi}{180}$ 弧度，$\\pi$ 弧度 = 180°\n弧长公式：$l = |\\alpha| \\cdot r$，扇形面积：$S = \\frac{1}{2}|\\alpha|r^2$\n正角=逆时针转，负角=顺时针转，零角=没转\n象限角判断：终边落在第几象限就是第几象限角。', url: 'https://www.bilibili.com/video/BV12B4y1K7Fa' },
  { id: 15, visual: '单位圆是核心工具：在单位圆上，角的终边交点坐标(cosα, sinα)\n八个基本关系(同角三角函数关系)：\n平方关系：$$\\sin^2\\alpha + \\cos^2\\alpha = 1$$\n商数关系：$\\tan\\alpha = \\frac{\\sin\\alpha}{\\cos\\alpha}$\n倒数关系：$\\tan\\alpha \\cdot \\cot\\alpha = 1$\n记忆六边形：对角线两端=倒数，上方两数平方和=下方平方，相邻三数=中间等于两旁之积。', url: 'https://www.bilibili.com/video/BV1w64y1R7iv' },
  { id: 16, visual: '正弦曲线 = 波浪线：$y=\\sin x$ 在[-1,1]间上下波动\n五点作图法：0, π/2, π, 3π/2, 2π 五个关键点连线\n周期：$T = \\frac{2\\pi}{\\omega}$\n振幅A、平移φ、周期ω 三参数控制图像变换\n变换口诀：先平移后伸缩 vs 先伸缩后平移，结果不同！\n$y=A\\sin(\\omega x+\\varphi)$：ω影响周期，φ影响左右平移，A影响振幅。', url: 'https://www.bilibili.com/video/BV1RN4y1x7D2' },
  { id: 17, visual: '核心公式：\n$$\\sin(\\alpha \\pm \\beta) = \\sin\\alpha\\cos\\beta \\pm \\cos\\alpha\\sin\\beta$$\n$$\\cos(\\alpha \\pm \\beta) = \\cos\\alpha\\cos\\beta \\mp \\sin\\alpha\\sin\\beta$$\n辅助角公式：$a\\sin x + b\\cos x = \\sqrt{a^2+b^2}\\sin(x+\\varphi)$\n记忆技巧：正弦和差=正余交叉(sccs)，余弦和差=余余正正(ccss)，符号看余弦项。', url: 'https://www.bilibili.com/video/BV1eb4y1k7RX' },
  { id: 18, visual: '等差数列 = 阶梯：每一项比前一项多固定的d(公差)\n通项公式：$a_n = a_1 + (n-1)d$\n前n项和：$S_n = \\frac{n(a_1+a_n)}{2} = na_1 + \\frac{n(n-1)}{2}d$\n图像特征：散点图呈直线排列\n对称美：$a_1+a_n = a_2+a_{n-1} = ...$，首尾等距项之和相等。', url: 'https://www.bilibili.com/video/BV1KN4y1e7S5' },
  { id: 19, visual: '等比数列 = 雪球：每一项是前一项的q倍(公比)\n通项公式：$a_n = a_1 \\cdot q^{n-1}$\n前n项和：$S_n = \\frac{a_1(1-q^n)}{1-q}$（q≠1）\n图像特征：q>1 散点图指数增长，0<q<1 指数衰减\n注意：q=1 时所有项相等，S_n=na_1', url: 'https://www.bilibili.com/video/BV1iN411j7qT' },
  { id: 20, visual: '四大求和方法：\n1. 公式法：等差/等比直接用公式\n2. 裂项相消：$\\frac{1}{n(n+1)} = \\frac{1}{n} - \\frac{1}{n+1}$，中间项抵消\n3. 错位相减：等差×等比型，$S_n$ 减 $qS_n$ 消项\n4. 分组求和：正负交替或可拆分成已知数列\n裂项关键：把一项拆成两项之差，让中间项自相抵消。', url: 'https://www.bilibili.com/video/BV1f6kbY4EaG' },
  { id: 21, visual: '向量 = 有方向的箭头：有大小(长度)有方向\n加法：首尾相接，首尾连(三角形法则)；或平行四边形法则\n减法：共起点，连终点，指被减\n数乘：$\\lambda\\vec{a}$ 缩放长度，λ<0时反向\n共线定理：$\\vec{b} = \\lambda\\vec{a}$ ⇔ a,b共线(a≠0)', url: 'https://www.bilibili.com/video/BV1ZsXDYVEAW' },
  { id: 22, visual: '数量积 = 投影×长度：$\\vec{a}\\cdot\\vec{b} = |\\vec{a}||\\vec{b}|\\cos\\theta$\n几何意义：一个向量在另一个向量方向上的投影与长度的乘积\n重要性质：$\\vec{a} \\perp \\vec{b} \\Leftrightarrow \\vec{a}\\cdot\\vec{b}=0$\n坐标运算：$\\vec{a}\\cdot\\vec{b} = x_1x_2 + y_1y_2$\n注意：数量积是标量不是向量！不满足结合律！', url: 'https://www.bilibili.com/video/BV1JU4y1H7rg' },
  { id: 23, visual: '五种形式互化：\n点斜式：$y-y_0 = k(x-x_0)$\n斜截式：$y = kx+b$\n两点式：由两点确定\n截距式：由x、y截距确定\n一般式：$Ax+By+C=0$\n斜率是灵魂：k=tanα，反映直线倾斜程度\n两直线平行⇔斜率相等，垂直⇔斜率之积=-1', url: 'https://www.bilibili.com/video/BV1pb421n78Z' },
  { id: 24, visual: '标准方程：$(x-a)^2+(y-b)^2=r^2$，圆心(a,b)，半径r\n一般方程：$x^2+y^2+Dx+Ey+F=0$，需 $D^2+E^2-4F>0$\n配方是一般→标准的桥梁\n几何法求圆方程：找圆心+半径\n点与圆关系：代入方程，>0 在外，=0 在上，<0 在内', url: 'https://www.bilibili.com/video/BV1Ef421B7PJ' },
  { id: 25, visual: '椭圆 = 被压扁的圆：到两焦点距离之和=2a(常数)\n标准方程：$\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$(a>b>0)\n焦点在长轴上：$c^2 = a^2 - b^2$\n离心率：$e = \\frac{c}{a}$(0<e<1)，e越接近1越扁\n参数方程：$x=a\\cos\\theta, y=b\\sin\\theta$', url: 'https://www.bilibili.com/video/BV11e2qYME9k' },
  { id: 26, visual: '双曲线 = 反向椭圆：到两焦点距离之差=2a(常数)\n标准方程：$\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$\n关键区别：$c^2 = a^2 + b^2$（注意是加号！与椭圆相反）\n渐近线：$y = \\pm\\frac{b}{a}x$，双曲线无限接近但不相交\n离心率：$e = \\frac{c}{a}$(e>1)，e越大开口越宽', url: 'https://www.bilibili.com/video/BV1NN4y1A7C1' },
  { id: 27, visual: '抛物线 = 到焦点=到准线距离\n标准方程四种形式：\n$y^2=2px$(开口向右)，$y^2=-2px$(向左)\n$x^2=2py$(开口向上)，$x^2=-2py$(向下)\n焦点：($\\frac{p}{2}$, 0)，准线：$x=-\\frac{p}{2}$\n焦点弦重要结论：$|AF|+|BF|=x_A+x_B+p$\n光学性质：平行光经抛物面反射汇聚于焦点。', url: 'https://www.bilibili.com/video/BV1MP41137Yw' },
  { id: 28, visual: '导数 = 瞬时变化率 = 切线斜率\n几何意义：函数图像在某点的切线斜率\n定义：$$f\'(x_0) = \\lim_{\\Delta x \\to 0}\\frac{f(x_0+\\Delta x)-f(x_0)}{\\Delta x}$$\n基本求导法则：\n$(x^n)\' = nx^{n-1}$，$(e^x)\' = e^x$，$(\\ln x)\' = \\frac{1}{x}$\n链式法则：复合函数逐层求导\n图像理解：越陡→导数绝对值越大，平缓→导数接近0。', url: 'https://www.bilibili.com/video/BV1iZ421y71z' },
  { id: 29, visual: '三大应用：\n1. 求单调性：f\'(x)>0 → 增，f\'(x)<0 → 减\n2. 求极值：f\'(x)=0 且两侧变号 → 极值点\n3. 求最值：比较极值与端点值\n极值≠最值：极值是局部的，最值是全局的\n优化问题：建目标函数→求导→令f\'(x)=0→验证\n零点问题：用导数研究函数图像与x轴交点个数。', url: 'https://www.bilibili.com/video/BV1im411d7Eu' },
  { id: 30, visual: '概率 = 频率的稳定值\n古典概型：等可能事件，$P(A) = \\frac{n(A)}{n(\\Omega)}$\n互斥事件：不能同时发生，$P(A+B) = P(A)+P(B)$\n对立事件：必有一个发生，$P(\\overline{A}) = 1-P(A)$\n独立事件：互不影响，$P(AB) = P(A) \\cdot P(B)$\n条件概率：$P(A|B) = \\frac{P(AB)}{P(B)}$\n树状图和列表法是求概率的两大工具。', url: 'https://www.bilibili.com/video/BV1E34y1x7cL' },
  { id: 31, visual: '三大统计量：\n平均数：$\\bar{x} = \\frac{1}{n}\\sum x_i$，代表整体水平\n方差：$s^2 = \\frac{1}{n}\\sum(x_i-\\bar{x})^2$，衡量波动大小\n标准差：$s = \\sqrt{s^2}$，与原数据同单位\n抽样方法：简单随机抽样、系统抽样、分层抽样\n频率分布直方图：面积=频率，总面积=1\n用样本估计总体是统计的核心思想。', url: 'https://www.bilibili.com/video/BV147411K7xu' },
  { id: 32, visual: '三大类几何体：\n多面体：棱柱、棱锥、棱台\n旋转体：圆柱、圆锥、圆台、球\n三视图：正视图、侧视图、俯视图 → 还原立体图形\n体积公式：\n柱体 $V=Sh$，锥体 $V=\\frac{1}{3}Sh$\n球 $V=\\frac{4}{3}\\pi r^3$，表面积 $S=4\\pi r^2$\n展开图是求表面积的利器。', url: 'https://www.bilibili.com/video/BV1YgzTBTEGf' },
  { id: 33, visual: '两大关系：\n平行：线线平行 → 线面平行 → 面面平行\n垂直：线线垂直 → 线面垂直 → 面面垂直\n判定与性质互为逆用：判定由低维到高维，性质由高维到低维\n线面平行判定：面外一条线与面内一条线平行→线面平行\n线面垂直判定：一条线与面内两条相交线都垂直→线面垂直\n三垂线定理是解角度问题的核心工具。', url: 'https://www.bilibili.com/video/BV1m4421U7pC' },
  { id: 34, visual: '复数 = 实部+虚部：$z = a+bi$(a,b∈R)\ni 的魔力：$i^2=-1$，这是虚数世界的基本法则\n四则运算：类似多项式运算，遇到i²就替换为-1\n几何表示：复平面上，实部=x坐标，虚部=y坐标\n模：$|z|=\\sqrt{a^2+b^2}$，就是到原点的距离\n共轭复数：实部相同虚部取反，$\\bar{z}=a-bi$\n除法技巧：分子分母同乘分母的共轭复数。', url: 'https://www.bilibili.com/video/BV1CR4y1F7Ca' }
]

const stmt = db.prepare('UPDATE knowledge_points SET visual_desc = ?, video_url = ? WHERE id = ?')
let updated = 0
for (const item of data) {
  const result = stmt.run(item.visual, item.url, item.id)
  if (result.changes > 0) updated++
}
console.log(`Updated ${updated} knowledge points`)
db.close()
