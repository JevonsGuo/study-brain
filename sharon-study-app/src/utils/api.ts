const API_BASE = '/api'

async function request(url: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  get: (url: string) => request(url),
  post: (url: string, body: unknown) => request(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url: string, body?: unknown) => request(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: (url: string) => request(url, { method: 'DELETE' }),
}
