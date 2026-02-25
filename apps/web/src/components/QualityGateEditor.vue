<template>
  <div class="quality-gate-tab">
    <div class="tab-header">
      <div>
        <h3>{{ t('qualityGate.editorTitle') }}</h3>
        <p class="muted" style="margin: 6px 0 0">{{ t('qualityGate.editorSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <button class="ghost-button" @click="loadGate" :disabled="loading" data-cy="quality-gate-refresh">
          {{ t('common.refresh') }}
        </button>
      </div>
    </div>

    <LoadingState v-if="loading" :message="t('qualityGate.loading')" />
    <ErrorBanner v-else-if="error" :error="error" dismissible @dismiss="error = null" />

    <div v-else class="editor-body">
      <div class="form-row">
        <div class="form-group">
          <label>{{ t('qualityGate.nameLabel') }}</label>
          <input
            v-model="form.name"
            type="text"
            :placeholder="t('qualityGate.namePlaceholder')"
            data-cy="quality-gate-name"
          />
        </div>
      </div>

      <div class="conditions-header">
        <h4>{{ t('qualityGate.conditionsTitle') }}</h4>
        <button class="ghost-button compact" @click="addCondition" data-cy="quality-gate-add-condition">
          {{ t('qualityGate.addCondition') }}
        </button>
      </div>

      <div v-if="form.conditions.length === 0" class="muted">
        {{ t('qualityGate.noConditions') }}
      </div>

      <div v-else class="conditions-table">
        <div class="conditions-row head">
          <span>{{ t('qualityGate.metricLabel') }}</span>
          <span>{{ t('qualityGate.operatorLabel') }}</span>
          <span>{{ t('qualityGate.thresholdLabel') }}</span>
          <span>{{ t('qualityGate.scopeLabel') }}</span>
          <span></span>
        </div>
        <div v-for="(condition, index) in form.conditions" :key="condition.id" class="conditions-row" :data-cy="`quality-gate-condition-${index}`">
          <select v-model="condition.metric" @change="handleMetricChange(condition)">
            <option v-for="metric in metricOptions" :key="metric.value" :value="metric.value">
              {{ metric.label }}
            </option>
          </select>
          <select v-model="condition.operator">
            <option v-for="op in operatorOptions" :key="op.value" :value="op.value">
              {{ op.label }}
            </option>
          </select>
          <input v-model.number="condition.threshold" type="number" step="0.01" />
          <select v-model="condition.scope">
            <option value="ALL">ALL</option>
            <option value="NEW">NEW</option>
          </select>
          <button class="ghost-button compact danger" @click="removeCondition(index)">
            {{ t('qualityGate.removeCondition') }}
          </button>
        </div>
      </div>

      <div class="form-actions">
        <button class="primary-button" @click="save" :disabled="saving || !isValid || !isDirty" data-cy="quality-gate-save">
          {{ saving ? t('qualityGate.saving') : t('qualityGate.save') }}
        </button>
        <button class="ghost-button" @click="resetForm" :disabled="saving || !isDirty">
          {{ t('common.reset') }}
        </button>
      </div>

      <p class="muted helper">{{ t('qualityGate.help') }}</p>
    </div>

    <Toast v-if="toastMessage" :message="toastMessage" :type="toastType" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from '../i18n';
import {
  getProjectQualityGate,
  upsertProjectQualityGate,
  type QualityGate,
  type QualityGateOperator,
  type QualityGateScope,
} from '../services/api';
import LoadingState from './common/LoadingState.vue';
import ErrorBanner from './common/ErrorBanner.vue';
import Toast from './common/Toast.vue';

const props = defineProps<{
  projectKey: string;
}>();

const { t } = useI18n();

type EditableCondition = {
  id: string;
  metric: string;
  operator: QualityGateOperator;
  threshold: number;
  scope: QualityGateScope;
};

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const toastMessage = ref('');
const toastType = ref<'success' | 'error' | 'info'>('info');

const form = reactive({
  name: '',
  conditions: [] as EditableCondition[],
});

const initialSnapshot = ref('');

const metricOptions = [
  { value: 'issues_total', label: 'Issues total' },
  { value: 'issues_blocker', label: 'Issues blocker' },
  { value: 'issues_critical', label: 'Issues critical' },
  { value: 'issues_major', label: 'Issues major' },
  { value: 'issues_minor', label: 'Issues minor' },
  { value: 'issues_info', label: 'Issues info' },
  { value: 'vulnerabilities_total', label: 'Vulnerabilities total' },
  { value: 'coverage', label: 'Coverage (%)' },
  { value: 'coverage_lines', label: 'Coverage lines (%)' },
  { value: 'coverage_branches', label: 'Coverage branches (%)' },
  { value: 'new_coverage', label: 'New coverage (%)' },
];

const operatorOptions = [
  { value: 'GT' as const, label: '>' },
  { value: 'LT' as const, label: '<' },
  { value: 'EQ' as const, label: '=' },
];

const isDirty = computed(() => initialSnapshot.value !== snapshotForm());

const isValid = computed(() => {
  if (!form.name.trim()) return false;
  if (form.conditions.length === 0) return true;
  return form.conditions.every((condition) => condition.metric && !Number.isNaN(Number(condition.threshold)));
});

function snapshotForm() {
  const payload = {
    name: form.name,
    conditions: form.conditions.map((condition) => ({
      metric: condition.metric,
      operator: condition.operator,
      threshold: Number(condition.threshold),
      scope: condition.scope,
    })),
  };
  return JSON.stringify(payload);
}

function applyGate(gate: QualityGate | null) {
  form.name = gate?.name ?? t('qualityGate.defaultName');
  form.conditions = gate?.conditions?.map((condition) => ({
    id: condition.id,
    metric: condition.metric,
    operator: condition.operator,
    threshold: Number(condition.threshold),
    scope: condition.scope ?? 'ALL',
  })) ?? [];
  initialSnapshot.value = snapshotForm();
}

function handleMetricChange(condition: EditableCondition) {
  if (condition.metric === 'new_coverage') {
    condition.scope = 'NEW';
  }
}

function addCondition() {
  form.conditions.push({
    id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    metric: 'issues_total',
    operator: 'GT',
    threshold: 0,
    scope: 'ALL',
  });
}

function removeCondition(index: number) {
  form.conditions.splice(index, 1);
}

function resetForm() {
  applyGate(lastLoadedGate.value);
}

const lastLoadedGate = ref<QualityGate | null>(null);

async function loadGate() {
  loading.value = true;
  error.value = null;
  try {
    const gate = await getProjectQualityGate(props.projectKey);
    lastLoadedGate.value = gate;
    applyGate(gate);
  } catch (err: any) {
    let notFound = false;
    if (err?.message) {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.statusCode === 404) notFound = true;
      } catch {
        // ignore parse errors
      }
      if (!notFound && /404/.test(err.message)) {
        notFound = true;
      }
    }
    if (notFound) {
      lastLoadedGate.value = null;
      applyGate(null);
    } else {
      error.value = err?.message ?? t('qualityGate.errorLoad');
    }
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!isValid.value || saving.value) return;
  saving.value = true;
  error.value = null;
  try {
    const payload = {
      name: form.name.trim(),
      conditions: form.conditions.map((condition) => ({
        metric: condition.metric,
        operator: condition.operator,
        threshold: Number(condition.threshold),
        scope: condition.scope,
      })),
    };
    const gate = await upsertProjectQualityGate(props.projectKey, payload);
    lastLoadedGate.value = gate;
    applyGate(gate);
    showToast(t('qualityGate.saved'), 'success');
  } catch (err: any) {
    showToast(err?.message ?? t('qualityGate.errorSave'), 'error');
  } finally {
    saving.value = false;
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toastMessage.value = message;
  toastType.value = type;
  setTimeout(() => {
    toastMessage.value = '';
  }, 100);
}

onMounted(loadGate);
</script>

<style scoped>
.quality-gate-tab {
  @apply flex flex-col gap-5;
}

.tab-header {
  @apply flex items-start justify-between gap-4 flex-wrap;
}

.tab-header h3 {
  @apply m-0 text-lg font-bold;
}

.editor-body {
  @apply flex flex-col gap-4;
}

.conditions-header {
  @apply flex items-center justify-between gap-3;
}

.conditions-header h4 {
  @apply m-0 text-base font-semibold;
}

.conditions-table {
  @apply flex flex-col gap-2;
}

.conditions-row {
  @apply grid gap-3 items-center;
  grid-template-columns: 1.7fr 0.7fr 0.7fr 0.7fr auto;
}

.conditions-row.head {
  @apply text-xs uppercase font-semibold text-text-muted tracking-wide;
}

.form-actions {
  @apply flex items-center gap-3 flex-wrap;
}

.ghost-button.danger {
  @apply border-[#fca5a5] text-[#b91c1c];
  background: linear-gradient(135deg, rgba(254, 226, 226, 0.6) 0%, rgba(254, 202, 202, 0.6) 100%);
}

.ghost-button.danger:hover:not(:disabled) {
  @apply border-[#f87171];
}

.helper {
  @apply text-xs;
}

@media (max-width: 960px) {
  .conditions-row {
    grid-template-columns: 1fr 1fr;
  }

  .conditions-row.head {
    display: none;
  }

  .conditions-row > *:nth-child(3),
  .conditions-row > *:nth-child(4) {
    grid-column: span 1;
  }

  .conditions-row > button {
    grid-column: span 2;
    justify-self: flex-end;
  }
}
</style>
