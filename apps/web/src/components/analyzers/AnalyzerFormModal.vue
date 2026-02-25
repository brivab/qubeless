<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-card" @click.stop>
        <div class="modal-header">
          <h3>{{ analyzer ? 'Edit Analyzer' : 'Add New Analyzer' }}</h3>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <form @submit.prevent="handleSubmit" class="modal-body">
          <div class="form-group">
            <label for="key">
              Key <span class="required">*</span>
            </label>
            <input
              id="key"
              v-model="form.key"
              type="text"
              placeholder="e.g., eslint"
              :disabled="!!analyzer || submitting"
              required
              pattern="^[a-z0-9-]{2,32}$"
              title="Lowercase letters, numbers, and hyphens only (2-32 chars)"
            />
            <small class="hint">Lowercase letters, numbers, and hyphens (2-32 characters)</small>
          </div>

          <div class="form-group">
            <label for="name">
              Name <span class="required">*</span>
            </label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              placeholder="e.g., ESLint"
              :disabled="submitting"
              required
            />
          </div>

          <div class="form-group">
            <label for="dockerImage">
              Docker Image <span class="required">*</span>
            </label>
            <input
              id="dockerImage"
              v-model="form.dockerImage"
              type="text"
              placeholder="e.g., myregistry/eslint-analyzer:latest"
              :disabled="submitting"
              required
            />
            <small class="hint">Must include a tag (e.g., :latest or :v1.0.0)</small>
          </div>

          <div class="form-group checkbox-group">
            <input
              id="enabled-checkbox"
              type="checkbox"
              v-model="form.enabled"
              :disabled="submitting"
            />
            <label for="enabled-checkbox" class="checkbox-label">
              Enabled globally
            </label>
          </div>

          <ErrorBanner v-if="error" :error="error" dismissible @dismiss="error = null" />

          <div class="modal-footer">
            <button type="button" class="ghost-button" @click="close" :disabled="submitting">
              Cancel
            </button>
            <button type="submit" :disabled="submitting || !isValid">
              {{ submitting ? 'Saving...' : analyzer ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import type { Analyzer } from '../../services/api';
import ErrorBanner from '../common/ErrorBanner.vue';

const props = defineProps<{
  modelValue: boolean;
  analyzer?: Analyzer | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submit: [data: { key: string; name: string; dockerImage: string; enabled: boolean }];
}>();

const form = reactive({
  key: '',
  name: '',
  dockerImage: '',
  enabled: true,
});

const submitting = ref(false);
const error = ref<string | null>(null);

const isValid = computed(() => {
  const keyValid = /^[a-z0-9-]{2,32}$/.test(form.key);
  const nameValid = form.name.trim().length > 0;
  const imageValid = form.dockerImage.trim().length > 0 && (form.dockerImage.includes(':') || form.dockerImage.includes('@sha256:'));
  return keyValid && nameValid && imageValid;
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.analyzer) {
        form.key = props.analyzer.key;
        form.name = props.analyzer.name;
        form.dockerImage = props.analyzer.dockerImage;
        form.enabled = props.analyzer.enabled;
      } else {
        form.key = '';
        form.name = '';
        form.dockerImage = '';
        form.enabled = true;
      }
      error.value = null;
    }
  },
  { immediate: true },
);

function handleOverlayClick() {
  if (!submitting.value) {
    close();
  }
}

function close() {
  emit('update:modelValue', false);
}

async function handleSubmit() {
  if (!isValid.value || submitting.value) return;

  error.value = null;
  submitting.value = true;

  try {
    emit('submit', {
      key: form.key,
      name: form.name,
      dockerImage: form.dockerImage,
      enabled: form.enabled,
    });
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to save analyzer';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm;
  @apply flex items-center justify-center z-[1000] p-5;
}

.modal-card {
  @apply bg-bg-primary rounded-2xl shadow-[0_20px_60px_var(--modal-shadow)];
  @apply max-w-[560px] w-full overflow-hidden;
  @apply transition-all duration-300 ease-in-out;
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
  @apply flex justify-between items-center py-5 px-6;
  @apply border-b-2 border-border-primary transition-colors duration-300;
}

.modal-header h3 {
  @apply m-0 text-lg font-bold text-text-primary transition-colors duration-300;
}

.close-btn {
  @apply bg-transparent border-0 text-text-tertiary text-2xl font-bold cursor-pointer p-0;
  @apply w-8 h-8 flex items-center justify-center rounded-lg;
  @apply transition-all duration-300 ease-in-out;
}

.close-btn:hover {
  @apply bg-bg-tertiary text-text-primary;
}

.modal-body {
  @apply p-6 flex flex-col gap-5;
}

.form-group {
  @apply flex flex-col gap-[6px];
}

.form-group label {
  @apply font-semibold text-[13px] text-text-primary transition-colors duration-300;
}

.form-group input[type='text'] {
  @apply py-[10px] px-[14px] border-2 border-border-primary rounded-lg text-sm;
  @apply bg-bg-secondary text-text-primary transition-all duration-300;
}

.form-group input[type='text']:focus {
  @apply outline-none border-[var(--primary)] shadow-[0_0_0_3px_var(--primary-shadow)];
}

.form-group input[type='text']:disabled {
  @apply bg-[var(--disabled-bg)] text-[var(--disabled-text)] cursor-not-allowed;
}

.required {
  @apply text-[var(--error-text)];
}

.hint {
  @apply text-xs text-text-secondary transition-colors duration-300;
}

.checkbox-group {
  @apply flex-row items-center gap-[10px];
}

.checkbox-label {
  @apply cursor-pointer select-none font-semibold text-sm text-text-primary m-0;
  @apply transition-colors duration-300;
}

.checkbox-group input[type='checkbox'] {
  @apply w-5 h-5 cursor-pointer m-0 shrink-0;
  accent-color: var(--primary);
}

.checkbox-group input[type='checkbox']:disabled {
  @apply cursor-not-allowed opacity-50;
}

.modal-footer {
  @apply flex justify-end gap-3 pt-5 border-t-2 border-border-primary;
  @apply transition-colors duration-300;
}
</style>
