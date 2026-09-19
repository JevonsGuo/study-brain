import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const publicDir = path.resolve(rootDir, 'sharon-study-app', 'public')

const faviconSvgPath = path.join(publicDir, 'favicon.svg')
const originalSvg = fs.readFileSync(faviconSvgPath, 'utf8')

// 提取 favicon.svg 内部的主体图形与 defs
const innerMatch = originalSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
if (!innerMatch) {
  console.error('无法解析 favicon.svg')
  process.exit(1)
}
const innerContent = innerMatch[1]

// 构建标准 512x512 带沉浸渐变背景的高清 App 图标 SVG
// 原始图形 viewBox="0 0 48 46"
// 缩放比例: 48 * 6 = 288, 居中偏移: (512 - 288) / 2 = 112, y 偏移: (512 - 46 * 6) / 2 = 118
const appIconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="pwaBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#312e81" />
      <stop offset="45%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#7c3aed" />
    </linearGradient>
    <filter id="pwaIconGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000" flood-opacity="0.38"/>
    </filter>
  </defs>
  <!-- 背景底色，适配 Android 自适应 maskable 安全区域与 iOS 默认圆角裁切 -->
  <rect width="512" height="512" rx="116" fill="url(#pwaBgGrad)" />
  <!-- 居中高清晰 LOGO -->
  <g transform="translate(112, 118) scale(6)" filter="url(#pwaIconGlow)">
    ${innerContent}
  </g>
</svg>
`

const tempSvgPath = path.join(publicDir, 'pwa-icon.svg')
fs.writeFileSync(tempSvgPath, appIconSvg, 'utf8')

console.log('正在生成各规格 PWA 高清 PNG 图标...')

const tmpDir = '/tmp'
execSync(`qlmanage -t -s 512 -o "${tmpDir}" "${tempSvgPath}"`, { stdio: 'inherit' })

const renderedPng = path.join(tmpDir, 'pwa-icon.svg.png')
if (!fs.existsSync(renderedPng)) {
  console.error('qlmanage 渲染失败')
  process.exit(1)
}

const target512 = path.join(publicDir, 'pwa-512x512.png')
const target192 = path.join(publicDir, 'pwa-192x192.png')
const targetApple = path.join(publicDir, 'apple-touch-icon.png')

// 1. 512x512 图标
fs.copyFileSync(renderedPng, target512)

// 2. 192x192 图标 (Android 标准)
execSync(`sips -z 192 192 "${renderedPng}" --out "${target192}"`, { stdio: 'inherit' })

// 3. 180x180 图标 (iOS Apple Touch Icon)
execSync(`sips -z 180 180 "${renderedPng}" --out "${targetApple}"`, { stdio: 'inherit' })

console.log('✅ PWA 图标生成完毕：')
console.log(' - public/pwa-512x512.png')
console.log(' - public/pwa-192x192.png')
console.log(' - public/apple-touch-icon.png')
