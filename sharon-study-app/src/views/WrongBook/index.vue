<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../../utils/api'
import { ElMessage } from 'element-plus'
import { subjectEmojis, defaultSubjects } from '../../utils/subjects'

interface WrongItem {
  id: number
  subject: string
  question: string
  reason: string
  created_at: string
}

const wrongItems = ref<WrongItem[]>([])
const loading = ref(false)
const newItem = ref({ subject: '', question: '', reason: '' })
const filterSubject = ref('')

const subjects = defaultSubjects

const filteredItems = computed(() => {
  if (!filterSubject.value) return wrongItems.value
  return wrongItems.value.filter((item) => item.subject === filterSubject.value)
})

const fetchWrongItems = async () => {
  loading.value = true
  try {
    wrongItems.value = await api.get('/wrong-items')
  } catch (e: unknown) {
    ElMessage.error('加载失败: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

const addWrongItem = async () => {
  if (!newItem.value.subject || !newItem.value.question || !newItem.value.reason) return
  try {
    await api.post('/wrong-items', newItem.value)
    newItem.value = { subject: '', question: '', reason: '' }
    await fetchWrongItems()
    ElMessage.success('添加成功')
  } catch (e: unknown) {
    ElMessage.error('添加失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

const removeItem = async (id: number) => {
  try {
    await api.del(`/wrong-items/${id}`)
    await fetchWrongItems()
    ElMessage.success('已删除')
  } catch (e: unknown) {
    ElMessage.error('删除失败')
  }
}

onMounted(fetchWrongItems)
</script>

<template>
  <div class="wrong-book-page">
    <h2>错题本</h2>

    <el-card class="add-card">
      <el-form :inline="true" @submit.prevent="addWrongItem">
        <el-form-item label="科目">
          <el-select v-model="newItem.subject" placeholder="选择科目" style="width: 120px">
            <el-option v-for="s in subjects" :key="s" :label="`${subjectEmojis[s] || '📚'} ${s}`" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="题目">
          <el-input v-model="newItem.question" placeholder="错题内容" style="width: 300px" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="newItem.reason" placeholder="错误原因" style="width: 200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addWrongItem">添加</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="filter-bar">
      <el-radio-group v-model="filterSubject">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button v-for="s in subjects" :key="s" :value="s">{{ s }}</el-radio-button>
      </el-radio-group>
    </div>

    <div class="wrong-list" v-loading="loading">
      <el-card v-for="item in filteredItems" :key="item.id" class="wrong-item">
        <div class="wrong-header">
          <el-tag>{{ item.subject }}</el-tag>
          <span class="wrong-date">{{ item.created_at }}</span>
          <el-button size="small" type="danger" text @click="removeItem(item.id)">删除</el-button>
        </div>
        <h4>{{ item.question }}</h4>
        <p class="wrong-reason">原因：{{ item.reason }}</p>
      </el-card>
      <el-empty v-if="filteredItems.length === 0 && !loading" description="暂无错题" />
    </div>
  </div>
</template>

<style scoped>
.wrong-book-page h2 {
  margin: 0 0 20px;
}

.add-card {
  margin-bottom: 16px;
}

.filter-bar {
  margin-bottom: 16px;
  overflow-x: auto;
}

.wrong-item {
  margin-bottom: 12px;
}

.wrong-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.wrong-date {
  color: #999;
  font-size: 13px;
}

.wrong-item h4 {
  margin: 0 0 4px;
}

.wrong-reason {
  color: #f5222d;
  font-size: 14px;
  margin: 0;
}
</style>
