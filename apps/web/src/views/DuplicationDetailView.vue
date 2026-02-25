<template>
  <div class="page">
    <div class="page-header">
      <div>
        <button @click="goBack" class="muted" style="font-size: 14px; background: none; border: none; padding: 0; cursor: pointer;">
          ← {{ t('analysis.backToProjects') }}
        </button>
        <h2 style="margin: 6px 0 0;">Code Duplication Details</h2>
        <p v-if="duplication" class="muted" style="margin: 4px 0 0;">
          Overall Duplication: {{ duplication.duplicationPercent.toFixed(2) }}% · {{ duplication.duplicationBlocks }} blocks
        </p>
      </div>
    </div>

    <div v-if="loading" style="text-align: center; padding: 32px 0;">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="error" style="color: var(--error-text); padding: 16px;">
      {{ error }}
    </div>

    <div v-else-if="duplication">
      <!-- Summary Cards -->
      <div class="grid" style="margin-bottom: 16px;">
        <div class="card">
          <div class="summary-label">Duplication %</div>
          <div class="summary-value" :class="getPercentClass(duplication.duplicationPercent)">
            {{ duplication.duplicationPercent.toFixed(2) }}%
          </div>
        </div>

        <div class="card">
          <div class="summary-label">Duplicate Blocks</div>
          <div class="summary-value">{{ duplication.duplicationBlocks }}</div>
          <div class="muted" style="font-size: 12px; margin-top: 4px;">
            {{ duplication.totalClones }} clones detected
          </div>
        </div>

        <div class="card">
          <div class="summary-label">Duplicated Lines</div>
          <div class="summary-value">{{ duplication.duplicatedLines }}</div>
          <div class="muted" style="font-size: 12px; margin-top: 4px;">
            across {{ duplication.totalSources }} files
          </div>
        </div>
      </div>

      <!-- Duplication Blocks List -->
      <div class="card">
        <div class="section-header">
          <h3 style="margin: 0;">Duplication Blocks ({{ filteredAndSortedBlocks.length }})</h3>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter by file path..."
              style="min-width: 200px;"
            />
            <select v-model="sortBy">
              <option value="size-desc">Sort by Size (Largest)</option>
              <option value="size-asc">Sort by Size (Smallest)</option>
              <option value="file1">Sort by First File</option>
              <option value="file2">Sort by Second File</option>
            </select>
          </div>
        </div>

        <div v-if="filteredAndSortedBlocks.length === 0" class="muted" style="text-align: center; padding: 32px 0;">
          No duplication blocks match your filter
        </div>

        <div v-else class="blocks-list" style="margin-top: 16px;">
          <div
            v-for="(block, index) in filteredAndSortedBlocks"
            :key="block.id"
            class="block-card"
            @click="selectedBlock = block"
          >
            <div class="block-header">
              <div class="block-number">#{{ index + 1 }}</div>
              <div class="block-size-badge" :class="getSizeBadgeClass(block.lines)">
                {{ block.lines }} lines · {{ block.tokens }} tokens
              </div>
            </div>
            <div class="block-files">
              <div class="block-file">
                <div class="block-file-path" :title="block.file1Path">
                  📄 {{ block.file1Path }}
                </div>
                <div class="block-file-lines muted">
                  Lines {{ block.file1StartLine }}-{{ block.file1EndLine }}
                </div>
              </div>
              <div class="block-separator">⇄</div>
              <div class="block-file">
                <div class="block-file-path" :title="block.file2Path">
                  📄 {{ block.file2Path }}
                </div>
                <div class="block-file-lines muted">
                  Lines {{ block.file2StartLine }}-{{ block.file2EndLine }}
                </div>
              </div>
            </div>
            <div class="block-footer">
              <span class="muted" style="font-size: 11px;">
                Fingerprint: {{ block.fingerprint.slice(0, 16) }}...
              </span>
              <span class="muted" style="font-size: 11px;">
                {{ formatDate(block.createdAt) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Block Details Modal -->
    <div
      v-if="selectedBlock"
      class="modal-overlay"
      @click.self="selectedBlock = null"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h3 style="margin: 0;">Duplication Block Details</h3>
          <button @click="selectedBlock = null" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="summary-grid-modal">
            <div class="summary-tile-modal">
              <div class="summary-label">Lines</div>
              <div class="summary-value">{{ selectedBlock.lines }}</div>
            </div>
            <div class="summary-tile-modal">
              <div class="summary-label">Tokens</div>
              <div class="summary-value">{{ selectedBlock.tokens }}</div>
            </div>
          </div>

          <div style="margin-top: 20px;">
            <div class="file-detail-section">
              <h4 style="margin: 0 0 8px; font-size: 14px;">First Occurrence</h4>
              <div class="file-detail-card">
                <div class="file-detail-path">{{ selectedBlock.file1Path }}</div>
                <div class="file-detail-lines">
                  Lines {{ selectedBlock.file1StartLine }}-{{ selectedBlock.file1EndLine }}
                  ({{ selectedBlock.file1EndLine - selectedBlock.file1StartLine + 1 }} lines)
                </div>
              </div>
            </div>

            <div class="file-detail-section" style="margin-top: 16px;">
              <h4 style="margin: 0 0 8px; font-size: 14px;">Second Occurrence</h4>
              <div class="file-detail-card">
                <div class="file-detail-path">{{ selectedBlock.file2Path }}</div>
                <div class="file-detail-lines">
                  Lines {{ selectedBlock.file2StartLine }}-{{ selectedBlock.file2EndLine }}
                  ({{ selectedBlock.file2EndLine - selectedBlock.file2StartLine + 1 }} lines)
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top: 20px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-primary);">
            <div class="muted" style="font-size: 12px;">
              <strong>Fingerprint:</strong> {{ selectedBlock.fingerprint }}
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 4px;">
              <strong>Detected:</strong> {{ formatDate(selectedBlock.createdAt) }}
            </div>
          </div>

          <div class="muted" style="margin-top: 16px; text-align: center; font-size: 13px;">
            💡 Consider extracting this duplicated code into a shared function or module to improve maintainability.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '../i18n';
import { getDuplication, type DuplicationStats, type DuplicationBlock } from '../services/api';

const route = useRoute();
const router = useRouter();
const { t, locale, getLocaleTag } = useI18n();

const analysisId = route.params.id as string;
const duplication = ref<DuplicationStats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref('');
const sortBy = ref<'size-desc' | 'size-asc' | 'file1' | 'file2'>('size-desc');
const selectedBlock = ref<DuplicationBlock | null>(null);

const getPercentClass = (percent: number): string => {
  if (percent < 3) return 'percent-high';
  if (percent < 10) return 'percent-medium';
  return 'percent-low';
};

const getSizeBadgeClass = (lines: number): string => {
  if (lines >= 50) return 'size-large';
  if (lines >= 20) return 'size-medium';
  return 'size-small';
};

const filteredAndSortedBlocks = computed(() => {
  if (!duplication.value?.blocks) return [];

  let blocks = duplication.value.blocks.filter((block) =>
    block.file1Path.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    block.file2Path.toLowerCase().includes(searchQuery.value.toLowerCase())
  );

  if (sortBy.value === 'size-desc') {
    blocks = blocks.sort((a, b) => b.lines - a.lines);
  } else if (sortBy.value === 'size-asc') {
    blocks = blocks.sort((a, b) => a.lines - b.lines);
  } else if (sortBy.value === 'file1') {
    blocks = blocks.sort((a, b) => a.file1Path.localeCompare(b.file1Path));
  } else if (sortBy.value === 'file2') {
    blocks = blocks.sort((a, b) => a.file2Path.localeCompare(b.file2Path));
  }

  return blocks;
});

const formatDate = (value?: string | null) => {
  if (!value) return t('common.notAvailable');
  return new Date(value).toLocaleString(getLocaleTag(locale.value));
};

const goBack = () => {
  router.push(`/analyses/${analysisId}`);
};

onMounted(async () => {
  try {
    loading.value = true;
    const data = await getDuplication(analysisId);
    duplication.value = data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load duplication details';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.page {
  @apply flex flex-col gap-4;
}

.page-header {
  @apply flex justify-between items-start;
}

.grid {
  display: grid;
  @apply gap-3;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.summary-label {
  @apply text-[11px] uppercase tracking-[0.5px] font-semibold mb-2;
  color: var(--text-secondary);
}

.summary-value {
  @apply text-2xl font-bold;
  color: var(--text-primary);
}

.percent-high {
  color: var(--success-text);
}

.percent-medium {
  color: var(--warning-text);
}

.percent-low {
  color: var(--danger-text);
}

.section-header {
  @apply flex justify-between items-center gap-3 flex-wrap;
}

.blocks-list {
  @apply flex flex-col gap-3;
}

.block-card {
  @apply border-2 rounded-xl p-4 cursor-pointer transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.block-card:hover {
  @apply -translate-y-px;
  border-color: var(--border-secondary);
  box-shadow: 0 4px 12px var(--card-shadow-hover);
}

.block-header {
  @apply flex justify-between items-center mb-3;
}

.block-number {
  @apply text-base font-bold;
  color: var(--text-secondary);
}

.block-size-badge {
  @apply px-2.5 py-1 rounded-md text-xs font-semibold border border-transparent;
}

.block-size-badge.size-large {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border-color: var(--badge-failed-border);
}

.block-size-badge.size-medium {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border-color: #fcd34d;
}

.block-size-badge.size-small {
  background: linear-gradient(135deg, var(--info-bg-start) 0%, var(--info-bg-end) 100%);
  color: var(--info-text);
  border-color: var(--info-border);
}

.block-files {
  display: grid;
  @apply gap-3 items-center;
  grid-template-columns: 1fr auto 1fr;
}

.block-separator {
  @apply text-lg text-center;
  color: var(--text-muted);
}

.block-file {
  @apply flex flex-col gap-1;
}

.block-file-path {
  @apply text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap;
  color: var(--text-primary);
}

.block-file-lines {
  @apply text-xs;
}

.block-footer {
  @apply flex justify-between items-center mt-3 pt-3 border-t;
  border-color: var(--border-primary);
}

.modal-overlay {
  @apply fixed inset-0 flex items-center justify-center p-4 z-[1000] backdrop-blur-sm;
  background: var(--modal-overlay-bg);
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  @apply rounded-xl max-w-[800px] w-full max-h-[90vh] overflow-hidden flex flex-col;
  background: var(--bg-primary);
  box-shadow: 0 12px 24px var(--modal-shadow);
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-header {
  @apply flex justify-between items-center px-6 py-5 border-b-2;
  border-color: var(--border-primary);
}

.modal-close {
  @apply bg-transparent border-none text-[32px] cursor-pointer leading-none p-0 w-8 h-8 flex items-center justify-center rounded-md transition-all duration-150;
  color: var(--text-secondary);
}

.modal-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  @apply p-6 overflow-y-auto;
}

.summary-grid-modal {
  display: grid;
  @apply gap-3;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.summary-tile-modal {
  @apply p-4 border-2 rounded-[10px];
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.file-detail-section h4 {
  color: var(--text-secondary);
}

.file-detail-card {
  @apply p-3 border rounded-lg;
  background: var(--bg-tertiary);
  border-color: var(--border-primary);
}

.file-detail-path {
  @apply text-sm font-semibold mb-1 break-all;
  color: var(--text-primary);
}

.file-detail-lines {
  @apply text-xs;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .block-files {
    grid-template-columns: 1fr;
  }

  .block-separator {
    @apply rotate-90;
  }
}
</style>
