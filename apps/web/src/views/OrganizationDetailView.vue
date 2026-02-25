<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink to="/organizations" class="muted" style="font-size: 14px">
          ← {{ t('organizations.title') }}
        </RouterLink>
        <h2 style="margin: 6px 0 0">{{ organization?.name ?? 'Organization' }}</h2>
        <p class="muted" style="margin: 4px 0 0">{{ organization?.description ?? organization?.slug }}</p>
      </div>
      <div class="actions">
        <RouterLink :to="{ name: 'organization-settings', params: { slug: orgSlug } }">
          <button class="ghost-button">Settings</button>
        </RouterLink>
        <button class="ghost-button" @click="load" :disabled="loading">
          {{ t('common.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="card">{{ t('organizations.loading') }}</div>
    <div v-else-if="error" class="card" style="color: #b91c1c;">{{ error }}</div>
    <div v-else>
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">{{ t('organizations.projectCount') }}</div>
          <div class="stat-value">{{ organization?._count?.projects ?? 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('organizations.memberCount') }}</div>
          <div class="stat-value">{{ organization?._count?.members ?? 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Created</div>
          <div class="stat-value-small">{{ formatDate(organization?.createdAt) }}</div>
        </div>
      </div>

      <!-- Projects List -->
      <div class="card">
        <div class="section-header">
          <h3 style="margin: 0">{{ t('organizations.projectCount') }}</h3>
          <button class="ghost-button compact" @click="loadProjects" :disabled="loadingProjects">
            {{ t('common.refresh') }}
          </button>
        </div>
        <div v-if="loadingProjects" class="muted">{{ t('projects.loading') }}</div>
        <div v-else-if="projectsError" style="color: #b91c1c;">{{ projectsError }}</div>
        <div v-else-if="projects.length === 0" class="muted">{{ t('project.noAnalyses') }}</div>
        <div v-else class="projects-list">
          <div v-for="project in projects" :key="project.id" class="project-item">
            <div>
              <div class="muted" style="font-size: 13px;">{{ project.key }}</div>
              <strong style="display: block; margin: 4px 0;">{{ project.name }}</strong>
              <p class="muted" style="margin: 0; font-size: 14px;">
                {{ project.description || t('projects.noDescription') }}
              </p>
            </div>
            <RouterLink :to="{ name: 'project', params: { key: project.key } }" class="link-btn">
              {{ t('projects.openProject') }}
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getOrganization, getOrganizationProjects, type Organization, type Project } from '../services/api';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';

const route = useRoute();
const orgSlug = route.params.slug as string;

const organization = ref<Organization | null>(null);
const projects = ref<Project[]>([]);
const loading = ref(false);
const loadingProjects = ref(false);
const error = ref<string | null>(null);
const projectsError = ref<string | null>(null);
const auth = useAuthStore();
const { t, getLocaleTag } = useI18n();

function formatDate(dateStr?: string | null) {
  if (!dateStr) return t('common.notAvailable');
  return new Date(dateStr).toLocaleDateString(getLocaleTag());
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    organization.value = await getOrganization(orgSlug);
    await loadProjects();
  } catch (err: any) {
    console.error('Failed to load organization', err);
    error.value = err?.message ?? t('organizations.error');
  } finally {
    loading.value = false;
  }
}

async function loadProjects() {
  loadingProjects.value = true;
  projectsError.value = null;
  try {
    projects.value = await getOrganizationProjects(orgSlug);
  } catch (err: any) {
    console.error('Failed to load projects', err);
    projectsError.value = err?.message ?? t('projects.error');
  } finally {
    loadingProjects.value = false;
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
.page {
  @apply flex flex-col gap-4;
}

.page-header {
  @apply flex justify-between items-center mb-4;
}

.actions {
  @apply flex gap-3 items-end;
}

.stats-grid {
  display: grid;
  @apply gap-4 mb-4;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.stat-card {
  @apply rounded-lg p-5 transition-all duration-200;
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
  border: 1px solid var(--card-border);
}

.stat-card:hover {
  @apply -translate-y-0.5;
  box-shadow: 0 4px 12px var(--card-shadow-hover);
}

.stat-label {
  @apply text-xs uppercase font-semibold tracking-[0.3px] mb-2;
  color: var(--text-muted, #6b7280);
}

.stat-value {
  @apply text-[32px] font-bold;
  color: var(--text-primary, #111827);
}

.stat-value-small {
  @apply text-base font-semibold;
  color: var(--text-primary, #111827);
}

.section-header {
  @apply flex justify-between items-center mb-4;
}

.ghost-button.compact {
  @apply px-3 py-1.5 text-sm;
}

.projects-list {
  @apply flex flex-col gap-4;
}

.project-item {
  @apply flex justify-between items-center p-4 rounded-lg border transition-all duration-200;
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
  border-color: var(--card-border);
}

.project-item:hover {
  @apply translate-x-1;
  border-color: var(--primary);
  box-shadow: 0 4px 12px var(--card-shadow-hover);
}

.link-btn {
  @apply inline-flex items-center gap-1.5 font-bold whitespace-nowrap transition-all duration-200;
  color: var(--primary);
}

.link-btn:hover {
  @apply gap-[10px];
  color: var(--primary-dark);
}
</style>
