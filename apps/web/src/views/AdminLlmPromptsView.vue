<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink to="/admin" class="muted" style="font-size: 14px">{{ t('adminLlmPrompts.back') }}</RouterLink>
        <h2 style="margin: 6px 0 0">{{ t('adminLlmPrompts.title') }}</h2>
        <p class="muted" style="margin: 4px 0 0">
          {{ t('adminLlmPrompts.subtitle') }}
        </p>
      </div>
      <button class="ghost-button" @click="loadPrompts" :disabled="loading" data-cy="admin-llm-prompts-refresh">
        {{ t('common.refresh') }}
      </button>
    </div>

    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">
          {{ editingId ? t('adminLlmPrompts.editTitle') : t('adminLlmPrompts.createTitle') }}
        </h3>
        <button v-if="editingId" class="ghost-button" @click="cancelEdit" :disabled="saving">
          {{ t('common.cancel') }}
        </button>
      </div>

      <div class="form-grid">
        <label>
          <div class="muted">{{ t('adminLlmPrompts.nameLabel') }}</div>
          <input v-model="form.name" :placeholder="t('adminLlmPrompts.namePlaceholder')" data-cy="admin-llm-prompt-name" />
        </label>
        <label>
          <div class="muted">{{ t('adminLlmPrompts.versionLabel') }}</div>
          <input v-model="form.version" placeholder="v1" data-cy="admin-llm-prompt-version" />
        </label>
        <label class="checkbox-row">
          <input v-model="form.isActive" type="checkbox" />
          <span>{{ t('adminLlmPrompts.activeLabel') }}</span>
        </label>
      </div>

      <label style="margin-top: 12px; display: block;">
        <div class="muted">{{ t('adminLlmPrompts.systemPromptLabel') }}</div>
        <textarea v-model="form.systemPrompt" rows="5" :placeholder="t('adminLlmPrompts.systemPromptPlaceholder')" data-cy="admin-llm-prompt-system"></textarea>
      </label>

      <label style="margin-top: 12px; display: block;">
        <div class="muted">{{ t('adminLlmPrompts.taskPromptLabel') }}</div>
        <textarea v-model="form.taskPrompt" rows="5" :placeholder="t('adminLlmPrompts.taskPromptPlaceholder')" data-cy="admin-llm-prompt-task"></textarea>
      </label>

      <div v-if="formError" class="form-error">{{ formError }}</div>

      <div style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
        <button @click="savePrompt" :disabled="saving" data-cy="admin-llm-prompt-save">
          {{ saving ? t('common.saving') : editingId ? t('common.save') : t('common.create') }}
        </button>
        <button class="ghost-button" type="button" @click="resetForm" :disabled="saving">
          {{ t('common.reset') }}
        </button>
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">{{ t('adminLlmPrompts.listTitle') }}</h3>
        <div class="muted" style="font-size: 13px;">
          {{ t('adminLlmPrompts.count', { count: prompts.length }) }}
        </div>
      </div>

      <div v-if="loading">{{ t('adminLlmPrompts.loading') }}</div>
      <div v-else-if="error" class="form-error">{{ error }}</div>
      <div v-else-if="prompts.length === 0" class="muted">{{ t('adminLlmPrompts.none') }}</div>

      <div v-else class="providers-list">
        <div v-for="prompt in prompts" :key="prompt.id" class="provider-item" :data-cy="`admin-llm-prompt-card-${prompt.name}`">
          <div class="provider-main">
            <div class="provider-header">
              <div>
                <div class="provider-name">{{ prompt.name }}</div>
                <div class="muted" style="font-size: 13px;">
                  {{ t('adminLlmPrompts.versionDisplay') }} {{ prompt.version }}
                </div>
                <div class="muted" style="font-size: 12px; margin-top: 4px;">
                  {{ t('adminLlmPrompts.systemPreview') }} {{ preview(prompt.systemPrompt) }}
                </div>
                <div class="muted" style="font-size: 12px; margin-top: 2px;">
                  {{ t('adminLlmPrompts.taskPreview') }} {{ preview(prompt.taskPrompt) }}
                </div>
              </div>
              <div class="provider-badges">
                <span v-if="prompt.isActive" class="badge">{{ t('adminLlmPrompts.activeBadge') }}</span>
              </div>
            </div>
          </div>
          <div class="provider-actions">
            <button
              v-if="!prompt.isActive"
              class="ghost-button compact"
              @click="activatePrompt(prompt)"
              :disabled="activatingId === prompt.id"
            >
              {{ activatingId === prompt.id ? t('adminLlmPrompts.activating') : t('adminLlmPrompts.activate') }}
            </button>
            <button class="ghost-button compact" @click="startEdit(prompt)" :disabled="saving">
              {{ t('common.edit') }}
            </button>
            <button
              class="ghost-button compact danger"
              @click="confirmDelete(prompt)"
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
      :title="t('adminLlmPrompts.deleteTitle')"
      :message="t('adminLlmPrompts.deleteConfirm', { name: deletingPrompt?.name ?? '' })"
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
  activateLlmPrompt,
  createLlmPrompt,
  deleteLlmPrompt,
  getLlmPrompts,
  updateLlmPrompt,
  type LlmPromptTemplate,
} from '../services/api';
import ConfirmModal from '../components/common/ConfirmModal.vue';
import Toast from '../components/common/Toast.vue';
import { useI18n } from '../i18n';

const prompts = ref<LlmPromptTemplate[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const activatingId = ref<string | null>(null);
const editingId = ref<string | null>(null);

const showDeleteConfirm = ref(false);
const deletingPrompt = ref<LlmPromptTemplate | null>(null);

const toastMessage = ref('');
const toastType = ref<'success' | 'error' | 'info'>('info');

const form = ref({
  name: '',
  version: '',
  systemPrompt: '',
  taskPrompt: '',
  isActive: false,
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
    version: '',
    systemPrompt: '',
    taskPrompt: '',
    isActive: false,
  };
  formError.value = null;
  editingId.value = null;
}

function startEdit(prompt: LlmPromptTemplate) {
  editingId.value = prompt.id;
  form.value = {
    name: prompt.name,
    version: prompt.version,
    systemPrompt: prompt.systemPrompt,
    taskPrompt: prompt.taskPrompt,
    isActive: prompt.isActive,
  };
  formError.value = null;
}

function cancelEdit() {
  resetForm();
}

function preview(text: string) {
  const trimmed = text.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;
}

async function loadPrompts() {
  loading.value = true;
  error.value = null;
  try {
    prompts.value = await getLlmPrompts();
  } catch (err: any) {
    error.value = err?.message ?? t('adminLlmPrompts.errorLoad');
  } finally {
    loading.value = false;
  }
}

async function savePrompt() {
  formError.value = null;

  if (!form.value.name.trim()) {
    formError.value = t('adminLlmPrompts.errorName');
    return;
  }
  if (!form.value.version.trim()) {
    formError.value = t('adminLlmPrompts.errorVersion');
    return;
  }
  if (!form.value.systemPrompt.trim()) {
    formError.value = t('adminLlmPrompts.errorSystemPrompt');
    return;
  }
  if (!form.value.taskPrompt.trim()) {
    formError.value = t('adminLlmPrompts.errorTaskPrompt');
    return;
  }

  saving.value = true;
  try {
    if (editingId.value) {
      const updated = await updateLlmPrompt(editingId.value, {
        name: form.value.name,
        version: form.value.version,
        systemPrompt: form.value.systemPrompt,
        taskPrompt: form.value.taskPrompt,
        isActive: form.value.isActive,
      });
      prompts.value = prompts.value.map((item) => {
        if (item.id === updated.id) return updated;
        if (updated.isActive && item.name === updated.name) return { ...item, isActive: false };
        return item;
      });
      showToast(t('adminLlmPrompts.saved'), 'success');
    } else {
      const created = await createLlmPrompt({
        name: form.value.name,
        version: form.value.version,
        systemPrompt: form.value.systemPrompt,
        taskPrompt: form.value.taskPrompt,
        isActive: form.value.isActive,
      });
      const refreshed = prompts.value.map((item) =>
        created.isActive && item.name === created.name ? { ...item, isActive: false } : item,
      );
      prompts.value = [created, ...refreshed];
      showToast(t('adminLlmPrompts.created'), 'success');
    }
    resetForm();
  } catch (err: any) {
    showToast(err?.message ?? t('adminLlmPrompts.errorSave'), 'error');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(prompt: LlmPromptTemplate) {
  deletingPrompt.value = prompt;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!deletingPrompt.value) return;
  saving.value = true;
  try {
    await deleteLlmPrompt(deletingPrompt.value.id);
    prompts.value = prompts.value.filter((item) => item.id !== deletingPrompt.value?.id);
    showToast(t('adminLlmPrompts.deleted'), 'success');
  } catch (err: any) {
    showToast(err?.message ?? t('adminLlmPrompts.errorDelete'), 'error');
  } finally {
    saving.value = false;
    showDeleteConfirm.value = false;
    deletingPrompt.value = null;
  }
}

async function activatePrompt(prompt: LlmPromptTemplate) {
  activatingId.value = prompt.id;
  try {
    const updated = await activateLlmPrompt(prompt.id);
    prompts.value = prompts.value.map((item) =>
      item.id === updated.id ? updated : { ...item, isActive: item.name === updated.name ? false : item.isActive },
    );
    showToast(t('adminLlmPrompts.activated'), 'success');
  } catch (err: any) {
    showToast(err?.message ?? t('adminLlmPrompts.errorActivate'), 'error');
  } finally {
    activatingId.value = null;
  }
}

onMounted(loadPrompts);
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
