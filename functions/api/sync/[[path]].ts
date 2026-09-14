/**
 * Cloudflare Pages Function - 智学大脑端到端加密同步引擎
 * 部署至 Cloudflare Pages 时自动运行于全球 Anycast 边缘网络
 * 支持跨域 (CORS) 访问，无论前端部署在 GitHub Pages、Google Cloud 还是独立域名均可调用
 */

interface Env {
  SYNC_KV?: KVNamespace
}

// 内存兜底存储（当用户尚未在 Cloudflare 后台绑定 KV 命名空间时自动启用）
const memoryStore = new Map<string, { payload: any; updatedAt: string }>()

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

  return new Response(JSON.stringify({ ok: false, error: 'not_found', message: '接口路径无效' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
