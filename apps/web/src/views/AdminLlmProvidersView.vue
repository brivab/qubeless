<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink to="/admin" class="muted" style="font-size: 14px">{{ t('adminLlmProviders.back') }}</RouterLink>
        <h2 style="margin: 6px 0 0">{{ t('adminLlmProviders.title') }}</h2>
        <p class="muted" style="margin: 4px 0 0">
          {{ t('adminLlmProviders.subtitle') }}
        </p>
      </div>
      <button class="ghost-button" @click="loadProviders" :disabled="loading" data-cy="admin-llm-providers-refresh">
        {{ t('common.refresh') }}
      </button>
    </div>

    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">
          {{ editingId ? t('adminLlmProviders.editTitle') : t('adminLlmProviders.createTitle') }}
        </h3>
        <button v-if="editingId" class="ghost-button" @click="cancelEdit" :disabled="saving">
          {{ t('common.cancel') }}
        </button>
      </div>

      <div class="form-grid">
        <label>
          <div class="muted">{{ t('adminLlmProviders.nameLabel') }}</div>
          <input v-model="form.name" :placeholder="t('adminLlmProviders.namePlaceholder')" data-cy="admin-llm-provider-name" />
        </label>
        <label>
          <div class="muted">{{ t('adminLlmProviders.providerTypeLabel') }}</div>
          <input v-model="form.providerType" placeholder="openai" data-cy="admin-llm-provider-type" />
        </label>
        <label>
          <div class="muted">{{ t('adminLlmProviders.baseUrlLabel') }}</div>
          <input v-model="form.baseUrl" placeholder="https://api.example.com/v1/models" data-cy="admin-llm-provider-base-url" />
        </label>
        <label>
          <div class="muted">{{ t('adminLlmProviders.modelLabel') }}</div>
          <input v-model="form.model" placeholder="gpt-4o-mini" data-cy="admin-llm-provider-model" />
        </label>
        <label>
          <div class="muted">{{ t('adminLlmProviders.tokenLabel') }}</div>
          <input
            v-model="form.token"
            type="password"
            :placeholder="editingId ? t('adminLlmProviders.tokenEditPlaceholder') : 'sk-...'"
            data-cy="admin-llm-provider-token"
          />
          <div v-if="editingId" class="muted" style="font-size: 12px; margin-top: 4px;">
            {{ t('adminLlmProviders.tokenEditHint') }}
          </div>
        </label>
        <label class="checkbox-row">
          <input v-model="form.isDefault" type="checkbox" />
          <span>{{ t('adminLlmProviders.defaultLabel') }}</span>
        </label>
      </div>

      <label style="margin-top: 12px; display: block;">
        <div class="muted">{{ t('adminLlmProviders.headersLabel') }}</div>
        <textarea
          v-model="form.headersJsonText"
          rows="4"
          placeholder='{"Authorization": "Bearer ..."}'
          data-cy="admin-llm-provider-headers"
        ></textarea>
        <div class="muted" style="font-size: 12px; margin-top: 4px;">
          {{ t('adminLlmProviders.headersHint') }}
        </div>
      </label>

      <div v-if="formError" class="form-error">{{ formError }}</div>

      <div style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
        <button @click="saveProvider" :disabled="saving" data-cy="admin-llm-provider-save">
          {{ saving ? t('common.saving') : editingId ? t('common.save') : t('common.create') }}
        </button>
        <button class="ghost-button" type="button" @click="resetForm" :disabled="saving">
          {{ t('common.reset') }}
        </button>
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">{{ t('adminLlmProviders.listTitle') }}</h3>
        <div class="muted" style="font-size: 13px;">
          {{ t('adminLlmProviders.count', { count: providers.length }) }}
        </div>
      </div>

      <div v-if="loading">{{ t('adminLlmProviders.loading') }}</div>
      <div v-else-if="error" class="form-error">{{ error }}</div>
      <div v-else-if="providers.length === 0" class="muted">{{ t('adminLlmProviders.none') }}</div>

      <div v-else class="providers-list">
        <div v-for="provider in providers" :key="provider.id" class="provider-item" :data-cy="`admin-llm-provider-card-${provider.name}`">
          <div class="provider-main">
            <div class="provider-header">
              <div>
                <div class="provider-name">{{ provider.name }}</div>
                <div class="muted" style="font-size: 13px;">
                  {{ provider.providerType }} · {{ provider.baseUrl }}
                </div>
                <div class="muted" style="font-size: 12px; margin-top: 4px;">
                  {{ t('adminLlmProviders.modelDisplay') }} {{ provider.model || t('common.notAvailable') }}
                </div>
              </div>
              <div class="provider-badges">
                <span v-if="provider.isDefault" class="badge">{{ t('adminLlmProviders.defaultBadge') }}</span>
              </div>
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 8px;">
              {{ t('adminLlmProviders.tokenDisplay') }} {{ provider.tokenMasked || t('common.notAvailable') }}
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 2px;">
              {{ t('adminLlmProviders.headersDisplay', { count: headerCount(provider) }) }}
            </div>
          </div>
          <div class="provider-actions">
            <button
              class="ghost-button compact"
              @click="testProvider(provider)"
              :disabled="testingId === provider.id"
            >
              {{ testingId === provider.id ? t('adminLlmProviders.testing') : t('adminLlmProviders.test') }}
            </button>
            <button class="ghost-button compact" @click="startEdit(provider)" :disabled="saving">
              {{ t('common.edit') }}
            </button>
            <button
              class="ghost-button compact danger"
              @click="confirmDelete(provider)"
              :disabled="saving"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      v-model="showDeleteConfirm"
      :title="t('adminLlmProviders.deleteTitle')"
      :message="t('adminLlmProviders.deleteConfirm', { name: deletingProvider?.name ?? '' })"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      danger-confirm
      @confirm="handleDelete"
    />

    <Toast v-if="toastMessage" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  createLlmProvider,
  deleteLlmProvider,
  getLlmProviders,
  testLlmProviderConnection,
  updateLlmProvider,
  type LlmProvider,
} from '../services/api';
import ConfirmModal from '../components/common/ConfirmModal.vue';
import Toast from '../components/common/Toast.vue';
import { useI18n } from '../i18n';

const providers = ref<LlmProvider[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const testingId = ref<string | null>(null);
const editingId = ref<string | null>(null);

const showDeleteConfirm = ref(false);
const deletingProvider = ref<LlmProvider | null>(null);

const toastMessage = ref('');
const toastType = ref<'success' | 'error' | 'info'>('info');

const form = ref({
  name: '',
  providerType: '',
  baseUrl: '',
  model: '',
  token: '',
  headersJsonText: '',
  isDefault: false,
});

const formError = ref<string | null>(null);
const { t } = useI18n();

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toastMessage.value = message;
  toastType.value = type;
  setTimeout(() => {
    toastMessage.value = '';
  }, 100);
}

function resetForm() {
  form.value = {
    name: '',
    providerType: '',
    baseUrl: '',
    model: '',
    token: '',
    headersJsonText: '',
    isDefault: false,
  };
  formError.value = null;
  editingId.value = null;
}

function startEdit(provider: LlmProvider) {
  editingId.value = provider.id;
  form.value = {
    name: provider.name,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    model: provider.model ?? '',
    token: '',
    headersJsonText: provider.headersJson ? JSON.stringify(provider.headersJson, null, 2) : '',
    isDefault: provider.isDefault,
  };
  formError.value = null;
}

function cancelEdit() {
  resetForm();
}

function headerCount(provider: LlmProvider) {
  return provider.headersJson ? Object.keys(provider.headersJson).length : 0;
}

function parseHeadersJson() {
  const text = form.value.headersJsonText.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid');
    }
    return parsed as Record<string, any>;
  } catch {
    formError.value = t('adminLlmProviders.errorHeaders');
    return null;
  }
}

async function loadProviders() {
  loading.value = true;
  error.value = null;
  try {
    providers.value = await getLlmProviders();
  } catch (err: any) {
    error.value = err?.message ?? t('adminLlmProviders.errorLoad');
  } finally {
    loading.value = false;
  }
}

async function saveProvider() {
  formError.value = null;

  if (!form.value.name.trim()) {
    formError.value = t('adminLlmProviders.errorName');
    return;
  }
  if (!form.value.providerType.trim()) {
    formError.value = t('adminLlmProviders.errorProviderType');
    return;
  }
  if (!form.value.baseUrl.trim()) {
    formError.value = t('adminLlmProviders.errorBaseUrl');
    return;
  }

  const headersJson = parseHeadersJson();
  if (form.value.headersJsonText.trim() && headersJson === null) return;

  const payload: Record<string, any> = {
    name: form.value.name.trim(),
    providerType: form.value.providerType.trim(),
    baseUrl: form.value.baseUrl.trim(),
    model: form.value.model.trim() || null,
    headersJson,
    isDefault: form.value.isDefault,
  };

  const token = form.value.token.trim();
  if (token) {
    payload.token = token;
  }

  saving.value = true;
  try {
    if (editingId.value) {
      await updateLlmProvider(editingId.value, payload);
      showToast(t('adminLlmProviders.saved'), 'success');
    } else {
      await createLlmProvider(payload);
      showToast(t('adminLlmProviders.created'), 'success');
    }
    await loadProviders();
    resetForm();
  } catch (err: any) {
    showToast(err?.message ?? t('adminLlmProviders.errorSave'), 'error');
  } finally {
    saving.value = false;
  }
}

async function testProvider(provider: LlmProvider) {
  if (testingId.value) return;
  testingId.value = provider.id;
  try {
    await testLlmProviderConnection(provider.id);
    showToast(t('adminLlmProviders.testSuccess', { name: provider.name }), 'success');
  } catch (err: any) {
    showToast(err?.message ?? t('adminLlmProviders.testError', { name: provider.name }), 'error');
  } finally {
    testingId.value = null;
  }
}

function confirmDelete(provider: LlmProvider) {
  deletingProvider.value = provider;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!deletingProvider.value) return;
  saving.value = true;
  try {
    await deleteLlmProvider(deletingProvider.value.id);
    providers.value = providers.value.filter((p) => p.id !== deletingProvider.value?.id);
    showToast(t('adminLlmProviders.deleted'), 'success');
  } catch (err: any) {
    showToast(err?.message ?? t('adminLlmProviders.errorDelete'), 'error');
  } finally {
    saving.value = false;
    deletingProvider.value = null;
  }
}

onMounted(loadProviders);
</script>

<style scoped>
.page {
  @apply flex flex-col gap-4;
}

.page-header {
  @apply flex items-start justify-between gap-4;
}

.section-header {
  @apply flex items-center justify-between gap-4 mb-3;
}

.form-grid {
  @apply grid gap-4;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.form-error {
  @apply text-red-600 text-sm mt-2;
}

.providers-list {
  @apply flex flex-col gap-3;
}

.provider-item {
  @apply flex flex-col gap-3 border border-border-primary rounded-xl p-4 bg-bg-secondary;
}

.provider-main {
  @apply flex-1;
}

.provider-header {
  @apply flex items-start justify-between gap-4;
}

.provider-name {
  @apply font-semibold text-text-primary;
}

.provider-actions {
  @apply flex flex-wrap gap-2;
}

.provider-badges .badge {
  @apply text-xs font-semibold px-2 py-1 rounded-full border border-border-primary;
}

.checkbox-row {
  @apply flex items-center gap-2;
}

textarea {
  @apply w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm;
  min-height: 90px;
}
</style>
