/**
 * Cloudflare Pages Function - 坚果云 WebDAV 跨域反向代理
 * 部署至 Cloudflare Pages 时自动生效，拦截 /api/nutstore/* 请求并无缝转发至坚果云服务器
 */

interface Env {}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, If-Match, If-None-Match',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params } = context

  if (request.method === 'OPTIONS') {
    return onRequestOptions(context)
  }

  const pathParam = params.path
  const subpath = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '')
  const targetUrl = `https://dav.jianguoyun.com/dav/${subpath}`

  // 复制并转发请求头（过滤 Host 和 Cloudflare 专有头）
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('cf-connecting-ip')
  headers.delete('cf-ray')
  headers.delete('cf-visitor')

  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      body: ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'follow',
    }

    const response = await fetch(targetUrl, fetchOptions)

    // 构建带 CORS 响应头的客户端返回
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Access-Control-Allow-Origin', '*')
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY')
    newHeaders.set('Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, If-Match, If-None-Match')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'WebDAV proxy error' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
