<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink :to="{ name: 'project', params: { key: projectKey } }" class="muted" style="font-size: 14px">
          {{ t('quickstart.backToProject') }}
        </RouterLink>
        <h2 style="margin: 6px 0 0">{{ t('quickstart.title') }}</h2>
      <p class="muted" style="margin: 4px 0 0">
        {{ t('quickstart.subtitle', { project: project?.name ?? projectKey }) }}
      </p>
    </div>
    <button class="ghost-button" @click="loadProject" :disabled="loadingProject" data-cy="quickstart-refresh">{{ t('common.refresh') }}</button>
  </div>

    <div v-if="projectError" class="form-error">{{ projectError }}</div>

    <div class="card">
      <h3 style="margin-top: 0;">{{ t('quickstart.ciVarsTitle') }}</h3>
      <p class="muted">{{ t('quickstart.ciVarsDesc') }}</p>
      <pre class="code-block" data-cy="quickstart-ci-vars">{{ ciVars }}</pre>
      <div class="muted" style="margin-top: 8px;">
        {{ t('quickstart.ciVarsHintPrefix') }} <code>--branch</code> {{ t('quickstart.ciVarsHintOr') }}
        <code>--sha</code> {{ t('quickstart.ciVarsHintSuffix') }}
      </div>
    </div>

    <div class="card">
      <h3 style="margin-top: 0;">{{ t('quickstart.commandTitle') }}</h3>
      <p class="muted">{{ t('quickstart.commandDesc') }}</p>
      <pre class="code-block" data-cy="quickstart-command">{{ scannerCommand }}</pre>
      <p class="muted" style="margin-top: 8px;">
        {{ t('quickstart.commandHintPrefix') }}
        <code>--branch $(git rev-parse --abbrev-ref HEAD)</code>.
        {{ t('quickstart.commandHintSuffix') }}
      </p>
    </div>

    <div class="card">
      <h3 style="margin-top: 0;">{{ t('quickstart.tokenTitle') }}</h3>
      <p class="muted">
        {{ t('quickstart.tokenDescPrefix') }}
        <RouterLink to="/admin/tokens">{{ t('quickstart.tokenDescLink') }}</RouterLink>.
        {{ t('quickstart.tokenDescSuffix') }}
      </p>
      <div class="info-box">
        <div style="font-weight: 700;">{{ t('quickstart.exclusionsTitle') }}</div>
        <div class="muted">
          {{ t('quickstart.exclusionsPrefix') }} <code>.git</code>, <code>node_modules</code>,
          <code>dist</code>, {{ t('quickstart.exclusionsMid') }} <code>.gitignore</code>.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getProject, type Project } from '../services/api';
import { useI18n } from '../i18n';

const route = useRoute();
const projectKey = route.params.key as string;
const rawApi = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '');
const apiBase = `${rawApi.replace(/\/api$/, '')}/api`;
const ciVars = computed(
  () =>
    `export SERVER_URL=${apiBase}\nexport PROJECT_KEY=${projectKey}\nexport SCANNER_TOKEN=<token_d_admin_tokens>`,
);
const scannerCommand = computed(
  () =>
    `pnpm scanner run \\\n  --server "$SERVER_URL" \\\n  --project "$PROJECT_KEY" \\\n  --token "$SCANNER_TOKEN"`,
);

const project = ref<Project | null>(null);
const loadingProject = ref(false);
const projectError = ref<string | null>(null);
const { t } = useI18n();

async function loadProject() {
  loadingProject.value = true;
  projectError.value = null;
  try {
    project.value = await getProject(projectKey);
  } catch (err: any) {
    projectError.value = err?.message ?? t('quickstart.projectError');
  } finally {
    loadingProject.value = false;
  }
}

onMounted(loadProject);
</script>

<style scoped>
.page {
  @apply flex flex-col gap-4;
}

.page-header {
  @apply flex justify-between items-center;
}

.code-block {
  @apply p-3 rounded-[10px] border font-mono whitespace-pre overflow-x-auto transition-all duration-300;
  background: var(--code-bg);
  color: var(--code-text);
  border-color: var(--code-border);
}

.info-box {
  @apply mt-2 p-3 rounded-[10px] border transition-all duration-300;
  background: var(--info-bg);
  border-color: var(--info-border);
}

.form-error {
  @apply transition-colors duration-300;
  color: var(--error-text);
}
</style>
