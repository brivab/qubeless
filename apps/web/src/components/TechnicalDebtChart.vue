<template>
  <div class="debt-chart-container">
    <h4>Évolution de la Dette Technique</h4>
    <div v-if="loading">Chargement...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="!points.length" class="muted">
      Pas de données d'évolution disponibles
    </div>
    <div v-else>
      <div class="chart-wrapper">
        <canvas ref="canvasEl"></canvas>
      </div>
      <div class="legend">
        <span class="legend-item">
          <span class="dot" :style="{ background: 'var(--primary)' }"></span>
          Ratio de Dette (%)
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface DebtTrendPoint {
  analysisId: string;
  debtRatio: number;
  date: string;
  commitSha?: string;
}

const props = defineProps<{
  points: DebtTrendPoint[];
  loading?: boolean;
  error?: string | null;
}>();

const canvasEl: Ref<HTMLCanvasElement | null> = ref(null);
let chartInstance: any = null;

const renderChart = () => {
  if (!canvasEl.value) return;
  if (chartInstance) {
    chartInstance.destroy();
  }

  const labels = props.points.map((p) => {
    const date = new Date(p.date);
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
  });

  const data = props.points.map((p) => p.debtRatio);

  // Determine colors based on debt ratio
  const colors = props.points.map((p) => {
    if (p.debtRatio <= 5) return '#10b981'; // A - Green
    if (p.debtRatio <= 10) return '#84cc16'; // B - Lime
    if (p.debtRatio <= 20) return '#f59e0b'; // C - Yellow
    if (p.debtRatio <= 50) return '#f97316'; // D - Orange
    return '#ef4444'; // E - Red
  });

  chartInstance = new Chart(canvasEl.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ratio de Dette (%)',
          data,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          pointBackgroundColor: colors,
          pointBorderColor: colors,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            title: (ctx) => {
              const point = props.points[ctx[0].dataIndex];
              return `${labels[ctx[0].dataIndex]} · ${point.commitSha?.slice(0, 7) || ''}`;
            },
            label: (ctx) => {
              const value = ctx.parsed.y;
              const point = props.points[ctx.dataIndex];
              const rating =
                value <= 5 ? 'A' : value <= 10 ? 'B' : value <= 20 ? 'C' : value <= 50 ? 'D' : 'E';
              return `Ratio: ${value.toFixed(2)}% (${rating})`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Ratio de Dette (%)',
          },
          grid: {
            color: '#e5e7eb',
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

watch(() => props.points, renderChart, { deep: true });

onMounted(() => {
  if (props.points.length) {
    renderChart();
  }
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>

<style scoped>
.debt-chart-container {
  @apply p-4;
}

h4 {
  @apply m-0 mb-4 text-base font-semibold text-text-primary;
}

.error {
  @apply text-[var(--error-text)] p-3;
}

.muted {
  @apply text-text-muted p-3;
}

.chart-wrapper {
  @apply h-[300px] relative;
}

.legend {
  @apply flex gap-4 mt-3 flex-wrap;
}

.legend-item {
  @apply flex items-center gap-[6px] text-[13px] text-text-muted;
}

.dot {
  @apply w-[10px] h-[10px] rounded-full inline-block;
}
</style>
