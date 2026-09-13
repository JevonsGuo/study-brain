/**
 * 本地专属数据引擎 (IndexedDB + 静态公共学科数据)
 * 纯客户端运行：支持 GitHub Pages, Cloudflare Pages, Google Cloud 零后端部署
 * 个人数据（错题、笔记、计划、专注记录、成绩、词汇进度）绝对私有，安全存储于本地浏览器
 */

const DB_NAME = 'StudyBrainDB'
const DB_VERSION = 1

export interface LocalUserProfile {
  id: number
  user_name: string
  app_title: string
  grade_level: string
  target_exam: string
  custom_quote: string
  elective_subjects?: string[]
  has_configured: boolean
  updated_at?: string
}

export interface LocalWrongItem {
  id?: number
  subject: string
  question: string
  answer?: string
  wrong_reason?: string
  reason?: string
  mastery_status: string
  review_count: number
  tags?: string
  knowledge_point_id?: number | null
  image_url?: string
  created_at?: string
  updated_at?: string
}

export interface LocalStudyPlan {
  id?: number
  subject: string
  content: string
  date: string
  status: 'pending' | 'done'
  done?: boolean
  estimated_minutes?: number
  actual_minutes?: number
  created_at?: string
}

export interface LocalFocusRecord {
  id?: number
  subject: string
  plan_id?: number | null
  task_name?: string
  mode?: string
  duration_minutes: number
  completed_at: string
}

export interface LocalGrade {
  id?: number
  subject: string
  exam: string
  score: number
  full_score: number
  date: string
  created_at?: string
}

export interface LocalWordProgress {
  word: string
  word_list: string
  review_count: number
  last_review: string
  next_review: string
  interval_days: number
  mastery_level: number
  updated_at?: string
}

export interface LocalStudyRecord {
  id?: number
  word_id: number | string
  action: 'new' | 'review'
  date: string
}

export type DbSyncState = 'idle' | 'checking' | 'downloading' | 'syncing' | 'latest' | 'update_available' | 'offline'

class LocalDatabase {
  private syncListeners: ((state: DbSyncState, message: string) => void)[] = []
  private currentSyncState: DbSyncState = 'latest'
  private currentSyncMessage: string = '数据库就绪'

  onSyncStateChange(fn: (state: DbSyncState, message: string) => void) {
    this.syncListeners.push(fn)
    fn(this.currentSyncState, this.currentSyncMessage)
  }

  setSyncState(state: DbSyncState, message: string) {
    this.currentSyncState = state
    this.currentSyncMessage = message
    this.syncListeners.forEach(fn => {
      try { fn(state, message) } catch {}
    })
  }

  private dbPromise: Promise<IDBDatabase> | null = null
  private contentCache: Map<string, any> = new Map()
  private wordCache: Map<string, any[]> = new Map()
  private idToWordMap: Map<number, { word: string; word_list: string }> = new Map()

  constructor() {
    this.initDB()
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains('wrong_items')) {
          const store = db.createObjectStore('wrong_items', { keyPath: 'id', autoIncrement: true })
          store.createIndex('subject', 'subject', { unique: false })
          store.createIndex('created_at', 'created_at', { unique: false })
        }

        if (!db.objectStoreNames.contains('student_notes')) {
          db.createObjectStore('student_notes', { keyPath: 'knowledge_point_id' })
        }

        if (!db.objectStoreNames.contains('custom_knowledge')) {
          const store = db.createObjectStore('custom_knowledge', { keyPath: 'id', autoIncrement: true })
          store.createIndex('subject', 'subject', { unique: false })
        }

        if (!db.objectStoreNames.contains('custom_resources')) {
          const store = db.createObjectStore('custom_resources', { keyPath: 'id', autoIncrement: true })
          store.createIndex('subject', 'subject', { unique: false })
        }

        if (!db.objectStoreNames.contains('study_plans')) {
          const store = db.createObjectStore('study_plans', { keyPath: 'id', autoIncrement: true })
          store.createIndex('date', 'date', { unique: false })
          store.createIndex('status', 'status', { unique: false })
        }

        if (!db.objectStoreNames.contains('focus_records')) {
          const store = db.createObjectStore('focus_records', { keyPath: 'id', autoIncrement: true })
          store.createIndex('completed_at', 'completed_at', { unique: false })
        }

        if (!db.objectStoreNames.contains('grades')) {
          const store = db.createObjectStore('grades', { keyPath: 'id', autoIncrement: true })
          store.createIndex('subject', 'subject', { unique: false })
          store.createIndex('date', 'date', { unique: false })
        }

        if (!db.objectStoreNames.contains('grade_goals')) {
          db.createObjectStore('grade_goals', { keyPath: 'subject' })
        }

        if (!db.objectStoreNames.contains('user_profile')) {
          db.createObjectStore('user_profile', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('word_progress')) {
          const store = db.createObjectStore('word_progress', { keyPath: 'word' })
          store.createIndex('word_list', 'word_list', { unique: false })
          store.createIndex('next_review', 'next_review', { unique: false })
        }

        if (!db.objectStoreNames.contains('custom_words')) {
          const store = db.createObjectStore('custom_words', { keyPath: 'id', autoIncrement: true })
          store.createIndex('word_list', 'word_list', { unique: false })
        }

        if (!db.objectStoreNames.contains('study_records')) {
          const store = db.createObjectStore('study_records', { keyPath: 'id', autoIncrement: true })
          store.createIndex('date', 'date', { unique: false })
        }

        if (!db.objectStoreNames.contains('daily_config')) {
          db.createObjectStore('daily_config', { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return this.dbPromise
  }

  // === 基础 Store 操作辅助方法 ===
  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.initDB()
    const tx = db.transaction(storeName, mode)
    return tx.objectStore(storeName)
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const store = await this.getStore(storeName)
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  }

  private async getByKey<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const store = await this.getStore(storeName)
    return new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  private async putItem<T>(storeName: string, item: T): Promise<IDBValidKey> {
    const store = await this.getStore(storeName, 'readwrite')
    // 移除 Vue 3 响应式 Proxy 包装，防止 IndexedDB 抛出 DataCloneError
    const safeItem = JSON.parse(JSON.stringify(item))
    return new Promise((resolve, reject) => {
      const req = store.put(safeItem)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  private async deleteItem(storeName: string, key: IDBValidKey): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  private async clearStore(storeName: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite')
    return new Promise((resolve, reject) => {
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  // === 静态公共内容加载 ===
  invalidatePublicContentCache() {
    this.contentCache.clear()
    this.wordCache.clear()
    this.idToWordMap.clear()
    console.log("[localDB] 已清空公共数据内存缓存，将从服务器拉取全量最新数据")
  }

  private async loadPublicJson<T>(filename: string, forceFresh = false): Promise<T> {
    if (!forceFresh && this.contentCache.has(filename)) {
      return this.contentCache.get(filename) as T
    }

    const baseUrl = import.meta.env.BASE_URL || './'
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    const isVersion = filename === 'version.json'
    const cacheBuster = isVersion || forceFresh ? `?_t=${Date.now()}` : ''
    const url = `${normalizedBase}content/${filename}${cacheBuster}`

    const res = await fetch(url, {
      cache: isVersion || forceFresh ? 'no-store' : 'no-cache'
    })
    if (!res.ok) {
      throw new Error(`Failed to load ${filename}: ${res.statusText}`)
    }
    const data = await res.json()
    // version.json 永不缓存于内存，确保每次版本检查均为服务器真实最新文件
    if (!isVersion) {
      this.contentCache.set(filename, data)
    }
    return data as T
  }

  // ================= 模块 1: 系统版本与公共元数据 =================
  async getVersionMeta(forceFresh = true) {
    try {
      return await this.loadPublicJson('version.json', forceFresh)
    } catch {
      return {
        database_version: '20260912.00000000',
        updated_at: new Date().toISOString(),
        description: '本地离线单机模式'
      }
    }
  }

  // ================= 模块 2: 用户档案 (User Profile) =================
  async getUserProfile(): Promise<LocalUserProfile> {
    const saved = await this.getByKey<LocalUserProfile>('user_profile', 1)
    if (saved) return saved

    return {
      id: 1,
      user_name: '',
      app_title: '',
      grade_level: '高三',
      target_exam: '高考',
      custom_quote: '',
      elective_subjects: ['物理', '化学', '生物'],
      has_configured: false
    }
  }

  async saveUserProfile(payload: Partial<LocalUserProfile>): Promise<LocalUserProfile> {
    const existing = await this.getUserProfile()
    const updated: LocalUserProfile = {
      ...existing,
      ...payload,
      id: 1,
      elective_subjects: payload.elective_subjects !== undefined ? payload.elective_subjects : (existing.elective_subjects || ['物理', '化学', '生物']),
      has_configured: payload.has_configured !== undefined ? payload.has_configured : Boolean(payload.user_name && payload.user_name.trim()),
      updated_at: new Date().toISOString()
    }
    await this.putItem('user_profile', updated)
    return updated
  }

  // ================= 模块 3: 知识库 (Knowledge Points) & 学生笔记 =================
  getKnowledgeOverrides(): Record<number, any> {
    try {
      const raw = localStorage.getItem('study_knowledge_overrides')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }

  getKnowledgeDeletedIds(): Set<number> {
    try {
      const raw = localStorage.getItem('study_knowledge_deleted_ids')
      return new Set(raw ? JSON.parse(raw) : [])
    } catch { return new Set() }
  }

  async getSubjects(): Promise<string[]> {
    const all = await this.getKnowledgePoints()
    const subjects = Array.from(new Set(all.map((p) => p.subject).filter(Boolean)))
    return subjects.length > 0 ? subjects : ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
  }

  async getKnowledgePoints(subject?: string) {
    const seedPoints = await this.loadPublicJson<any[]>('knowledge.json').catch(() => [])
    const customPoints = await this.getAll<any>('custom_knowledge')
    const allNotes = await this.getAll<{ knowledge_point_id: number; note: string }>('student_notes')
    const noteMap = new Map<number, string>(allNotes.map(n => [n.knowledge_point_id, n.note]))

    const overrides = this.getKnowledgeOverrides()
    const deletedIds = this.getKnowledgeDeletedIds()

    // 为 seed points 分配稳定数字 ID (1, 2, 3...)，并融入官方维护模式草稿覆盖与删除
    const list: any[] = []
    seedPoints.forEach((item, index) => {
      const id = index + 1
      if (deletedIds.has(id)) return // 已被维护模式标记删除

      const note = noteMap.get(id) || ''
      const pointData = overrides[id] ? { ...item, ...overrides[id] } : item
      list.push({
        ...pointData,
        id,
        origin: 'seed',
        is_modified: Boolean(overrides[id]),
        student_note: note,
        user_note: note
      })
    })

    // 合并用户自定义考点 (ID 从 10000+ 开始)
    for (const cp of customPoints) {
      const note = noteMap.get(cp.id) || ''
      list.push({
        ...cp,
        origin: 'user',
        student_note: note,
        user_note: note
      })
    }

    let filtered = list
    if (subject) {
      filtered = filtered.filter(p => p.subject === subject)
    }

    filtered.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id)
    return filtered
  }

  async getKnowledgePointById(id: number) {
    const points = await this.getKnowledgePoints()
    return points.find(p => p.id === Number(id)) || null
  }

  async saveKnowledgePoint(payload: any) {
    // 若编辑的是已有 seed 考点（id < 10000），写入官方维护草稿 overrides 字典
    if (payload.id && payload.id < 10000) {
      const overrides = this.getKnowledgeOverrides()
      overrides[payload.id] = { ...payload }
      localStorage.setItem('study_knowledge_overrides', JSON.stringify(overrides))
      return payload
    }
    if (payload.id && payload.id >= 10000) {
      await this.putItem('custom_knowledge', payload)
      return payload
    }
    const newId = 10000 + Date.now() % 1000000
    const point = {
      ...payload,
      id: newId,
      origin: 'user',
      created_at: new Date().toISOString()
    }
    await this.putItem('custom_knowledge', point)
    return point
  }

  async deleteKnowledgePoint(id: number) {
    if (id < 10000) {
      // 官方考点删除：记录至 deleted_ids
      const deletedIds = this.getKnowledgeDeletedIds()
      deletedIds.add(id)
      localStorage.setItem('study_knowledge_deleted_ids', JSON.stringify(Array.from(deletedIds)))

      const overrides = this.getKnowledgeOverrides()
      delete overrides[id]
      localStorage.setItem('study_knowledge_overrides', JSON.stringify(overrides))
    } else {
      await this.deleteItem('custom_knowledge', id)
    }
    await this.deleteItem('student_notes', id)
    return { ok: true }
  }

  async saveKnowledgeNote(knowledge_point_id: number, note: string) {
    const entry = {
      knowledge_point_id: Number(knowledge_point_id),
      note,
      updated_at: new Date().toISOString()
    }
    await this.putItem('student_notes', entry)
    return entry
  }

  // ================= 模块 4: 学习资源 (Learning Resources) =================
  getResourceOverrides(): Record<number, any> {
    try {
      const raw = localStorage.getItem('study_resources_overrides')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }

  getResourceDeletedIds(): Set<number> {
    try {
      const raw = localStorage.getItem('study_resources_deleted_ids')
      return new Set(raw ? JSON.parse(raw) : [])
    } catch { return new Set() }
  }

  async getLearningResources(subject?: string) {
    const seed = await this.loadPublicJson<any[]>('learning-resources.json').catch(() => [])
    const custom = await this.getAll<any>('custom_resources')
    const overrides = this.getResourceOverrides()
    const deletedIds = this.getResourceDeletedIds()

    const list: any[] = []
    seed.forEach((item, index) => {
      const id = index + 1
      if (deletedIds.has(id)) return
      const resData = overrides[id] ? { ...item, ...overrides[id] } : item
      list.push({
        ...resData,
        id,
        origin: 'seed',
        is_modified: Boolean(overrides[id])
      })
    })

    for (const cr of custom) {
      list.push({
        ...cr,
        origin: 'user'
      })
    }

    let filtered = list
    if (subject) {
      filtered = filtered.filter(r => r.subject === subject)
    }
    filtered.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    return filtered
  }

  async saveLearningResource(payload: any) {
    if (payload.id && payload.id < 10000) {
      const overrides = this.getResourceOverrides()
      overrides[payload.id] = { ...payload }
      localStorage.setItem('study_resources_overrides', JSON.stringify(overrides))
      return payload
    }
    if (payload.id && payload.id >= 10000) {
      await this.putItem('custom_resources', payload)
      return payload
    }
    const newId = 10000 + Date.now() % 1000000
    const res = {
      ...payload,
      id: newId,
      origin: 'user',
      created_at: new Date().toISOString()
    }
    await this.putItem('custom_resources', res)
    return res
  }

  async deleteLearningResource(id: number) {
    if (id < 10000) {
      const deletedIds = this.getResourceDeletedIds()
      deletedIds.add(id)
      localStorage.setItem('study_resources_deleted_ids', JSON.stringify(Array.from(deletedIds)))

      const overrides = this.getResourceOverrides()
      delete overrides[id]
      localStorage.setItem('study_resources_overrides', JSON.stringify(overrides))
    } else {
      await this.deleteItem('custom_resources', id)
    }
    return { ok: true }
  }

  // ================= 模块 4.1: 官方公共 JSON 数据导出与发布工具 =================
  async exportConsolidatedKnowledgeJson(): Promise<string> {
    const all = await this.getKnowledgePoints()
    // 整理为官方纯净标准字段 (去除 id, origin, is_modified, student_note, user_note 等前端运行态字段)
    const cleanList = all.map(p => ({
      subject: p.subject || '',
      grade: p.grade || '',
      book: p.book || '',
      chapter: p.chapter || '',
      title: p.title || '',
      content: p.content || '',
      key_formulas: p.key_formulas || '',
      tips: p.tips || '',
      visual_desc: p.visual_desc || '',
      video_url: p.video_url || '',
      sort_order: Number(p.sort_order || 0)
    }))
    return JSON.stringify(cleanList, null, 2)
  }

  async exportConsolidatedResourcesJson(): Promise<string> {
    const all = await this.getLearningResources()
    const cleanList = all.map(r => ({
      subject: r.subject || '',
      category: r.category || 'tool',
      name: r.name || '',
      desc: r.desc || '',
      url: r.url || '',
      sort_order: Number(r.sort_order || 0)
    }))
    return JSON.stringify(cleanList, null, 2)
  }

  async getDraftStats() {
    const knowledgeOverrides = Object.keys(this.getKnowledgeOverrides()).length
    const knowledgeDeleted = this.getKnowledgeDeletedIds().size
    const customKnowledge = (await this.getAll('custom_knowledge')).length

    const resOverrides = Object.keys(this.getResourceOverrides()).length
    const resDeleted = this.getResourceDeletedIds().size
    const customRes = (await this.getAll('custom_resources')).length

    const totalPoints = (await this.getKnowledgePoints()).length
    const totalResources = (await this.getLearningResources()).length

    return {
      knowledge: {
        total: totalPoints,
        modified: knowledgeOverrides,
        added: customKnowledge,
        deleted: knowledgeDeleted,
        hasDraft: knowledgeOverrides > 0 || knowledgeDeleted > 0 || customKnowledge > 0
      },
      resources: {
        total: totalResources,
        modified: resOverrides,
        added: customRes,
        deleted: resDeleted,
        hasDraft: resOverrides > 0 || resDeleted > 0 || customRes > 0
      }
    }
  }

  async resetAllOfficialDrafts() {
    localStorage.removeItem('study_knowledge_overrides')
    localStorage.removeItem('study_knowledge_deleted_ids')
    localStorage.removeItem('study_resources_overrides')
    localStorage.removeItem('study_resources_deleted_ids')
    await this.clearStore('custom_knowledge')
    await this.clearStore('custom_resources')
  }

  // ================= 模块 5: 错题本 (Wrong Book) =================
  async getWrongItems(subject?: string): Promise<LocalWrongItem[]> {
    const all = await this.getAll<LocalWrongItem>('wrong_items')
    let filtered = all
    if (subject) {
      filtered = filtered.filter(w => w.subject === subject)
    }
    filtered.sort((a, b) => (b.id || 0) - (a.id || 0))
    return filtered.map(w => {
      const r = w.reason || w.wrong_reason || ''
      return {
        ...w,
        reason: r,
        wrong_reason: r
      }
    })
  }

  async createWrongItem(payload: Partial<LocalWrongItem> & { reason?: string }): Promise<LocalWrongItem> {
    const r = payload.reason || payload.wrong_reason || ''
    const item: LocalWrongItem = {
      subject: payload.subject || '数学',
      question: payload.question || '',
      answer: payload.answer || '',
      wrong_reason: r,
      reason: r,
      mastery_status: payload.mastery_status || 'unmastered',
      review_count: payload.review_count || 0,
      tags: payload.tags || '',
      knowledge_point_id: payload.knowledge_point_id || null,
      image_url: payload.image_url || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    const id = await this.putItem('wrong_items', item)
    return { ...item, id: Number(id) }
  }

  async updateWrongItem(id: number, payload: Partial<LocalWrongItem> & { reason?: string }): Promise<LocalWrongItem> {
    const existing = await this.getByKey<LocalWrongItem>('wrong_items', Number(id))
    if (!existing) throw new Error('Wrong item not found')

    const r = payload.reason !== undefined ? payload.reason : (payload.wrong_reason !== undefined ? payload.wrong_reason : (existing.reason || existing.wrong_reason || ''))
    const updated: LocalWrongItem = {
      ...existing,
      ...payload,
      wrong_reason: r,
      reason: r,
      id: Number(id),
      updated_at: new Date().toISOString()
    }
    await this.putItem('wrong_items', updated)
    return updated
  }

  async deleteWrongItem(id: number): Promise<{ ok: boolean }> {
    await this.deleteItem('wrong_items', Number(id))
    return { ok: true }
  }

  // ================= 模块 6: 每日计划 (Study Plans) =================
  async getStudyPlans(date?: string): Promise<(LocalStudyPlan & { done: boolean })[]> {
    const all = await this.getAll<LocalStudyPlan>('study_plans')
    let filtered = all
    if (date) {
      filtered = filtered.filter(p => p.date === date)
    }
    filtered.sort((a, b) => (b.id || 0) - (a.id || 0))
    return filtered.map(p => ({
      ...p,
      done: p.status === 'done' || (p as any).done === true
    }))
  }

  async createStudyPlan(payload: Partial<LocalStudyPlan> & { done?: boolean }): Promise<LocalStudyPlan & { done: boolean }> {
    const isDone = payload.status === 'done' || payload.done === true
    const plan: LocalStudyPlan & { done: boolean } = {
      subject: payload.subject || '通用',
      content: payload.content || '',
      date: payload.date || new Date().toISOString().slice(0, 10),
      status: isDone ? 'done' : 'pending',
      done: isDone,
      estimated_minutes: payload.estimated_minutes || 30,
      actual_minutes: payload.actual_minutes || 0,
      created_at: new Date().toISOString()
    }
    const id = await this.putItem('study_plans', plan)
    return { ...plan, id: Number(id) }
  }

  async toggleStudyPlan(id: number): Promise<LocalStudyPlan & { done: boolean }> {
    const plan = await this.getByKey<LocalStudyPlan>('study_plans', Number(id))
    if (!plan) throw new Error('Plan not found')
    const currentDone = plan.status === 'done' || (plan as any).done === true
    const nextDone = !currentDone
    plan.status = nextDone ? 'done' : 'pending'
    ;(plan as any).done = nextDone
    await this.putItem('study_plans', plan)
    return { ...plan, done: nextDone }
  }

  async updateStudyPlan(id: number, payload: Partial<LocalStudyPlan> & { done?: boolean }): Promise<LocalStudyPlan & { done: boolean }> {
    const plan = await this.getByKey<LocalStudyPlan>('study_plans', Number(id))
    if (!plan) throw new Error('Plan not found')
    const isDone = payload.status !== undefined
      ? payload.status === 'done'
      : payload.done !== undefined
      ? Boolean(payload.done)
      : (plan.status === 'done' || (plan as any).done === true)

    const planStatus: 'done' | 'pending' = isDone ? 'done' : 'pending'
    const updated: LocalStudyPlan & { done: boolean } = {
      ...plan,
      ...payload,
      id: Number(id),
      status: planStatus,
      done: isDone
    }
    await this.putItem('study_plans', updated)
    return updated
  }

  async deleteStudyPlan(id: number): Promise<{ ok: boolean }> {
    await this.deleteItem('study_plans', Number(id))
    return { ok: true }
  }

  // ================= 模块 7: 成绩追踪 (Grades & Goals) =================
  async getGrades(): Promise<LocalGrade[]> {
    const list = await this.getAll<LocalGrade>('grades')
    list.sort((a, b) => a.date.localeCompare(b.date))
    return list
  }

  async createGrade(payload: Partial<LocalGrade>): Promise<LocalGrade> {
    const grade: LocalGrade = {
      subject: payload.subject || '语文',
      exam: payload.exam || '模拟考',
      score: Number(payload.score) || 0,
      full_score: Number(payload.full_score) || 150,
      date: payload.date || new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    }
    const id = await this.putItem('grades', grade)
    return { ...grade, id: Number(id) }
  }

  async batchCreateGrades(records: any): Promise<LocalGrade[]> {
    const items = Array.isArray(records) ? records : (records?.items || records?.records || [])
    const exam = records?.exam || '模拟考'
    const date = records?.date || new Date().toISOString().slice(0, 10)
    const created: LocalGrade[] = []
    for (const r of items) {
      const gradeItem = {
        subject: r.subject || '语文',
        exam: r.exam || exam,
        date: r.date || date,
        score: r.score !== null && r.score !== undefined ? Number(r.score) : 0,
        full_score: r.full_score !== null && r.full_score !== undefined ? Number(r.full_score) : 150
      }
      const res = await this.createGrade(gradeItem)
      created.push(res)
    }
    return created
  }

  async updateGrade(id: number, payload: Partial<LocalGrade>): Promise<LocalGrade> {
    const grade = await this.getByKey<LocalGrade>('grades', Number(id))
    if (!grade) throw new Error('Grade not found')
    const updated = { ...grade, ...payload, id: Number(id) }
    await this.putItem('grades', updated)
    return updated
  }

  async deleteGrade(id: number): Promise<{ ok: boolean }> {
    await this.deleteItem('grades', Number(id))
    return { ok: true }
  }

  async getGradeGoals(): Promise<Record<string, { target_score: number; target_full_score: number }>> {
    const list = await this.getAll<{ subject: string; target_score: number; target_full_score: number }>('grade_goals')
    const map: Record<string, { target_score: number; target_full_score: number }> = {}
    for (const item of list) {
      map[item.subject] = {
        target_score: item.target_score,
        target_full_score: item.target_full_score
      }
    }
    return map
  }

  async saveGradeGoals(payload: Record<string, { target_score: number; target_full_score: number }>) {
    for (const [subject, val] of Object.entries(payload)) {
      await this.putItem('grade_goals', {
        subject,
        target_score: val.target_score,
        target_full_score: val.target_full_score
      })
    }
    return this.getGradeGoals()
  }

  // ================= 模块 8: 专注记录 (Focus Records) =================
  async getFocusRecords() {
    const records = await this.getAll<LocalFocusRecord>('focus_records')
    records.sort((a, b) => b.completed_at.localeCompare(a.completed_at))

    const today = new Date().toISOString().slice(0, 10)
    let totalMinutes = 0
    let todayMinutes = 0
    const subjectMinutes: Record<string, number> = {}

    for (const r of records) {
      const dur = Number(r.duration_minutes) || 0
      totalMinutes += dur
      if (r.completed_at.startsWith(today)) {
        todayMinutes += dur
      }
      subjectMinutes[r.subject] = (subjectMinutes[r.subject] || 0) + dur
    }

    return {
      records,
      stats: {
        totalMinutes,
        todayMinutes,
        totalSessions: records.length,
        subjectMinutes
      }
    }
  }

  async createFocusRecord(payload: Partial<LocalFocusRecord>): Promise<LocalFocusRecord> {
    const rec: LocalFocusRecord = {
      subject: payload.subject || '全科自习',
      plan_id: payload.plan_id || null,
      task_name: payload.task_name || '沉浸专注',
      mode: payload.mode || 'pomodoro',
      duration_minutes: Number(payload.duration_minutes) || 25,
      completed_at: payload.completed_at || new Date().toISOString()
    }
    const id = await this.putItem('focus_records', rec)
    return { ...rec, id: Number(id) }
  }

  async deleteFocusRecord(id: number): Promise<{ ok: boolean }> {
    await this.deleteItem('focus_records', Number(id))
    return { ok: true }
  }

  // ================= 模块 9: 单词卡与艾宾浩斯记忆算法 =================
  private readonly INTERVAL_STEPS = [1, 2, 4, 7, 15, 30]

  async getWordLists(): Promise<{ word_list: string; count: number }[]> {
    try {
      const lists = await this.loadPublicJson<{ word_list: string; count: number }[]>('word-lists.json')
      return lists
    } catch {
      return [
        { word_list: 'shanghai', count: 4679 },
        { word_list: 'default', count: 1528 },
        { word_list: 'cet6', count: 2088 },
        { word_list: 'ielts', count: 5530 },
        { word_list: 'toefl', count: 7416 },
        { word_list: 'gre', count: 4330 }
      ]
    }
  }

  private async loadWordsForList(wordList: string): Promise<any[]> {
    if (this.wordCache.has(wordList)) {
      return this.wordCache.get(wordList)!
    }
    const filename = `words-${wordList}.json`
    const rawWords = await this.loadPublicJson<any[]>(filename).catch(() => [])

    // 为每个单词分配在内存中的稳定 ID，并构建 id -> word 映射表
    const list = rawWords.map((item, idx) => {
      // 保证全球唯一稳定 ID
      const baseOffset = (wordList.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 1000) * 100000
      const id = baseOffset + idx + 1
      this.idToWordMap.set(id, { word: item.word, word_list: wordList })
      return {
        ...item,
        id,
        word_list: wordList
      }
    })

    this.wordCache.set(wordList, list)
    return list
  }

  async getWordStats(wordList?: string) {
    const targetList = wordList || 'default'
    const words = await this.loadWordsForList(targetList)
    const progressList = await this.getAll<LocalWordProgress>('word_progress')
    const progressMap = new Map<string, LocalWordProgress>(progressList.map(p => [p.word, p]))

    const today = new Date().toISOString().slice(0, 10)
    let newCount = 0
    let learningCount = 0
    let masteredCount = 0
    let dueCount = 0

    for (const w of words) {
      const prog = progressMap.get(w.word)
      if (!prog || prog.mastery_level === 0) {
        newCount++
      } else if (prog.mastery_level === 1) {
        learningCount++
      } else if (prog.mastery_level === 2) {
        masteredCount++
      }

      if (prog && prog.next_review && prog.next_review <= today) {
        dueCount++
      }
    }

    // 统计今日学习与复习量 (来自 study_records)
    const records = await this.getAll<LocalStudyRecord>('study_records')
    const todayRecords = records.filter(r => r.date === today)
    const todayNewSet = new Set(todayRecords.filter(r => r.action === 'new').map(r => r.word_id))
    const todayReviewSet = new Set(todayRecords.filter(r => r.action === 'review').map(r => r.word_id))
    const todayStudiedSet = new Set(todayRecords.map(r => r.word_id))

    // 计算连击天数
    let streak = 0
    const d = new Date()
    const recordDates = new Set(records.map(r => r.date))
    while (true) {
      const dateStr = d.toISOString().slice(0, 10)
      if (recordDates.has(dateStr)) {
        streak++
        d.setDate(d.getDate() - 1)
      } else {
        break
      }
    }

    const config = await this.getByKey<{ id: number; target_new: number; target_review: number }>('daily_config', 1)

    return {
      total: words.length,
      newCount,
      learningCount,
      masteredCount,
      dueCount,
      todayStudied: todayStudiedSet.size,
      todayNew: todayNewSet.size,
      todayReviewed: todayReviewSet.size,
      targetNew: config?.target_new || 20,
      targetReview: config?.target_review || 40,
      streak
    }
  }

  async getWords(query: { word_list?: string; search?: string; mastery?: number | string; shuffle?: boolean }) {
    const targetList = query.word_list || 'default'
    const words = await this.loadWordsForList(targetList)
    const progressList = await this.getAll<LocalWordProgress>('word_progress')
    const progressMap = new Map<string, LocalWordProgress>(progressList.map(p => [p.word, p]))

    let merged = words.map(w => {
      const p = progressMap.get(w.word)
      return {
        ...w,
        review_count: p?.review_count || 0,
        last_review: p?.last_review || '',
        next_review: p?.next_review || '',
        interval_days: p?.interval_days || 0,
        mastery_level: p?.mastery_level || 0
      }
    })

    if (query.search) {
      const s = query.search.toLowerCase()
      merged = merged.filter(w =>
        w.word.toLowerCase().includes(s) ||
        (w.meaning && w.meaning.toLowerCase().includes(s)) ||
        (w.example_en && w.example_en.toLowerCase().includes(s))
      )
    }

    if (query.mastery !== undefined && query.mastery !== '') {
      const m = Number(query.mastery)
      merged = merged.filter(w => w.mastery_level === m)
    }

    if (query.shuffle) {
      merged.sort(() => Math.random() - 0.5)
    }

    return merged
  }

  async getDueWords(query: { word_list?: string; shuffle?: boolean }) {
    const targetList = query.word_list || 'default'
    const words = await this.loadWordsForList(targetList)
    const progressList = await this.getAll<LocalWordProgress>('word_progress')
    const progressMap = new Map<string, LocalWordProgress>(progressList.map(p => [p.word, p]))

    const today = new Date().toISOString().slice(0, 10)
    const due: any[] = []
    const newWords: any[] = []

    for (const w of words) {
      const p = progressMap.get(w.word)
      const item = {
        ...w,
        review_count: p?.review_count || 0,
        last_review: p?.last_review || '',
        next_review: p?.next_review || '',
        interval_days: p?.interval_days || 0,
        mastery_level: p?.mastery_level || 0
      }

      if (p && p.next_review && p.next_review <= today) {
        due.push(item)
      } else if (!p || p.mastery_level === 0) {
        newWords.push(item)
      }
    }

    if (query.shuffle) {
      due.sort(() => Math.random() - 0.5)
      newWords.sort(() => Math.random() - 0.5)
    }

    return {
      due,
      newWords: newWords.slice(0, 40)
    }
  }

  private resolveWordAndList(idOrWord: number | string): { word: string; word_list: string } {
    const str = String(idOrWord).trim()
    const numId = Number(str)

    // 若为纯数字 ID，优先从 idToWordMap 寻找
    if (!isNaN(numId) && this.idToWordMap.has(numId)) {
      return this.idToWordMap.get(numId)!
    }

    // 遍历兜底
    if (!isNaN(numId)) {
      for (const [id, val] of this.idToWordMap.entries()) {
        if (id === numId) return val
      }
    }

    // 若传入的就是英文单词本身
    return { word: str, word_list: 'default' }
  }

  async rememberWord(idOrWord: number | string) {
    const { word: wordStr, word_list: wordList } = this.resolveWordAndList(idOrWord)

    const today = new Date().toISOString().slice(0, 10)
    const existing = await this.getByKey<LocalWordProgress>('word_progress', wordStr)
    const currentReviewCount = existing?.review_count || 0
    const newReviewCount = currentReviewCount + 1

    const stepIdx = Math.min(Math.floor(newReviewCount / 2), this.INTERVAL_STEPS.length - 1)
    const interval = this.INTERVAL_STEPS[stepIdx]
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + interval)
    const nextReview = nextDate.toISOString().slice(0, 10)

    let newMastery = existing?.mastery_level || 0
    if (newMastery === 0) newMastery = 1
    if (newReviewCount >= 5) newMastery = 2

    const updated: LocalWordProgress = {
      word: wordStr,
      word_list: existing?.word_list || wordList,
      review_count: newReviewCount,
      last_review: today,
      next_review: nextReview,
      interval_days: interval,
      mastery_level: newMastery,
      updated_at: new Date().toISOString()
    }

    await this.putItem('word_progress', updated)
    await this.putItem('study_records', {
      word_id: wordStr,
      action: currentReviewCount === 0 ? 'new' : 'review',
      date: today
    })

    return updated
  }

  async forgetWord(idOrWord: number | string) {
    const { word: wordStr, word_list: wordList } = this.resolveWordAndList(idOrWord)

    const today = new Date().toISOString().slice(0, 10)
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + 1)
    const nextReview = nextDate.toISOString().slice(0, 10)

    const existing = await this.getByKey<LocalWordProgress>('word_progress', wordStr)
    let newMastery = existing?.mastery_level || 0
    if (newMastery === 2) newMastery = 1

    const updated: LocalWordProgress = {
      word: wordStr,
      word_list: existing?.word_list || wordList,
      review_count: existing?.review_count || 0,
      last_review: today,
      next_review: nextReview,
      interval_days: 1,
      mastery_level: newMastery,
      updated_at: new Date().toISOString()
    }

    await this.putItem('word_progress', updated)
    await this.putItem('study_records', {
      word_id: wordStr,
      action: 'review',
      date: today
    })

    return updated
  }

  async saveDailyConfig(config: { target_new?: number; target_review?: number }) {
    const item = {
      id: 1,
      target_new: config.target_new || 20,
      target_review: config.target_review || 40,
      updated_at: new Date().toISOString()
    }
    await this.putItem('daily_config', item)
    return item
  }

  // ================= 模块 10: 坚果云 (WebDAV) 同步与全量个人数据导入/导出 =================
  async exportAllUserData() {
    const user_profile = await this.getByKey('user_profile', 1)
    const wrong_items = await this.getAll('wrong_items')
    const student_notes = await this.getAll('student_notes')
    const study_plans = await this.getAll('study_plans')
    const focus_records = await this.getAll('focus_records')
    const grades = await this.getAll('grades')
    const grade_goals = await this.getAll('grade_goals')
    const word_progress = await this.getAll('word_progress')
    const study_records = await this.getAll('study_records')
    const daily_config = await this.getByKey('daily_config', 1)
    const custom_knowledge = await this.getAll('custom_knowledge')
    const custom_resources = await this.getAll('custom_resources')

    // 收集脑力工坊全部游戏最佳纪录与训练统计
    const braingym_records: Record<string, any> = {}
    const points_mastery: Record<string, any> = {}
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (
          key.startsWith('study_braingym_') ||
          key.startsWith('study_schulte_') ||
          key.startsWith('study_2048_') ||
          key.startsWith('study_sudoku_') ||
          key.startsWith('study_klotski_') ||
          key.startsWith('study_arrow_') ||
          key.startsWith('study_minesweeper_') ||
          key.startsWith('study_memory_') ||
          key.startsWith('study_hanoi_') ||
          key.startsWith('sharon_braingym_') ||
          key.startsWith('sharon_schulte_') ||
          key.startsWith('sharon_2048_') ||
          key.startsWith('sharon_sudoku_') ||
          key.startsWith('sharon_klotski_') ||
          key.startsWith('sharon_arrow_') ||
          key.startsWith('sharon_minesweeper_') ||
          key.startsWith('sharon_memory_') ||
          key.startsWith('sharon_hanoi_')
        ) {
          braingym_records[key] = localStorage.getItem(key)
        } else if (
          key === 'study_starred_points' ||
          key === 'study_mastered_points' ||
          key === 'sharon_starred_points' ||
          key === 'sharon_mastered_points'
        ) {
          points_mastery[key] = localStorage.getItem(key)
        }
      }
    }

    return {
      brand: 'StudyBrain',
      version: 1,
      exported_at: new Date().toISOString(),
      user_profile,
      wrong_items,
      student_notes,
      study_plans,
      focus_records,
      grades,
      grade_goals,
      word_progress,
      study_records,
      daily_config,
      custom_knowledge,
      custom_resources,
      braingym_records,
      points_mastery
    }
  }

  async importAllUserData(backup: any) {
    if (!backup || typeof backup !== 'object') {
      throw new Error('无效的备份数据格式')
    }

    if (backup.user_profile) await this.putItem('user_profile', backup.user_profile)
    if (backup.daily_config) await this.putItem('daily_config', backup.daily_config)

    if (Array.isArray(backup.wrong_items)) {
      for (const item of backup.wrong_items) await this.putItem('wrong_items', item)
    }
    if (Array.isArray(backup.student_notes)) {
      for (const item of backup.student_notes) await this.putItem('student_notes', item)
    }
    if (Array.isArray(backup.study_plans)) {
      for (const item of backup.study_plans) await this.putItem('study_plans', item)
    }
    if (Array.isArray(backup.focus_records)) {
      for (const item of backup.focus_records) await this.putItem('focus_records', item)
    }
    if (Array.isArray(backup.grades)) {
      for (const item of backup.grades) await this.putItem('grades', item)
    }
    if (Array.isArray(backup.grade_goals)) {
      for (const item of backup.grade_goals) await this.putItem('grade_goals', item)
    }
    if (Array.isArray(backup.word_progress)) {
      for (const item of backup.word_progress) await this.putItem('word_progress', item)
    }
    if (Array.isArray(backup.study_records)) {
      for (const item of backup.study_records) await this.putItem('study_records', item)
    }
    if (Array.isArray(backup.custom_knowledge)) {
      for (const item of backup.custom_knowledge) await this.putItem('custom_knowledge', item)
    }
    if (Array.isArray(backup.custom_resources)) {
      for (const item of backup.custom_resources) await this.putItem('custom_resources', item)
    }

    // 恢复脑力工坊各游戏历史最佳纪录与统计
    if (backup.braingym_records && typeof backup.braingym_records === 'object' && typeof localStorage !== 'undefined') {
      for (const [key, val] of Object.entries(backup.braingym_records)) {
        if (val !== null && val !== undefined) {
          localStorage.setItem(key, String(val))
          if (key.startsWith('sharon_')) {
            const studyKey = 'study_' + key.slice('sharon_'.length)
            localStorage.setItem(studyKey, String(val))
          }
        }
      }
    }

    // 恢复学科中心收藏与已掌握知识点
    if (backup.points_mastery && typeof backup.points_mastery === 'object' && typeof localStorage !== 'undefined') {
      for (const [key, val] of Object.entries(backup.points_mastery)) {
        if (val !== null && val !== undefined) {
          localStorage.setItem(key, String(val))
          if (key.startsWith('sharon_')) {
            const studyKey = 'study_' + key.slice('sharon_'.length)
            localStorage.setItem(studyKey, String(val))
          }
        }
      }
    }

    return { ok: true, imported_at: new Date().toISOString() }
  }
}

export const localDB = new LocalDatabase()
