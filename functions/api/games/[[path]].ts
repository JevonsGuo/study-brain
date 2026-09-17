/**
 * Cloudflare Pages Function - 脑力工坊轻量边缘排行榜服务
 * 部署至 Cloudflare Pages 全球 Anycast 边缘网络
 * 采用 Workers KV 存储公开榜单，无集中式服务器数据库，纯边缘极速响应
 */

interface KVNamespace {
  get(key: string, options?: any): Promise<string | null>
  put(key: string, value: string, options?: any): Promise<void>
}

interface EventContext<Env, P extends string = string, Data = Record<string, unknown>> {
  request: Request
  functionPath: string
  waitUntil: (promise: Promise<unknown>) => void
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>
  env: Env
  params: Record<P, string | string[]>
  data: Data
}

type PagesFunction<Env = unknown, P extends string = string, Data = Record<string, unknown>> = (
  context: EventContext<Env, P, Data>
) => Response | Promise<Response>

interface Env {
  SYNC_KV?: KVNamespace
}

export interface LeaderboardEntry {
  rank?: number
  userName: string
  grade?: string
  score?: number
  timeMs?: number
  steps?: number
  displayScore: string
  achievedAt: string
  isSelf?: boolean
}

// 内存兜底存储
const memoryLeaderboards = new Map<string, LeaderboardEntry[]>()

// 全国高中名校学霸标杆基准榜（开局即有浓厚良性自律竞争氛围）
const DEFAULT_BENCHMARKS: Record<string, LeaderboardEntry[]> = {
  schulte: [
    { userName: '清华自律打卡组', grade: '高三', timeMs: 13820, displayScore: '13.82s', achievedAt: '2026-09-17' },
    { userName: '黄冈数学课代表', grade: '高三', timeMs: 15400, displayScore: '15.40s', achievedAt: '2026-09-17' },
    { userName: '海淀理综做题家', grade: '高二', timeMs: 17150, displayScore: '17.15s', achievedAt: '2026-09-16' },
    { userName: '南通一模自律生', grade: '高三', timeMs: 19300, displayScore: '19.30s', achievedAt: '2026-09-16' },
    { userName: '衡水早读先锋', grade: '高一', timeMs: 21600, displayScore: '21.60s', achievedAt: '2026-09-15' },
    { userName: '西工大附中学霸', grade: '高二', timeMs: 24500, displayScore: '24.50s', achievedAt: '2026-09-15' },
    { userName: '成外自律星', grade: '高三', timeMs: 27800, displayScore: '27.80s', achievedAt: '2026-09-14' }
  ],
  game2048: [
    { userName: '镇海中学数竞生', grade: '高三', score: 16384, displayScore: '16,384 分', achievedAt: '2026-09-17' },
    { userName: '雅礼机房冲刺者', grade: '高二', score: 8192, displayScore: '8,192 分', achievedAt: '2026-09-17' },
    { userName: '成都七中自律星', grade: '高三', score: 6144, displayScore: '6,144 分', achievedAt: '2026-09-16' },
    { userName: '华师一附中课代表', grade: '高一', score: 4096, displayScore: '4,096 分', achievedAt: '2026-09-16' },
    { userName: '执信中学理科生', grade: '高二', score: 3584, displayScore: '3,584 分', achievedAt: '2026-09-15' }
  ],
  sudoku: [
    { userName: '巴蜀中学逻辑狂魔', grade: '高三', timeMs: 88000, displayScore: '1分28秒', achievedAt: '2026-09-17' },
    { userName: '东北育才数理学霸', grade: '高二', timeMs: 105000, displayScore: '1分45秒', achievedAt: '2026-09-16' },
    { userName: '长郡中学高三学子', grade: '高三', timeMs: 130000, displayScore: '2分10秒', achievedAt: '2026-09-16' },
    { userName: '石家庄二中课代表', grade: '高二', timeMs: 185000, displayScore: '3分05秒', achievedAt: '2026-09-15' }
  ],
  klotski15: [
    { userName: '复旦附中空间推演', grade: '高三', steps: 56, timeMs: 32400, displayScore: '56 步 (32.4s)', achievedAt: '2026-09-17' },
    { userName: '深圳中学全局控', grade: '高二', steps: 68, timeMs: 39800, displayScore: '68 步 (39.8s)', achievedAt: '2026-09-17' },
    { userName: '杭州二中自律先锋', grade: '高三', steps: 76, timeMs: 46200, displayScore: '76 步 (46.2s)', achievedAt: '2026-09-16' },
    { userName: '南京外国语学霸', grade: '高一', steps: 88, timeMs: 54000, displayScore: '88 步 (54.0s)', achievedAt: '2026-09-15' }
  ],
  arrow: [
    { userName: '天一中学瞬时反应', grade: '高三', score: 38, displayScore: '第 38 关', achievedAt: '2026-09-17' },
    { userName: '襄阳四中课间挑战', grade: '高二', score: 32, displayScore: '第 32 关', achievedAt: '2026-09-16' },
    { userName: '南开中学心流自习', grade: '高三', score: 28, displayScore: '第 28 关', achievedAt: '2026-09-16' },
    { userName: '郑州外国语学子', grade: '高一', score: 24, displayScore: '第 24 关', achievedAt: '2026-09-15' }
  ],
  minesweeper: [
    { userName: '上海中学概率排查', grade: '高三', timeMs: 9800, displayScore: '9.80s', achievedAt: '2026-09-17' },
    { userName: '交大附中微操达人', grade: '高二', timeMs: 12400, displayScore: '12.40s', achievedAt: '2026-09-17' },
    { userName: '七宝中学自律先锋', grade: '高三', timeMs: 15600, displayScore: '15.60s', achievedAt: '2026-09-16' },
    { userName: '格致中学理科班', grade: '高一', timeMs: 18200, displayScore: '18.20s', achievedAt: '2026-09-15' }
  ],
  memory: [
    { userName: '华二附中超强记忆', grade: '高三', timeMs: 18500, displayScore: '18.50s (16步)', achievedAt: '2026-09-17' },
    { userName: '合肥一中抗遗忘组', grade: '高二', timeMs: 22100, displayScore: '22.10s (18步)', achievedAt: '2026-09-16' },
    { userName: '绵阳中学自律打卡', grade: '高三', timeMs: 25800, displayScore: '25.80s (20步)', achievedAt: '2026-09-16' },
    { userName: '哈三中自习尖兵', grade: '高一', timeMs: 29400, displayScore: '29.40s (22步)', achievedAt: '2026-09-15' }
  ],
  hanoi: [
    { userName: '人大附中算法神童', grade: '高三', steps: 15, timeMs: 11200, displayScore: '15 步 (11.2s)', achievedAt: '2026-09-17' },
    { userName: '黄冈中学数学课代表', grade: '高二', steps: 15, timeMs: 14500, displayScore: '15 步 (14.5s)', achievedAt: '2026-09-17' },
    { userName: '清华自律学子', grade: '高三', steps: 15, timeMs: 16800, displayScore: '15 步 (16.8s)', achievedAt: '2026-09-16' },
    { userName: '海淀冲刺高考生', grade: '高一', steps: 17, timeMs: 21000, displayScore: '17 步 (21.0s)', achievedAt: '2026-09-15' }
  ]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context

  if (request.method === 'OPTIONS') {
    return onRequestOptions(context)
  }

  const url = new URL(request.url)
  const pathParts = Array.isArray(params.path) ? params.path : [params.path || '']
  const action = pathParts[0] || ''

  // 1. 获取榜单：GET /api/games/leaderboard?gameId=xxx
  if (request.method === 'GET' && (action === 'leaderboard' || pathParts.includes('leaderboard'))) {
    try {
      const gameId = url.searchParams.get('gameId') || 'schulte'
      const key = `leaderboard:${gameId}`
      let list: LeaderboardEntry[] = []

      if (env.SYNC_KV) {
        const raw = await env.SYNC_KV.get(key)
        if (raw) {
          try {
            list = JSON.parse(raw)
          } catch { /* parse error */ }
        }
      } else if (memoryLeaderboards.has(key)) {
        list = memoryLeaderboards.get(key) || []
      }

      // 若云端尚无用户提交记录，注入名校学霸标杆基底
      if (!list || list.length === 0) {
        list = [...(DEFAULT_BENCHMARKS[gameId] || DEFAULT_BENCHMARKS.schulte)]
      }

      // 添加名次编号
      const ranked = list.map((item, idx) => ({
        ...item,
        rank: idx + 1
      }))

      return new Response(JSON.stringify({
        ok: true,
        gameId,
        leaderboard: ranked.slice(0, 15),
        updatedAt: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, s-maxage=120'
        }
      })
    } catch (err: any) {
      return new Response(JSON.stringify({ ok: false, error: 'server_error', message: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // 2. 成绩上报提榜：POST /api/games/leaderboard
  if (request.method === 'POST' && (action === 'leaderboard' || pathParts.includes('leaderboard'))) {
    try {
      const body = await request.json() as {
        gameId: string
        userName: string
        grade?: string
        score?: number
        timeMs?: number
        steps?: number
        displayScore?: string
      }

      if (!body || !body.gameId || !body.userName) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_params', message: '缺少 gameId 或 userName' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const key = `leaderboard:${body.gameId}`
      let list: LeaderboardEntry[] = []

      if (env.SYNC_KV) {
        const raw = await env.SYNC_KV.get(key)
        if (raw) {
          try { list = JSON.parse(raw) } catch { /* ignore */ }
        }
      } else if (memoryLeaderboards.has(key)) {
        list = memoryLeaderboards.get(key) || []
      }

      if (!list || list.length === 0) {
        list = [...(DEFAULT_BENCHMARKS[body.gameId] || DEFAULT_BENCHMARKS.schulte)]
      }

      // 组装新条目
      const newEntry: LeaderboardEntry = {
        userName: body.userName.slice(0, 12),
        grade: body.grade || '高三',
        score: body.score,
        timeMs: body.timeMs,
        steps: body.steps,
        displayScore: body.displayScore || (body.timeMs ? `${(body.timeMs / 1000).toFixed(2)}s` : `${body.score || 0}`),
        achievedAt: new Date().toISOString().slice(0, 10)
      }

      // 插入并重排序
      list.push(newEntry)

      // 排序规则：时间越短越好 (timeMs)，或分数/关卡越高越好 (score)，或步数越少越好 (steps)
      const isTimeBased = ['schulte', 'sudoku', 'minesweeper', 'memory'].includes(body.gameId)
      const isStepsBased = ['klotski15', 'hanoi'].includes(body.gameId)

      if (isTimeBased) {
        list.sort((a, b) => (a.timeMs || 9999999) - (b.timeMs || 9999999))
      } else if (isStepsBased) {
        list.sort((a, b) => {
          const stepDiff = (a.steps || 9999) - (b.steps || 9999)
          if (stepDiff !== 0) return stepDiff
          return (a.timeMs || 9999999) - (b.timeMs || 9999999)
        })
      } else {
        // 分数模式 (game2048, arrow)
        list.sort((a, b) => (b.score || 0) - (a.score || 0))
      }

      // 截取前 20 名
      list = list.slice(0, 20)

      // 查算新名次
      const rank = list.findIndex(e => e.userName === newEntry.userName && e.displayScore === newEntry.displayScore) + 1

      // 写入持久化
      if (env.SYNC_KV) {
        await env.SYNC_KV.put(key, JSON.stringify(list))
      } else {
        memoryLeaderboards.set(key, list)
      }

      return new Response(JSON.stringify({
        ok: true,
        rank: rank > 0 ? rank : null,
        isTopTen: rank > 0 && rank <= 10,
        leaderboard: list.slice(0, 15)
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (err: any) {
      return new Response(JSON.stringify({ ok: false, error: 'server_error', message: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response(JSON.stringify({ ok: false, error: 'not_found', message: '接口路径无效' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
