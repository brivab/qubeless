<template>
  <div class="card">
    <h3 style="margin-top: 0;">{{ t('summary.title') }}</h3>
    <div v-if="loading || !summary">{{ t('summary.loading') }}</div>
    <div v-else class="summary-grid">
      <div class="summary-tile">
        <div class="summary-label">{{ t('summary.totalIssues') }}</div>
        <div class="summary-value">{{ summary.totalIssues }}</div>
      </div>
      <div class="summary-tile">
        <div class="summary-label">{{ t('summary.newIssues') }}</div>
        <div class="summary-value summary-value-new">{{ summary.newIssues }}</div>
      </div>
      <div class="summary-tile">
        <div class="summary-label">{{ t('summary.criticalBlocker') }}</div>
        <div class="summary-value summary-value-critical">
          {{ (summary.bySeverity?.CRITICAL ?? 0) + (summary.bySeverity?.BLOCKER ?? 0) }}
        </div>
      </div>
      <div class="summary-tile">
        <div class="summary-label">{{ t('summary.vulnerabilities') }}</div>
        <div class="summary-value summary-value-vuln">{{ summary.byType?.VULNERABILITY ?? 0 }}</div>
      </div>
    </div>
    <div v-if="summary" class="mini-bars">
      <div class="mini-bar">
        <div class="mini-bar-label">{{ t('summary.severityAll') }}</div>
        <div class="bar">
          <span
            v-for="sev in severities"
            :key="sev"
            class="bar-seg"
            :style="{ flex: (summary.bySeverity?.[sev] || 0) + 1 }"
            :data-severity="sev"
          >
            <span class="bar-seg-label">{{ sev }}</span>
            <span class="bar-seg-value">{{ summary.bySeverity?.[sev] || 0 }}</span>
          </span>
        </div>
      </div>
      <div class="mini-bar">
        <div class="mini-bar-label">{{ t('summary.severityNew') }}</div>
        <div class="bar">
          <span
            v-for="sev in severities"
            :key="sev"
            class="bar-seg"
            :style="{ flex: (summary.newBySeverity?.[sev] || 0) + 1 }"
            :data-severity="sev"
          >
            <span class="bar-seg-label">{{ sev }}</span>
            <span class="bar-seg-value">{{ summary.newBySeverity?.[sev] || 0 }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AnalysisSummary } from '../services/api';
import { useI18n } from '../i18n';

defineProps<{
  summary: AnalysisSummary | null;
  loading?: boolean;
}>();

const severities = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];
const { t } = useI18n();
</script>

<style scoped>
.summary-grid {
  display: grid;
  @apply gap-3 mt-3;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}

.summary-tile {
  @apply py-[14px] px-4 border-2 border-border-primary rounded-xl;
  @apply bg-gradient-to-br from-[var(--card-bg-start)] to-[var(--card-bg-end)];
  @apply transition-all duration-300 ease-in-out;
}

.summary-tile:hover {
  @apply border-border-secondary shadow-[0_2px_8px_var(--card-shadow)] -translate-y-[1px];
}

.summary-label {
  @apply text-[13px] font-semibold text-text-secondary uppercase tracking-[0.5px] mb-2;
  @apply transition-colors duration-300;
}

.summary-value {
  @apply text-[28px] font-bold text-text-primary leading-none;
  @apply transition-colors duration-300;
}

.summary-value-new {
  @apply text-[var(--success-text)];
}

.summary-value-critical {
  @apply text-[var(--danger-text)];
}

.summary-value-vuln {
  @apply text-[var(--warning-text)];
}

.mini-bars {
  @apply mt-4 flex flex-col gap-3 pt-4 border-t-2 border-border-primary;
  @apply transition-all duration-300;
}

.mini-bar-label {
  @apply text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-[0.5px];
  @apply transition-colors duration-300;
}

.mini-bar .bar {
  @apply flex gap-[6px] mt-[6px];
}

.mini-bar .bar-seg {
  @apply flex flex-col gap-[2px] bg-bg-tertiary py-2 px-[6px] rounded-lg text-center;
  @apply border border-border-primary transition-all duration-300;
}

.mini-bar .bar-seg:hover {
  @apply -translate-y-[2px] shadow-[0_2px_6px_var(--card-shadow-hover)];
}

.bar-seg-label {
  @apply text-[10px] font-semibold text-text-secondary uppercase tracking-[0.3px];
  @apply transition-colors duration-300;
}

.bar-seg-value {
  @apply text-base font-bold text-text-primary;
  @apply transition-colors duration-300;
}

.mini-bar .bar-seg[data-severity='BLOCKER'] {
  @apply bg-gradient-to-br from-[var(--badge-blocker-bg-start)] to-[var(--badge-blocker-bg-end)];
  @apply border-[var(--badge-blocker-border)];
}

.mini-bar .bar-seg[data-severity='BLOCKER'] .bar-seg-value {
  @apply text-[var(--badge-blocker-text)];
}

.mini-bar .bar-seg[data-severity='CRITICAL'] {
  @apply bg-gradient-to-br from-[var(--badge-critical-bg-start)] to-[var(--badge-critical-bg-end)];
  @apply border-[var(--badge-critical-border)];
}

.mini-bar .bar-seg[data-severity='CRITICAL'] .bar-seg-value {
  @apply text-[var(--badge-critical-text)];
}

.mini-bar .bar-seg[data-severity='MAJOR'] {
  @apply bg-gradient-to-br from-[var(--badge-major-bg-start)] to-[var(--badge-major-bg-end)];
  @apply border-[var(--badge-major-border)];
}

.mini-bar .bar-seg[data-severity='MAJOR'] .bar-seg-value {
  @apply text-[var(--badge-major-text)];
}

.mini-bar .bar-seg[data-severity='MINOR'] {
  @apply bg-gradient-to-br from-[var(--badge-minor-bg-start)] to-[var(--badge-minor-bg-end)];
  @apply border-[var(--badge-minor-border)];
}

.mini-bar .bar-seg[data-severity='MINOR'] .bar-seg-value {
  @apply text-[var(--badge-minor-text)];
}

.mini-bar .bar-seg[data-severity='INFO'] {
  @apply bg-gradient-to-br from-[var(--badge-info-bg-start)] to-[var(--badge-info-bg-end)];
  @apply border-[var(--badge-info-border)];
}

.mini-bar .bar-seg[data-severity='INFO'] .bar-seg-value {
  @apply text-[var(--badge-info-text)];
}
</style>
