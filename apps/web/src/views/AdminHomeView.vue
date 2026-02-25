<template>
  <div class="page">
    <div class="page-header">
      <div>
        <p class="muted" style="margin: 0">{{ t('nav.admin') }}</p>
        <h2 style="margin: 4px 0 0">{{ t('adminHome.title') }}</h2>
        <p class="muted" style="margin: 4px 0 0">
          {{ t('adminHome.subtitle') }}
        </p>
      </div>
    </div>

    <div class="admin-grid">
      <RouterLink v-for="item in adminItems" :key="item.to" :to="item.to" class="card admin-card">
        <h3 class="admin-card-title">{{ item.title }}</h3>
        <p class="muted" style="margin: 0">{{ item.description }}</p>
        <div class="admin-card-cta">{{ t('adminHome.open') }} →</div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../i18n';

const { t } = useI18n();

const adminItems = computed(() => [
  {
    to: '/admin/tokens',
    title: t('nav.tokens'),
    description: t('adminHome.tokensDesc'),
  },
  {
    to: '/admin/analyzers',
    title: t('nav.analyzers'),
    description: t('adminHome.analyzersDesc'),
  },
  {
    to: '/admin/llm-providers',
    title: t('nav.llmProviders'),
    description: t('adminHome.llmProvidersDesc'),
  },
  {
    to: '/admin/llm-prompts',
    title: t('nav.llmPrompts'),
    description: t('adminHome.llmPromptsDesc'),
  },
  {
    to: '/admin/audit-logs',
    title: t('nav.auditLogs'),
    description: t('adminHome.auditLogsDesc'),
  },
]);
</script>

<style scoped>
.admin-grid {
  display: grid;
  @apply gap-4;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.admin-card {
  @apply flex flex-col gap-3 transition-all duration-200 cursor-pointer;
  text-decoration: none;
  min-height: 160px;
}

.admin-card:hover {
  @apply -translate-y-0.5;
}

.admin-card-title {
  @apply text-lg font-semibold;
  margin: 0;
}

.admin-card-cta {
  @apply mt-auto text-sm font-semibold text-text-secondary;
}
</style>
