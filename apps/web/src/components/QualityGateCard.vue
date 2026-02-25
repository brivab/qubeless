<template>
  <div class="card">
    <h3 style="margin-top: 0;">{{ t('qualityGate.title') }}</h3>
    <div v-if="error" style="color: var(--error-text);">{{ error }}</div>
    <div v-else-if="!qualityGate">{{ t('qualityGate.loading') }}</div>
    <div v-else class="qg">
      <div class="qg-status" :data-status="qualityGate.status">
        {{ qualityGate.status }}
      </div>
      <div class="muted" style="margin-top: 6px;">{{ qualityGate.gate.name }}</div>
      <div class="conditions">
        <div
          v-for="condition in qualityGate.conditions"
          :key="condition.metric + (condition.scope || '')"
          class="condition"
        >
          <div class="muted">
            {{ condition.metric }} · {{ t('qualityGate.scopeLabel') }} {{ formatScope(condition.scope) }}
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span>{{ condition.operator }} {{ condition.threshold }}</span>
            <span class="badge" :class="{ pass: condition.passed, fail: !condition.passed }">
              {{ t('qualityGate.valueLabel') }} {{ condition.value }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QualityGateStatusResponse } from '../services/api';
import { useI18n } from '../i18n';

defineProps<{
  qualityGate: QualityGateStatusResponse | null;
  error?: string | null;
}>();

const { t } = useI18n();

const formatScope = (scope?: string | null) => {
  if (!scope || scope === 'ALL') return t('common.all');
  return scope;
};
</script>

<style scoped>
.qg {
  @apply flex flex-col gap-2;
}

.qg-status {
  @apply py-[10px] px-[18px] rounded-full w-fit font-bold text-sm uppercase tracking-[0.5px];
  @apply border-2 border-transparent shadow-[0_4px_12px_var(--card-shadow)];
  @apply transition-all duration-300 ease-in-out;
}

.qg-status[data-status='PASS'] {
  @apply bg-gradient-to-br from-[var(--badge-success-bg-start)] to-[var(--badge-success-bg-end)];
  @apply text-[var(--badge-success-text)] border-[var(--badge-success-border)];
}

.qg-status[data-status='FAIL'] {
  @apply bg-gradient-to-br from-[var(--badge-failed-bg-start)] to-[var(--badge-failed-bg-end)];
  @apply text-[var(--badge-failed-text)] border-[var(--badge-failed-border)];
}

.conditions {
  @apply flex flex-col gap-2;
}

.condition {
  @apply border-2 border-border-primary rounded-[10px] py-3 px-[14px];
  @apply bg-gradient-to-br from-[var(--card-bg-start)] to-[var(--card-bg-end)];
  @apply transition-all duration-300 ease-in-out;
}

.condition:hover {
  @apply border-border-secondary shadow-[0_2px_8px_var(--card-shadow)];
}

.badge {
  @apply py-[5px] px-3 rounded-[10px] text-[11px] font-bold uppercase tracking-[0.3px];
  @apply border border-transparent shadow-[0_2px_4px_var(--card-shadow)];
  @apply transition-all duration-300 ease-in-out inline-block;
}

.badge.pass {
  @apply bg-gradient-to-br from-[var(--badge-success-bg-start)] to-[var(--badge-success-bg-end)];
  @apply text-[var(--badge-success-text)] border-[var(--badge-success-border)];
  @apply shadow-[0_2px_4px_var(--badge-success-shadow)];
}

.badge.fail {
  @apply bg-gradient-to-br from-[var(--badge-failed-bg-start)] to-[var(--badge-failed-bg-end)];
  @apply text-[var(--badge-failed-text)] border-[var(--badge-failed-border)];
  @apply shadow-[0_2px_4px_var(--badge-failed-shadow)];
}
</style>
