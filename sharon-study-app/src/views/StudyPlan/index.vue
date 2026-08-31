<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../../utils/api'
import { ElMessage } from 'element-plus'

interface PlanItem {
  id: number
  subject: string
  content: string
  date: string
  done: boolean
}

const plans = ref<PlanItem[]>([])
const loading = ref(false)
const newPlan = ref({ subject: '', content: '', date: '' })

const fetchPlans = async () => {
  loading.value = true
  try {
    plans.value = await api.get('/study-plans')
  } catch (e: unknown) {
    ElMessage.error('加载失败: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

const addPlan = async () => {
  if (!newPlan.value.subject || !newPlan.value.content || !newPlan.value.date) return
  try {
    await api.post('/study-plans', newPlan.value)
    newPlan.value = { subject: '', content: '', date: '' }
    await fetchPlans()
    ElMessage.success('添加成功')
  } catch (e: unknown) {
    ElMessage.error('添加失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

const toggleDone = async (item: PlanItem) => {
  try {
    await api.put(`/study-plans/${item.id}/toggle`)
    await fetchPlans()
  } catch (e: unknown) {
    ElMessage.error('操作失败')
  }
}

const removePlan = async (id: number) => {
  try {
    await api.del(`/study-plans/${id}`)
    await fetchPlans()
    ElMessage.success('已删除')
  } catch (e: unknown) {
    ElMessage.error('删除失败')
  }
}

onMounted(fetchPlans)
</script>

<template>
  <div class="study-plan-page">
    <h2>学习计划</h2>

    <el-card class="add-card">
      <el-form :inline="true" @submit.prevent="addPlan">
        <el-form-item label="科目">
          <el-input v-model="newPlan.subject" placeholder="如：数学" style="width: 120px" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="newPlan.content" placeholder="学习内容" style="width: 240px" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="newPlan.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addPlan">添加</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="plans" stripe class="plan-table" v-loading="loading">
      <el-table-column prop="subject" label="科目" width="120" />
      <el-table-column prop="content" label="学习内容" />
      <el-table-column prop="date" label="日期" width="140" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.done ? 'success' : 'info'">{{ row.done ? '已完成' : '待完成' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" :type="row.done ? 'warning' : 'success'" @click="toggleDone(row)">
            {{ row.done ? '撤销' : '完成' }}
          </el-button>
          <el-button size="small" type="danger" @click="removePlan(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.study-plan-page h2 {
  margin: 0 0 20px;
}

.add-card {
  margin-bottom: 20px;
}

.plan-table {
  width: 100%;
}
</style>
