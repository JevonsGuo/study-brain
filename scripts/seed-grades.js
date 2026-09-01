const API_BASE = process.argv[2] || 'http://localhost:3000/api'

const examData = [
  { subject: '语文', exam: '月考一', score: 110, full_score: 150, date: '2025-09-20' },
  { subject: '语文', exam: '月考二', score: 108, full_score: 150, date: '2025-10-18' },
  { subject: '语文', exam: '期中考试', score: 105, full_score: 150, date: '2025-11-12' },
  { subject: '语文', exam: '月考三', score: 100, full_score: 150, date: '2025-12-15' },
  { subject: '语文', exam: '期末考试', score: 98, full_score: 150, date: '2026-01-10' },

  { subject: '数学', exam: '月考一', score: 98, full_score: 150, date: '2025-09-22' },
  { subject: '数学', exam: '月考二', score: 110, full_score: 150, date: '2025-10-20' },
  { subject: '数学', exam: '期中考试', score: 105, full_score: 150, date: '2025-11-14' },
  { subject: '数学', exam: '月考三', score: 120, full_score: 150, date: '2025-12-17' },
  { subject: '数学', exam: '期末考试', score: 128, full_score: 150, date: '2026-01-12' },

  { subject: '英语', exam: '月考一', score: 125, full_score: 150, date: '2025-09-23' },
  { subject: '英语', exam: '月考二', score: 122, full_score: 150, date: '2025-10-21' },
  { subject: '英语', exam: '期中考试', score: 118, full_score: 150, date: '2025-11-15' },
  { subject: '英语', exam: '月考三', score: 112, full_score: 150, date: '2025-12-18' },
  { subject: '英语', exam: '期末考试', score: 108, full_score: 150, date: '2026-01-13' },

  { subject: '物理', exam: '月考一', score: 82, full_score: 100, date: '2025-09-24' },
  { subject: '物理', exam: '月考二', score: 78, full_score: 100, date: '2025-10-22' },
  { subject: '物理', exam: '期中考试', score: 74, full_score: 100, date: '2025-11-16' },
  { subject: '物理', exam: '月考三', score: 70, full_score: 100, date: '2025-12-19' },
  { subject: '物理', exam: '期末考试', score: 65, full_score: 100, date: '2026-01-14' },

  { subject: '化学', exam: '月考一', score: 72, full_score: 100, date: '2025-09-25' },
  { subject: '化学', exam: '月考二', score: 78, full_score: 100, date: '2025-10-23' },
  { subject: '化学', exam: '期中考试', score: 80, full_score: 100, date: '2025-11-17' },
  { subject: '化学', exam: '月考三', score: 83, full_score: 100, date: '2025-12-20' },
  { subject: '化学', exam: '期末考试', score: 86, full_score: 100, date: '2026-01-15' },

  { subject: '生物', exam: '月考一', score: 75, full_score: 100, date: '2025-09-26' },
  { subject: '生物', exam: '月考二', score: 80, full_score: 100, date: '2025-10-24' },
  { subject: '生物', exam: '期中考试', score: 82, full_score: 100, date: '2025-11-18' },
  { subject: '生物', exam: '月考三', score: 85, full_score: 100, date: '2025-12-21' },
  { subject: '生物', exam: '期末考试', score: 88, full_score: 100, date: '2026-01-16' },

  { subject: '历史', exam: '月考一', score: 85, full_score: 100, date: '2025-09-27' },
  { subject: '历史', exam: '月考二', score: 82, full_score: 100, date: '2025-10-25' },
  { subject: '历史', exam: '期中考试', score: 78, full_score: 100, date: '2025-11-19' },
  { subject: '历史', exam: '月考三', score: 72, full_score: 100, date: '2025-12-22' },
  { subject: '历史', exam: '期末考试', score: 68, full_score: 100, date: '2026-01-17' },

  { subject: '地理', exam: '月考一', score: 78, full_score: 100, date: '2025-09-28' },
  { subject: '地理', exam: '月考二', score: 82, full_score: 100, date: '2025-10-26' },
  { subject: '地理', exam: '期中考试', score: 85, full_score: 100, date: '2025-11-20' },
  { subject: '地理', exam: '月考三', score: 80, full_score: 100, date: '2025-12-23' },
  { subject: '地理', exam: '期末考试', score: 88, full_score: 100, date: '2026-01-18' },

  { subject: '政治', exam: '月考一', score: 65, full_score: 100, date: '2025-09-29' },
  { subject: '政治', exam: '月考二', score: 70, full_score: 100, date: '2025-10-27' },
  { subject: '政治', exam: '期中考试', score: 68, full_score: 100, date: '2025-11-21' },
  { subject: '政治', exam: '月考三', score: 74, full_score: 100, date: '2025-12-24' },
  { subject: '政治', exam: '期末考试', score: 78, full_score: 100, date: '2026-01-19' },
]

async function main() {
  let success = 0
  let fail = 0
  for (const g of examData) {
    try {
      const res = await fetch(`${API_BASE}/grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(g),
      })
      if (res.ok) success++
      else fail++
    } catch {
      fail++
    }
  }
  console.log(`Done: ${success} success, ${fail} fail, ${examData.length} total`)
}

main()
