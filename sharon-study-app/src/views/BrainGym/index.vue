<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GAMES_CATALOG, type GameId } from './types'
import SchulteGrid from './games/SchulteGrid/index.vue'
import Game2048 from './games/Game2048/index.vue'
import Sudoku from './games/Sudoku/index.vue'
import Klotski15 from './games/Klotski15/index.vue'
import ArrowWheel from './games/ArrowWheel/index.vue'
import Minesweeper from './games/Minesweeper/index.vue'
import MemoryMatch from './games/MemoryMatch/index.vue'
import HanoiTower from './games/HanoiTower/index.vue'
import { VideoPlay, MuteNotification, Bell } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

// 当前正在玩的游戏 ID，null 表示停留在游戏大厅
const activeGameId = ref<GameId | null>(null)

// 本地缓存读写辅助 (study_ 前缀，平滑兼容历史 sharon_ 键)
const getStorage = (key: string) => localStorage.getItem('study_' + key) || localStorage.getItem('sharon_' + key)
const setStorage = (key: string, val: string) => localStorage.setItem('study_' + key, val)

// 全局音效静音偏好
const isSoundMuted = ref(getStorage('braingym_muted') === 'true')

// 今日累计与总统计
const todayPlays = ref(0)
const totalTrainSeconds = ref(0)

const toggleSoundMute = () => {
  isSoundMuted.value = !isSoundMuted.value
  setStorage('braingym_muted', String(isSoundMuted.value))
}

// 载入统计与纪录
const loadStats = () => {
  const todayStr = new Date().toISOString().slice(0, 10)
  const savedDate = getStorage('braingym_stat_date')
  if (savedDate !== todayStr) {
    setStorage('braingym_stat_date', todayStr)
    setStorage('braingym_today_plays', '0')
    todayPlays.value = 0
  } else {
    todayPlays.value = Number(getStorage('braingym_today_plays') || '0')
  }
  totalTrainSeconds.value = Number(getStorage('braingym_total_sec') || '0')
}

// 记录保存回调
const handleRecordSaved = (data: { gameId: string; timeMs: number }) => {
  todayPlays.value++
  const addSec = Math.max(1, Math.round(data.timeMs / 1000))
  totalTrainSeconds.value += addSec

  setStorage('braingym_today_plays', String(todayPlays.value))
  setStorage('braingym_total_sec', String(totalTrainSeconds.value))
}

// 获取各游戏的历史最佳描述
const getGameBestDisplay = (gameId: GameId): string | null => {
  if (gameId === 'schulte') {
    const best5 = getStorage('schulte_best_5x5')
    if (best5) return `5×5 最佳: ${(Number(best5) / 1000).toFixed(2)}s`
    const best3 = getStorage('schulte_best_3x3')
    if (best3) return `3×3 最佳: ${(Number(best3) / 1000).toFixed(2)}s`
    return null
  }
  if (gameId === 'game2048') {
    const bestScore = getStorage('2048_best_score')
    if (bestScore && Number(bestScore) > 0) return `最高分: ${bestScore}`
    return null
  }
  if (gameId === 'sudoku') {
    const best4 = getStorage('sudoku_best_4x4')
    if (best4) {
      const s = Math.floor(Number(best4) / 1000)
      return `4×4最佳: ${Math.floor(s / 60)}分${s % 60}秒`
    }
    const best9 = getStorage('sudoku_best_9x9_easy')
    if (best9) {
      const s = Math.floor(Number(best9) / 1000)
      return `9×9最佳: ${Math.floor(s / 60)}分${s % 60}秒`
    }
    return null
  }
  if (gameId === 'klotski15') {
    const best4 = getStorage('klotski_best_4x4')
    if (best4) {
      try {
        const parsed = JSON.parse(best4)
        return `4×4最佳: ${parsed.moves}步`
      } catch { /* ignore */ }
    }
    const best3 = getStorage('klotski_best_3x3')
    if (best3) {
      try {
        const parsed = JSON.parse(best3)
        return `3×3最佳: ${parsed.moves}步`
      } catch { /* ignore */ }
    }
    return null
  }
  if (gameId === 'arrow') {
    const bestLvl = getStorage('arrow_best_level')
    if (bestLvl && Number(bestLvl) > 1) return `最高闯过: LV.${bestLvl}`
    return null
  }
  if (gameId === 'minesweeper') {
    const best8 = getStorage('minesweeper_best_8x8')
    if (best8) return `8×8最佳: ${Math.round(Number(best8) / 1000)}s`
    const best9 = getStorage('minesweeper_best_9x9')
    if (best9) return `9×9最佳: ${Math.round(Number(best9) / 1000)}s`
    return null
  }
  if (gameId === 'memory') {
    const best4 = getStorage('memory_best_4x4')
    if (best4) {
      try {
        const parsed = JSON.parse(best4)
        return `4×4最佳: ${parsed.moves}次`
      } catch { /* ignore */ }
    }
    return null
  }
  if (gameId === 'hanoi') {
    const best3 = getStorage('hanoi_best_3')
    if (best3) {
      try {
        const parsed = JSON.parse(best3)
        return `3阶最佳: ${parsed.moves}步`
      } catch { /* ignore */ }
    }
    const best4 = getStorage('hanoi_best_4')
    if (best4) {
      try {
        const parsed = JSON.parse(best4)
        return `4阶最佳: ${parsed.moves}步`
      } catch { /* ignore */ }
    }
    return null
  }
  return null
}

// 进入游戏
const enterGame = (id: GameId) => {
  activeGameId.value = id
  router.replace({ query: { ...route.query, game: id } })
}

// 返回大厅
const handleBackToHub = () => {
  activeGameId.value = null
  const query = { ...route.query }
  delete query.game
  router.replace({ query })
}

onMounted(() => {
  loadStats()
  const qGame = route.query.game as GameId
  if (qGame && GAMES_CATALOG.some(g => g.id === qGame)) {
    activeGameId.value = qGame
  }
})
</script>

<template>
  <div class="brain-gym-page">
    <!-- 1. 顶部全局工坊导航条 -->
    <header class="gym-top-header">
      <div class="header-brand">
        <div class="brand-icon-wrap">
          <span class="brand-emoji">🎮</span>
        </div>
        <div class="brand-text">
          <h1 class="brand-title">脑力工坊</h1>
          <p class="brand-subtitle">课间微光 · 5 分钟益智思维充能站</p>
        </div>
      </div>

      <!-- 右侧：音效开关与统计徽标 -->
      <div class="header-controls">
        <button
          type="button"
          class="audio-toggle-btn"
          :class="{ 'is-muted': isSoundMuted }"
          :title="isSoundMuted ? '点击开启工坊音效' : '点击静音'"
          @click="toggleSoundMute"
        >
          <el-icon v-if="isSoundMuted"><MuteNotification /></el-icon>
          <el-icon v-else><Bell /></el-icon>
          <span>{{ isSoundMuted ? '音效已关' : '音效开启' }}</span>
        </button>

        <div class="header-stat-pill">
          <span class="stat-label">今日动脑</span>
          <span class="stat-num">{{ todayPlays }}</span>
          <span class="stat-unit">次</span>
        </div>
      </div>
    </header>

    <!-- 2. 状态一：游戏大厅陈列馆 (Game Hub) -->
    <main v-if="!activeGameId" class="gym-hub-view">
      <!-- 推荐横幅卡片 -->
      <div class="featured-banner">
        <div class="banner-left">
          <span class="banner-tag">🔥 今日推荐挑战</span>
          <h2 class="banner-title">⚡ 舒尔特方格 · 30秒极速唤醒专注力</h2>
          <p class="banner-desc">
            刷题疲劳或困倦？用 1~25 乱序方格瞬间激活双眼视幅与注意力，迅速重回心流状态。
          </p>
        </div>
        <button type="button" class="banner-action-btn" @click="enterGame('schulte')">
          <el-icon><VideoPlay /></el-icon>
          <span>立即挑战</span>
        </button>
      </div>

      <!-- 8 大益智游戏卡片网格 -->
      <div class="games-grid-section">
        <div class="section-title-row">
          <div class="section-title">
            <span>🧠 益智自选对局 (8 款精选)</span>
          </div>
          <span class="section-hint">点击卡片开启专注训练，可随时暂停退出</span>
        </div>

        <div class="games-grid">
          <div
            v-for="game in GAMES_CATALOG"
            :key="game.id"
            class="game-card"
            :class="{ 'is-playable': game.status === 'playable' }"
            @click="enterGame(game.id)"
          >
            <!-- 卡片顶部：图标与状态徽章 -->
            <div class="card-top">
              <div class="game-icon-box" :style="{ backgroundColor: game.accentBg }">
                <span class="game-icon">{{ game.icon }}</span>
              </div>
              <div class="status-badge" :class="game.status">
                <span v-if="game.status === 'playable'" class="badge-dot-green"></span>
                <span>{{ game.status === 'playable' ? '可挑战' : '工坊整备中' }}</span>
              </div>
            </div>

            <!-- 卡片中间：名称与副标 -->
            <div class="card-body">
              <h3 class="game-name">{{ game.name }}</h3>
              <p class="game-subtitle">{{ game.subtitle }}</p>
              <p class="game-desc">{{ game.desc }}</p>
            </div>

            <!-- 标签与指标 -->
            <div class="card-tags-row">
              <span v-for="tag in game.tags" :key="tag" class="tag-badge">
                {{ tag }}
              </span>
            </div>

            <!-- 底部：耗时/难度与进入按钮 -->
            <div class="card-footer">
              <div class="footer-meta">
                <div class="meta-item">
                  <span class="meta-label">单局：</span>
                  <span class="meta-value">{{ game.duration }}</span>
                </div>
                <div v-if="getGameBestDisplay(game.id)" class="best-record-pill">
                  🏆 {{ getGameBestDisplay(game.id) }}
                </div>
              </div>

              <div class="enter-btn-wrap">
                <span v-if="game.status === 'playable'" class="enter-label">开始 →</span>
                <span v-else class="preview-label">查看规则</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 3. 状态二：游戏独立舞台容器 (Game Stage) -->
    <main v-else class="gym-stage-view">
      <SchulteGrid
        v-if="activeGameId === 'schulte'"
        :is-muted="isSoundMuted"
        @back="handleBackToHub"
        @record-saved="handleRecordSaved"
      />
      <Game2048
        v-else-if="activeGameId === 'game2048'"
        :is-muted="isSoundMuted"
        @back="handleBackToHub"
        @record-saved="handleRecordSaved"
      />
      <Sudoku
        v-else-if="activeGameId === 'sudoku'"
        :is-muted="isSoundMuted"
        @back="handleBackToHub"
        @record-saved="handleRecordSaved"
      />
      <Klotski15
        v-else-if="activeGameId === 'klotski15'"
        :is-muted="isSoundMuted"
        @back="handleBackToHub"
        @record-saved="handleRecordSaved"
      />
      <ArrowWheel
        v-else-if="activeGameId === 'arrow'"
        :is-muted="isSoundMuted"
        @back="handleBackToHub"
        @record-saved="handleRecordSaved"
      />
      <Minesweeper
        v-else-if="activeGameId === 'minesweeper'"
        :is-muted="isSoundMuted"
        @back="handleBackToHub"
        @record-saved="handleRecordSaved"
      />
      <MemoryMatch
        v-else-if="activeGameId === 'memory'"
        :is-muted="isSoundMuted"
        @back="handleBackToHub"
        @record-saved="handleRecordSaved"
      />
      <HanoiTower
        v-else-if="activeGameId === 'hanoi'"
        :is-muted="isSoundMuted"
        @back="handleBackToHub"
        @record-saved="handleRecordSaved"
      />
    </main>
  </div>
</template>

<style scoped>
.brain-gym-page {
  padding: 24px;
  max-width: 1280px;
  margin: 0 auto;
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 顶部全局工坊导航条 */
.gym-top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.2));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
}

.brand-emoji {
  font-size: 26px;
}

.brand-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main, #0f172a);
  margin: 0 0 2px;
  letter-spacing: -0.3px;
}

.brand-subtitle {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.audio-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 20px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  color: var(--text-regular, #475569);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.audio-toggle-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.audio-toggle-btn.is-muted {
  color: #94a3b8;
  background: var(--bg-page, #f8fafc);
}

.header-stat-pill {
  display: flex;
  align-items: baseline;
  gap: 4px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.stat-label {
  color: var(--text-secondary, #94a3b8);
}

.stat-num {
  font-size: 16px;
  font-weight: 800;
  color: #6366f1;
}

.stat-unit {
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
}

/* 推荐横幅 */
.featured-banner {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(234, 179, 8, 0.08) 100%);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 20px;
  padding: 22px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
}

.banner-left {
  max-width: 720px;
}

.banner-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #d97706;
  background: rgba(234, 179, 8, 0.15);
  padding: 2px 8px;
  border-radius: 6px;
  margin-bottom: 6px;
}

.banner-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  margin: 0 0 6px;
}

.banner-desc {
  font-size: 13px;
  color: var(--text-regular, #475569);
  margin: 0;
  line-height: 1.5;
}

.banner-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  background: #6366f1;
  color: #ffffff;
  border: none;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
}

.banner-action-btn:hover {
  background: #4f46e5;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
}

/* 游戏卡片网格 */
.games-grid-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
}

.section-hint {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.game-card {
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  position: relative;
}

.game-card:hover {
  transform: translateY(-3px);
  border-color: #6366f1;
  box-shadow: 0 10px 24px -6px rgba(99, 102, 241, 0.15);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.game-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-icon {
  font-size: 26px;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-badge.playable {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-badge.coming_soon {
  background: var(--bg-page, #f1f5f9);
  color: var(--text-secondary, #94a3b8);
}

.badge-dot-green {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #10b981;
}

.card-body {
  flex: 1;
  margin-bottom: 14px;
}

.game-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main, #0f172a);
  margin: 0 0 4px;
}

.game-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: #6366f1;
  margin: 0 0 8px;
}

.game-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-regular, #64748b);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.tag-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--bg-page, #f1f5f9);
  color: var(--text-secondary, #64748b);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px dashed var(--border-color, #e2e8f0);
  padding-top: 12px;
}

.footer-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-item {
  font-size: 11px;
}

.meta-label {
  color: var(--text-secondary, #94a3b8);
}

.meta-value {
  color: var(--text-regular, #475569);
  font-weight: 600;
}

.best-record-pill {
  font-size: 11px;
  font-weight: 700;
  color: #10b981;
}

.enter-btn-wrap {
  font-size: 12px;
  font-weight: 700;
}

.enter-label {
  color: #6366f1;
}

.preview-label {
  color: var(--text-secondary, #94a3b8);
}

/* 舞台视图 */
.gym-stage-view {
  padding: 10px 0;
}

/* 脑力工坊小屏自适应 */
@media (max-width: 640px) {
  .schulte-hero-card {
    padding: 16px 14px !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 14px !important;
  }
  .banner-action-btn {
    width: 100% !important;
    justify-content: center !important;
  }
  .games-grid {
    grid-template-columns: 1fr !important;
    gap: 14px !important;
  }
}

</style>
