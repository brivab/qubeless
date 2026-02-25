<template>
  <div class="page">
    <div class="page-header">
      <div>
        <p class="muted" style="margin: 0">Admin</p>
        <h2 style="margin: 4px 0 0">Analyzers</h2>
      </div>
      <div class="header-actions">
        <button class="ghost-button" @click="loadAnalyzers" :disabled="loading" data-cy="admin-analyzers-refresh">Refresh</button>
        <button @click="openCreateModal" data-cy="admin-analyzers-open-create">Add Analyzer</button>
      </div>
    </div>

    <div class="filters-bar">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by key or name..."
          class="search-input"
          data-cy="admin-analyzers-search"
        />
      </div>
      <div class="filter-chips">
        <button
          class="filter-chip"
          :class="{ active: filterEnabled === null }"
          @click="filterEnabled = null"
        >
          All
        </button>
        <button
          class="filter-chip"
          :class="{ active: filterEnabled === true }"
          @click="filterEnabled = true"
        >
          Enabled
        </button>
        <button
          class="filter-chip"
          :class="{ active: filterEnabled === false }"
          @click="filterEnabled = false"
        >
          Disabled
        </button>
      </div>
    </div>

    <LoadingState v-if="loading" message="Loading analyzers..." />

    <ErrorBanner v-else-if="error" :error="error" dismissible @dismiss="error = null" />

    <div v-else-if="filteredAnalyzers.length === 0" class="card">
      <p class="muted">No analyzers found. {{ searchQuery ? 'Try a different search.' : 'Add one to get started.' }}</p>
    </div>

    <div v-else class="analyzers-grid">
      <div v-for="analyzer in filteredAnalyzers" :key="analyzer.id" class="analyzer-card" :data-cy="`admin-analyzer-card-${analyzer.key}`">
        <div class="card-header">
          <div class="analyzer-info">
            <div class="analyzer-name">{{ analyzer.name }}</div>
            <div class="muted">{{ analyzer.key }}</div>
            <div class="muted docker-image">{{ analyzer.dockerImage }}</div>
            <div class="status-badge" :class="analyzer.enabled ? 'enabled' : 'disabled'">
              {{ analyzer.enabled ? 'Enabled' : 'Disabled' }}
            </div>
          </div>

          <label class="toggle">
            <input
              type="checkbox"
              :checked="analyzer.enabled"
              @change="handleToggleEnabled(analyzer)"
              :disabled="updatingId === analyzer.id"
              :data-cy="`admin-analyzer-toggle-${analyzer.key}`"
            />
            <span class="switch" aria-hidden="true">
              <span class="knob"></span>
            </span>
          </label>
        </div>

        <div class="card-footer">
          <button class="ghost-button compact" @click="openEditModal(analyzer)">Edit</button>
          <button class="ghost-button compact danger" @click="confirmDelete(analyzer)">
            Delete
          </button>
        </div>
      </div>
    </div>

    <AnalyzerFormModal
      v-model="showFormModal"
      :analyzer="editingAnalyzer"
      @submit="handleFormSubmit"
    />

    <ConfirmModal
      v-model="showDeleteConfirm"
      title="Delete Analyzer"
      :message="`Are you sure you want to delete '${deletingAnalyzer?.name}'? This action cannot be undone.`"
      confirm-text="Delete"
      cancel-text="Cancel"
      danger-confirm
      @confirm="handleDelete"
    />

    <Toast v-if="toastMessage" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  getAnalyzers,
  createAnalyzer,
  updateAnalyzer,
  deleteAnalyzer,
  type Analyzer,
} from '../services/api';
import AnalyzerFormModal from '../components/analyzers/AnalyzerFormModal.vue';
import ConfirmModal from '../components/common/ConfirmModal.vue';
import LoadingState from '../components/common/LoadingState.vue';
import ErrorBanner from '../components/common/ErrorBanner.vue';
import Toast from '../components/common/Toast.vue';

const analyzers = ref<Analyzer[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const filterEnabled = ref<boolean | null>(null);

const showFormModal = ref(false);
const editingAnalyzer = ref<Analyzer | null>(null);

const showDeleteConfirm = ref(false);
const deletingAnalyzer = ref<Analyzer | null>(null);

const updatingId = ref<string | null>(null);

const toastMessage = ref('');
const toastType = ref<'success' | 'error' | 'info'>('info');

const filteredAnalyzers = computed(() => {
  let result = analyzers.value;

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (a) => a.key.toLowerCase().includes(query) || a.name.toLowerCase().includes(query),
    );
  }

  if (filterEnabled.value !== null) {
    result = result.filter((a) => a.enabled === filterEnabled.value);
  }

  return result.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
});

async function loadAnalyzers() {
  loading.value = true;
  error.value = null;
  try {
    analyzers.value = await getAnalyzers();
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load analyzers';
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingAnalyzer.value = null;
  showFormModal.value = true;
}

function openEditModal(analyzer: Analyzer) {
  editingAnalyzer.value = analyzer;
  showFormModal.value = true;
}

async function handleFormSubmit(data: {
  key: string;
  name: string;
  dockerImage: string;
  enabled: boolean;
}) {
  try {
    if (editingAnalyzer.value) {
      const updated = await updateAnalyzer(editingAnalyzer.value.key, {
        name: data.name,
        dockerImage: data.dockerImage,
        enabled: data.enabled,
      });
      analyzers.value = analyzers.value.map((a) => (a.id === updated.id ? updated : a));
      showToast('Analyzer updated successfully', 'success');
    } else {
      const created = await createAnalyzer(data);
      analyzers.value.push(created);
      showToast('Analyzer created successfully', 'success');
    }
    showFormModal.value = false;
  } catch (err: any) {
    showToast(err?.message ?? 'Failed to save analyzer', 'error');
  }
}

async function handleToggleEnabled(analyzer: Analyzer) {
  if (updatingId.value) return;

  const newEnabled = !analyzer.enabled;

  if (!newEnabled) {
    const confirmed = confirm(
      `Disabling '${analyzer.name}' globally will affect all projects using this analyzer. Continue?`,
    );
    if (!confirmed) return;
  }

  updatingId.value = analyzer.id;

  try {
    const updated = await updateAnalyzer(analyzer.key, { enabled: newEnabled });
    analyzers.value = analyzers.value.map((a) => (a.id === updated.id ? updated : a));
    showToast(
      `Analyzer ${newEnabled ? 'enabled' : 'disabled'} successfully`,
      'success',
    );
  } catch (err: any) {
    showToast(err?.message ?? 'Failed to update analyzer', 'error');
  } finally {
    updatingId.value = null;
  }
}

function confirmDelete(analyzer: Analyzer) {
  deletingAnalyzer.value = analyzer;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!deletingAnalyzer.value) return;

  try {
    await deleteAnalyzer(deletingAnalyzer.value.key);
    analyzers.value = analyzers.value.filter((a) => a.id !== deletingAnalyzer.value!.id);
    showToast('Analyzer deleted successfully', 'success');
  } catch (err: any) {
    showToast(err?.message ?? 'Failed to delete analyzer', 'error');
  } finally {
    deletingAnalyzer.value = null;
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toastMessage.value = message;
  toastType.value = type;
  setTimeout(() => {
    toastMessage.value = '';
  }, 100);
}

onMounted(loadAnalyzers);
</script>

<style scoped>
.page {
  @apply flex flex-col gap-5;
}

.page-header {
  @apply flex justify-between items-center flex-wrap gap-3;
}

.header-actions {
  @apply flex gap-2.5 flex-wrap;
}

.filters-bar {
  @apply flex items-center gap-4 flex-wrap;
}

.search-box {
  @apply flex-1 min-w-[240px];
}

.search-input {
  @apply w-full px-4 py-2.5 border-2 rounded-[10px] text-sm transition-all duration-300;
  border-color: var(--border-primary);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.search-input:focus {
  @apply outline-none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.filter-chips {
  @apply flex gap-2 flex-wrap;
}

.filter-chip {
  @apply border-2 rounded-full px-4 py-2 font-bold text-xs cursor-pointer uppercase tracking-[0.3px] transition-all duration-300;
  border-color: var(--filter-chip-border);
  background: linear-gradient(135deg, var(--filter-chip-bg-start) 0%, var(--filter-chip-bg-end) 100%);
  color: var(--filter-chip-text);
  box-shadow: 0 2px 4px var(--filter-chip-shadow);
}

.filter-chip:hover:not(.active) {
  @apply -translate-y-px;
  border-color: var(--filter-chip-border-hover);
  box-shadow: 0 4px 8px var(--filter-chip-shadow-hover);
}

.filter-chip.active {
  background: linear-gradient(135deg, var(--filter-chip-active-bg-start) 0%, var(--filter-chip-active-bg-end) 100%);
  color: var(--filter-chip-active-text);
  border-color: var(--filter-chip-active-border);
  box-shadow: 0 4px 12px var(--filter-chip-active-shadow);
}

.analyzers-grid {
  display: grid;
  @apply gap-4;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.analyzer-card {
  @apply border-2 rounded-xl p-[18px] flex flex-col gap-3.5 transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
  box-shadow: 0 4px 12px var(--card-shadow);
}

.analyzer-card:hover {
  @apply -translate-y-0.5;
  border-color: var(--border-secondary);
  box-shadow: 0 8px 20px var(--card-shadow-hover);
}

.card-header {
  @apply flex justify-between gap-3;
}

.analyzer-info {
  @apply flex-1 flex flex-col gap-1.5;
}

.analyzer-name {
  @apply text-base font-bold transition-colors duration-300;
  color: var(--text-primary);
}

.docker-image {
  @apply text-xs font-mono break-all;
}

.status-badge {
  @apply inline-block self-start px-3 py-[5px] rounded-full text-[11px] font-bold uppercase tracking-[0.3px] border border-transparent;
}

.status-badge.enabled {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
  border-color: var(--badge-success-border);
}

.status-badge.disabled {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border-color: var(--badge-failed-border);
}

.toggle {
  @apply flex flex-col items-center gap-1.5 font-semibold text-[11px];
}

.toggle input {
  @apply hidden;
}

.switch {
  @apply w-12 h-[26px] rounded-full relative transition-all duration-300 inline-flex items-center p-[3px];
  background: var(--toggle-bg);
  border: 1px solid var(--toggle-border);
}

.knob {
  @apply w-[18px] h-[18px] rounded-full translate-x-0 transition-all duration-300;
  background: var(--toggle-knob);
  box-shadow: 0 2px 6px var(--toggle-knob-shadow);
}

.toggle input:checked + .switch {
  background: var(--toggle-checked-bg);
  border-color: var(--toggle-checked-border);
}

.toggle input:checked + .switch .knob {
  @apply translate-x-5;
  background: var(--toggle-checked-knob);
  box-shadow: 0 4px 10px var(--toggle-checked-knob-shadow);
}

.card-footer {
  @apply flex gap-2 pt-2 border-t transition-colors duration-300;
  border-color: var(--border-primary);
}

.compact {
  @apply px-3 py-1.5 text-[13px];
}

.danger {
  @apply transition-all duration-300;
  color: var(--danger-text);
}

.danger:hover:not(:disabled) {
  background: var(--danger-bg);
  color: var(--danger-text-dark);
}
</style>
