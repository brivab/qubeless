<template>
  <div class="page">
    <div class="page-header">
      <div>
        <button @click="goBack" class="muted back-button" style="font-size: 14px; background: none; border: none; padding: 0; cursor: pointer; transition: color 0.2s ease;">
          ← {{ t('analysis.backToProjects') }}
        </button>
        <h2 style="margin: 6px 0 0;">Coverage Details</h2>
        <p v-if="coverage" class="muted" style="margin: 4px 0 0;">
          Overall Coverage: {{ coverage.coveragePercent.toFixed(2) }}% · Format: {{ coverage.format }}
        </p>
      </div>
    </div>

    <div v-if="loading" style="text-align: center; padding: 32px 0;">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="error" style="color: var(--error-text); padding: 16px;">
      {{ error }}
    </div>

    <div v-else-if="coverage">
      <!-- Summary Cards -->
      <div class="grid" style="margin-bottom: 16px;">
        <div class="card">
          <div class="summary-label">Total Files</div>
          <div class="summary-value">{{ coverage.files.length }}</div>
        </div>

        <div class="card">
          <div class="summary-label">Line Coverage</div>
          <div class="summary-value">{{ coverage.coveredLines }} / {{ coverage.totalLines }}</div>
          <div class="summary-percent" :class="getPercentClass((coverage.coveredLines / coverage.totalLines) * 100)">
            {{ ((coverage.coveredLines / coverage.totalLines) * 100).toFixed(2) }}%
          </div>
        </div>

        <div class="card">
          <div class="summary-label">Branch Coverage</div>
          <div class="summary-value">{{ coverage.coveredBranches }} / {{ coverage.totalBranches }}</div>
          <div class="summary-percent" :class="getPercentClass(coverage.totalBranches > 0 ? (coverage.coveredBranches / coverage.totalBranches) * 100 : 0)">
            {{ coverage.totalBranches > 0 ? ((coverage.coveredBranches / coverage.totalBranches) * 100).toFixed(2) : '0.00' }}%
          </div>
        </div>
      </div>

      <!-- File List -->
      <div class="card">
        <div class="section-header">
          <h3 style="margin: 0;">Files ({{ filteredAndSortedFiles.length }})</h3>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter files..."
              style="min-width: 200px;"
            />
            <select v-model="sortBy">
              <option value="name">Sort by Name</option>
              <option value="coverage-asc">Coverage (Low to High)</option>
              <option value="coverage-desc">Coverage (High to Low)</option>
            </select>
          </div>
        </div>

        <div class="files-table" style="margin-top: 16px;">
          <div class="files-table-header">
            <div class="file-path-col">File Path</div>
            <div class="file-stat-col">Lines</div>
            <div class="file-stat-col">Branches</div>
            <div class="file-coverage-col">Coverage</div>
          </div>

          <div class="files-table-body">
            <div
              v-for="file in filteredAndSortedFiles"
              :key="file.filePath"
              class="file-row"
              @click="selectedFile = file"
            >
              <div class="file-path-col" :title="file.filePath">{{ file.filePath }}</div>
              <div class="file-stat-col">{{ file.coveredLines }} / {{ file.lines }}</div>
              <div class="file-stat-col">{{ file.coveredBranches }} / {{ file.branches }}</div>
              <div class="file-coverage-col">
                <span class="badge" :class="getCoverageBadgeClass(file)">
                  {{ getFileCoveragePercent(file).toFixed(2) }}%
                </span>
              </div>
            </div>
          </div>

          <div v-if="filteredAndSortedFiles.length === 0" class="muted" style="text-align: center; padding: 32px 0;">
            No files match your filter
          </div>
        </div>
      </div>
    </div>

    <!-- File Details Modal -->
    <div
      v-if="selectedFile"
      class="modal-overlay"
      @click.self="selectedFile = null"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h3 style="margin: 0;">{{ selectedFile.filePath }}</h3>
          <button @click="selectedFile = null" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="summary-grid-modal">
            <div class="summary-tile-modal">
              <div class="summary-label">Coverage</div>
              <div class="summary-value" :class="getPercentClass(getFileCoveragePercent(selectedFile))">
                {{ getFileCoveragePercent(selectedFile).toFixed(2) }}%
              </div>
            </div>
            <div class="summary-tile-modal">
              <div class="summary-label">Lines</div>
              <div class="summary-value">{{ selectedFile.coveredLines }} / {{ selectedFile.lines }}</div>
            </div>
            <div class="summary-tile-modal">
              <div class="summary-label">Branches</div>
              <div class="summary-value">{{ selectedFile.coveredBranches }} / {{ selectedFile.branches }}</div>
            </div>
          </div>
          <div class="muted" style="margin-top: 16px; text-align: center;">
            Line-by-line coverage view is available when source code is uploaded with the analysis.
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
import { getCoverage, type CoverageReport, type FileCoverage } from '../services/api';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const analysisId = route.params.id as string;
const coverage = ref<CoverageReport | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref('');
const sortBy = ref<'name' | 'coverage-asc' | 'coverage-desc'>('name');
const selectedFile = ref<FileCoverage | null>(null);

const getFileCoveragePercent = (file: FileCoverage): number => {
  if (file.lines === 0) return 0;
  return (file.coveredLines / file.lines) * 100;
};

const getCoverageBadgeClass = (file: FileCoverage): string => {
  const percent = getFileCoveragePercent(file);
  if (percent >= 80) return 'coverage-high';
  if (percent >= 50) return 'coverage-medium';
  return 'coverage-low';
};

const getPercentClass = (percent: number): string => {
  if (percent >= 80) return 'percent-high';
  if (percent >= 50) return 'percent-medium';
  return 'percent-low';
};

const filteredAndSortedFiles = computed(() => {
  if (!coverage.value) return [];

  let files = coverage.value.files.filter((file) =>
    file.filePath.toLowerCase().includes(searchQuery.value.toLowerCase())
  );

  if (sortBy.value === 'coverage-asc') {
    files = files.sort((a, b) => getFileCoveragePercent(a) - getFileCoveragePercent(b));
  } else if (sortBy.value === 'coverage-desc') {
    files = files.sort((a, b) => getFileCoveragePercent(b) - getFileCoveragePercent(a));
  } else {
    files = files.sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  return files;
});

const goBack = () => {
  router.push(`/analyses/${analysisId}`);
};

onMounted(async () => {
  try {
    loading.value = true;
    coverage.value = await getCoverage(analysisId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load coverage details';
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

.back-button:hover {
  color: var(--text-primary) !important;
}

.grid {
  display: grid;
  @apply gap-3;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.summary-label {
  @apply text-[11px] uppercase tracking-[0.5px] font-semibold mb-2 transition-colors duration-300;
  color: var(--text-secondary);
}

.summary-value {
  @apply text-2xl font-bold transition-colors duration-300;
  color: var(--text-primary);
}

.summary-percent {
  @apply text-sm font-semibold mt-1;
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

.files-table-header {
  display: grid;
  @apply gap-3 py-2.5 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.5px] border transition-all duration-300;
  grid-template-columns: 1fr auto auto auto;
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
  color: var(--text-secondary);
  border-color: var(--border-primary);
}

.files-table-body {
  @apply flex flex-col gap-2 mt-2;
}

.file-row {
  display: grid;
  @apply gap-3 py-3 px-3.5 border-2 rounded-[10px] transition-all duration-200 cursor-pointer;
  grid-template-columns: 1fr auto auto auto;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.file-row:hover {
  @apply -translate-y-px;
  border-color: var(--border-secondary);
  box-shadow: 0 4px 12px var(--card-shadow-hover);
}

.file-path-col {
  @apply overflow-hidden text-ellipsis whitespace-nowrap text-[13px] transition-colors duration-300;
  color: var(--text-primary);
}

.file-stat-col {
  @apply min-w-[100px] text-right text-[13px] transition-colors duration-300;
  color: var(--text-secondary);
}

.file-coverage-col {
  @apply min-w-[100px] text-right;
}

.badge.coverage-high {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
  border-color: var(--badge-success-border);
}

.badge.coverage-medium {
  background: linear-gradient(135deg, var(--badge-critical-bg-start) 0%, var(--badge-critical-bg-end) 100%);
  color: var(--badge-critical-text);
  border-color: var(--badge-critical-border);
}

.badge.coverage-low {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border-color: var(--badge-failed-border);
}

.modal-overlay {
  @apply fixed inset-0 flex items-center justify-center p-4 z-[1000];
  background: rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  @apply border-2 rounded-xl max-w-[800px] w-full max-h-[90vh] overflow-hidden flex flex-col;
  background: var(--bg-primary);
  border-color: var(--border-primary);
  box-shadow: 0 12px 24px var(--card-shadow-hover);
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-header {
  @apply flex justify-between items-center py-5 px-6 border-b-2;
  border-color: var(--border-primary);
}

.modal-close {
  @apply bg-transparent border-none text-[32px] cursor-pointer leading-none p-0 w-8 h-8 flex items-center justify-center rounded-md transition-all duration-150;
  color: var(--text-secondary);
}

.modal-close:hover {
  background: var(--bg-secondary);
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
  @apply p-4 border-2 rounded-[10px] transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.summary-tile-modal:hover {
  border-color: var(--border-secondary);
  box-shadow: 0 2px 8px var(--card-shadow);
}
</style>
