<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../../utils/api'
import { ElMessage } from 'element-plus'

interface Grade {
  id: number
  subject: string
  exam: string
  score: number
  full_score: number
  date: string
}

const grades = ref<Grade[]>([])
const loading = ref(false)
const newGrade = ref({ subject: '', exam: '', score: 0, full_score: 150, date: '' })

const fetchGrades = async () => {
  loading.value = true
  try {
    grades.value = await api.get('/grades')
  } catch (e: unknown) {
    ElMessage.error('加载失败: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

const addGrade = async () => {
  if (!newGrade.value.subject || !newGrade.value.exam || !newGrade.value.date) return
  try {
    await api.post('/grades', newGrade.value)
    newGrade.value = { subject: '', exam: '', score: 0, full_score: 150, date: '' }
    await fetchGrades()
    ElMessage.success('添加成功')
  } catch (e: unknown) {
    ElMessage.error('添加失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

const removeGrade = async (id: number) => {
  try {
    await api.del(`/grades/${id}`)
    await fetchGrades()
    ElMessage.success('已删除')
  } catch (e: unknown) {
    ElMessage.error('删除失败')
  }
}

const getBarStyle = (grade: Grade) => {
  const pct = (grade.score / grade.full_score) * 100
  const color = pct >= 90 ? '#52c41a' : pct >= 75 ? '#1890ff' : pct >= 60 ? '#faad14' : '#f5222d'
  return { width: pct + '%', background: color }
}

onMounted(fetchGrades)
</script>

<template>
  <div class="grade-tracker-page">
    <h2>成绩追踪</h2>

    <el-card class="add-card">
      <el-form :inline="true" @submit.prevent="addGrade">
        <el-form-item label="科目">
          <el-input v-model="newGrade.subject" placeholder="科目" style="width: 100px" />
        </el-form-item>
        <el-form-item label="考试">
          <el-input v-model="newGrade.exam" placeholder="考试名称" style="width: 120px" />
        </el-form-item>
        <el-form-item label="分数">
          <el-input-number v-model="newGrade.score" :min="0" :max="newGrade.full_score" style="width: 120px" />
        </el-form-item>
        <el-form-item label="满分">
          <el-input-number v-model="newGrade.full_score" :min="1" style="width: 120px" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="newGrade.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addGrade">添加</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="grades" stripe class="grade-table" v-loading="loading">
      <el-table-column prop="subject" label="科目" width="100" />
      <el-table-column prop="exam" label="考试" width="120" />
      <el-table-column label="分数" width="200">
        <template #default="{ row }">
          <div class="score-bar-wrapper">
            <span class="score-text">{{ row.score }}/{{ row.full_score }}</span>
            <div class="score-bar">
              <div class="score-bar-fill" :style="getBarStyle(row)"></div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="date" label="日期" width="140" />
      <el-table-column label="操作" width="80">
        <template #default="{ row }">
          <el-button size="small" type="danger" text @click="removeGrade(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.grade-tracker-page h2 {
  margin: 0 0 20px;
}

.add-card {
  margin-bottom: 20px;
}

.score-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.score-text {
  width: 70px;
  font-size: 14px;
  font-weight: 500;
}

.score-bar {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}
</style>
