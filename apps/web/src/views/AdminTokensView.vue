<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink to="/admin" class="muted" style="font-size: 14px">{{ t('adminTokens.back') }}</RouterLink>
        <h2 style="margin: 6px 0 0">{{ t('adminTokens.title') }}</h2>
        <p class="muted" style="margin: 4px 0 0">
          {{ t('adminTokens.subtitle') }}
        </p>
      </div>
      <button class="ghost-button" @click="loadTokens" :disabled="loading">{{ t('common.refresh') }}</button>
    </div>

    <div class="card">
      <h3 style="margin-top: 0">{{ t('adminTokens.createTitle') }}</h3>
      <div class="form-grid">
        <label>
          <div class="muted">{{ t('adminTokens.nameLabel') }}</div>
          <input v-model="form.name" :placeholder="t('adminTokens.defaultName')" />
        </label>
        <label>
          <div class="muted">{{ t('adminTokens.projectKeyLabel') }}</div>
          <input v-model="form.projectKey" placeholder="demo-project" />
        </label>
      </div>
      <div v-if="createError" class="form-error">{{ createError }}</div>
      <div style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
        <button @click="createToken" :disabled="creating">
          {{ creating ? t('common.creating') : t('common.create') }}
        </button>
        <button class="ghost-button" type="button" @click="resetForm" :disabled="creating">{{ t('common.reset') }}</button>
      </div>
      <div v-if="createdToken" class="token-banner">
        <div style="font-weight: 700; margin-bottom: 4px;">{{ t('adminTokens.generatedTitle') }}</div>
        <div class="code-pill">{{ createdToken }}</div>
        <div class="muted" style="margin-top: 4px;">
          {{ t('adminTokens.generatedHint') }}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <div class="section-title">
          <h3 style="margin: 0">{{ t('adminTokens.existingTitle') }}</h3>
          <div class="muted" style="display: flex; gap: 10px; flex-wrap: wrap;">
            <span>{{ t('adminTokens.count', { count: tokens.length }) }}</span>
            <span>{{ t('adminTokens.selectedCount', { count: selectedCount }) }}</span>
          </div>
        </div>
        <div class="section-actions">
          <label class="select-all">
            <input
              ref="selectAllRef"
              type="checkbox"
              :checked="allSelected"
              :disabled="tokens.length === 0 || bulkDeleting || loading"
              @change="toggleSelectAll"
            />
            <span class="muted">{{ t('adminTokens.selectAll') }}</span>
          </label>
          <button
            class="ghost-button danger"
            type="button"
            @click="removeSelectedTokens"
            :disabled="selectedCount === 0 || bulkDeleting || loading"
          >
            {{ bulkDeleting ? t('common.deleting') : t('adminTokens.deleteSelected', { count: selectedCount }) }}
          </button>
        </div>
      </div>
      <div v-if="loading">{{ t('adminTokens.loading') }}</div>
      <div v-else-if="error" class="form-error">{{ error }}</div>
      <div v-else-if="tokens.length === 0" class="muted">{{ t('adminTokens.none') }}</div>
      <div v-else class="list">
        <div v-for="token in tokens" :key="token.id" class="list-item">
          <label class="select-box">
            <input
              type="checkbox"
              :value="token.id"
              v-model="selectedTokens"
              :disabled="bulkDeleting || deleting === token.id"
            />
          </label>
          <div class="token-content">
            <div style="font-weight: 700;">{{ token.name }}</div>
            <div class="muted" style="font-size: 13px;">
              {{ t('adminTokens.tokenMeta', { id: token.id.slice(0, 8), project: token.projectId || t('common.allLower') }) }}
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 4px;">
              {{
                t('adminTokens.tokenDates', {
                  created: formatDate(token.createdAt),
                  lastUsed: token.lastUsedAt ? formatDate(token.lastUsedAt) : t('adminTokens.never'),
                })
              }}
            </div>
          </div>
          <button class="ghost-button danger" @click="removeToken(token.id)" :disabled="deleting === token.id || bulkDeleting">
            {{ deleting === token.id ? t('common.deleting') : t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { createApiToken, deleteApiToken, deleteApiTokens, getApiTokens, type ApiToken } from '../services/api';
import { useI18n } from '../i18n';

const tokens = ref<ApiToken[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const deleting = ref<string | null>(null);
const bulkDeleting = ref(false);
const selectedTokens = ref<string[]>([]);
const selectAllRef = ref<HTMLInputElement | null>(null);
const { t, locale, getLocaleTag } = useI18n();

const form = ref({
  name: t('adminTokens.defaultName'),
  projectKey: '',
});
const creating = ref(false);
const createdToken = ref<string | null>(null);
const createError = ref<string | null>(null);
const selectedCount = computed(() => selectedTokens.value.length);
const allSelected = computed(
  () => tokens.value.length > 0 && selectedTokens.value.length === tokens.value.length,
);
const someSelected = computed(
  () => selectedTokens.value.length > 0 && selectedTokens.value.length < tokens.value.length,
);

function formatDate(date: string) {
  return new Date(date).toLocaleString(getLocaleTag(locale.value));
}

async function loadTokens() {
  loading.value = true;
  error.value = null;
  try {
    tokens.value = await getApiTokens();
  } catch (err: any) {
    error.value = err?.message ?? t('adminTokens.errorLoad');
  } finally {
    loading.value = false;
  }
}

async function createToken() {
  if (!form.value.name.trim()) {
    createError.value = t('adminTokens.errorNameRequired');
    return;
  }
  creating.value = true;
  createError.value = null;
  createdToken.value = null;
  try {
    const payload = {
      name: form.value.name.trim(),
      projectKey: form.value.projectKey.trim() || undefined,
    };
    const created = await createApiToken(payload);
    createdToken.value = created.token;
    await loadTokens();
  } catch (err: any) {
    createError.value = err?.message ?? t('adminTokens.errorCreate');
  } finally {
    creating.value = false;
  }
}

function resetForm() {
  form.value = { name: t('adminTokens.defaultName'), projectKey: '' };
  createdToken.value = null;
  createError.value = null;
}

async function removeToken(id: string) {
  if (!confirm(t('adminTokens.deleteConfirm'))) return;
  deleting.value = id;
  try {
    await deleteApiToken(id);
    tokens.value = tokens.value.filter((t) => t.id !== id);
    selectedTokens.value = selectedTokens.value.filter((selectedId) => selectedId !== id);
  } catch (err: any) {
    alert(err?.message ?? t('adminTokens.errorDelete'));
  } finally {
    deleting.value = null;
  }
}

async function removeSelectedTokens() {
  if (selectedTokens.value.length === 0) return;
  if (!confirm(t('adminTokens.deleteManyConfirm', { count: selectedTokens.value.length }))) return;
  bulkDeleting.value = true;
  try {
    const { deletedIds, missingIds } = await deleteApiTokens([...selectedTokens.value]);
    const removedIds = new Set([...deletedIds, ...missingIds]);
    if (removedIds.size > 0) {
      tokens.value = tokens.value.filter((token) => !removedIds.has(token.id));
    }
    selectedTokens.value = [];
  } catch (err: any) {
    alert(err?.message ?? t('adminTokens.errorDeleteMany', { count: selectedTokens.value.length }));
  } finally {
    bulkDeleting.value = false;
  }
}

function toggleSelectAll(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.checked) {
    selectedTokens.value = tokens.value.map((token) => token.id);
  } else {
    selectedTokens.value = [];
  }
}

watch(tokens, (nextTokens) => {
  const existingIds = new Set(nextTokens.map((token) => token.id));
  selectedTokens.value = selectedTokens.value.filter((id) => existingIds.has(id));
});

watch([someSelected, allSelected], () => {
  if (!selectAllRef.value) return;
  selectAllRef.value.indeterminate = someSelected.value;
});

onMounted(loadTokens);
</script>

<style scoped>
.page {
  @apply flex flex-col gap-4;
}

.page-header {
  @apply flex justify-between items-center;
}

.list {
  @apply flex flex-col gap-2.5;
}

.list-item {
  @apply flex items-start rounded-[10px] p-3 gap-3 transition-all duration-300;
  border: 1px solid var(--list-item-border);
  background: var(--list-item-bg);
}

.list-item:hover {
  @apply -translate-y-px;
  border-color: var(--border-secondary);
  box-shadow: 0 4px 12px var(--card-shadow);
}

.form-grid {
  display: grid;
  @apply gap-3;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.section-actions {
  @apply flex items-center gap-2;
}

.section-title {
  @apply flex flex-col gap-1;
}

.select-all {
  @apply flex items-center gap-2;
}

.select-box {
  @apply flex items-start pt-1.5;
}

.select-box input {
  accent-color: var(--brand);
}

.token-content {
  @apply flex-1 min-w-0;
}

.form-error {
  @apply mt-1.5 transition-colors duration-300;
  color: var(--error-text);
}

.token-banner {
  @apply mt-3 p-3 rounded-[10px] border transition-all duration-300;
  background: var(--code-bg);
  color: var(--code-text);
  border-color: var(--code-border);
}

.code-pill {
  @apply px-2.5 py-2 rounded-lg font-mono break-all transition-all duration-300;
  background: var(--code-pill-bg);
  border: 1px solid var(--code-border);
}

.danger {
  color: var(--danger-text);
  border-color: var(--danger-border);
}

.danger:hover:not(:disabled) {
  @apply bg-danger-bg;
  color: var(--danger-text-dark);
}
</style>
