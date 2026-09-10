/**
 * 高考各学科权威微课平台与名师推荐工具库
 * 提供 B 站名师精选检索直达、国家中小学智慧教育平台官方微课与优质题解通道
 */

export interface SubjectTeacherMeta {
  subject: string
  biliTeachers: string[]
  searchKeywordPrefix: string
  smartEduCategory: string
  tips: string
}

export const SUBJECT_VIDEO_CONFIG: Record<string, SubjectTeacherMeta> = {
  数学: {
    subject: '数学',
    biliTeachers: ['一数', '王云飞高中数学', '赵礼显数学'],
    searchKeywordPrefix: '高中数学',
    smartEduCategory: '普通高中 · 数学',
    tips: '推荐观看“一数”老师的高中数学考点全通系列，逻辑清晰、保姆级推导。'
  },
  物理: {
    subject: '物理',
    biliTeachers: ['李永乐老师', '质心物理', '坤哥物理'],
    searchKeywordPrefix: '高中物理',
    smartEduCategory: '普通高中 · 物理',
    tips: '推荐“李永乐老师”具象模型解析与“质心物理”经典题型归纳。'
  },
  化学: {
    subject: '化学',
    biliTeachers: ['李政化学', '高东辉化学', '化学老师刘延阁'],
    searchKeywordPrefix: '高中化学',
    smartEduCategory: '普通高中 · 化学',
    tips: '推荐“李政化学”元素周期律与反应机理思维导图，口诀化秒杀。'
  },
  生物: {
    subject: '生物',
    biliTeachers: ['周老师高中生物', '老李搞生物', '生物徐老师'],
    searchKeywordPrefix: '高中生物',
    smartEduCategory: '普通高中 · 生物',
    tips: '推荐“周老师高中生物”，细胞代谢、遗传图解与稳态调节深入浅出。'
  },
  语文: {
    subject: '语文',
    biliTeachers: ['董腾语文', '国家宝藏官方', '高中语文苏老师'],
    searchKeywordPrefix: '高中语文',
    smartEduCategory: '普通高中 · 语文',
    tips: '推荐结合国家宝藏古文赏析与现代文论述类文本快速破题方法。'
  },
  英语: {
    subject: '英语',
    biliTeachers: ['高中英语语法解构', '奇速英语', '田静高考英语'],
    searchKeywordPrefix: '高中英语',
    smartEduCategory: '普通高中 · 英语',
    tips: '推荐核心语法长难句解构与完形填空语篇逻辑精讲。'
  },
  历史: {
    subject: '历史',
    biliTeachers: ['国家通史精讲', '高考历史袁老师', '大喵历史'],
    searchKeywordPrefix: '高中历史',
    smartEduCategory: '普通高中 · 历史',
    tips: '推荐通史大时空坐标系串讲与唯物史观材料解析专项。'
  },
  地理: {
    subject: '地理',
    biliTeachers: ['包易正地理', '高考地理大讲堂', '地理周老师'],
    searchKeywordPrefix: '高中地理',
    smartEduCategory: '普通高中 · 地理',
    tips: '推荐“包易正地理”，自然地理三维地球模型演示与人文地理答题模板。'
  },
  政治: {
    subject: '政治',
    biliTeachers: ['思政金课', '政治徐涛', '高考政治陆老师'],
    searchKeywordPrefix: '高中思想政治',
    smartEduCategory: '普通高中 · 思想政治',
    tips: '推荐结合哲学矛盾分析法与新发展理念核心政治术语背诵模型。'
  }
}

export interface VideoHubInfo {
  subject: string
  title: string
  chapter: string
  book: string
  bilibiliSearchUrl: string
  smartEduUrl: string
  baiduSearchUrl: string
  biliTeachers: string[]
  tips: string
  directVideoUrl: string
  embedUrl: string
  hasDirectVideo: boolean
}

/**
 * 校验并提取可用的 B 站嵌入式播放地址
 */
export function getBilibiliEmbedUrl(url: string): string {
  if (!url) return ''
  const bvMatch = url.match(/\/(BV[\w]+)/)
  if (bvMatch) {
    return `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&autoplay=0&high_quality=1&as_wide=1&danmaku=0`
  }
  const avMatch = url.match(/\/av(\d+)/)
  if (avMatch) {
    return `https://player.bilibili.com/player.html?aid=${avMatch[1]}&autoplay=0&high_quality=1&as_wide=1&danmaku=0`
  }
  return ''
}

/**
 * 获取考点的多渠道权威视频信息
 */
export function getVideoHubInfo(point: {
  subject: string
  title: string
  chapter?: string
  book?: string
  video_url?: string
}): VideoHubInfo {
  const meta = SUBJECT_VIDEO_CONFIG[point.subject] || {
    subject: point.subject,
    biliTeachers: ['学科名师'],
    searchKeywordPrefix: `高中${point.subject}`,
    smartEduCategory: `普通高中 · ${point.subject}`,
    tips: '推荐在 B 站或国家智慧教育平台搜索该考点精讲。'
  }

  const query = `${meta.searchKeywordPrefix} ${point.title}`
  const bilibiliSearchUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`
  const smartEduUrl = 'https://basic.smartedu.cn/tchMaterial'
  const baiduSearchUrl = `https://wenku.baidu.com/search?word=${encodeURIComponent(`${query} 视频微课`)}`

  const directVideoUrl = point.video_url || ''
  const embedUrl = getBilibiliEmbedUrl(directVideoUrl)
  const hasDirectVideo = Boolean(embedUrl)

  return {
    subject: point.subject,
    title: point.title,
    chapter: point.chapter || '',
    book: point.book || '',
    bilibiliSearchUrl,
    smartEduUrl,
    baiduSearchUrl,
    biliTeachers: meta.biliTeachers,
    tips: meta.tips,
    directVideoUrl,
    embedUrl,
    hasDirectVideo
  }
}
