<template>
  <div class="card technical-debt-widget">
    <div class="widget-header">
      <h3 style="margin: 0;">{{ t('technicalDebt.title') }}</h3>
      <button class="ghost-button compact" @click="refresh" :disabled="loading">
        {{ t('technicalDebt.refresh') }}
      </button>
    </div>

    <div v-if="loading" class="loading-state">{{ t('technicalDebt.loading') }}</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <div v-else-if="!debt" class="empty-state">{{ t('technicalDebt.noData') }}</div>

    <div v-else class="debt-content">
      <!-- Rating Badge -->
      <div class="debt-rating-section">
        <div class="rating-label">{{ t('technicalDebt.maintainability') }}</div>
        <TechnicalDebtBadge
          v-if="debt.maintainabilityRating"
          :rating="debt.maintainabilityRating"
          class="rating-badge-large"
        />
        <div v-else class="no-rating">N/A</div>
        <div class="rating-description">
          {{ getRatingDescription(debt.maintainabilityRating) }}
        </div>
      </div>

      <!-- Metrics Grid -->
      <div class="debt-metrics">
        <div class="debt-metric">
          <div class="metric-label">{{ t('technicalDebt.debtRatio') }}</div>
          <div class="metric-value">
            <span v-if="debt.debtRatio !== null" class="debt-ratio">
              {{ debt.debtRatio.toFixed(2) }}%
            </span>
            <span v-else class="no-data">-</span>
          </div>
          <div class="metric-bar" v-if="debt.debtRatio !== null">
            <div
              class="metric-bar-fill"
              :style="{ width: Math.min(debt.debtRatio, 100) + '%' }"
              :data-rating="debt.maintainabilityRating"
            ></div>
          </div>
        </div>

        <div class="debt-metric">
          <div class="metric-label">{{ t('technicalDebt.remediationTime') }}</div>
          <div class="metric-value remediation-time">
            {{ formatRemediationTime(debt.remediationCost) }}
          </div>
        </div>

        <div class="debt-metric" v-if="debt.remediationCost !== null">
          <div class="metric-label">{{ t('technicalDebt.remediationCost') }}</div>
          <div class="metric-value cost">
            {{ t('technicalDebt.minutesShort', { count: debt.remediationCost }) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { TechnicalDebt, MaintainabilityRating } from '../services/api';
import { getTechnicalDebt } from '../services/api';
import TechnicalDebtBadge from './TechnicalDebtBadge.vue';
import { useI18n } from '../i18n';

const { t } = useI18n();

const props = defineProps<{
  analysisId: string;
}>();

const debt = ref<TechnicalDebt | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const loadDebt = async () => {
  loading.value = true;
  error.value = null;
  try {
    debt.value = await getTechnicalDebt(props.analysisId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('technicalDebt.error');
    console.error('Error loading technical debt:', err);
  } finally {
    loading.value = false;
  }
};

const refresh = () => {
  void loadDebt();
};

const getRatingDescription = (rating: MaintainabilityRating | null): string => {
  if (!rating) return '';

  const descriptions: Record<MaintainabilityRating, string> = {
    A: t('technicalDebt.ratingExcellent'),
    B: t('technicalDebt.ratingGood'),
    C: t('technicalDebt.ratingAverage'),
    D: t('technicalDebt.ratingPoor'),
    E: t('technicalDebt.ratingVeryPoor'),
  };

  return descriptions[rating];
};

const formatRemediationTime = (minutes: number | null): string => {
  if (minutes === null) return '-';
  if (minutes === 0) return t('technicalDebt.minutesShort', { count: 0 });

  const days = Math.floor(minutes / (8 * 60));
  const remainingAfterDays = minutes % (8 * 60);
  const hours = Math.floor(remainingAfterDays / 60);
  const mins = Math.floor(remainingAfterDays % 60);
  const parts: string[] = [];

  if (days > 0) {
    parts.push(
      days === 1
        ? t('technicalDebt.daySingular', { count: days })
        : t('technicalDebt.dayPlural', { count: days }),
    );
  }
  if (hours > 0) {
    parts.push(t('technicalDebt.hoursShort', { count: hours }));
  }
  if (mins > 0) {
    parts.push(t('technicalDebt.minutesShort', { count: mins }));
  }

  if (parts.length === 0) {
    return t('technicalDebt.minutesShort', { count: 0 });
  }

  return parts.join(' ');
};

onMounted(() => {
  void loadDebt();
});

defineExpose({ refresh: loadDebt });
</script>

<style scoped>
.widget-header {
  @apply flex justify-between items-center mb-4;
}

.widget-header h3 {
  @apply m-0 text-sm font-semibold;
}

.loading-state,
.error-state,
.empty-state {
  @apply p-6 text-center text-text-secondary transition-colors duration-300;
}

.error-state {
  @apply text-[var(--error-text)];
}

.debt-content {
  @apply flex flex-col gap-5;
}

.debt-rating-section {
  @apply flex flex-col items-center p-5 bg-bg-tertiary rounded-xl;
  @apply border border-border-primary transition-all duration-300 ease-in-out;
}

.rating-label {
  @apply text-[13px] font-semibold text-text-secondary uppercase tracking-[0.5px] mb-3;
  @apply transition-colors duration-300;
}

.rating-badge-large {
  @apply text-[28px] py-3 px-6 min-w-[60px] mb-2;
}

.rating-description {
  @apply text-[13px] text-text-secondary mt-1;
  @apply transition-colors duration-300;
}

.no-rating {
  @apply text-[28px] font-extrabold text-border-secondary;
  @apply transition-colors duration-300;
}

.debt-metrics {
  display: grid;
  @apply gap-4;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.debt-metric {
  @apply bg-bg-tertiary p-3 rounded-lg border border-border-primary text-center;
  @apply transition-all duration-300 ease-in-out;
}

.debt-metric:hover {
  @apply border-border-secondary shadow-[0_2px_4px_var(--card-shadow)];
}

.metric-label {
  @apply text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1;
  @apply transition-colors duration-300;
}

.metric-value {
  @apply text-xl font-semibold text-text-primary mb-[2px];
  @apply transition-colors duration-300;
}

.debt-ratio {
  @apply text-text-primary;
}

.remediation-time {
  @apply text-[var(--primary)];
}

.cost {
  @apply text-lg text-text-secondary;
  @apply transition-colors duration-300;
}

.no-data {
  @apply text-border-secondary;
  @apply transition-colors duration-300;
}

.metric-bar {
  @apply h-[6px] bg-border-primary rounded-[3px] overflow-hidden;
  @apply transition-colors duration-300;
}

.metric-bar-fill {
  @apply h-full bg-[var(--primary)] transition-all duration-300;
  transition-property: width;
}

.metric-bar-fill[data-rating='A'] {
  @apply bg-[var(--success-bg-dark)];
}

.metric-bar-fill[data-rating='B'] {
  @apply bg-[var(--success-text-dark)];
}

.metric-bar-fill[data-rating='C'] {
  @apply bg-[var(--warning-text-dark)];
}

.metric-bar-fill[data-rating='D'] {
  @apply bg-[var(--warning-bg-light)];
}

.metric-bar-fill[data-rating='E'] {
  @apply bg-[var(--error-text)];
}
</style>
