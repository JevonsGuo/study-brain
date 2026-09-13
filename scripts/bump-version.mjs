import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const appPkgPath = path.resolve(rootDir, 'sharon-study-app', 'package.json')
const rootPkgPath = path.resolve(rootDir, 'package.json')

// 接受参数：patch (自增修订号，默认) | minor (自增次版本) | major (自增主版本) | 具体版本号 (如 1.2.0)
const arg = (process.argv[2] || 'patch').trim()

function calculateNextVersion(currentVersion, rule) {
  // 如果直接传入合法的具体三段式版本号，直接使用该版本号
  if (/^\d+\.\d+\.\d+$/.test(rule)) {
    return rule
  }

  const parts = currentVersion.split('.').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    return '1.0.1'
  }

  let [major, minor, patch] = parts

  if (rule === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (rule === 'minor') {
    minor += 1
    patch = 0
  } else {
    // 默认 patch 自增
    patch += 1
  }

  return `${major}.${minor}.${patch}`
}

const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'))
const currentVersion = appPkg.version || '1.0.0'
const nextVersion = calculateNextVersion(currentVersion, arg)

// 1. 同步更新 sharon-study-app/package.json
appPkg.version = nextVersion
fs.writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2) + '\n', 'utf8')

// 2. 同步更新 根目录 package.json
if (fs.existsSync(rootPkgPath)) {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'))
  rootPkg.version = nextVersion
  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n', 'utf8')
}

// 3. 更新 public/app-version.json
const publicVersionPath = path.resolve(rootDir, 'sharon-study-app', 'public', 'app-version.json')
if (fs.existsSync(publicVersionPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(publicVersionPath, 'utf8'))
    raw.version = nextVersion
    fs.writeFileSync(publicVersionPath, JSON.stringify(raw, null, 2) + '\n', 'utf8')
  } catch {}
}

console.log(`[bump-version] 🚀 版本号已成功升级: v${currentVersion} -> v${nextVersion} (规则: ${arg})`)
