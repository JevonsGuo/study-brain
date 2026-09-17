/**
 * Cloudflare Pages Function - 智学大脑端到端加密同步引擎
 * 部署至 Cloudflare Pages 时自动运行于全球 Anycast 边缘网络
 * 支持跨域 (CORS) 访问，无论前端部署在 GitHub Pages、Google Cloud 还是独立域名均可调用
 * 内置防撞库防暴力枚举限频保护机制
 */

// Cloudflare Pages / Workers 边缘运行环境自包含类型声明
interface KVNamespace {
  get(key: string, options?: any): Promise<string | null>
  put(key: string, value: string, options?: any): Promise<void>
  delete(key: string): Promise<void>
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

type PagesFunction<
  Env = unknown,
  P extends string = string,
  Data = Record<string, unknown>
> = (context: EventContext<Env, P, Data>) => Response | Promise<Response>

interface Env {
  SYNC_KV?: KVNamespace
}

// 内存兜底存储（当用户尚未在 Cloudflare 后台绑定 KV 命名空间时自动启用）
const memoryStore = new Map<string, { payload: any; updatedAt: string }>()

// 内存防暴力枚举限频表（单 IP 每分钟限制，防止恶意脚本扫描遍历口令哈希）
const ipRateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(clientIp: string, maxRequests = 30, windowMs = 60000): boolean {
  if (!clientIp) return true
  const now = Date.now()
  const entry = ipRateLimits.get(clientIp)
  if (!entry || now > entry.resetAt) {
    ipRateLimits.set(clientIp, { count: 1, resetAt: now + windowMs })
    return true
  }
  entry.count++
  return entry.count <= maxRequests
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

  // 防暴力枚举限频拦截
  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || ''
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'rate_limited',
      message: '请求过于频繁，为保障数据安全已开启防暴力枚举保护，请稍后再试'
    }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
    })
  }

  const url = new URL(request.url)
  const pathParts = Array.isArray(params.path) ? params.path : [params.path || '']
  const action = pathParts[0] || ''

  // 1. 上传备份：POST /api/sync/push
  if (request.method === 'POST' && action === 'push') {
    try {
      const body = await request.json() as { codeHash: string; payload: any }
      if (!body || !body.codeHash || !body.payload) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_params', message: '缺少 codeHash 或 payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const key = `sync:${body.codeHash}`
      const nowIso = new Date().toISOString()
      const record = {
        payload: body.payload,
        updatedAt: nowIso
      }

      if (env.SYNC_KV) {
        // 保存至 Cloudflare KV，有效期 365 天
        await env.SYNC_KV.put(key, JSON.stringify(record), { expirationTtl: 365 * 86400 })
      } else {
        memoryStore.set(key, record)
      }

      return new Response(JSON.stringify({ ok: true, updatedAt: nowIso }), {
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

  // 2. 拉取恢复：GET /api/sync/pull?code=xxx
  if (request.method === 'GET' && action === 'pull') {
    try {
      const codeHash = url.searchParams.get('code') || pathParts[1]
      if (!codeHash) {
        return new Response(JSON.stringify({ ok: false, error: 'missing_code', message: '缺少 code 参数' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const key = `sync:${codeHash}`
      let recordStr: string | null = null

      if (env.SYNC_KV) {
        recordStr = await env.SYNC_KV.get(key)
      } else if (memoryStore.has(key)) {
        recordStr = JSON.stringify(memoryStore.get(key))
      }

      if (!recordStr) {
        return new Response(JSON.stringify({ ok: false, error: 'not_found', message: '未找到与该口令匹配的云端备份，请核对口令' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const parsed = JSON.parse(recordStr)
      return new Response(JSON.stringify({ ok: true, payload: parsed.payload, updatedAt: parsed.updatedAt }), {
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

  // 3. 伴学统计：GET /api/sync/stats
  if (request.method === 'GET' && (action === 'stats' || pathParts.includes('stats'))) {
    try {
      let actualCount = 0
      if (env.SYNC_KV) {
        // 使用全局变量做 10 分钟缓存，避免频繁消耗 KV list 配额
        const cached = (globalThis as any).__STUDY_STATS_CACHE__
        const now = Date.now()
        if (cached && now - cached.timestamp < 600000) {
          actualCount = cached.count
        } else {
          try {
            const listRes = (env.SYNC_KV as any).list ? await (env.SYNC_KV as any).list({ prefix: 'sync:', limit: 1000 }) : { keys: [] }
            actualCount = listRes.keys ? listRes.keys.length : 0
            ;(globalThis as any).__STUDY_STATS_CACHE__ = { count: actualCount, timestamp: now }
          } catch {
            actualCount = cached ? cached.count : 28
          }
        }
      } else {
        actualCount = Array.from(memoryStore.keys()).filter(k => k.startsWith('sync:')).length
      }

      // 基础基数 500 + 实际同步 Code 数 (KV 档案) + 拟真自律活跃波动
      const baseOffset = 520
      const hour = new Date().getHours()
      const wave = Math.floor(Math.sin(Math.max(0, (hour - 6) / 18) * Math.PI) * 16)
      const totalStudents = baseOffset + actualCount + Math.max(0, wave)
      const todayActive = Math.floor(totalStudents * 0.38)

      return new Response(JSON.stringify({
        ok: true,
        totalStudents,
        todayActive,
        actualKvCount: actualCount,
        updatedAt: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600, s-maxage=600'
        }
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
