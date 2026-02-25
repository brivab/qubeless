<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-card" @click.stop>
        <div class="modal-header">
          <h3>Auto-Detect Languages</h3>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <div class="modal-body">
          <!-- Loading State -->
          <LoadingState v-if="loading" message="Detecting languages..." />

          <!-- Error State -->
          <ErrorBanner v-else-if="error" :error="error" dismissible @dismiss="error = null" />

          <!-- Results Display -->
          <div v-else-if="detectionResults" class="results-container">
            <p class="summary">
              Detected {{ detectionResults.languages.length }} language(s)
              <span v-if="detectionResults.totalFiles > 0">
                in {{ detectionResults.totalFiles }} files
              </span>
            </p>

            <div v-for="lang in detectionResults.languages" :key="lang.language" class="language-card">
              <div class="language-header">
                <h4>{{ lang.language }}</h4>
                <span v-if="lang.fileCount > 0" class="confidence">
                  {{ lang.confidence.toFixed(1) }}% ({{ lang.fileCount }} files)
                </span>
              </div>

              <div v-if="lang.frameworks && lang.frameworks.length > 0" class="frameworks">
                <span v-for="fw in lang.frameworks" :key="fw" class="framework-badge">{{ fw }}</span>
              </div>

              <div class="suggested-analyzers">
                <p class="analyzers-label">Suggested Analyzers:</p>
                <label
                  v-for="analyzer in lang.suggestedAnalyzers"
                  :key="analyzer"
                  class="analyzer-checkbox"
                >
                  <input
                    type="checkbox"
                    :value="analyzer"
                    v-model="selectedAnalyzers"
                    :disabled="submitting"
                  />
                  <span>{{ analyzer }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="ghost-button" @click="close" :disabled="submitting">
            Cancel
          </button>
          <button
            type="button"
            class="primary-button"
            @click="handleEnableAnalyzers"
            :disabled="submitting || selectedAnalyzers.length === 0"
          >
            {{ submitting ? 'Enabling...' : `Enable ${selectedAnalyzers.length} Analyzer(s)` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { detectProjectLanguages, updateProjectAnalyzer, type DetectLanguagesResponse } from '../../services/api';
import LoadingState from '../common/LoadingState.vue';
import ErrorBanner from '../common/ErrorBanner.vue';

const props = defineProps<{
  modelValue: boolean;
  projectKey: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'analyzers-enabled': [];
}>();

const loading = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);
const detectionResults = ref<DetectLanguagesResponse | null>(null);
const selectedAnalyzers = ref<string[]>([]);

watch(() => props.modelValue, async (open) => {
  if (open) {
    await detectLanguages();
  }
});

async function detectLanguages() {
  loading.value = true;
  error.value = null;
  detectionResults.value = null;
  selectedAnalyzers.value = [];

  try {
    detectionResults.value = await detectProjectLanguages(props.projectKey);
    // Pre-select all suggested analyzers (remove duplicates)
    const allSuggested = detectionResults.value.languages.flatMap(l => l.suggestedAnalyzers);
    selectedAnalyzers.value = [...new Set(allSuggested)];
  } catch (err: any) {
    error.value = err?.message || 'Failed to detect languages. Please run an analysis first.';
  } finally {
    loading.value = false;
  }
}

async function handleEnableAnalyzers() {
  submitting.value = true;
  error.value = null;

  try {
    // Enable each selected analyzer (silently skip if already enabled)
    const results = await Promise.allSettled(
      selectedAnalyzers.value.map(analyzerKey =>
        updateProjectAnalyzer(props.projectKey, analyzerKey, { enabled: true, configJson: null })
      )
    );

    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      error.value = `Failed to enable ${failures.length} analyzer(s). They may not exist in the system.`;
    } else {
      emit('analyzers-enabled');
    }
  } catch (err: any) {
    error.value = err?.message || 'Failed to enable analyzers';
  } finally {
    submitting.value = false;
  }
}

function close() {
  if (!submitting.value) {
    emit('update:modelValue', false);
  }
}

function handleOverlayClick() {
  close();
}
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 flex items-center justify-center z-[1000] p-5 backdrop-blur-sm;
  background: var(--modal-overlay-bg);
}

.modal-card {
  @apply rounded-2xl max-w-[720px] w-full max-h-[90vh] overflow-hidden flex flex-col;
  background: var(--bg-primary);
  box-shadow: 0 20px 60px var(--modal-shadow);
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  @apply flex justify-between items-center px-6 py-5 border-b-2 transition-colors duration-300;
  border-color: var(--border-primary);
}

.modal-header h3 {
  @apply m-0 text-lg font-bold transition-colors duration-300;
  color: var(--text-primary);
}

.close-btn {
  @apply bg-transparent border-none text-2xl font-bold cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300;
  color: var(--text-tertiary);
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  @apply p-6 overflow-y-auto flex-1;
}

.results-container {
  @apply flex flex-col gap-5;
}

.summary {
  @apply text-sm m-0 mb-2 p-3 rounded-lg;
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

.language-card {
  @apply border-2 rounded-xl p-4 transition-all duration-300;
  border-color: var(--border-primary);
  background: var(--bg-secondary);
}

.language-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px var(--primary-shadow);
}

.language-header {
  @apply flex justify-between items-center mb-3;
}

.language-header h4 {
  @apply m-0 text-base font-bold;
  color: var(--text-primary);
}

.confidence {
  @apply text-[13px] font-semibold;
  color: var(--text-secondary);
}

.frameworks {
  @apply flex flex-wrap gap-2 mb-3;
}

.framework-badge {
  @apply inline-block px-3 py-1 rounded-md text-xs font-semibold text-white;
  background: var(--primary);
}

.suggested-analyzers {
  @apply mt-3;
}

.analyzers-label {
  @apply text-[13px] font-semibold m-0 mb-2;
  color: var(--text-primary);
}

.analyzer-checkbox {
  @apply flex items-center gap-2 py-2 cursor-pointer select-none transition-colors duration-300;
}

.analyzer-checkbox:hover {
  color: var(--primary);
}

.analyzer-checkbox input[type='checkbox'] {
  @apply w-[18px] h-[18px] cursor-pointer m-0 flex-shrink-0;
  accent-color: var(--primary);
}

.analyzer-checkbox input[type='checkbox']:disabled {
  @apply cursor-not-allowed opacity-50;
}

.analyzer-checkbox span {
  @apply text-sm font-medium;
}

.modal-footer {
  @apply flex justify-end gap-3 px-6 py-5 border-t-2 transition-colors duration-300;
  border-color: var(--border-primary);
}

.primary-button {
  @apply px-5 py-2.5 border-none rounded-lg font-semibold text-sm cursor-pointer text-white transition-all duration-300;
  background: var(--primary);
}

.primary-button:hover:not(:disabled) {
  @apply -translate-y-px;
  background: var(--primary-dark);
  box-shadow: 0 4px 12px var(--primary-shadow);
}

.primary-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.ghost-button {
  @apply px-5 py-2.5 bg-transparent border-2 rounded-lg font-semibold text-sm cursor-pointer transition-all duration-300;
  color: var(--text-primary);
  border-color: var(--border-primary);
}

.ghost-button:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--bg-tertiary);
}

.ghost-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
