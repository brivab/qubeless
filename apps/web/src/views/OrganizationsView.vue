<template>
  <div class="page">
    <div class="page-header">
      <div>
        <p class="muted" style="margin: 0;">{{ t('organizations.title') }}</p>
        <h2 style="margin: 4px 0 0;">{{ t('organizations.listTitle') }}</h2>
      </div>
      <div style="display: flex; gap: 12px; align-items: flex-end;">
        <RouterLink to="/organizations/new">
          <button type="button">{{ t('organizations.createNew') }}</button>
        </RouterLink>
        <button class="ghost-button" @click="load" :disabled="loading">{{ t('common.refresh') }}</button>
      </div>
    </div>

    <div v-if="loading" class="card">{{ t('organizations.loading') }}</div>
    <div v-else-if="error" class="card" style="color: #b91c1c;">{{ error }}</div>
    <div v-else class="grid">
      <div v-for="org in organizations" :key="org.id" class="card org-card">
        <div class="org-header">
          <div>
            <div class="muted" style="font-size: 13px;">{{ org.slug }}</div>
            <h3 style="margin: 6px 0 4px;">{{ org.name }}</h3>
            <p class="muted" style="margin: 0;">{{ org.description || t('organizations.noDescription') }}</p>
          </div>
          <span class="badge">{{ org.slug }}</span>
        </div>
        <div class="org-stats">
          <div class="stat-item">
            <span class="stat-label">{{ t('organizations.projectCount') }}</span>
            <span class="stat-value">{{ org._count?.projects ?? 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('organizations.memberCount') }}</span>
            <span class="stat-value">{{ org._count?.members ?? 0 }}</span>
          </div>
        </div>
        <RouterLink :to="{ name: 'organization', params: { slug: org.slug } }" class="link-btn">
          {{ t('organizations.openOrganization') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getOrganizations, type Organization } from '../services/api';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';

const organizations = ref<Organization[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const auth = useAuthStore();
const { t } = useI18n();

async function load() {
  loading.value = true;
  error.value = null;
  try {
    console.log('[organizations] loading organizations');
    organizations.value = await getOrganizations();
    console.log('[organizations] loaded', organizations.value);
  } catch (err: any) {
    console.error('Failed to load organizations', err);
    error.value = err?.message ?? t('organizations.error');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (!auth.initialized) {
    await auth.initialize();
  }
  await load();
});
</script>

<style scoped>
.grid {
  display: grid;
  @apply gap-4;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.org-card {
  @apply flex flex-col gap-3 transition-all duration-200;
}

.org-card:hover {
  @apply -translate-y-0.5;
}

.org-header {
  @apply flex items-start justify-between gap-3;
}

.badge {
  @apply px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-[0.3px] border;
  background: linear-gradient(135deg, var(--badge-type-bg-start) 0%, var(--badge-type-bg-end) 100%);
  color: var(--badge-type-text);
  border-color: var(--badge-type-border);
  box-shadow: 0 2px 4px var(--badge-success-shadow);
}

.org-stats {
  @apply flex gap-4 py-3 border-t;
  border-color: var(--border-color, #e5e7eb);
}

.stat-item {
  @apply flex flex-col gap-1;
}

.stat-label {
  @apply text-xs uppercase font-semibold tracking-[0.3px];
  color: var(--text-muted, #6b7280);
}

.stat-value {
  @apply text-xl font-bold;
  color: var(--text-primary, #111827);
}

.link-btn {
  @apply inline-flex items-center gap-1.5 font-bold py-2 transition-all duration-200;
  color: var(--primary);
}

.link-btn:hover {
  @apply gap-[10px];
  color: var(--primary-dark);
}

.page-header {
  @apply flex justify-between items-center mb-4;
}

.page {
  @apply flex flex-col gap-4;
}
</style>
