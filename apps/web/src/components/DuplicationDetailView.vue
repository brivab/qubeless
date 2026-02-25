<template>
  <div class="duplication-detail-view">
    <div class="header">
      <h2>Code Duplication Blocks</h2>
      <p class="muted">{{ blocks.length }} duplicate blocks found</p>
    </div>

    <div v-if="loading" class="loading">
      Loading duplication data...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else-if="blocks.length === 0" class="empty-state">
      <p>No code duplication detected in this analysis.</p>
      <p class="muted">This is great! Your code has minimal duplication.</p>
    </div>

    <div v-else class="blocks-list">
      <div v-for="block in sortedBlocks" :key="block.id" class="duplication-block">
        <div class="block-header">
          <div class="block-stats">
            <span class="stat">
              <strong>{{ block.lines }}</strong> lines
            </span>
            <span class="stat">
              <strong>{{ block.tokens }}</strong> tokens
            </span>
          </div>
          <button
            @click="toggleBlock(block.id)"
            class="toggle-button"
            :class="{ expanded: expandedBlocks.has(block.id) }"
          >
            {{ expandedBlocks.has(block.id) ? '▼' : '▶' }}
          </button>
        </div>

        <div class="block-files">
          <div class="file-location">
            <span class="file-icon">📄</span>
            <code>{{ block.file1Path }}</code>
            <span class="line-range">
              Lines {{ block.file1StartLine }}–{{ block.file1EndLine }}
            </span>
          </div>
          <div class="duplicate-arrow">⟷</div>
          <div class="file-location">
            <span class="file-icon">📄</span>
            <code>{{ block.file2Path }}</code>
            <span class="line-range">
              Lines {{ block.file2StartLine }}–{{ block.file2EndLine }}
            </span>
          </div>
        </div>

        <div v-if="expandedBlocks.has(block.id)" class="block-details">
          <div class="detail-info">
            <p class="muted">
              This code block appears in two different locations.
              Consider extracting it into a shared function or module to reduce duplication.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div v-if="stats" class="summary-stats">
      <h3>Summary</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Duplication Rate</div>
          <div class="stat-value" :style="{ color: duplicationColor }">
            {{ Math.round(stats.duplicationPercent * 10) / 10 }}%
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Duplicated Lines</div>
          <div class="stat-value">{{ stats.duplicatedLines }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Files Scanned</div>
          <div class="stat-value">{{ stats.totalSources }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Clone Instances</div>
          <div class="stat-value">{{ stats.totalClones }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getDuplication, getDuplicationBlocks, type DuplicationBlock, type DuplicationStats } from '../services/api';

const props = defineProps<{
  analysisId: string;
}>();

const blocks = ref<DuplicationBlock[]>([]);
const stats = ref<DuplicationStats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const expandedBlocks = ref<Set<number>>(new Set());

const sortedBlocks = computed(() => {
  return [...blocks.value].sort((a, b) => b.lines - a.lines);
});

const duplicationColor = computed(() => {
  if (!stats.value) return '#6b7280';
  const percent = stats.value.duplicationPercent;
  if (percent < 3) return '#10b981';
  if (percent < 5) return '#f59e0b';
  if (percent < 10) return '#f97316';
  return '#ef4444';
});

function toggleBlock(id: number) {
  if (expandedBlocks.value.has(id)) {
    expandedBlocks.value.delete(id);
  } else {
    expandedBlocks.value.add(id);
  }
}

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    const [statsData, blocksData] = await Promise.all([
      getDuplication(props.analysisId),
      getDuplicationBlocks(props.analysisId)
    ]);
    stats.value = statsData;
    blocks.value = blocksData;
  } catch (err) {
    console.error('Failed to fetch duplication data:', err);
    error.value = 'Failed to load duplication data';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.duplication-detail-view {
  @apply p-6 max-w-[1200px] mx-auto;
}

.header {
  @apply mb-6;
}

.header h2 {
  @apply m-0 mb-2 text-2xl font-semibold;
}

.loading, .error, .empty-state {
  @apply text-center py-12;
}

.error {
  @apply text-[#b91c1c];
}

.empty-state {
  @apply bg-bg-secondary rounded-lg;
}

.blocks-list {
  @apply flex flex-col gap-4 mb-8;
}

.duplication-block {
  @apply bg-bg-primary border border-border-primary rounded-lg p-4;
  @apply transition-shadow duration-200;
}

.duplication-block:hover {
  @apply shadow-[0_2px_8px_rgba(0,0,0,0.1)];
}

.block-header {
  @apply flex justify-between items-center mb-3;
}

.block-stats {
  @apply flex gap-4;
}

.stat {
  @apply text-sm text-text-secondary;
}

.toggle-button {
  @apply bg-transparent border-0 cursor-pointer text-base py-1 px-2 text-text-secondary;
}

.toggle-button:hover {
  @apply text-text-primary;
}

.block-files {
  @apply flex items-center gap-4 p-3 bg-bg-secondary rounded-md;
}

.file-location {
  @apply flex-1 flex items-center gap-2 text-sm;
}

.file-icon {
  @apply text-base;
}

.file-location code {
  @apply bg-bg-primary py-1 px-2 rounded text-[13px] flex-1;
  @apply overflow-hidden text-ellipsis whitespace-nowrap;
}

.line-range {
  @apply text-text-secondary text-xs whitespace-nowrap;
}

.duplicate-arrow {
  @apply text-text-muted text-xl;
}

.block-details {
  @apply mt-3 pt-3 border-t border-border-primary;
}

.detail-info {
  @apply text-sm;
}

.summary-stats {
  @apply mt-8 p-6 bg-bg-secondary rounded-lg;
}

.summary-stats h3 {
  @apply m-0 mb-4 text-lg font-semibold;
}

.stats-grid {
  display: grid;
  @apply gap-4;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.stat-card {
  @apply bg-bg-primary p-4 rounded-md text-center;
}

.stat-label {
  @apply text-xs text-text-secondary mb-2;
}

.stat-value {
  @apply text-[28px] font-bold text-text-primary;
}

.muted {
  @apply text-text-muted;
}
</style>
