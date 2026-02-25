<template>
  <div class="llm-tab">
    <div class="tab-header">
      <div>
        <h3 style="margin: 0">{{ t('project.llm.title') }}</h3>
        <p class="muted" style="margin: 6px 0 0">
          {{ t('project.llm.subtitle') }}
        </p>
      </div>
      <button class="ghost-button" @click="loadSettings" :disabled="loading" data-cy="project-llm-refresh">
        {{ t('common.refresh') }}
      </button>
    </div>

    <div v-if="loading" class="muted">{{ t('project.llm.loading') }}</div>
    <div v-else-if="error" class="form-error">{{ error }}</div>

    <form v-else class="llm-form" @submit.prevent="saveSettings">
      <div class="form-group">
        <label>{{ t('project.llm.providerLabel') }}</label>
        <select v-model="selectedProviderId" class="text-input" data-cy="project-llm-provider">
          <option value="">{{ t('project.llm.providerDefault') }}</option>
          <option v-for="provider in providers" :key="provider.id" :value="provider.id">
            {{ provider.name }}{{ provider.model ? ` - ${provider.model}` : '' }}
            ({{ provider.providerType }}){{ provider.isDefault ? ` - ${t('project.llm.defaultBadge')}` : '' }}
          </option>
        </select>
        <small class="muted">{{ providerHint }}</small>
      </div>

      <div class="overrides-grid">
        <div class="form-group">
          <label>{{ t('project.llm.temperatureLabel') }}</label>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            v-model="overrides.temperature"
            class="text-input"
            placeholder="0.2"
            data-cy="project-llm-temperature"
          />
          <small class="muted">{{ t('project.llm.temperatureHint') }}</small>
        </div>

        <div class="form-group">
          <label>{{ t('project.llm.topPLabel') }}</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            v-model="overrides.topP"
            class="text-input"
            placeholder="0.9"
            data-cy="project-llm-top-p"
          />
          <small class="muted">{{ t('project.llm.topPHint') }}</small>
        </div>

        <div class="form-group">
          <label>{{ t('project.llm.maxTokensLabel') }}</label>
          <input
            type="number"
            min="1"
            max="200000"
            step="1"
            v-model="overrides.maxTokens"
            class="text-input"
            placeholder="2048"
            data-cy="project-llm-max-tokens"
          />
          <small class="muted">{{ t('project.llm.maxTokensHint') }}</small>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="primary-button" :disabled="saving" data-cy="project-llm-save">
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
        <div v-if="saveSuccess" class="success-message">{{ t('project.llm.saved') }}</div>
        <div v-if="formError" class="form-error">{{ formError }}</div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  getProjectLlmSettings,
  updateProjectLlmSettings,
  type LlmProviderSummary,
  type ProjectLlmOverrides,
} from '../../services/api';
import { useI18n } from '../../i18n';

const props = defineProps<{
  projectKey: string;
}>();

const { t } = useI18n();

const providers = ref<LlmProviderSummary[]>([]);
const selectedProviderId = ref('');
const effectiveProvider = ref<LlmProviderSummary | null>(null);
const source = ref<'project' | 'default' | 'none'>('none');

const overrides = reactive({
  temperature: '',
  topP: '',
  maxTokens: '',
});

const loading = ref(false);
const saving = ref(false);
const error = ref('');
const formError = ref('');
const saveSuccess = ref(false);

const providerHint = computed(() => {
  if (source.value === 'project' && effectiveProvider.value) {
    return t('project.llm.providerHintProject', { name: effectiveProvider.value.name });
  }
  if (source.value === 'default' && effectiveProvider.value) {
    return t('project.llm.providerHintDefault', { name: effectiveProvider.value.name });
  }
  return t('project.llm.providerHintNone');
});

function parseOptionalNumber(value: string): number | null | 'invalid' {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 'invalid';
  return parsed;
}

function buildOverridesPayload(): ProjectLlmOverrides | null | 'invalid' {
  const temperature = parseOptionalNumber(overrides.temperature);
  if (temperature === 'invalid' || (temperature !== null && (temperature < 0 || temperature > 2))) {
    formError.value = t('project.llm.validationTemperature');
    return 'invalid';
  }

  const topP = parseOptionalNumber(overrides.topP);
  if (topP === 'invalid' || (topP !== null && (topP < 0 || topP > 1))) {
    formError.value = t('project.llm.validationTopP');
    return 'invalid';
  }

  const maxTokens = parseOptionalNumber(overrides.maxTokens);
  if (
    maxTokens === 'invalid'
    || (maxTokens !== null && (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 200000))
  ) {
    formError.value = t('project.llm.validationMaxTokens');
    return 'invalid';
  }

  const payload: ProjectLlmOverrides = {};
  if (temperature !== null) payload.temperature = temperature;
  if (topP !== null) payload.topP = topP;
  if (maxTokens !== null) payload.maxTokens = maxTokens;
  return Object.keys(payload).length ? payload : null;
}

async function loadSettings() {
  loading.value = true;
  error.value = '';
  formError.value = '';
  try {
    const data = await getProjectLlmSettings(props.projectKey);
    providers.value = data.providers ?? [];
    selectedProviderId.value = data.selectedProviderId ?? '';
    effectiveProvider.value = data.provider;
    source.value = data.source ?? 'none';
    overrides.temperature = data.overrides?.temperature?.toString() ?? '';
    overrides.topP = data.overrides?.topP?.toString() ?? '';
    overrides.maxTokens = data.overrides?.maxTokens?.toString() ?? '';
  } catch (err: any) {
    error.value = err?.message ?? t('project.llm.errorLoad');
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  formError.value = '';
  saveSuccess.value = false;

  const overridesPayload = buildOverridesPayload();
  if (overridesPayload === 'invalid') return;

  try {
    saving.value = true;
    await updateProjectLlmSettings(props.projectKey, {
      llmProviderId: selectedProviderId.value || null,
      overrides: overridesPayload,
    });
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
    await loadSettings();
  } catch (err: any) {
    formError.value = err?.message ?? t('project.llm.errorSave');
  } finally {
    saving.value = false;
  }
}

onMounted(loadSettings);
</script>

<style scoped>
.llm-tab {
  @apply flex flex-col gap-5;
}

.tab-header {
  @apply flex items-center justify-between;
}

.llm-form {
  @apply flex flex-col gap-5;
}

.form-group {
  @apply flex flex-col gap-2;
}

.text-input {
  @apply w-full p-2 border rounded text-sm transition-colors duration-300;
  border-color: var(--border-primary);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.text-input:focus {
  @apply outline-none;
  border-color: var(--primary);
}

.overrides-grid {
  @apply grid gap-4;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.form-actions {
  @apply flex items-center gap-3 flex-wrap;
}

.success-message {
  @apply px-4 py-2 rounded text-sm;
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
}
</style>
