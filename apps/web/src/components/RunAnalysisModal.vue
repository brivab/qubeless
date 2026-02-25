<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>{{ t('analysis.runAnalysis') }}</h3>
        <button class="close-button" @click="close">&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">{{ t('analysis.branch') }} *</label>
          <select v-model="selectedBranch" class="form-input" :disabled="loading">
            <option value="">{{ t('analysis.selectBranch') }}</option>
            <option v-for="branch in branches" :key="branch.id" :value="branch.name">
              {{ branch.name }} {{ branch.isDefault ? t('project.defaultBranch') : '' }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('analysis.commitSha') }} *</label>
          <input
            v-model="commitSha"
            type="text"
            class="form-input"
            :placeholder="t('analysis.commitShaPlaceholder')"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('analysis.analyzers') }}</label>
          <p class="form-help">{{ t('analysis.analyzersHelp') }}</p>
          <div class="analyzer-list">
            <label
              v-for="analyzer in activeAnalyzers"
              :key="analyzer.analyzer.id"
              class="analyzer-checkbox"
            >
              <input
                type="checkbox"
                :value="analyzer.analyzer.id"
                v-model="selectedAnalyzerIds"
                :disabled="loading"
              />
              <span>{{ analyzer.analyzer.name }}</span>
              <span class="analyzer-key">{{ analyzer.analyzer.key }}</span>
            </label>
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>
      </div>

      <div class="modal-footer">
        <button class="ghost-button" @click="close" :disabled="loading">
          {{ t('common.cancel') }}
        </button>
        <button
          class="primary-button"
          @click="runAnalysis"
          :disabled="loading || !canSubmit"
        >
          {{ loading ? t('analysis.running') : t('analysis.run') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from '../i18n';
import { createAnalysis, getProjectAnalyzers, type Branch, type ProjectAnalyzerStatus } from '../services/api';

const props = defineProps<{
  isOpen: boolean;
  projectKey: string;
  branches: Branch[];
}>();

const emit = defineEmits<{
  close: [];
  success: [analysisId: string];
}>();

const { t } = useI18n();

const selectedBranch = ref('');
const commitSha = ref('');
const selectedAnalyzerIds = ref<string[]>([]);
const analyzers = ref<ProjectAnalyzerStatus[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const activeAnalyzers = computed(() =>
  analyzers.value.filter((a: ProjectAnalyzerStatus) => a.effectiveEnabled)
);

const canSubmit = computed(() =>
  selectedBranch.value && commitSha.value && commitSha.value.length >= 7
);

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // Reset form
    selectedBranch.value = '';
    commitSha.value = '';
    selectedAnalyzerIds.value = [];
    error.value = null;

    // Load analyzers
    try {
      analyzers.value = await getProjectAnalyzers(props.projectKey);
    } catch (err: any) {
      error.value = err?.message ?? t('analysis.errorLoadAnalyzers');
    }

    // Pre-select default branch
    const defaultBranch = props.branches.find(b => b.isDefault);
    if (defaultBranch) {
      selectedBranch.value = defaultBranch.name;
    }
  }
});

async function runAnalysis() {
  error.value = null;
  loading.value = true;

  try {
    const payload: {
      commitSha: string;
      branch: string;
      analyzerIds?: string[];
    } = {
      commitSha: commitSha.value.trim(),
      branch: selectedBranch.value,
    };

    // Only include analyzerIds if some are selected
    if (selectedAnalyzerIds.value.length > 0) {
      payload.analyzerIds = selectedAnalyzerIds.value;
    }

    const result = await createAnalysis(props.projectKey, payload);
    emit('success', result.analysisId);
    close();
  } catch (err: any) {
    error.value = err?.message ?? t('analysis.errorRunAnalysis');
  } finally {
    loading.value = false;
  }
}

function close() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-5;
}

.modal-container {
  @apply bg-bg-primary rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)];
  @apply max-w-[600px] w-full max-h-[90vh] flex flex-col;
}

.modal-header {
  @apply flex justify-between items-center py-5 px-6 border-b-2 border-border-primary;
}

.modal-header h3 {
  @apply m-0 text-xl font-bold text-text-primary;
}

.close-button {
  @apply bg-transparent border-0 text-[32px] text-text-secondary cursor-pointer p-0;
  @apply w-8 h-8 flex items-center justify-center leading-none;
  @apply transition-colors duration-200 ease-in-out;
}

.close-button:hover {
  @apply text-text-primary;
}

.modal-body {
  @apply p-6 overflow-y-auto flex-1;
}

.form-group {
  @apply mb-5;
}

.form-label {
  @apply block font-semibold mb-2 text-text-primary text-sm;
}

.form-help {
  @apply my-1 mb-3 text-[13px] text-text-secondary;
}

.form-input {
  @apply w-full border-2 border-border-primary rounded-lg py-[10px] px-3 text-sm;
  @apply bg-bg-primary text-text-primary transition-all duration-200 ease-in-out;
}

.form-input:focus {
  @apply outline-none border-[var(--primary)] shadow-[0_0_0_3px_rgba(79,70,229,0.1)];
}

.form-input:disabled {
  @apply bg-bg-tertiary cursor-not-allowed;
}

.analyzer-list {
  @apply flex flex-col gap-2 max-h-[200px] overflow-y-auto;
  @apply border-2 border-border-primary rounded-lg p-3;
}

.analyzer-checkbox {
  @apply flex items-center gap-[10px] cursor-pointer py-2 px-2 rounded-md;
  @apply transition-colors duration-200 ease-in-out;
}

.analyzer-checkbox:hover {
  @apply bg-bg-secondary;
}

.analyzer-checkbox input[type="checkbox"] {
  @apply w-[18px] h-[18px] cursor-pointer;
}

.analyzer-checkbox span {
  @apply text-sm text-text-primary;
}

.analyzer-key {
  @apply ml-auto text-xs text-text-secondary font-mono;
}

.error-message {
  @apply p-3 bg-[#fee2e2] border border-[#fca5a5] rounded-lg;
  @apply text-[#b91c1c] text-sm mt-4;
}

.modal-footer {
  @apply flex justify-end gap-3 py-5 px-6 border-t-2 border-border-primary;
}

.primary-button {
  @apply bg-gradient-to-br from-[#4f46e5] to-[#6366f1] text-white border-0 rounded-lg;
  @apply py-[10px] px-5 font-semibold text-sm cursor-pointer;
  @apply transition-all duration-200 ease-in-out shadow-[0_2px_4px_rgba(79,70,229,0.2)];
}

.primary-button:hover:not(:disabled) {
  @apply -translate-y-[1px] shadow-[0_4px_12px_rgba(79,70,229,0.3)];
}

.primary-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
