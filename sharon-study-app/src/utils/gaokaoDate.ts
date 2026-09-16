/**
 * 智能根据学生年级推算高考年份与剩余倒计时天数
 */
export interface GaokaoTargetInfo {
  targetYear: number
  targetDate: Date
  targetDateStr: string
  diffDays: number
  stageDesc: string
}

export function getGaokaoTarget(gradeLevel: string, currentDate = new Date()): GaokaoTargetInfo {
  const currentYear = currentDate.getFullYear()
  // 6月7日 00:00:00 (注意：月份 5 代表 6月)
  const thisYearGaokao = new Date(currentYear, 5, 7, 0, 0, 0)
  const baseGaokaoYear = currentDate.getTime() > thisYearGaokao.getTime() ? currentYear + 1 : currentYear

  let targetYear = baseGaokaoYear
  const gl = (gradeLevel || "").trim()

  if (gl.includes("高一")) {
    targetYear = baseGaokaoYear + 2
  } else if (gl.includes("高二")) {
    targetYear = baseGaokaoYear + 1
  } else {
    // 默认高三
    targetYear = baseGaokaoYear
  }

  const targetDate = new Date(targetYear, 5, 7, 0, 0, 0)
  const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0)
  const diffDays = Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

  let stageDesc = "高三冲刺阶段"
  if (gl.includes("高一")) stageDesc = "高一扎根奠基"
  else if (gl.includes("高二")) stageDesc = "高二强化培优"

  return {
    targetYear,
    targetDate,
    targetDateStr: `${targetYear}年6月7日`,
    diffDays,
    stageDesc
  }
}
