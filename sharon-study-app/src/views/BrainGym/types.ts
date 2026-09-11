export type GameId = 'schulte' | 'game2048' | 'sudoku' | 'klotski15' | 'arrow' | 'minesweeper' | 'memory' | 'hanoi'

export type GameStatus = 'playable' | 'coming_soon'

export interface GameMeta {
  id: GameId
  name: string
  subtitle: string
  icon: string
  tags: string[]
  duration: string
  difficulty: string
  status: GameStatus
  desc: string
  color: string
  accentBg: string
}

export interface GameRecord {
  gameId: GameId
  bestScore?: number
  bestTimeMs?: number
  playedCount: number
  lastPlayedAt?: string
}

export const GAMES_CATALOG: GameMeta[] = [
  {
    id: 'schulte',
    name: '舒尔特方格',
    subtitle: '视幅广度 · 极速专注',
    icon: '⚡',
    tags: ['专注力', '视幅训练', '抗疲劳'],
    duration: '15~35 秒',
    difficulty: '★★☆☆☆',
    status: 'playable',
    desc: '飞行员与顶尖学霸经典训练法。在乱序方格中按从小到大极速找出所有数字，瞬间激活大脑视神经与注意力。',
    color: '#eab308',
    accentBg: 'rgba(234, 179, 8, 0.12)'
  },
  {
    id: 'game2048',
    name: '2048',
    subtitle: '数字合成 · 空间推演',
    icon: '🔢',
    tags: ['数字敏感', '空间逻辑', '步骤规划'],
    duration: '2~5 分钟',
    difficulty: '★★★☆☆',
    status: 'playable',
    desc: '经典极简数学滑块。上下左右滑动网格，将相同数字碰撞合并，推演最终达成 2048 乃至更高极限。',
    color: '#f97316',
    accentBg: 'rgba(249, 115, 22, 0.12)'
  },
  {
    id: 'sudoku',
    name: '经典数独',
    subtitle: '排查归纳 · 逻辑推理',
    icon: '🧩',
    tags: ['数理逻辑', '逆向推导', '细致耐心'],
    duration: '3~8 分钟',
    difficulty: '★★★★☆',
    status: 'playable',
    desc: '源自数学巨匠欧拉的逻辑精粹。每行、每列与每个小九宫格填入不重复的 1~9，锻炼极致逻辑排查。',
    color: '#6366f1',
    accentBg: 'rgba(99, 102, 241, 0.12)'
  },
  {
    id: 'klotski15',
    name: '数字华容道',
    subtitle: '空间还原 · 序列调度',
    icon: '🔲',
    tags: ['空间重构', '步骤优化', '全局思维'],
    duration: '1~3 分钟',
    difficulty: '★★★☆☆',
    status: 'playable',
    desc: '4×4 方格中打乱的 15 个木块，利用唯一空隙移回 1~15 秩序。考查极短时间内的空间全局优化。',
    color: '#10b981',
    accentBg: 'rgba(16, 185, 129, 0.12)'
  },
  {
    id: 'arrow',
    name: '见缝插针',
    subtitle: '节奏把控 · 瞬时反应',
    icon: '🎯',
    tags: ['动态捕捉', '瞬时反应', '心流减压'],
    duration: '1~2 分钟',
    difficulty: '★★☆☆☆',
    status: 'playable',
    desc: '旋转核心靶轮与极速插针。找准转速间隙射出针尖，在紧张与节奏中释放学习刷题压力。',
    color: '#ec4899',
    accentBg: 'rgba(236, 72, 153, 0.12)'
  },
  {
    id: 'minesweeper',
    name: '经典扫雷',
    subtitle: '概率推演 · 逻辑排查',
    icon: '💣',
    tags: ['概率推理', '逻辑排除', '细致严谨'],
    duration: '1~3 分钟',
    difficulty: '★★★☆☆',
    status: 'playable',
    desc: '经典益智巅峰。通过方格数字线索推理地雷方位，首击绝对安全，空白智能连锁扩散，锻炼严密逻辑排查。',
    color: '#0ea5e9',
    accentBg: 'rgba(14, 165, 233, 0.12)'
  },
  {
    id: 'memory',
    name: '记忆翻牌',
    subtitle: '瞬间记忆 · 图像映射',
    icon: '🎴',
    tags: ['瞬间记忆', '空间定位', '双连匹配'],
    duration: '1~2 分钟',
    difficulty: '★★☆☆☆',
    status: 'playable',
    desc: '脑科学经典工作记忆训练法。翻开卡片寻找配对的理科学霸专属符号，3D 翻转动效，用最短步数配对所有卡片。',
    color: '#8b5cf6',
    accentBg: 'rgba(139, 92, 246, 0.12)'
  },
  {
    id: 'hanoi',
    name: '汉诺塔',
    subtitle: '递归推演 · 步骤优化',
    icon: '🗼',
    tags: ['递归思想', '全局规划', '逆向推演'],
    duration: '1~4 分钟',
    difficulty: '★★★☆☆',
    status: 'playable',
    desc: '源自印度古老传说的数学递归宝藏。将所有圆盘移至目标柱，大盘绝不可压小盘，探索最优 2ⁿ-1 极限步数。',
    color: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.12)'
  }
]
