<template>
  <div>
    <div class="widget-header">
      <h3 style="margin: 0;">Code Coverage</h3>
      <span v-if="coverage" class="muted" style="font-size: 12px;">{{ coverage.format }}</span>
    </div>

    <div v-if="loading" class="loading-state">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="error" class="error-state">
      {{ error }}
    </div>

    <div v-else-if="coverage" class="coverage-widget">
      <!-- Overall Coverage Percentage -->
      <div class="coverage-circle-wrapper">
        <div class="coverage-circle">
          <svg class="coverage-svg" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#e5e7eb"
              stroke-width="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              :stroke="coverageColor"
              stroke-width="8"
              fill="none"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="dashOffset"
              class="coverage-progress"
            />
          </svg>
          <div class="coverage-percentage" :style="{ color: coverageColor }">
            {{ Math.round(coverage.coveragePercent) }}%
          </div>
        </div>
      </div>

      <!-- Coverage Details -->
      <div class="coverage-details">
        <div class="coverage-detail-tile">
          <div class="coverage-detail-label">Line Coverage</div>
          <div class="coverage-detail-value">
            {{ coverage.coveredLines }} / {{ coverage.totalLines }}
          </div>
          <div class="coverage-detail-percent">
            {{ linePercentage }}%
          </div>
        </div>

        <div class="coverage-detail-tile">
          <div class="coverage-detail-label">Branch Coverage</div>
          <div class="coverage-detail-value">
            {{ coverage.coveredBranches }} / {{ coverage.totalBranches }}
          </div>
          <div class="coverage-detail-percent">
            {{ branchPercentage }}%
          </div>
        </div>
      </div>

      <!-- Link to Detailed View -->
      <div v-if="showDetailsLink" style="margin-top: 16px; text-align: center;">
        <router-link
          :to="`/analyses/${analysisId}/coverage`"
          class="coverage-link"
        >
          View file-level coverage →
        </router-link>
      </div>
    </div>

    <div v-else class="empty-state">
      No coverage data available for this analysis
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '../i18n';
import { getCoverage, type CoverageReport } from '../services/api';

const { t } = useI18n();

const props = defineProps<{
  analysisId: string;
  showDetailsLink?: boolean;
}>();

const coverage = ref<CoverageReport | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const circumference = 2 * Math.PI * 56;

const dashOffset = computed(() => {
  if (!coverage.value) return circumference;
  const percent = coverage.value.coveragePercent / 100;
  return circumference * (1 - percent);
});

const linePercentage = computed(() => {
  if (!coverage.value || coverage.value.totalLines === 0) return '0.00';
  return ((coverage.value.coveredLines / coverage.value.totalLines) * 100).toFixed(2);
});

const branchPercentage = computed(() => {
  if (!coverage.value || coverage.value.totalBranches === 0) return '0.00';
  return ((coverage.value.coveredBranches / coverage.value.totalBranches) * 100).toFixed(2);
});

const coverageColor = computed(() => {
  if (!coverage.value) return '#9CA3AF';
  const percent = coverage.value.coveragePercent;
  if (percent >= 80) return '#10B981'; // green
  if (percent >= 50) return '#F59E0B'; // yellow
  return '#EF4444'; // red
});

onMounted(async () => {
  try {
    loading.value = true;
    coverage.value = await getCoverage(props.analysisId);
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      // Coverage not found is not an error - just don't display widget
      coverage.value = null;
    } else {
      error.value = err instanceof Error ? err.message : 'Failed to load coverage';
    }
  } finally {
    loading.value = false;
  }
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

.coverage-widget {
  @apply mt-4;
}

.coverage-circle-wrapper {
  @apply flex justify-center mb-5;
}

.coverage-circle {
  @apply relative w-32 h-32;
}

.coverage-svg {
  @apply -rotate-90 w-full h-full;
}

.coverage-progress {
  @apply transition-all duration-500 ease-in-out;
  transition-property: stroke-dashoffset;
}

.coverage-percentage {
  @apply absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-semibold;
}

.coverage-details {
  @apply grid-cols-2 gap-3;
}

.coverage-detail-tile {
  @apply bg-bg-tertiary border border-border-primary rounded-lg p-3 text-center;
  @apply transition-all duration-300 ease-in-out;
}

.coverage-detail-tile:hover {
  @apply border-border-secondary shadow-[0_2px_4px_var(--card-shadow)];
}

.coverage-detail-label {
  @apply text-[11px] text-text-secondary mb-1 uppercase tracking-wider;
  @apply transition-colors duration-300;
}

.coverage-detail-value {
  @apply text-base font-semibold mb-[2px] text-text-primary;
  @apply transition-colors duration-300;
}

.coverage-detail-percent {
  @apply text-xs text-text-secondary;
  @apply transition-colors duration-300;
}

.coverage-link {
  @apply text-sm text-[var(--primary)] no-underline;
  @apply transition-all duration-300;
}

.coverage-link:hover {
  @apply underline;
}
</style>
