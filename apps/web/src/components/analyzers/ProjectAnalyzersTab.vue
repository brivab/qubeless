<template>
  <div class="analyzers-tab">
    <div class="tab-header">
      <h3>Analyzers Configuration</h3>
      <div class="header-buttons">
        <button class="primary-button" @click="showAutoDetectModal = true" data-cy="project-analyzers-auto-detect">
          Auto-Detect Languages
        </button>
        <button class="ghost-button" @click="loadAnalyzers" :disabled="loading" data-cy="project-analyzers-refresh">
          Refresh
        </button>
      </div>
    </div>

    <LoadingState v-if="loading" message="Loading analyzers..." />

    <ErrorBanner v-else-if="error" :error="error" dismissible @dismiss="error = null" />

    <div v-else-if="analyzers.length === 0" class="card">
      <p class="muted">No analyzers available</p>
    </div>

    <div v-else class="analyzers-list">
      <ProjectAnalyzerCard
        v-for="link in analyzers"
        :key="link.analyzer.id"
        :analyzer="link.analyzer"
        :project-enabled="link.projectEnabled"
        :config-json="link.configJson"
        @save="(data) => handleSave(link.analyzer.key, data)"
      />
    </div>

    <Toast v-if="toastMessage" :message="toastMessage" :type="toastType" />

    <AutoDetectAnalyzersModal
      v-model="showAutoDetectModal"
      :project-key="projectKey"
      @analyzers-enabled="handleAnalyzersEnabled"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getProjectAnalyzers, updateProjectAnalyzer, type ProjectAnalyzerStatus } from '../../services/api';
import ProjectAnalyzerCard from './ProjectAnalyzerCard.vue';
import LoadingState from '../common/LoadingState.vue';
import ErrorBanner from '../common/ErrorBanner.vue';
import Toast from '../common/Toast.vue';
import AutoDetectAnalyzersModal from './AutoDetectAnalyzersModal.vue';

const props = defineProps<{
  projectKey: string;
}>();

const analyzers = ref<ProjectAnalyzerStatus[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const showAutoDetectModal = ref(false);

const toastMessage = ref('');
const toastType = ref<'success' | 'error' | 'info'>('info');

async function loadAnalyzers() {
  loading.value = true;
  error.value = null;
  try {
    analyzers.value = await getProjectAnalyzers(props.projectKey);
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load analyzers configuration';
  } finally {
    loading.value = false;
  }
}

async function handleSave(
  analyzerKey: string,
  data: { enabled: boolean; configJson: Record<string, unknown> | null },
) {
  try {
    const updated = await updateProjectAnalyzer(props.projectKey, analyzerKey, data);
    analyzers.value = analyzers.value.map((item) =>
      item.analyzer.id === updated.analyzer.id ? updated : item,
    );
    showToast('Configuration saved successfully', 'success');
  } catch (err: any) {
    showToast(err?.message ?? 'Failed to save configuration', 'error');
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toastMessage.value = message;
  toastType.value = type;
  setTimeout(() => {
    toastMessage.value = '';
  }, 100);
}

function handleAnalyzersEnabled() {
  showAutoDetectModal.value = false;
  loadAnalyzers();
  showToast('Analyzers enabled successfully', 'success');
}

onMounted(loadAnalyzers);
</script>

<style scoped>
.analyzers-tab {
  @apply flex flex-col gap-5;
}

.tab-header {
  @apply flex justify-between items-center;
}

.tab-header h3 {
  @apply m-0 text-lg font-bold;
}

.header-buttons {
  @apply flex gap-3;
}

.primary-button {
  @apply py-2 px-4 bg-[var(--primary)] text-white border-0 rounded-lg;
  @apply font-semibold text-sm cursor-pointer transition-all duration-300;
}

.primary-button:hover:not(:disabled) {
  @apply bg-[var(--primary-dark)] -translate-y-[1px] shadow-[0_4px_12px_var(--primary-shadow)];
}

.primary-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.analyzers-list {
  @apply flex flex-col gap-4;
}
</style>
