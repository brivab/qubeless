<template>
  <div class="page">
    <div class="page-header">
      <div>
        <p class="muted" style="margin: 0;">{{ t('projects.title') }}</p>
        <h2 style="margin: 4px 0 0;">{{ t('projects.listTitle') }}</h2>
      </div>
      <div style="display: flex; gap: 12px; align-items: flex-end;">
        <LanguageFilter v-model="languageFilter" @update:modelValue="load" />
        <button class="ghost-button" @click="load" :disabled="loading" data-cy="projects-refresh">{{ t('common.refresh') }}</button>
      </div>
    </div>

    <div v-if="loading" class="card">{{ t('projects.loading') }}</div>
    <div v-else-if="error" class="card" style="color: #b91c1c;">{{ error }}</div>
    <div v-else class="grid">
      <div v-for="project in projects" :key="project.id" class="card project-card" :data-cy="`project-card-${project.key}`">
        <div class="project-header">
          <div>
            <div class="muted" style="font-size: 13px;">{{ project.key }}</div>
            <h3 style="margin: 6px 0 4px;">{{ project.name }}</h3>
            <p class="muted" style="margin: 0;">{{ project.description || t('projects.noDescription') }}</p>
          </div>
          <span class="badge">{{ t('projects.branches', { count: project.branches?.length ?? 0 }) }}</span>
        </div>
        <RouterLink :to="{ name: 'project', params: { key: project.key } }" class="link-btn" :data-cy="`open-project-${project.key}`">
          {{ t('projects.openProject') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getProjects, type Project } from '../services/api';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import LanguageFilter from '../components/LanguageFilter.vue';

const projects = ref<Project[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const languageFilter = ref<string>('');
const auth = useAuthStore();
const { t } = useI18n();

async function load() {
  loading.value = true;
  error.value = null;
  try {
    console.log('[projects] loading projects', { language: languageFilter.value });
    projects.value = await getProjects(languageFilter.value || undefined);
    console.log('[projects] loaded', projects.value);
  } catch (err: any) {
    console.error('Failed to load projects', err);
    error.value = err?.message ?? t('projects.error');
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
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.project-card {
  @apply flex flex-col gap-3 transition-all duration-200;
}

.project-card:hover {
  @apply -translate-y-0.5;
}

.project-header {
  @apply flex items-start justify-between gap-3;
}

.badge {
  @apply px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-[0.3px] border;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  color: #4338ca;
  border-color: #c7d2fe;
  box-shadow: 0 2px 4px rgba(79, 70, 229, 0.1);
}

.link-btn {
  @apply inline-flex items-center gap-1.5 font-bold py-2 transition-all duration-200;
  color: #4f46e5;
}

.link-btn:hover {
  @apply gap-[10px];
  color: #4338ca;
}

.page-header {
  @apply flex justify-between items-center mb-4;
}

.page {
  @apply flex flex-col gap-4;
}
</style>
