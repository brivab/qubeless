<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink to="/organizations" class="muted" style="font-size: 14px">
          ← {{ t('organizations.title') }}
        </RouterLink>
        <h2 style="margin: 6px 0 0">{{ t('organizations.createNew') }}</h2>
        <p class="muted" style="margin: 4px 0 0">Create a new organization to group your projects</p>
      </div>
    </div>

    <div class="card">
      <form @submit.prevent="handleSubmit" class="create-form">
        <div class="form-group">
          <label for="name" class="form-label">
            Organization Name <span class="required">*</span>
          </label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            class="form-input"
            placeholder="e.g., Acme Corporation"
            required
            :disabled="creating"
          />
          <p class="form-hint">The display name for your organization</p>
        </div>

        <div class="form-group">
          <label for="slug" class="form-label">
            Slug <span class="required">*</span>
          </label>
          <input
            id="slug"
            v-model="form.slug"
            type="text"
            class="form-input"
            placeholder="e.g., acme-corp"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            :disabled="creating"
          />
          <p class="form-hint">
            URL-friendly identifier (lowercase, hyphens allowed, no spaces)
          </p>
        </div>

        <div class="form-group">
          <label for="description" class="form-label">
            Description
          </label>
          <textarea
            id="description"
            v-model="form.description"
            class="form-textarea"
            placeholder="Optional description of your organization"
            rows="4"
            :disabled="creating"
          ></textarea>
        </div>

        <div v-if="error" class="form-error">{{ error }}</div>

        <div class="form-actions">
          <RouterLink to="/organizations">
            <button type="button" class="ghost-button" :disabled="creating">
              {{ t('common.cancel') }}
            </button>
          </RouterLink>
          <button type="submit" class="primary-button" :disabled="creating || !isFormValid">
            {{ creating ? t('common.creating') : t('common.create') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { createOrganization } from '../services/api';
import { useI18n } from '../i18n';

const router = useRouter();
const { t } = useI18n();

const form = ref({
  name: '',
  slug: '',
  description: '',
});

const creating = ref(false);
const error = ref<string | null>(null);

const isFormValid = computed(() => {
  return form.value.name.trim().length > 0 && form.value.slug.trim().length > 0;
});

async function handleSubmit() {
  if (!isFormValid.value) return;

  creating.value = true;
  error.value = null;

  try {
    const org = await createOrganization({
      name: form.value.name.trim(),
      slug: form.value.slug.trim().toLowerCase(),
      description: form.value.description.trim() || undefined,
    });

    // Navigate to the new organization's detail page
    router.push({ name: 'organization', params: { slug: org.slug } });
  } catch (err: any) {
    console.error('Failed to create organization', err);
    error.value = err?.message ?? 'Failed to create organization';
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped>
.page {
  @apply flex flex-col gap-4 max-w-[800px] mx-auto;
}

.page-header {
  @apply flex justify-between items-center mb-4;
}

.create-form {
  @apply flex flex-col gap-6;
}

.form-group {
  @apply flex flex-col gap-2;
}

.form-label {
  @apply text-sm font-semibold;
  color: var(--text-primary);
}

.required {
  color: var(--error-text);
}

.form-input,
.form-textarea {
  @apply border-2 rounded-lg px-3.5 py-2.5 text-sm font-sans transition-all duration-300;
  border-color: var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
}

.form-input:focus,
.form-textarea:focus {
  @apply outline-none;
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--input-shadow-focus);
}

.form-input:disabled,
.form-textarea:disabled {
  @apply opacity-60 cursor-not-allowed;
}

.form-textarea {
  @apply resize-y min-h-[100px];
}

.form-hint {
  @apply text-[13px] m-0;
  color: var(--text-muted);
}

.form-error {
  @apply text-sm px-4 py-3 border rounded-lg;
  color: var(--error-text);
  background: var(--error-bg);
  border-color: var(--error-border);
}

.form-actions {
  @apply flex justify-end gap-3 pt-2;
}

.primary-button {
  @apply border-none px-5 py-2.5 rounded-lg font-semibold cursor-pointer transition-all duration-300;
  background: linear-gradient(135deg, var(--btn-bg-start) 0%, var(--btn-bg-end) 100%);
  color: var(--button-text);
  box-shadow: 0 4px 12px var(--btn-shadow);
}

.primary-button:hover:not(:disabled) {
  @apply -translate-y-px;
  background: linear-gradient(135deg, var(--btn-bg-start) 0%, var(--btn-bg-start) 100%);
  box-shadow: 0 6px 16px var(--btn-shadow-hover);
}

.primary-button:disabled {
  @apply opacity-60 cursor-not-allowed;
}

.ghost-button {
  @apply border-2 px-5 py-2.5 rounded-lg font-semibold cursor-pointer transition-all duration-300;
  background: linear-gradient(135deg, var(--ghost-btn-bg-start) 0%, var(--ghost-btn-bg-end) 100%);
  color: var(--ghost-btn-text);
  border-color: var(--ghost-btn-border);
  box-shadow: 0 2px 8px var(--ghost-btn-shadow);
}

.ghost-button:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--ghost-btn-bg-hover-start) 0%, var(--ghost-btn-bg-hover-end) 100%);
  border-color: var(--ghost-btn-border-hover);
  box-shadow: 0 4px 12px var(--ghost-btn-shadow-hover);
}

.ghost-button:disabled {
  @apply opacity-60 cursor-not-allowed;
}
</style>
