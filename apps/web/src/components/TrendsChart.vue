<template>
  <div class="trends-container">
    <div v-if="loading">{{ t('trends.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="!points.length" class="muted">
      {{ t('trends.noData') }}
      <!-- Debug: show why no data -->
      <div style="font-size: 11px; margin-top: 4px">
        (Debug: points={{ points.length }}, loading={{ loading }}, error={{ error }})
      </div>
    </div>
    <div v-else>
      <div class="chart-wrapper">
        <canvas ref="canvasEl"></canvas>
      </div>
      <div class="legend" v-if="legendItems.length">
        <span v-for="item in legendItems" :key="item.key" class="legend-item">
          <span class="dot" :style="{ background: item.color }"></span>
          {{ item.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { Chart, registerables } from 'chart.js';
import { useI18n } from '../i18n';

// Register Chart.js components
Chart.register(...registerables);

export interface TrendPoint {
  id: string;
  label: string;
  totalIssues: number;
  newIssues: number;
  blockerCritical: number;
  blocker?: number;
  critical?: number;
  createdAt?: string;
  commitSha?: string;
}

const props = defineProps<{
  points: TrendPoint[];
  loading?: boolean;
  error?: string | null;
  limitValue?: number;
  showTotal?: boolean;
  showNew?: boolean;
  showBlocker?: boolean;
  showCritical?: boolean;
}>();

const canvasEl: Ref<HTMLCanvasElement | null> = ref(null);
let chartInstance: any = null;
const { t, locale } = useI18n();

const renderChart = () => {
  console.log('[TrendsChart] renderChart called', { points: props.points.length, canvasEl: !!canvasEl.value });
  if (!canvasEl.value) return;
  if (chartInstance) {
    chartInstance.destroy();
  }

  const labels = props.points.map((p) => p.label);
  const showTotal = props.showTotal ?? true;
  const showNew = props.showNew ?? true;
  const showBlocker = props.showBlocker ?? true;
  const showCritical = props.showCritical ?? true;

  const datasets = [
    ...(showTotal
      ? [
          {
            label: t('trends.legendTotal'),
            data: props.points.map((p) => p.totalIssues),
            borderColor: '#4f46e5',
            backgroundColor: '#4f46e5',
            tension: 0.3,
            pointRadius: 4,
          },
        ]
      : []),
    ...(showNew
      ? [
          {
            label: t('trends.legendNew'),
            data: props.points.map((p) => p.newIssues),
            borderColor: '#0ea5e9',
            backgroundColor: '#0ea5e9',
            tension: 0.3,
            pointRadius: 4,
          },
        ]
      : []),
    ...(showBlocker
      ? [
          {
            label: t('trends.legendBlocker'),
            data: props.points.map((p) => p.blocker ?? 0),
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b',
            tension: 0.3,
            pointRadius: 4,
          },
        ]
      : []),
    ...(showCritical
      ? [
          {
            label: t('trends.legendCritical'),
            data: props.points.map((p) => p.critical ?? 0),
            borderColor: '#b91c1c',
            backgroundColor: '#b91c1c',
            tension: 0.3,
            pointRadius: 4,
          },
        ]
      : []),
  ];

  chartInstance = new Chart(canvasEl.value, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items: any[]) {
              return items?.[0]?.label ?? '';
            },
            afterBody(items: any[]) {
              const idx = items?.[0]?.dataIndex ?? -1;
              const point = idx >= 0 ? props.points[idx] : null;
              const rev = point?.commitSha;
              return rev ? [t('trends.gitRevision', { sha: rev.slice(0, 8) })] : [];
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
          },
          grid: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim(),
          },
        },
      },
    },
  });
};

onMounted(() => {
  console.log('[TrendsChart] onMounted, points:', props.points.length);
  renderChart();
});

watch(
  () => [props.points, props.showTotal, props.showNew, props.showBlocker, props.showCritical, locale.value],
  (newVal, oldVal) => {
    console.log('[TrendsChart] watch triggered', {
      pointsChanged: newVal[0] !== oldVal?.[0],
      newLength: (newVal[0] as any)?.length,
      oldLength: (oldVal?.[0] as any)?.length,
    });
    renderChart();
  },
  { deep: true, flush: 'post' },
);

onBeforeUnmount(() => {
  if (chartInstance) chartInstance.destroy();
});

const legendItems = computed(() => {
  const showTotal = props.showTotal ?? true;
  const showNew = props.showNew ?? true;
  const showBlocker = props.showBlocker ?? true;
  const showCritical = props.showCritical ?? true;

  return [
    { key: 'total', label: t('trends.legendTotal'), color: '#4f46e5', visible: showTotal },
    { key: 'new', label: t('trends.legendNew'), color: '#0ea5e9', visible: showNew },
    { key: 'blocker', label: t('trends.legendBlocker'), color: '#f59e0b', visible: showBlocker },
    { key: 'critical', label: t('trends.legendCritical'), color: '#b91c1c', visible: showCritical },
  ].filter((item) => item.visible);
});
</script>

<style scoped>
.trends-container {
  @apply flex flex-col gap-2;
}

.legend {
  @apply mt-3 p-3 flex items-center gap-4 text-[13px] flex-wrap;
  @apply text-[var(--legend-text)];
  @apply bg-gradient-to-br from-[var(--legend-bg-start)] to-[var(--legend-bg-end)];
  @apply border-2 border-[var(--legend-border)] rounded-[10px];
  @apply transition-all duration-300 ease-in-out;
}

.legend-item {
  @apply inline-flex items-center gap-[6px] py-1 px-2 rounded-md font-semibold;
  @apply transition-all duration-200 ease-in-out;
}

.legend-item:hover {
  @apply bg-[var(--legend-item-hover-bg)];
}

.dot {
  @apply inline-block w-3 h-3 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.15)];
}

.chart-wrapper {
  @apply w-full min-h-[280px] p-3;
  @apply bg-gradient-to-br from-[var(--chart-bg-start)] to-[var(--chart-bg-end)];
  @apply border-2 border-[var(--chart-border)] rounded-[10px];
  @apply transition-all duration-300 ease-in-out;
}

.error {
  @apply text-[var(--error-text)] font-semibold p-3;
  @apply bg-[var(--error-bg)] border-2 border-[var(--error-border)] rounded-[10px];
  @apply transition-all duration-300 ease-in-out;
}
</style>
