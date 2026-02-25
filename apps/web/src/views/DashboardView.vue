<template>
  <section class="card" data-cy="dashboard-section">
    <h2 style="margin-top: 0;">{{ t('dashboard.title') }}</h2>
    <div class="dashboard-grid">
      <div
        class="status-card status-card-dark status-card-wide"
        data-cy="dashboard-platform-status"
        :class="{
          'status-card-error': platformStatus?.status === 'down',
          'status-card-warning': platformStatus?.status === 'degraded'
        }"
      >
        <div class="status-card-label">{{ t('dashboard.platformStatusLabel') }}</div>
        <div class="status-card-value">
          <span v-if="loadingStatus" class="status-loading">⏳</span>
          <span v-else-if="!platformStatus">{{ t('dashboard.platformStatusValue') }}</span>
          <span v-else-if="platformStatus.status === 'operational'">✓ {{ t('dashboard.statusOperational') }}</span>
          <span v-else-if="platformStatus.status === 'degraded'">⚠ {{ t('dashboard.statusDegraded') }}</span>
          <span v-else>✗ {{ t('dashboard.statusDown') }}</span>
        </div>
        <div class="status-card-desc">
          <span v-if="loadingStatus">{{ t('dashboard.loadingStatus') }}</span>
          <span v-else-if="!platformStatus">{{ t('dashboard.platformStatusDesc') }}</span>
          <span v-else>{{ platformStatus.message }}</span>
        </div>
        <div v-if="!loadingStatus" class="status-services">
          <div
            v-for="service in servicesSummary"
            :key="service.key"
            :class="['status-service-card', `status-service-card-${service.status}`]"
          >
            <div class="status-service-head">
              <span :class="['status-service-dot', `status-service-dot-${service.status}`]"></span>
              <span class="status-service-label">{{ service.label }}</span>
            </div>
            <span class="status-service-value">
              {{ getServiceStatusLabel(service.status) }}
            </span>
          </div>
        </div>
        <div v-if="platformStatus" class="status-card-meta">
          {{ t('dashboard.lastCheck') }}: {{ formatTimestamp(platformStatus.timestamp) }}
        </div>
      </div>
      <div class="status-card status-card-cta" data-cy="dashboard-projects-card">
        <div class="status-card-label">{{ t('dashboard.projectsLabel') }}</div>
        <div class="status-card-value" style="font-size: 20px;">{{ t('dashboard.projectsValue') }}</div>
        <div class="status-card-desc">{{ t('dashboard.projectsDesc') }}</div>
        <RouterLink to="/projects">
          <button type="button" style="width: 100%; margin-top: 8px;">{{ t('dashboard.projectsCta') }}</button>
        </RouterLink>
      </div>
    </div>
  </section>
  <AnalyzersCatalog />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import AnalyzersCatalog from '../components/AnalyzersCatalog.vue';
import { useI18n } from '../i18n';

const { t } = useI18n();

type ServiceStatus = 'online' | 'offline' | 'unknown';

interface PlatformStatus {
  status: 'operational' | 'degraded' | 'down';
  message: string;
  services: {
    api: 'online' | 'offline';
    worker: 'online' | 'offline';
    database: 'online' | 'offline';
  };
  timestamp: string;
}

interface ReadinessStatus {
  checks?: {
    redis?: { status: 'ok' | 'error' };
    minio?: { status: 'ok' | 'error' };
  };
}

const platformStatus = ref<PlatformStatus | null>(null);
const serviceDetails = ref<{ redis: ServiceStatus; objectStorage: ServiceStatus }>({
  redis: 'unknown',
  objectStorage: 'unknown',
});
const loadingStatus = ref(true);
let statusInterval: ReturnType<typeof setInterval> | null = null;

const servicesSummary = computed(() => [
  {
    key: 'api',
    label: t('dashboard.serviceApi'),
    status: toServiceStatus(platformStatus.value?.services.api),
  },
  {
    key: 'worker',
    label: t('dashboard.serviceWorker'),
    status: toServiceStatus(platformStatus.value?.services.worker),
  },
  {
    key: 'database',
    label: t('dashboard.serviceDatabase'),
    status: toServiceStatus(platformStatus.value?.services.database),
  },
  {
    key: 'redis',
    label: t('dashboard.serviceRedis'),
    status: serviceDetails.value.redis,
  },
  {
    key: 'object-storage',
    label: t('dashboard.serviceObjectStorage'),
    status: serviceDetails.value.objectStorage,
  },
]);

function toServiceStatus(value?: 'online' | 'offline'): ServiceStatus {
  return value ?? 'unknown';
}

function getCheckStatus(value?: { status: 'ok' | 'error' }): ServiceStatus {
  if (!value) return 'unknown';
  return value.status === 'ok' ? 'online' : 'offline';
}

function getServiceStatusLabel(status: ServiceStatus) {
  if (status === 'online') return t('dashboard.serviceOnline');
  if (status === 'offline') return t('dashboard.serviceOffline');
  return t('dashboard.serviceUnknown');
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString();
}

async function fetchPlatformStatus() {
  try {
    const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '');
    const API_URL = `${API_BASE.replace(/\/api$/, '')}/api`;
    const [statusResponse, readinessResponse] = await Promise.all([
      fetch(`${API_URL}/status`),
      fetch(`${API_URL}/ready`).catch(() => null),
    ]);
    if (!statusResponse.ok) {
      throw new Error(`HTTP ${statusResponse.status}`);
    }
    platformStatus.value = await statusResponse.json();

    serviceDetails.value = {
      redis: 'unknown',
      objectStorage: 'unknown',
    };

    if (readinessResponse && (readinessResponse.ok || readinessResponse.status === 503)) {
      const readiness = (await readinessResponse.json()) as ReadinessStatus;
      serviceDetails.value = {
        redis: getCheckStatus(readiness.checks?.redis),
        objectStorage: getCheckStatus(readiness.checks?.minio),
      };
    }
  } catch (error) {
    console.error('Failed to fetch platform status:', error);
    // Set offline status if the API call fails
    platformStatus.value = {
      status: 'down',
      message: 'Unable to connect to API',
      services: {
        api: 'offline',
        worker: 'offline',
        database: 'offline',
      },
      timestamp: new Date().toISOString(),
    };
    serviceDetails.value = {
      redis: 'offline',
      objectStorage: 'offline',
    };
  } finally {
    loadingStatus.value = false;
  }
}

onMounted(async () => {
  await fetchPlatformStatus();
  // Refresh status every 30 seconds
  statusInterval = setInterval(fetchPlatformStatus, 30000);
});

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval);
  }
});
</script>

<style scoped>
.dashboard-grid {
  display: grid;
  @apply gap-4 mt-4;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.status-card-wide {
  grid-column: span 2;
}

.status-card {
  @apply flex flex-col gap-[10px] rounded-[14px] p-5 border-2 transition-all duration-300;
  background: linear-gradient(135deg, var(--status-card-bg-start) 0%, var(--status-card-bg-end) 100%);
  border-color: var(--status-card-border);
  box-shadow: 0 6px 30px var(--card-shadow);
}

.status-card:hover {
  @apply -translate-y-0.5;
  border-color: var(--status-card-border-hover);
  box-shadow: 0 8px 35px var(--card-shadow-hover);
}

.status-card-dark {
  background: linear-gradient(135deg, var(--status-card-dark-bg-start) 0%, var(--status-card-dark-bg-end) 100%);
  color: var(--status-card-dark-text);
  border-color: var(--status-card-dark-border);
}

.status-card-dark:hover {
  border-color: var(--status-card-dark-border-hover);
  box-shadow: 0 8px 35px var(--status-card-dark-shadow);
}

.status-card-dark .status-card-label {
  color: var(--status-card-dark-label);
}

.status-card-dark .status-card-desc {
  color: var(--status-card-dark-desc);
}

.status-card-error {
  background: linear-gradient(135deg, var(--status-card-error-bg-start) 0%, var(--status-card-error-bg-end) 100%);
  border-color: var(--status-card-error-border);
}

.status-card-error:hover {
  border-color: var(--status-card-error-border-hover);
  box-shadow: 0 8px 35px var(--status-card-error-shadow);
}

.status-card-warning {
  background: linear-gradient(135deg, var(--status-card-warning-bg-start) 0%, var(--status-card-warning-bg-end) 100%);
  border-color: var(--status-card-warning-border);
}

.status-card-warning:hover {
  border-color: var(--status-card-warning-border-hover);
  box-shadow: 0 8px 35px var(--status-card-warning-shadow);
}

.status-loading {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-card-cta {
  border-color: var(--status-card-cta-border);
  background: linear-gradient(135deg, var(--status-card-cta-bg-start) 0%, var(--status-card-cta-bg-end) 100%);
}

.status-card-cta:hover {
  border-color: var(--status-card-cta-border-hover);
}

.status-card-label {
  @apply text-[13px] font-semibold uppercase tracking-[0.5px] transition-colors duration-300;
  color: var(--status-card-label);
}

.status-card-value {
  @apply text-[32px] font-bold mt-1.5 leading-tight;
}

.status-card-desc {
  @apply text-sm mt-2 leading-relaxed transition-colors duration-300;
  color: var(--status-card-desc);
}

.status-services {
  @apply mt-2 grid gap-2;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}

.status-service-card {
  @apply rounded-xl border p-3 transition-colors duration-300;
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
}

.status-service-card-online {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.22) 0%, rgba(16, 185, 129, 0.16) 100%);
  border-color: rgba(74, 222, 128, 0.5);
}

.status-service-card-offline {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.16) 100%);
  border-color: rgba(252, 165, 165, 0.45);
}

.status-service-card-unknown {
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.2) 0%, rgba(100, 116, 139, 0.14) 100%);
  border-color: rgba(148, 163, 184, 0.35);
}

.status-service-head {
  @apply flex items-center gap-2;
}

.status-service-dot {
  @apply inline-block h-2.5 w-2.5 rounded-full;
}

.status-service-dot-online {
  background: #4ade80;
}

.status-service-dot-offline {
  background: #f87171;
}

.status-service-dot-unknown {
  background: #cbd5e1;
}

.status-service-label {
  @apply text-sm font-medium;
}

.status-service-value {
  @apply mt-2 block text-sm font-semibold;
}

.status-card-meta {
  @apply mt-2 text-xs;
  color: var(--status-card-desc);
}

@media (max-width: 1024px) {
  .status-card-wide {
    grid-column: span 1;
  }
}
</style>
