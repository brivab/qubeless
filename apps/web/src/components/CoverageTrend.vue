<template>
  <div>
    <h3 style="margin-top: 0;">Coverage Trend</h3>

    <div v-if="loading" style="text-align: center; padding: 32px 0;">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="error" style="color: #b91c1c; font-size: 14px;">
      {{ error }}
    </div>

    <div v-else-if="trendData.length === 0" class="muted" style="text-align: center; padding: 32px 0; font-size: 14px;">
      No coverage trend data available
    </div>

    <div v-else>
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useI18n } from '../i18n';
import { Chart, registerables } from 'chart.js';
import { getCoverageTrend, type CoverageTrendPoint } from '../services/api';

Chart.register(...registerables);

const { t } = useI18n();

const props = defineProps<{
  projectKey: string;
  branchId?: string;
  limit?: number;
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
const trendData = ref<CoverageTrendPoint[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
let chartInstance: Chart | null = null;

const loadTrendData = async () => {
  try {
    loading.value = true;
    error.value = null;
    trendData.value = await getCoverageTrend(props.projectKey, props.branchId, props.limit || 20);

    if (trendData.value.length > 0 && chartCanvas.value) {
      renderChart();
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      trendData.value = [];
    } else {
      error.value = err instanceof Error ? err.message : 'Failed to load coverage trend';
    }
  } finally {
    loading.value = false;
  }
};

const renderChart = () => {
  if (!chartCanvas.value || trendData.value.length === 0) return;

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  const labels = trendData.value.map((point) => {
    const date = new Date(point.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const data = trendData.value.map((point) => point.coveragePercent);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Coverage %',
          data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.5,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => `Coverage: ${context.parsed.y?.toFixed(2) ?? '0.00'}%`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`,
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
};

onMounted(() => {
  loadTrendData();
});

watch(() => [props.projectKey, props.branchId], () => {
  loadTrendData();
});
</script>
