<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { api } from '../../../utils/api'
import { GAMES_CATALOG, type GameId } from '../types'
import { useUserProfileStore } from '../../../stores/userProfile'
import { ElMessage } from 'element-plus'
import { Close, Trophy, Refresh } from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
  initialGameId?: GameId
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const userProfile = useUserProfileStore()
const currentGameId = ref<GameId>(props.initialGameId || 'schulte')
const loading = ref(false)
const submitting = ref(false)

interface LeaderboardItem {
  rank: number
  userName: string
  grade?: string
  score?: number
  timeMs?: number
  steps?: number
  displayScore: string
  achievedAt: string
  isSelf?: boolean
}

const leaderboardList = ref<LeaderboardItem[]>([])
const currentGameMeta = computed(() => GAMES_CATALOG.find(g => g.id === currentGameId.value) || GAMES_CATALOG[0])

// 本地存储读写辅助
const getStorage = (key: string) => localStorage.getItem('study_' + key) || localStorage.getItem('sharon_' + key)

// 获取当前用户在该游戏的本地最佳成绩与展示文字
const myBestData = computed(() => {
  const gid = currentGameId.value
  if (gid === 'schulte') {
    const b5 = getStorage('schulte_best_5x5')
    if (b5) return { rawTime: Number(b5), display: `${(Number(b5) / 1000).toFixed(2)}s` }
    const b3 = getStorage('schulte_best_3x3')
    if (b3) return { rawTime: Number(b3), display: `${(Number(b3) / 1000).toFixed(2)}s` }
    return null
  }
  if (gid === 'game2048') {
    const b = getStorage('2048_best_score')
    if (b && Number(b) > 0) return { rawScore: Number(b), display: `${Number(b).toLocaleString()} 分` }
    return null
  }
  if (gid === 'sudoku') {
    const b = getStorage('sudoku_best_4x4') || getStorage('sudoku_best_9x9_easy')
    if (b) {
      const s = Math.floor(Number(b) / 1000)
      return { rawTime: Number(b), display: `${Math.floor(s / 60)}分${s % 60}秒` }
    }
    return null
  }
  if (gid === 'klotski15') {
    const b4 = getStorage('klotski_best_4x4') || getStorage('klotski_best_3x3')
    if (b4) {
      try {
        const p = JSON.parse(b4)
        return { rawSteps: p.moves, rawTime: p.timeMs, display: `${p.moves} 步` }
      } catch { /* ignore */ }
    }
    return null
  }
  if (gid === 'arrow') {
    const b = getStorage('arrow_best_level')
    if (b && Number(b) > 1) return { rawScore: Number(b), display: `第 ${b} 关` }
    return null
  }
  if (gid === 'minesweeper') {
    const b = getStorage('minesweeper_best_8x8') || getStorage('minesweeper_best_9x9')
    if (b) return { rawTime: Number(b), display: `${(Number(b) / 1000).toFixed(1)}s` }
    return null
  }
  if (gid === 'memory') {
    const b = getStorage('memory_best_4x4')
    if (b) {
      try {
        const p = JSON.parse(b)
        return { rawSteps: p.moves, rawTime: p.timeMs, display: `${p.moves} 步 (${(p.timeMs/1000).toFixed(1)}s)` }
      } catch { /* ignore */ }
    }
    return null
  }
  if (gid === 'hanoi') {
    const b = getStorage('hanoi_best_3') || getStorage('hanoi_best_4')
    if (b) {
      try {
        const p = JSON.parse(b)
        return { rawSteps: p.moves, rawTime: p.timeMs, display: `${p.moves} 步 (${(p.timeMs/1000).toFixed(1)}s)` }
      } catch { /* ignore */ }
    }
    return null
  }
  return null
})

// 加载排行榜数据
const loadLeaderboard = async () => {
  loading.value = true
  try {
    const res = await api.get(`/games/leaderboard?gameId=${currentGameId.value}`)
    if (res && res.leaderboard) {
      // 标记是否为自己的名字
      const myName = userProfile.userName || '同学'
      leaderboardList.value = res.leaderboard.map((item: any) => ({
        ...item,
        isSelf: item.isSelf || item.userName === myName
      }))
    }
  } catch {
    ElMessage.error('加载学霸风云榜失败')
  } finally {
    loading.value = false
  }
}

// 手动或自动将自己的最佳成绩同步上云
const submitMyBest = async () => {
  if (!myBestData.value) {
    ElMessage.info('暂无该游戏的个人最佳战绩，快去挑战一局吧！')
    return
  }
  submitting.value = true
  try {
    const payload: any = {
      gameId: currentGameId.value,
      userName: userProfile.userName || '高三学霸',
      grade: userProfile.gradeLevel || '高三',
      displayScore: myBestData.value.display
    }
    if ('rawScore' in myBestData.value) payload.score = myBestData.value.rawScore
    if ('rawTime' in myBestData.value) payload.timeMs = myBestData.value.rawTime
    if ('rawSteps' in myBestData.value) payload.steps = myBestData.value.rawSteps

    const res = await api.post('/games/leaderboard', payload)
    if (res && res.ok) {
      if (res.rank) {
        ElMessage.success(`🎉 战报同步成功！当前位列全国学霸榜第 ${res.rank} 名！`)
      } else {
        ElMessage.success('成绩已成功同步至全国学霸榜！')
      }
      await loadLeaderboard()
    }
  } catch {
    ElMessage.error('同步成绩失败，请检查网络')
  } finally {
    submitting.value = false
  }
}

const selectGame = (id: GameId) => {
  currentGameId.value = id
  loadLeaderboard()
}

watch(() => props.modelValue, (val) => {
  if (val) {
    if (props.initialGameId) currentGameId.value = props.initialGameId
    loadLeaderboard()
  }
})

const close = () => {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    width="680px"
    class="leaderboard-dialog"
    destroy-on-close
    :show-close="false"
  >
    <!-- 自定义高奢头部 -->
    <template #header>
      <div class="dialog-header-custom">
        <div class="header-left">
          <div class="trophy-badge">
            <span>🏆</span>
          </div>
          <div class="header-titles">
            <div class="header-title-row">
              <h2 class="title-main">全国学霸风云榜</h2>
              <span class="header-tag">全国自律高中生实时联动</span>
            </div>
            <p class="title-sub">课间动脑 · 逻辑思维与专注极限挑战</p>
          </div>
        </div>

        <button type="button" class="close-icon-btn" @click="close">
          <el-icon :size="18"><Close /></el-icon>
        </button>
      </div>
    </template>

    <!-- 游戏切换 Tab 胶囊条 -->
    <div class="game-tabs-scroll">
      <button
        v-for="g in GAMES_CATALOG"
        :key="g.id"
        type="button"
        class="game-tab-btn"
        :class="{ active: currentGameId === g.id }"
        @click="selectGame(g.id)"
      >
        <span class="tab-icon">{{ g.icon }}</span>
        <span class="tab-name">{{ g.name }}</span>
      </button>
    </div>

    <!-- 游戏简介微卡片 -->
    <div class="current-game-meta-banner" :style="{ backgroundColor: currentGameMeta.accentBg }">
      <div class="meta-left">
        <span class="meta-icon">{{ currentGameMeta.icon }}</span>
        <div class="meta-info">
          <div class="meta-name">{{ currentGameMeta.name }} · {{ currentGameMeta.subtitle }}</div>
          <div class="meta-desc">{{ currentGameMeta.desc }}</div>
        </div>
      </div>
      <button
        type="button"
        class="refresh-btn"
        :disabled="loading"
        @click="loadLeaderboard"
        title="刷新实时榜单"
      >
        <el-icon :class="{ 'is-loading': loading }"><Refresh /></el-icon>
        <span>刷新榜</span>
      </button>
    </div>

    <!-- 榜单主体内容 -->
    <div class="leaderboard-body" v-loading="loading" element-loading-text="正在加载学霸排名...">
      <!-- Top 3 领奖台卡片群 -->
      <div v-if="leaderboardList.length >= 3" class="podium-section">
        <!-- 亚军 (Rank 2) -->
        <div class="podium-card rank-2" :class="{ 'is-self': leaderboardList[1].isSelf }">
          <div class="podium-medal">🥈</div>
          <div class="podium-avatar">2</div>
          <div class="podium-name" :title="leaderboardList[1].userName">
            {{ leaderboardList[1].userName }}
          </div>
          <div class="podium-grade">{{ leaderboardList[1].grade || '高中' }}</div>
          <div class="podium-score">{{ leaderboardList[1].displayScore }}</div>
        </div>

        <!-- 冠军 (Rank 1) -->
        <div class="podium-card rank-1" :class="{ 'is-self': leaderboardList[0].isSelf }">
          <div class="crown-icon">👑</div>
          <div class="podium-medal">🥇</div>
          <div class="podium-avatar">1</div>
          <div class="podium-name" :title="leaderboardList[0].userName">
            {{ leaderboardList[0].userName }}
          </div>
          <div class="podium-grade">{{ leaderboardList[0].grade || '高中' }}</div>
          <div class="podium-score gold-score">{{ leaderboardList[0].displayScore }}</div>
        </div>

        <!-- 季军 (Rank 3) -->
        <div class="podium-card rank-3" :class="{ 'is-self': leaderboardList[2].isSelf }">
          <div class="podium-medal">🥉</div>
          <div class="podium-avatar">3</div>
          <div class="podium-name" :title="leaderboardList[2].userName">
            {{ leaderboardList[2].userName }}
          </div>
          <div class="podium-grade">{{ leaderboardList[2].grade || '高中' }}</div>
          <div class="podium-score">{{ leaderboardList[2].displayScore }}</div>
        </div>
      </div>

      <!-- 详细排名卡片列表 (Rank 4 ~ 15) -->
      <div class="rank-list-wrap">
        <div
          v-for="item in leaderboardList"
          :key="item.rank"
          class="rank-row-item"
          :class="{
            'is-top3': item.rank <= 3,
            'is-self': item.isSelf
          }"
        >
          <div class="rank-number-box">
            <span v-if="item.rank === 1" class="rank-badge gold">1</span>
            <span v-else-if="item.rank === 2" class="rank-badge silver">2</span>
            <span v-else-if="item.rank === 3" class="rank-badge bronze">3</span>
            <span v-else class="rank-badge plain">{{ item.rank }}</span>
          </div>

          <div class="player-info-box">
            <div class="player-name-row">
              <span class="player-name">{{ item.userName }}</span>
              <span v-if="item.isSelf" class="self-tag">你</span>
              <span class="player-grade">{{ item.grade || '高三' }}</span>
            </div>
            <div class="player-date">{{ item.achievedAt }}</div>
          </div>

          <div class="score-box">
            <span class="score-val">{{ item.displayScore }}</span>
          </div>
        </div>

        <div v-if="leaderboardList.length === 0 && !loading" class="empty-rank">
          <span>暂无上榜记录，抢先拔得头筹吧！</span>
        </div>
      </div>
    </div>

    <!-- 底部：我的战绩与上榜同步 -->
    <template #footer>
      <div class="leaderboard-footer-bar">
        <div class="my-record-info">
          <span class="my-badge">我的最佳</span>
          <span v-if="myBestData" class="my-score">{{ myBestData.display }}</span>
          <span v-else class="my-score-empty">暂无记录 (快去玩一局)</span>
        </div>

        <div class="footer-actions">
          <button
            v-if="myBestData"
            type="button"
            class="submit-score-btn"
            :disabled="submitting"
            @click="submitMyBest"
          >
            <el-icon v-if="submitting" class="is-loading"><Refresh /></el-icon>
            <el-icon v-else><Trophy /></el-icon>
            <span>同步上榜</span>
          </button>
          <button type="button" class="btn-done" @click="close">
            <span>关闭</span>
          </button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 对齐全站科技感与自律极简审美 */
.dialog-header-custom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.trophy-badge {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(249, 115, 22, 0.15));
  border: 1px solid rgba(234, 179, 8, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(234, 179, 8, 0.15);
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-main {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

:global(html.dark) .title-main {
  color: #f8fafc;
}

.header-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(14, 165, 233, 0.12);
  color: #0284c7;
  border: 1px solid rgba(14, 165, 233, 0.25);
}

:global(html.dark) .header-tag {
  color: #38bdf8;
}

.title-sub {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: #64748b;
}

.close-icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-icon-btn:hover {
  background: rgba(148, 163, 184, 0.15);
  color: #334155;
}

/* 游戏 Tab 栏 */
.game-tabs-scroll {
  display: flex;
  gap: 8px;
  padding: 4px 24px 12px;
  overflow-x: auto;
  scrollbar-width: none;
}

.game-tabs-scroll::-webkit-scrollbar {
  display: none;
}

.game-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(241, 245, 249, 0.8);
  color: #475569;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

:global(html.dark) .game-tab-btn {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}

.game-tab-btn:hover {
  border-color: #38bdf8;
  color: #0284c7;
}

.game-tab-btn.active {
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
  font-weight: 600;
}

/* 游戏说明条 */
.current-game-meta-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 24px 14px;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.meta-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.meta-icon {
  font-size: 20px;
}

.meta-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

:global(html.dark) .meta-name {
  color: #f1f5f9;
}

.meta-desc {
  font-size: 11.5px;
  color: #64748b;
  margin-top: 1px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.8);
  font-size: 11.5px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

:global(html.dark) .refresh-btn {
  background: rgba(30, 41, 59, 0.8);
  color: #cbd5e1;
}

/* 榜单主体 */
.leaderboard-body {
  padding: 0 24px 12px;
  max-height: 400px;
  overflow-y: auto;
}

/* 前三领奖台 */
.podium-section {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 20px;
  padding-top: 24px;
}

.podium-card {
  position: relative;
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 14px;
  padding: 14px 10px 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s;
}

:global(html.dark) .podium-card {
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(148, 163, 184, 0.18);
}

.podium-card.rank-1 {
  background: linear-gradient(180deg, rgba(254, 240, 138, 0.25) 0%, rgba(253, 224, 71, 0.06) 100%);
  border-color: rgba(234, 179, 8, 0.45);
  padding-top: 18px;
  transform: translateY(-8px);
  box-shadow: 0 8px 24px rgba(234, 179, 8, 0.15);
}

.crown-icon {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 20px;
  filter: drop-shadow(0 2px 4px rgba(234, 179, 8, 0.4));
}

.podium-medal {
  font-size: 20px;
  margin-bottom: 2px;
}

.podium-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin: 0 auto 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  background: #e2e8f0;
  color: #475569;
}

.rank-1 .podium-avatar {
  background: #eab308;
  color: #ffffff;
}

.podium-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(html.dark) .podium-name {
  color: #f8fafc;
}

.podium-grade {
  font-size: 10.5px;
  color: #64748b;
  margin-top: 1px;
}

.podium-score {
  font-size: 14px;
  font-weight: 700;
  color: #0284c7;
  margin-top: 6px;
}

.gold-score {
  color: #d97706 !important;
  font-size: 15px;
}

/* 列表行 */
.rank-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rank-row-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.18);
  transition: all 0.2s;
}

:global(html.dark) .rank-row-item {
  background: rgba(30, 41, 59, 0.35);
  border-color: rgba(148, 163, 184, 0.12);
}

.rank-row-item:hover {
  border-color: #38bdf8;
  background: rgba(240, 249, 255, 0.8);
}

.rank-row-item.is-self {
  background: rgba(224, 242, 254, 0.6);
  border-color: #38bdf8;
}

:global(html.dark) .rank-row-item.is-self {
  background: rgba(14, 165, 233, 0.15);
  border-color: #0284c7;
}

.rank-number-box {
  width: 32px;
  flex-shrink: 0;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
}

.rank-badge.gold {
  background: #fef08a;
  color: #a16207;
}

.rank-badge.silver {
  background: #e2e8f0;
  color: #475569;
}

.rank-badge.bronze {
  background: #fed7aa;
  color: #c2410c;
}

.rank-badge.plain {
  color: #94a3b8;
  font-weight: 600;
}

.player-info-box {
  flex: 1;
  min-width: 0;
}

.player-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.player-name {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

:global(html.dark) .player-name {
  color: #e2e8f0;
}

.self-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: #0284c7;
  color: #ffffff;
}

.player-grade {
  font-size: 11px;
  color: #94a3b8;
}

.player-date {
  font-size: 10.5px;
  color: #94a3b8;
  margin-top: 1px;
}

.score-box {
  text-align: right;
}

.score-val {
  font-size: 14px;
  font-weight: 700;
  color: #0284c7;
}

:global(html.dark) .score-val {
  color: #38bdf8;
}

.empty-rank {
  text-align: center;
  padding: 30px;
  color: #94a3b8;
  font-size: 13px;
}

/* 底部栏 */
.leaderboard-footer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 4px 12px;
}

.my-record-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.my-badge {
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.15);
  color: #475569;
}

:global(html.dark) .my-badge {
  color: #cbd5e1;
}

.my-score {
  font-size: 14px;
  font-weight: 700;
  color: #0284c7;
}

.my-score-empty {
  font-size: 12px;
  color: #94a3b8;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.submit-score-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #eab308 0%, #f97316 100%);
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(234, 179, 8, 0.25);
  transition: all 0.2s;
}

.submit-score-btn:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.btn-done {
  padding: 7px 16px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: transparent;
  color: #64748b;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-done:hover {
  background: rgba(148, 163, 184, 0.1);
  color: #334155;
}
</style>
