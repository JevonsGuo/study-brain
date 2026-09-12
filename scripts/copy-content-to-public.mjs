import fs from "fs"
import path from "path"
import crypto from "crypto"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, "..")
const contentDir = path.join(rootDir, "content")
const publicContentDir = path.join(rootDir, "sharon-study-app", "public", "content")

export function syncContentAndVersion() {
  if (!fs.existsSync(publicContentDir)) {
    fs.mkdirSync(publicContentDir, { recursive: true })
  }

  if (!fs.existsSync(contentDir)) {
    console.warn("[sync-public-content] 未找到 content 目录:", contentDir)
    return null
  }

  const files = fs.readdirSync(contentDir).filter(f => f.endsWith(".json") && f !== "version.json")
  files.sort()

  let totalWords = 0
  let knowledgeCount = 0
  let resourceCount = 0
  const wordLists = []
  const hash = crypto.createHash("sha256")

  for (const file of files) {
    const src = path.join(contentDir, file)
    const dest = path.join(publicContentDir, file)
    const raw = fs.readFileSync(src, "utf8")

    hash.update(file)
    hash.update(raw)
    fs.copyFileSync(src, dest)

    if (file === "knowledge.json") {
      try {
        const items = JSON.parse(raw)
        if (Array.isArray(items)) knowledgeCount = items.length
      } catch (e) {
        console.warn("[sync-public-content] 解析 knowledge.json 失败:", e.message)
      }
    } else if (file === "learning-resources.json") {
      try {
        const items = JSON.parse(raw)
        if (Array.isArray(items)) resourceCount = items.length
      } catch (e) {
        console.warn("[sync-public-content] 解析 learning-resources.json 失败:", e.message)
      }
    } else if (file.startsWith("words-") && file.endsWith(".json")) {
      const wordList = file.slice(6, -5)
      try {
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          totalWords += items.length
          wordLists.push({
            word_list: wordList,
            count: items.length
          })
        }
      } catch (e) {
        console.warn("[sync-public-content] 解析 " + file + " 失败:", e.message)
      }
    }
  }

  // 词库排序优先级：上海高阶 -> 高考核心 -> 六级 -> 雅思 -> 托福 -> GRE
  const orderMap = {
    shanghai: 1,
    default: 2,
    cet6: 3,
    ielts: 4,
    toefl: 5,
    gre: 6
  }
  wordLists.sort((a, b) => (orderMap[a.word_list] || 99) - (orderMap[b.word_list] || 99))

  fs.writeFileSync(
    path.join(publicContentDir, "word-lists.json"),
    JSON.stringify(wordLists, null, 2),
    "utf8"
  )

  const contentHash = hash.digest("hex").slice(0, 6)
  const now = new Date()
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "")
  const timeStr = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0") + " " +
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0") + ":" +
    String(now.getSeconds()).padStart(2, "0")

  const versionFilePath = path.join(contentDir, "version.json")
  const publicVersionPath = path.join(publicContentDir, "version.json")

  let existingMeta = null
  if (fs.existsSync(versionFilePath)) {
    try {
      existingMeta = JSON.parse(fs.readFileSync(versionFilePath, "utf8"))
    } catch {}
  }

  let finalVersionMeta
  if (existingMeta && existingMeta.content_hash === contentHash && existingMeta.database_version) {
    // 内容未变，沿用原有版本
    finalVersionMeta = existingMeta
    fs.copyFileSync(versionFilePath, publicVersionPath)
    console.log("[sync-public-content] 公共数据内容无变动，保持版本: v" + finalVersionMeta.database_version)
  } else {
    // 内容变动或首次生成：自动生成新版本号
    const newVersion = yyyymmdd + "." + contentHash
    finalVersionMeta = {
      database_version: newVersion,
      content_hash: contentHash,
      updated_at: timeStr,
      description: "公共数据库自动版本同步 (收录" + knowledgeCount + "个考点、" + resourceCount + "项学科神器与" + totalWords + "个单词)",
      stats: {
        knowledge_points: knowledgeCount,
        learning_resources: resourceCount,
        total_words: totalWords,
        word_lists: wordLists.length
      }
    }
    const formatted = JSON.stringify(finalVersionMeta, null, 2) + "\n"
    fs.writeFileSync(versionFilePath, formatted, "utf8")
    fs.writeFileSync(publicVersionPath, formatted, "utf8")
    console.log("[sync-public-content] 🔔 公共数据指纹变化，已自动生成新数据库版本: v" + newVersion)
  }

  console.log("[sync-public-content] 成功同步公共学科 JSON 至 public/content/ (考点: " + knowledgeCount + ", 资源: " + resourceCount + ", 单词: " + totalWords + ")")
  return finalVersionMeta
}

// 直接作为 CLI 脚本运行时执行
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  syncContentAndVersion()
}
