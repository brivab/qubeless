<template>
  <div>
    <div class="widget-header">
      <h3 style="margin: 0;">Code Duplication</h3>
      <span v-if="duplication" class="muted" style="font-size: 12px;">jscpd</span>
    </div>

    <div v-if="loading" class="loading-state">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="error" class="error-state">
      {{ error }}
    </div>

    <div v-else-if="duplication" class="duplication-widget">
      <!-- Overall Duplication Percentage -->
      <div class="duplication-circle-wrapper">
        <div class="duplication-circle">
          <svg class="duplication-svg" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r="56"
              :stroke="circleBackgroundColor"
              stroke-width="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              :stroke="duplicationColor"
              stroke-width="8"
              fill="none"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="dashOffset"
              class="duplication-progress"
            />
          </svg>
          <div class="duplication-percentage" :style="{ color: duplicationColor }">
            {{ Math.round(duplication.duplicationPercent * 10) / 10 }}%
          </div>
        </div>
      </div>

      <!-- Duplication Details -->
      <div class="duplication-details">
        <div class="duplication-detail-tile">
          <div class="duplication-detail-label">Duplicated Lines</div>
          <div class="duplication-detail-value">
            {{ duplication.duplicatedLines }}
          </div>
          <div class="duplication-detail-percent muted" style="font-size: 12px;">
            {{ duplication.totalSources }} files scanned
          </div>
        </div>

        <div class="duplication-detail-tile">
          <div class="duplication-detail-label">Duplicate Blocks</div>
          <div class="duplication-detail-value">
            {{ duplication.duplicationBlocks || duplication.totalClones || 0 }}
          </div>
          <div class="duplication-detail-percent muted" style="font-size: 12px;">
            code fragments
          </div>
        </div>
      </div>

      <!-- Quality Indicator -->
      <div style="margin-top: 16px; text-align: center;">
        <div v-if="duplication.duplicationPercent < 3" class="quality-badge quality-badge-pass">
          ✓ Meets quality gate (< 3%)
        </div>
        <div v-else class="quality-badge quality-badge-fail">
          ✗ Exceeds quality gate (≥ 3%)
        </div>
      </div>

      <!-- Link to Detailed View -->
      <div v-if="showDetailsLink" style="margin-top: 16px; text-align: center;">
        <router-link
          :to="`/analyses/${analysisId}/duplication`"
          class="duplication-link"
        >
          View duplication blocks →
        </router-link>
      </div>
    </div>

    <div v-else class="empty-state">
      No duplication data available for this analysis
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '../i18n';
import { getDuplication, type DuplicationStats } from '../services/api';

const { t } = useI18n();

const props = defineProps<{
  analysisId: string;
  showDetailsLink?: boolean;
}>();

const duplication = ref<DuplicationStats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const circumference = 2 * Math.PI * 56;

const dashOffset = computed(() => {
  if (!duplication.value) return circumference;
  const percent = Math.min(duplication.value.duplicationPercent, 100);
  return circumference - (circumference * percent) / 100;
});

const circleBackgroundColor = computed(() => {
  // Use border color for the background circle
  return getComputedStyle(document.documentElement).getPropertyValue('--border-primary').trim() || '#e5e7eb';
});

const duplicationColor = computed(() => {
  if (!duplication.value) return getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6b7280';
  const percent = duplication.value.duplicationPercent;
  // Green if < 3%, yellow if < 5%, orange if < 10%, red otherwise
  if (percent < 3) return '#10b981';
  if (percent < 5) return '#f59e0b';
  if (percent < 10) return '#f97316';
  return '#ef4444';
});

async function fetchDuplication() {
  loading.value = true;
  error.value = null;
  try {
    duplication.value = await getDuplication(props.analysisId);
  } catch (err) {
    console.error('Failed to fetch duplication data:', err);
    error.value = 'Failed to load duplication data';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchDuplication();
});
</script>

<style scoped>
.widget-header {
  @apply flex justify-between items-center mb-4;
}

.loading-state,
.error-state,
.empty-state {
  @apply p-6 text-center text-text-secondary transition-colors duration-300;
}

.error-state {
  @apply text-[var(--error-text)];
}

.duplication-widget {
  @apply py-4 px-0;
}

.duplication-circle-wrapper {
  @apply flex justify-center mb-6;
}

.duplication-circle {
  @apply relative w-32 h-32;
}

.duplication-svg {
  @apply w-full h-full -rotate-90;
}

.duplication-progress {
  @apply transition-all duration-500 ease-in-out;
  transition-property: stroke-dashoffset;
}

.duplication-percentage {
  @apply absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[28px] font-bold;
}

.duplication-details {
  @apply grid-cols-2 gap-3 mt-4;
}

.duplication-detail-tile {
  @apply bg-bg-tertiary border border-border-primary rounded-lg p-3 text-center;
  @apply transition-all duration-300 ease-in-out;
}

.duplication-detail-tile:hover {
  @apply border-border-secondary shadow-[0_2px_4px_var(--card-shadow)];
}

.duplication-detail-label {
  @apply text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1;
  @apply transition-colors duration-300;
}

.duplication-detail-value {
  @apply text-xl font-semibold text-text-primary mb-[2px];
  @apply transition-colors duration-300;
}

.duplication-detail-percent {
  @apply text-xs text-text-secondary;
  @apply transition-colors duration-300;
}

.quality-badge {
  @apply inline-block py-[6px] px-3 rounded-md text-[13px] font-medium;
  @apply border border-transparent transition-all duration-300 ease-in-out;
}

.quality-badge-pass {
  @apply bg-gradient-to-br from-[var(--badge-success-bg-start)] to-[var(--badge-success-bg-end)];
  @apply text-[var(--badge-success-text)] border-[var(--badge-success-border)];
}

.quality-badge-fail {
  @apply bg-gradient-to-br from-[var(--badge-failed-bg-start)] to-[var(--badge-failed-bg-end)];
  @apply text-[var(--badge-failed-text)] border-[var(--badge-failed-border)];
}

.duplication-link {
  @apply text-[var(--accent)] no-underline text-sm font-medium;
  @apply transition-opacity duration-300;
}

.duplication-link:hover {
  @apply opacity-80 underline;
}

.muted {
  @apply text-text-muted;
}
</style>
