import { localDB } from './localDatabase'

/**
 * 统一 API 客户端
 * 优先通过 localDatabase (IndexedDB + 静态公共 JSON) 在客户端纯离线高速运行
 * 保证零服务器成本、数据 100% 私有，跨 Google Cloud、Cloudflare Pages、GitHub Pages 一体化通跑
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers?: Record<string, string>
}

function parseUrl(rawUrl: string) {
  let cleanUrl = rawUrl
  if (cleanUrl.startsWith('/api/')) {
    cleanUrl = cleanUrl.slice(4)
  } else if (cleanUrl.startsWith('/api')) {
    cleanUrl = cleanUrl.slice(4)
  }

  const [pathPart, queryPart] = cleanUrl.split('?')
  const query: Record<string, string> = {}
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart)
    for (const [k, v] of searchParams.entries()) {
      query[k] = v
    }
  }
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`
  return { path, query }
}

async function handleLocalRequest(method: string, rawUrl: string, body?: any): Promise<any> {
  const { path, query } = parseUrl(rawUrl)

  // 1. 系统版本
  if (path === '/version' && method === 'GET') {
    return await localDB.getVersionMeta()
  }

  // 2. 个人档案
  if (path === '/user-profile') {
    if (method === 'GET') return await localDB.getUserProfile()
    if (method === 'PUT') return await localDB.saveUserProfile(body)
  }

  // 3. 知识库与学科
  if (path === '/knowledge/subjects' && method === 'GET') {
    return await localDB.getSubjects()
  }
  if (path === '/knowledge' && method === 'GET') {
    return await localDB.getKnowledgePoints(query.subject)
  }
  if (path === '/knowledge' && method === 'POST') {
    return await localDB.saveKnowledgePoint(body)
  }
  const noteMatch = path.match(/^\/knowledge\/(\d+)\/note$/)
  if (noteMatch && method === 'PUT') {
    return await localDB.saveKnowledgeNote(Number(noteMatch[1]), body?.note || '')
  }
  const pointMatch = path.match(/^\/knowledge\/(\d+)$/)
  if (pointMatch) {
    const id = Number(pointMatch[1])
    if (method === 'GET') return await localDB.getKnowledgePointById(id)
    if (method === 'PUT') return await localDB.saveKnowledgePoint({ ...body, id })
    if (method === 'DELETE') return await localDB.deleteKnowledgePoint(id)
  }

  // 4. 学习资源
  if (path === '/learning-resources' && method === 'GET') {
    return await localDB.getLearningResources(query.subject)
  }
  if (path === '/learning-resources' && method === 'POST') {
    return await localDB.saveLearningResource(body)
  }
  const resourceMatch = path.match(/^\/learning-resources\/(\d+)$/)
  if (resourceMatch) {
    const id = Number(resourceMatch[1])
    if (method === 'PUT') return await localDB.saveLearningResource({ ...body, id })
    if (method === 'DELETE') return await localDB.deleteLearningResource(id)
  }

  // 5. 错题本
  if (path === '/wrong-items' && method === 'GET') {
    return await localDB.getWrongItems(query.subject)
  }
  if (path === '/wrong-items' && method === 'POST') {
    return await localDB.createWrongItem(body)
  }
  const wrongMatch = path.match(/^\/wrong-items\/(\d+)$/)
  if (wrongMatch) {
    const id = Number(wrongMatch[1])
    if (method === 'PUT') return await localDB.updateWrongItem(id, body)
    if (method === 'DELETE') return await localDB.deleteWrongItem(id)
  }

  // 6. 学习计划
  if (path === '/study-plans' && method === 'GET') {
    return await localDB.getStudyPlans(query.date)
  }
  if (path === '/study-plans' && method === 'POST') {
    return await localDB.createStudyPlan(body)
  }
  const planToggleMatch = path.match(/^\/study-plans\/(\d+)\/toggle$/)
  if (planToggleMatch && method === 'PUT') {
    return await localDB.toggleStudyPlan(Number(planToggleMatch[1]))
  }
  const planMatch = path.match(/^\/study-plans\/(\d+)$/)
  if (planMatch) {
    const id = Number(planMatch[1])
    if (method === 'PUT') return await localDB.updateStudyPlan(id, body)
    if (method === 'DELETE') return await localDB.deleteStudyPlan(id)
  }

  // 7. 成绩追踪
  if (path === '/grades/goals') {
    if (method === 'GET') return await localDB.getGradeGoals()
    if (method === 'PUT') return await localDB.saveGradeGoals(body)
  }
  if (path === '/grades/batch' && method === 'POST') {
    return await localDB.batchCreateGrades(body?.records || body)
  }
  if (path === '/grades' && method === 'GET') {
    return await localDB.getGrades()
  }
  if (path === '/grades' && method === 'POST') {
    return await localDB.createGrade(body)
  }
  const gradeMatch = path.match(/^\/grades\/(\d+)$/)
  if (gradeMatch) {
    const id = Number(gradeMatch[1])
    if (method === 'PUT') return await localDB.updateGrade(id, body)
    if (method === 'DELETE') return await localDB.deleteGrade(id)
  }

  // 8. 专注计时记录
  if (path === '/focus-records' && method === 'GET') {
    return await localDB.getFocusRecords()
  }
  if (path === '/focus-records' && method === 'POST') {
    return await localDB.createFocusRecord(body)
  }
  const focusMatch = path.match(/^\/focus-records\/(\d+)$/)
  if (focusMatch && method === 'DELETE') {
    return await localDB.deleteFocusRecord(Number(focusMatch[1]))
  }

  // 9. 单词卡
  if (path === '/words/word-lists' && method === 'GET') {
    return await localDB.getWordLists()
  }
  if (path === '/words/stats' && method === 'GET') {
    return await localDB.getWordStats(query.word_list)
  }
  if (path === '/words/due' && method === 'GET') {
    return await localDB.getDueWords({
      word_list: query.word_list,
      shuffle: query.shuffle === '1' || query.shuffle === 'true'
    })
  }
  if (path === '/words' && method === 'GET') {
    return await localDB.getWords({
      word_list: query.word_list,
      search: query.search,
      mastery: query.mastery,
      shuffle: query.shuffle === '1' || query.shuffle === 'true'
    })
  }
  if (path === '/words/daily-config' && method === 'PUT') {
    return await localDB.saveDailyConfig(body)
  }
  const rememberMatch = path.match(/^\/words\/([^/]+)\/remember$/)
  if (rememberMatch && method === 'PUT') {
    return await localDB.rememberWord(rememberMatch[1])
  }
  const forgetMatch = path.match(/^\/words\/([^/]+)\/forget$/)
  if (forgetMatch && method === 'PUT') {
    return await localDB.forgetWord(forgetMatch[1])
  }
  const wordDeleteMatch = path.match(/^\/words\/([^/]+)$/)
  if (wordDeleteMatch && method === 'DELETE') {
    return { ok: true }
  }

  // 未命中本地路由，作为网络请求发起 (例如坚果云代理或自定义 API)
  const API_BASE = '/api'
  const targetUrl = rawUrl.startsWith('http') ? rawUrl : `${API_BASE}${rawUrl}`
  const res = await fetch(targetUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  get: (url: string) => handleLocalRequest('GET', url),
  post: (url: string, body?: unknown) => handleLocalRequest('POST', url, body),
  put: (url: string, body?: unknown) => handleLocalRequest('PUT', url, body),
  del: (url: string) => handleLocalRequest('DELETE', url),
}

export { localDB }
