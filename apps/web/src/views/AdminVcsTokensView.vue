<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink to="/admin" class="muted" style="font-size: 14px">{{ t('adminVcsTokens.back') }}</RouterLink>
        <h2 style="margin: 6px 0 0">{{ t('adminVcsTokens.title') }}</h2>
        <p class="muted" style="margin: 4px 0 0">
          {{ t('adminVcsTokens.subtitle') }}
        </p>
      </div>
      <button class="ghost-button" @click="loadTokens" :disabled="loading">
        {{ t('common.refresh') }}
      </button>
    </div>

    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">
          {{ editingId ? t('adminVcsTokens.editTitle') : t('adminVcsTokens.createTitle') }}
        </h3>
        <button v-if="editingId" class="ghost-button" @click="cancelEdit" :disabled="saving">
          {{ t('common.cancel') }}
        </button>
      </div>

      <div class="form-grid">
        <label>
          <div class="muted">{{ t('adminVcsTokens.providerLabel') }}</div>
          <select v-model="form.provider" :disabled="Boolean(editingId)">
            <option value="GITHUB">{{ t('adminVcsTokens.providerGithub') }}</option>
            <option value="GITLAB">{{ t('adminVcsTokens.providerGitlab') }}</option>
            <option value="BITBUCKET">{{ t('adminVcsTokens.providerBitbucket') }}</option>
          </select>
        </label>
        <label>
          <div class="muted">{{ t('adminVcsTokens.baseUrlLabel') }}</div>
          <input
            v-model="form.baseUrl"
            type="text"
            :placeholder="t('adminVcsTokens.baseUrlPlaceholder')"
          />
        </label>
        <label>
          <div class="muted">{{ t('adminVcsTokens.tokenLabel') }}</div>
          <input
            v-model="form.token"
            type="password"
            :placeholder="editingId ? t('adminVcsTokens.tokenEditPlaceholder') : 'ghp_...'"
          />
          <div v-if="editingId" class="muted" style="font-size: 12px; margin-top: 4px;">
            {{ t('adminVcsTokens.tokenEditHint') }}
          </div>
        </label>
      </div>

      <div v-if="formError" class="form-error">{{ formError }}</div>

      <div style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
        <button @click="saveToken" :disabled="saving">
          {{ saving ? t('common.saving') : editingId ? t('common.save') : t('common.create') }}
        </button>
        <button class="ghost-button" type="button" @click="resetForm" :disabled="saving">
          {{ t('common.reset') }}
        </button>
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">{{ t('adminVcsTokens.listTitle') }}</h3>
        <div class="muted" style="font-size: 13px;">
          {{ t('adminVcsTokens.count', { count: tokens.length }) }}
        </div>
      </div>

      <div v-if="loading">{{ t('adminVcsTokens.loading') }}</div>
      <div v-else-if="error" class="form-error">{{ error }}</div>
      <div v-else-if="tokens.length === 0" class="muted">{{ t('adminVcsTokens.none') }}</div>

      <div v-else class="tokens-list">
        <div v-for="token in tokens" :key="token.id" class="token-item">
          <div class="token-main">
            <div class="token-header">
              <div class="token-provider">{{ providerLabel(token.provider) }}</div>
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 6px;">
              {{ t('adminVcsTokens.tokenDisplay') }} {{ token.tokenMasked || t('common.notAvailable') }}
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 2px;">
              {{ t('adminVcsTokens.createdAt', { date: formatDate(token.createdAt) }) }}
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 2px;">
              {{
                t('adminVcsTokens.lastUsed', {
                  date: token.lastUsedAt ? formatDate(token.lastUsedAt) : t('adminVcsTokens.never'),
                })
              }}
            </div>
          </div>
          <div class="token-actions">
            <button class="ghost-button compact" @click="startEdit(token)" :disabled="saving">
              {{ t('common.edit') }}
            </button>
            <button class="ghost-button compact danger" @click="confirmDelete(token)" :disabled="saving">
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      v-model="showDeleteConfirm"
      :title="t('adminVcsTokens.deleteTitle')"
      :message="t('adminVcsTokens.deleteConfirm', { provider: deletingToken ? providerLabel(deletingToken.provider) : '' })"
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
  createVcsToken,
  deleteVcsToken,
  getVcsTokens,
  updateVcsToken,
  type VcsToken,
} from '../services/api';
import ConfirmModal from '../components/common/ConfirmModal.vue';
import Toast from '../components/common/Toast.vue';
import { useI18n } from '../i18n';

const tokens = ref<VcsToken[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const editingId = ref<string | null>(null);

const showDeleteConfirm = ref(false);
const deletingToken = ref<VcsToken | null>(null);

const toastMessage = ref('');
const toastType = ref<'success' | 'error' | 'info'>('info');

const form = ref({
  provider: 'GITHUB' as VcsToken['provider'],
  token: '',
  baseUrl: '',
});

const formError = ref<string | null>(null);
const { t, locale, getLocaleTag } = useI18n();

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toastMessage.value = message;
  toastType.value = type;
  setTimeout(() => {
    toastMessage.value = '';
  }, 100);
}

function formatDate(date: string) {
  return new Date(date).toLocaleString(getLocaleTag(locale.value));
}

function providerLabel(provider: VcsToken['provider']) {
  if (provider === 'GITHUB') return t('adminVcsTokens.providerGithub');
  if (provider === 'GITLAB') return t('adminVcsTokens.providerGitlab');
  return t('adminVcsTokens.providerBitbucket');
}

function resetForm() {
  form.value = {
    provider: 'GITHUB',
    token: '',
    baseUrl: '',
  };
  formError.value = null;
  editingId.value = null;
}

function startEdit(token: VcsToken) {
  editingId.value = token.id;
  form.value = {
    provider: token.provider,
    token: '',
    baseUrl: token.baseUrl ?? '',
  };
  formError.value = null;
}

function cancelEdit() {
  resetForm();
}

async function loadTokens() {
  loading.value = true;
  error.value = null;
  try {
    tokens.value = await getVcsTokens();
  } catch (err: any) {
    error.value = err?.message ?? t('adminVcsTokens.errorLoad');
  } finally {
    loading.value = false;
  }
}

async function saveToken() {
  formError.value = null;

  const tokenValue = form.value.token.trim();
  if (!editingId.value && !tokenValue) {
    formError.value = t('adminVcsTokens.errorTokenRequired');
    return;
  }

  saving.value = true;
  try {
    if (editingId.value) {
      const payload: { token?: string } = {};
      if (tokenValue) payload.token = tokenValue;
      const baseUrl = form.value.baseUrl.trim() || null;
      await updateVcsToken(editingId.value, { ...payload, baseUrl });
      showToast(t('adminVcsTokens.saved'), 'success');
    } else {
      const baseUrl = form.value.baseUrl.trim() || null;
      await createVcsToken({ provider: form.value.provider, token: tokenValue, baseUrl });
      showToast(t('adminVcsTokens.created'), 'success');
    }
    await loadTokens();
    resetForm();
  } catch (err: any) {
    showToast(err?.message ?? t('adminVcsTokens.errorSave'), 'error');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(token: VcsToken) {
  deletingToken.value = token;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!deletingToken.value) return;
  saving.value = true;
  try {
    await deleteVcsToken(deletingToken.value.id);
    tokens.value = tokens.value.filter((t) => t.id !== deletingToken.value?.id);
    showToast(t('adminVcsTokens.deleted'), 'success');
  } catch (err: any) {
    showToast(err?.message ?? t('adminVcsTokens.errorDelete'), 'error');
  } finally {
    saving.value = false;
    deletingToken.value = null;
  }
}

onMounted(loadTokens);
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

.tokens-list {
  @apply flex flex-col gap-3;
}

.token-item {
  @apply flex flex-col gap-3 border border-border-primary rounded-xl p-4 bg-bg-secondary;
}

.token-header {
  @apply flex items-start justify-between gap-4;
}

.token-provider {
  @apply font-semibold text-text-primary;
}

.token-actions {
  @apply flex flex-wrap gap-2;
}

select,
input {
  @apply w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm;
}
</style>
