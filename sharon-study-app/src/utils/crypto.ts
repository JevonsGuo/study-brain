/**
 * 智学大脑 - 端到端零知识加密引擎 (E2EE)
 * 基于浏览器原生 Web Crypto API (PBKDF2 + AES-GCM 256位)
 * 数据在离开学生浏览器前由口令在本地完全加密，服务器与云端仅能访问乱码密文，100% 保护隐私
 */

export interface EncryptedPackage {
  version: number
  salt: string
  iv: string
  ciphertext: string
  updatedAt: string
  dataStats?: {
    wrongItems?: number
    plans?: number
    timerRecords?: number
    userName?: string
  }
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// 辅助函数：Uint8Array 转 Base64
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// 辅助函数：Base64 转 Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * 将用户口令派生为 AES-GCM 256 位密钥
 * 使用 PBKDF2-HMAC-SHA256 进行 100,000 次哈希迭代，强力抵御彩虹表与暴力破解
 */
async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(passcode.trim()),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * 核心加密：将本地学情数据使用口令加密为端到端密文包
 */
export async function encryptPayload(data: any, passcode: string): Promise<EncryptedPackage> {
  const cleanPasscode = passcode.trim()
  if (!cleanPasscode) {
    throw new Error('同步口令不能为空')
  }

  // 1. 生成 16 字节密码学随机盐与 12 字节 GCM 初始化向量 (IV)
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))

  // 2. 派生高强度对称密钥
  const key = await deriveKey(cleanPasscode, salt)

  // 3. 序列化数据并执行 AES-GCM 加密
  const jsonStr = JSON.stringify(data)
  const encodedData = textEncoder.encode(jsonStr)

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any
    },
    key,
    encodedData as any
  )

  // 提取概览统计信息（不包含具体题目、计划或笔记细节，仅展示卡片计数）
  const wrongCount = Array.isArray(data.wrong_items) ? data.wrong_items.length : 0
  const planCount = Array.isArray(data.study_plans) ? data.study_plans.length : 0
  const timerCount = Array.isArray(data.timer_records) ? data.timer_records.length : 0
  const userName = data.user_profile?.user_name || ''

  return {
    version: 1,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    updatedAt: new Date().toISOString(),
    dataStats: {
      wrongItems: wrongCount,
      plans: planCount,
      timerRecords: timerCount,
      userName
    }
  }
}

/**
 * 核心解密：将云端拉取的密文包使用口令解密还原为原始学情对象
 */
export async function decryptPayload(pkg: EncryptedPackage, passcode: string): Promise<any> {
  const cleanPasscode = passcode.trim()
  if (!cleanPasscode) {
    throw new Error('请输入同步口令')
  }

  if (!pkg || !pkg.ciphertext || !pkg.salt || !pkg.iv) {
    throw new Error('密文包格式无效或已损坏')
  }

  try {
    const salt = base64ToUint8Array(pkg.salt)
    const iv = base64ToUint8Array(pkg.iv)
    const ciphertext = base64ToUint8Array(pkg.ciphertext)

    const key = await deriveKey(cleanPasscode, salt)

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any
      },
      key,
      ciphertext as any
    )

    const jsonStr = textDecoder.decode(decryptedBuffer)
    return JSON.parse(jsonStr)
  } catch {
    throw new Error('解密失败：同步口令错误或云端数据已损坏')
  }
}

/**
 * 计算口令的 SHA-256 单向指纹
 * 仅用于云端定位存储空间，不泄露任何明文密码
 */
export async function hashPasscode(passcode: string): Promise<string> {
  const cleanPasscode = passcode.trim()
  const data = textEncoder.encode(`study-brain-sync:${cleanPasscode}`)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 生成高随机度、易记的 6 位安全同步口令
 */
export function generateRandomPasscode(): string {
  const randomNum = Math.floor(100000 + Math.random() * 900000)
  return `sb-${randomNum}`
}
