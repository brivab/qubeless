<template>
  <section class="card analyzers-card" data-cy="dashboard-analyzers-catalog">
    <div class="section-header">
      <div>
        <h3 style="margin: 0;">{{ t('analyzers.title') }}</h3>
        <p class="muted" style="margin: 4px 0 0;">{{ t('analyzers.subtitle') }}</p>
      </div>
      <button class="ghost-button" type="button" @click="loadAnalyzers" :disabled="loading">
        {{ loading ? t('common.loading') : t('common.refresh') }}
      </button>
    </div>

    <div v-if="loading" class="muted">{{ t('analyzers.loading') }}</div>
    <div v-else-if="error" class="error-text">{{ error }}</div>
    <div v-else-if="analyzers.length === 0" class="muted">{{ t('analyzers.none') }}</div>
    <div v-else class="analyzer-grid">
      <div v-for="analyzer in analyzers" :key="analyzer.id" class="analyzer-tile" :data-cy="`dashboard-analyzer-${analyzer.key}`">
        <div class="analyzer-tile-header">
          <div>
            <div class="analyzer-name">{{ analyzer.name }}</div>
            <div class="muted" style="font-size: 13px;">{{ t('analyzers.keyLabel') }} : {{ analyzer.key }}</div>
          </div>
          <span class="pill" :class="analyzer.enabled ? 'pill-success' : 'pill-danger'">
            {{ analyzer.enabled ? t('analyzers.enabled') : t('analyzers.disabled') }}
          </span>
        </div>
        <div class="muted" style="font-size: 13px; word-break: break-all;">
          {{ t('analyzers.imageLabel') }} : {{ analyzer.dockerImage }}
        </div>
        <div class="tile-meta">
          <span class="dot" />
          <span>{{ t('analyzers.created', { date: formatDate(analyzer.createdAt) }) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getAnalyzers, type Analyzer } from '../services/api';
import { useI18n } from '../i18n';

const analyzers = ref<Analyzer[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const { t, locale, getLocaleTag } = useI18n();

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(getLocaleTag(locale.value));
};

async function loadAnalyzers() {
  loading.value = true;
  error.value = null;
  try {
    analyzers.value = await getAnalyzers();
  } catch (err: any) {
    console.error('[dashboard] failed to load analyzers', err);
    error.value = err?.message ?? t('analyzers.errorLoad');
  } finally {
    loading.value = false;
  }
}

onMounted(loadAnalyzers);
</script>

<style scoped>
.analyzers-card {
  @apply mt-4;
}

.section-header {
  @apply flex justify-between items-center gap-3 flex-wrap;
}

.analyzer-grid {
  display: grid;
  @apply gap-3 mt-3;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.analyzer-tile {
  @apply border border-border-primary rounded-xl py-[14px] px-[14px];
  @apply bg-gradient-to-br from-[var(--card-bg-start)] to-[var(--card-bg-end)];
  @apply shadow-[0_8px_20px_var(--card-shadow)] flex flex-col gap-[10px];
  @apply transition-all duration-300 ease-in-out;
}

.analyzer-tile:hover {
  @apply border-border-secondary shadow-[0_10px_25px_var(--card-shadow-hover)] -translate-y-[2px];
}

.analyzer-tile-header {
  @apply flex items-center justify-between gap-[10px];
}

.analyzer-name {
  @apply font-bold text-base text-text-primary transition-colors duration-300;
}

.pill {
  @apply py-[6px] px-[10px] rounded-full text-xs font-bold tracking-[0.2px];
  @apply border border-transparent transition-all duration-300 ease-in-out;
}

.pill-success {
  @apply bg-[var(--badge-success-bg-start)] text-[var(--badge-success-text)];
  @apply border-[var(--badge-success-border)];
}

.pill-danger {
  @apply bg-[var(--badge-failed-bg-start)] text-[var(--badge-failed-text)];
  @apply border-[var(--badge-failed-border)];
}

.tile-meta {
  @apply flex items-center gap-2 text-[13px] text-text-secondary;
  @apply transition-colors duration-300;
}

.dot {
  @apply w-2 h-2 rounded-full bg-[var(--primary)] inline-block;
}

.error-text {
  @apply text-[var(--error-text)] transition-colors duration-300;
}

@media (max-width: 700px) {
  .analyzers-card {
    @apply mt-3;
  }
}
</style>
