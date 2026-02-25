<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink to="/projects" class="muted" style="font-size: 14px">
          {{ t('project.backToProjects') }}
        </RouterLink>
        <h2 style="margin: 6px 0 0">{{ project?.name ?? t('project.defaultName') }}</h2>
        <p class="muted" style="margin: 4px 0 0">{{ project?.description ?? project?.key }}</p>
      </div>
      <div class="actions">
        <button class="primary-button" @click="showRunAnalysisModal = true" data-cy="project-run-analysis">
          {{ t('analysis.runAnalysis') }}
        </button>
        <RouterLink :to="{ name: 'project-quickstart', params: { key: projectKey } }">
          <button class="ghost-button" data-cy="project-open-quickstart">{{ t('project.quickstart') }}</button>
        </RouterLink>
        <RouterLink :to="{ name: 'project-rules', params: { key: projectKey } }">
          <button class="ghost-button" data-cy="project-open-rules">{{ t('project.rules') }}</button>
        </RouterLink>
        <button class="ghost-button" @click="loadData" :disabled="loadingProject || loadingAnalyses" data-cy="project-refresh">
          {{ t('common.refresh') }}
        </button>
      </div>
    </div>

    <RunAnalysisModal
      :is-open="showRunAnalysisModal"
      :project-key="projectKey"
      :branches="project?.branches ?? []"
      @close="showRunAnalysisModal = false"
      @success="onAnalysisStarted"
    />

    <!-- Tabs Navigation -->
    <div class="main-tabs">
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'overview' }"
        data-cy="project-tab-overview"
        @click="activeTab = 'overview'"
      >
        {{ t('project.tabs.overview') }}
      </button>
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'analyses' }"
        data-cy="project-tab-analyses"
        @click="activeTab = 'analyses'"
      >
        {{ t('project.tabs.analyses') }}
      </button>
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'analyzers' }"
        data-cy="project-tab-analyzers"
        @click="activeTab = 'analyzers'"
      >
        {{ t('project.tabs.analyzers') }}
      </button>
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'qualityGate' }"
        data-cy="project-tab-quality-gate"
        @click="activeTab = 'qualityGate'"
      >
        {{ t('project.tabs.qualityGate') }}
      </button>
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'llm' }"
        data-cy="project-tab-llm"
        @click="activeTab = 'llm'"
      >
        {{ t('project.tabs.llm') }}
      </button>
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'members' }"
        data-cy="project-tab-members"
        @click="activeTab = 'members'"
      >
        {{ t('project.tabs.members') }}
      </button>
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'integrations' }"
        data-cy="project-tab-integrations"
        @click="activeTab = 'integrations'"
      >
        Integrations
      </button>
    </div>

    <!-- Overview Tab Content -->
    <div v-show="activeTab === 'overview'" class="tab-content-wrapper">
    <div class="card">
      <h3 style="margin-top: 0">{{ t('project.latestAnalysisTitle') }}</h3>
      <div v-if="!latestAnalysis" class="muted">{{ t('project.noAnalysis') }}</div>
      <div v-else>
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 6px">
          <strong>{{ latestAnalysis.id.slice(0, 8) }}</strong>
          <span class="status" :data-status="latestAnalysis.status">{{
            getAnalysisStatusLabel(latestAnalysis.status)
          }}</span>
        </div>
        <div class="muted">
          {{ t('project.commitLabel') }} {{ latestAnalysis.commitSha.slice(0, 8) }} ·
          {{ t('project.branchLabel') }} {{ latestAnalysis.branch?.name ?? t('common.notAvailable') }}
        </div>
        <div class="muted">
          {{ t('project.finishedLabel') }} :
          {{ formatDate(latestAnalysis.finishedAt || latestAnalysis.createdAt) }}
        </div>
        <div style="margin-top: 10px">
          <div class="muted" v-if="latestSummary">
            {{
              t('project.summaryTotal', {
                total: latestSummary.totalIssues,
                new: latestSummary.newIssues,
              })
            }}
          </div>
          <div class="muted" v-else>{{ t('project.summaryUnavailable') }}</div>
        </div>
        <div style="margin-top: 10px">
          <div v-if="latestGateError" style="color: var(--error-text);">{{ latestGateError }}</div>
          <div v-else-if="latestGate" class="qg-inline">
            <span
              class="badge"
              :class="{ pass: latestGate.status === 'PASS', fail: latestGate.status === 'FAIL' }"
            >
              {{ t('project.gateStatus', { status: latestGate.status }) }}
            </span>
            <span class="muted">{{ latestGate.gate.name }}</span>
          </div>
        </div>
        <div style="margin-top: 12px">
          <RouterLink :to="{ name: 'analysis', params: { id: latestAnalysis.id } }" class="link-btn">
            {{ t('project.detailsLink') }}
          </RouterLink>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">{{ t('project.trendTitle') }}</h3>
        <button class="ghost-button compact" @click="loadLatestWidgets" :disabled="trendLoading">
          {{ t('common.refresh') }}
        </button>
      </div>
      <div class="filters">
        <div class="filter-group">
          <label class="muted small-label">{{ t('project.startDate') }}</label>
          <input type="date" v-model="startDate" class="filter-input" />
        </div>
        <div class="filter-group">
          <label class="muted small-label">{{ t('project.endDate') }}</label>
          <input type="date" v-model="endDate" class="filter-input" />
        </div>
        <div class="filter-actions">
          <button
            class="trend-chip"
            :class="{ active: showTotal }"
            @click="showTotal = !showTotal"
          >
            {{ t('project.trendTotal') }}
          </button>
          <button class="trend-chip" :class="{ active: showNew }" @click="showNew = !showNew">
            {{ t('project.trendNew') }}
          </button>
          <button
            class="trend-chip"
            :class="{ active: showBlocker }"
            @click="showBlocker = !showBlocker"
          >
            {{ t('project.trendBlocker') }}
          </button>
          <button
            class="trend-chip"
            :class="{ active: showCritical }"
            @click="showCritical = !showCritical"
          >
            {{ t('project.trendCritical') }}
          </button>
        </div>
      </div>
      <TrendsChart
        :points="localizedTrendPoints"
        :loading="trendLoading"
        :error="trendError"
        :limit-value="trendLimit"
        :show-total="showTotal"
        :show-new="showNew"
        :show-blocker="showBlocker"
        :show-critical="showCritical"
      />
    </div>

    </div>
    <!-- End Overview Tab -->

    <!-- Analyses Tab Content -->
    <div v-show="activeTab === 'analyses'" class="tab-content-wrapper">
      <div class="card">
        <div class="section-header">
          <h3 style="margin: 0">{{ t('project.analysesTitle') }}</h3>
          <button class="ghost-button compact" @click="loadAnalyses" :disabled="loadingAnalyses">
            {{ t('common.refresh') }}
          </button>
        </div>

        <!-- Filters Section -->
        <div class="filters-section">
          <div class="filter-group">
            <label class="muted small-label">{{ t('project.filterBranch') }}</label>
            <select v-model="branchFilter" class="filter-input">
              <option value="">{{ t('common.all') }}</option>
              <option v-for="branch in project?.branches ?? []" :key="branch.id" :value="branch.name">
                {{ branch.name }} {{ branch.isDefault ? t('project.defaultBranch') : '' }}
              </option>
            </select>
          </div>

          <div class="filter-group">
            <label class="muted small-label">{{ t('project.filterStatus') }}</label>
            <select v-model="statusFilter" class="filter-input">
              <option value="">{{ t('common.all') }}</option>
              <option value="SUCCESS">{{ getAnalysisStatusLabel('SUCCESS') }}</option>
              <option value="RUNNING">{{ getAnalysisStatusLabel('RUNNING') }}</option>
              <option value="FAILED">{{ getAnalysisStatusLabel('FAILED') }}</option>
              <option value="PENDING">{{ getAnalysisStatusLabel('PENDING') }}</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="muted small-label">{{ t('project.filterCommit') }}</label>
            <input
              type="text"
              v-model="commitFilter"
              :placeholder="t('project.filterCommitPlaceholder')"
              class="filter-input"
            />
          </div>

          <div class="filter-group">
            <label class="muted small-label">{{ t('project.filterAnalysisId') }}</label>
            <input
              type="text"
              v-model="analysisIdFilter"
              :placeholder="t('project.filterAnalysisIdPlaceholder')"
              class="filter-input"
            />
          </div>

          <div class="filter-actions" style="margin-left: auto">
            <button
              class="ghost-button compact"
              @click="resetFilters"
              :disabled="!hasActiveFilters"
            >
              {{ t('common.resetFilters') }}
            </button>
          </div>
        </div>

        <!-- Analyses List -->
        <div v-if="loadingAnalyses" class="loading-state">{{ t('project.loadingAnalyses') }}</div>
        <div v-else-if="analysesError" class="error-state">{{ analysesError }}</div>
        <div v-else-if="filteredAnalyses.length === 0" class="empty-state">
          <p class="muted">
            {{ hasActiveFilters ? t('project.noAnalysesMatchFilters') : t('project.noAnalyses') }}
          </p>
        </div>
        <div v-else class="list">
          <div v-for="analysis in filteredAnalyses" :key="analysis.id" class="list-item">
            <div>
              <div class="muted" style="font-size: 13px">
                {{ t('project.commitLabel') }} {{ analysis.commitSha.slice(0, 8) }} ·
                {{ t('project.branchLabel') }} {{ analysis.branch?.name ?? t('common.notAvailable') }}
              </div>
              <div style="display: flex; align-items: center; gap: 8px">
                <strong>{{ t('project.analysisLabel', { id: analysis.id.slice(0, 8) }) }}</strong>
                <span class="status" :data-status="analysis.status">{{ getAnalysisStatusLabel(analysis.status) }}</span>
              </div>
              <div class="muted" style="font-size: 13px">
                {{ t('project.startedLabel') }} : {{ formatDate(analysis.startedAt || analysis.createdAt) }}
                <span v-if="analysis.finishedAt">
                  · {{ t('project.finishedLabel') }} : {{ formatDate(analysis.finishedAt) }}</span
                >
              </div>
            </div>
            <RouterLink :to="{ name: 'analysis', params: { id: analysis.id } }" class="link-btn">
              {{ t('project.detailsLink') }}
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
    <!-- End Analyses Tab -->

    <!-- Analyzers Tab Content -->
    <div v-show="activeTab === 'analyzers'" class="card">
      <ProjectAnalyzersTab :project-key="projectKey" />
    </div>
    <!-- End Analyzers Tab -->

    <!-- Quality Gate Tab Content -->
    <div v-show="activeTab === 'qualityGate'" class="card">
      <QualityGateEditor :project-key="projectKey" />
    </div>
    <!-- End Quality Gate Tab -->

    <!-- LLM Tab Content -->
    <div v-show="activeTab === 'llm'" class="card">
      <ProjectLlmSettingsTab :project-key="projectKey" />
    </div>
    <!-- End LLM Tab -->

    <!-- Members Tab Content -->
    <div v-show="activeTab === 'members'" class="card">
      <ProjectMembers :project-key="projectKey" :can-manage="canManageMembers" />
    </div>
    <!-- End Members Tab -->

    <!-- Integrations Tab Content -->
    <div v-show="activeTab === 'integrations'" class="integrations-content">
      <ChatIntegrationsTab :project-key="projectKey" />
      <ProjectEmailNotifications :project-key="projectKey" />
    </div>
    <!-- End Integrations Tab -->

  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  getAnalysesByProject,
  getProject,
  getQualityGateStatus,
  getAnalysisSummary,
  getProjectMetrics,
  type Analysis,
  type AnalysisStatus,
  type QualityGateStatusResponse,
  type AnalysisSummary,
  type Project,
} from '../services/api';
import TrendsChart, { type TrendPoint } from '../components/TrendsChart.vue';
import ProjectMembers from '../components/ProjectMembers.vue';
import ProjectAnalyzersTab from '../components/analyzers/ProjectAnalyzersTab.vue';
import ChatIntegrationsTab from '../components/chat-integrations/ChatIntegrationsTab.vue';
import ProjectEmailNotifications from '../components/ProjectEmailNotifications.vue';
import ProjectLlmSettingsTab from '../components/llm/ProjectLlmSettingsTab.vue';
import QualityGateEditor from '../components/QualityGateEditor.vue';
import RunAnalysisModal from '../components/RunAnalysisModal.vue';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const projectKey = route.params.key as string;

const project = ref<Project | null>(null);
const showRunAnalysisModal = ref(false);
const analyses = ref<Analysis[]>([]);
const branchFilter = ref('');
const statusFilter = ref('');
const commitFilter = ref('');
const analysisIdFilter = ref('');
const loadingProject = ref(false);
const loadingAnalyses = ref(false);
const analysesError = ref<string | null>(null);
const latestGate = ref<QualityGateStatusResponse | null>(null);
const latestGateError = ref<string | null>(null);
const latestSummary = ref<AnalysisSummary | null>(null);
const trendPoints = ref<TrendPoint[]>([]);
const trendLoading = ref(false);
const trendError = ref<string | null>(null);
const trendLimit = ref(10);
const startDate = ref<string>('');
const endDate = ref<string>('');
const showTotal = ref(true);
const showNew = ref(true);
const showBlocker = ref(true);
const showCritical = ref(true);
const { t, locale, getLocaleTag } = useI18n();
const authStore = useAuthStore();

// Active tab for the project view
const activeTab = ref<
  'overview' | 'analyses' | 'analyzers' | 'qualityGate' | 'llm' | 'members' | 'integrations'
>('overview');

// Check if user can manage members (admin or project admin)
const canManageMembers = computed(() => {
  // In COMPAT mode, all authenticated users can manage (backend will enforce)
  // For UI, we show management features optimistically
  return true; // Backend enforces actual permissions
});

const latestAnalysis = computed(() => {
  if (!analyses.value.length) return null;
  return [...analyses.value].sort((a, b) => {
    const da = new Date(a.finishedAt ?? a.createdAt).getTime();
    const db = new Date(b.finishedAt ?? b.createdAt).getTime();
    return db - da;
  })[0];
});

// Filtered analyses based on all active filters
const filteredAnalyses = computed(() => {
  let result = [...analyses.value];

  // Filter by branch (already applied in API call, but kept for consistency)
  if (branchFilter.value) {
    result = result.filter((a) => a.branch?.name === branchFilter.value);
  }

  // Filter by status
  if (statusFilter.value) {
    result = result.filter((a) => a.status === statusFilter.value);
  }

  // Filter by commit SHA (partial match)
  if (commitFilter.value) {
    const searchTerm = commitFilter.value.toLowerCase();
    result = result.filter((a) => a.commitSha.toLowerCase().includes(searchTerm));
  }

  // Filter by analysis ID (partial match)
  if (analysisIdFilter.value) {
    const searchTerm = analysisIdFilter.value.toLowerCase();
    result = result.filter((a) => a.id.toLowerCase().includes(searchTerm));
  }

  return result;
});

// Check if any filters are active (excluding branch filter which triggers API reload)
const hasActiveFilters = computed(() => {
  return !!(statusFilter.value || commitFilter.value || analysisIdFilter.value);
});

const filteredTrendPoints = computed(() => {
  const filtered = trendPoints.value.filter((p) => {
    if (!p.createdAt) return true;
    const date = new Date(p.createdAt);
    if (startDate.value) {
      const start = new Date(startDate.value);
      start.setHours(0, 0, 0, 0);
      if (date < start) return false;
    }
    if (endDate.value) {
      const end = new Date(endDate.value);
      end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
    return true;
  });
  console.log('[ProjectDetailView] Filtering:', {
    total: trendPoints.value.length,
    filtered: filtered.length,
    startDate: startDate.value,
    endDate: endDate.value,
  });
  return filtered;
});

const localizedTrendPoints = computed(() => {
  const localeTag = getLocaleTag(locale.value);
  const result = filteredTrendPoints.value.map((point) => ({
    ...point,
    label: point.createdAt
      ? new Date(point.createdAt).toLocaleString(localeTag, { dateStyle: 'short', timeStyle: 'short' })
      : point.label,
  }));
  console.log('[ProjectDetailView] localizedTrendPoints computed:', result.length);
  return result;
});

function formatDate(input?: string | null) {
  if (!input) return t('common.notAvailable');
  return new Date(input).toLocaleString(getLocaleTag(locale.value));
}

function getAnalysisStatusLabel(status?: AnalysisStatus | null) {
  if (!status) return '';
  const key = `status.analysis.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

async function loadProject() {
  loadingProject.value = true;
  try {
    console.log('[project] loading', projectKey);
    project.value = await getProject(projectKey);
    console.log('[project] loaded', project.value);
  } catch (err: any) {
    analysesError.value = err?.message ?? t('project.errorLoadProject');
  } finally {
    loadingProject.value = false;
  }
}

async function loadAnalyses() {
  loadingAnalyses.value = true;
  analysesError.value = null;
  try {
    console.log('[analyses] loading for', projectKey, 'branch', branchFilter.value);
    analyses.value = await getAnalysesByProject(projectKey, branchFilter.value || undefined);
    console.log('[analyses] loaded', analyses.value);
    await loadLatestWidgets();
  } catch (err: any) {
    analysesError.value = err?.message ?? t('project.errorLoadAnalyses');
  } finally {
    loadingAnalyses.value = false;
  }
}

async function loadLatestWidgets() {
  latestGate.value = null;
  latestSummary.value = null;
  latestGateError.value = null;
  trendPoints.value = [];
  trendError.value = null;

  const latest = latestAnalysis.value;
  if (!latest) return;

  try {
    latestGate.value = await getQualityGateStatus(latest.id);
  } catch (err: any) {
    latestGateError.value = err?.message ?? t('project.errorNoQualityGate');
  }

  try {
    latestSummary.value = await getAnalysisSummary(latest.id);
  } catch (err: any) {
    // silent; widget will stay empty
  }

  trendLoading.value = true;
  try {
    const metrics = await getProjectMetrics(projectKey, { limit: 200 });
    const analysisById = new Map(analyses.value.map((a) => [a.id, a]));
    const totalByAnalysis = metrics.filter((m) => m.metricKey === 'issues_total');
    const newByAnalysis = metrics.filter((m) => m.metricKey === 'issues_new');
    const blockerByAnalysis = metrics.filter((m) => m.metricKey === 'issues_blocker');
    const criticalByAnalysis = metrics.filter((m) => m.metricKey === 'issues_critical');

    const sortedTotals = [...totalByAnalysis].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const mappedPoints = sortedTotals
      .map((m) => {
        const dateObj = new Date(m.createdAt);
        const date = dateObj.toLocaleString(getLocaleTag(locale.value), { dateStyle: 'short', timeStyle: 'short' });
        const analysis = analysisById.get(m.analysisId);
        const findValue = (key: string) => {
          const metric = metrics.find((k) => k.analysisId === m.analysisId && k.metricKey === key);
          return metric ? Number(metric.value) : 0;
        };
        return {
          id: m.analysisId,
          label: date,
          createdAt: m.createdAt,
          commitSha: analysis?.commitSha,
          totalIssues: Number(m.value),
          newIssues: findValue('issues_new'),
          blockerCritical: findValue('issues_blocker') + findValue('issues_critical'),
          blocker: findValue('issues_blocker'),
          critical: findValue('issues_critical'),
        };
      });

    console.log('[ProjectDetailView] Loaded trend points:', mappedPoints.length);

    // Initialize date range to 1 month before latest analysis if not already set
    // Do this BEFORE setting trendPoints to avoid empty array being filtered
    if (!startDate.value && !endDate.value && latest) {
      const latestDate = new Date(latest.finishedAt ?? latest.createdAt);
      const oneMonthBefore = new Date(latestDate);
      oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);

      console.log('[ProjectDetailView] Initializing dates:', {
        latestAnalysis: latest.finishedAt ?? latest.createdAt,
        latestDate: latestDate.toISOString(),
        oneMonthBefore: oneMonthBefore.toISOString(),
        start: oneMonthBefore.toISOString().split('T')[0],
        end: latestDate.toISOString().split('T')[0],
      });

      // Check if we have any points in this range
      const pointsInRange = mappedPoints.filter((p) => {
        const pDate = new Date(p.createdAt);
        return pDate >= oneMonthBefore && pDate <= latestDate;
      });
      console.log('[ProjectDetailView] Points in calculated range:', pointsInRange.length, 'out of', mappedPoints.length);

      startDate.value = oneMonthBefore.toISOString().split('T')[0];
      endDate.value = latestDate.toISOString().split('T')[0];
    }

    // Now set the trend points - the filter will apply immediately with the correct dates
    trendPoints.value = mappedPoints;

    console.log('[ProjectDetailView] After setting points, filtered:', filteredTrendPoints.value.length);
  } catch (err: any) {
    trendError.value = err?.message ?? t('project.errorLoadTrend');
  } finally {
    trendLoading.value = false;
  }
}

async function loadData() {
  await Promise.all([loadProject(), loadAnalyses()]);
}

async function onAnalysisStarted(analysisId: string) {
  // Redirect to the analysis page
  await router.push({ name: 'analysis', params: { id: analysisId } });
}

function resetFilters() {
  statusFilter.value = '';
  commitFilter.value = '';
  analysisIdFilter.value = '';
  // Note: branchFilter is not reset as it's a primary filter
}

onMounted(loadData);
watch(branchFilter, loadAnalyses);
</script>

<style scoped>
.page {
  @apply flex flex-col gap-4;
}

.page-header {
  @apply flex justify-between items-center;
}

.tab-content-wrapper {
  @apply flex flex-col gap-4;
}

.list {
  @apply flex flex-col gap-3;
}

.list-item {
  @apply flex justify-between items-center rounded-xl p-[14px_16px] border-2 transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.list-item:hover {
  @apply -translate-y-px;
  border-color: var(--border-secondary);
  box-shadow: 0 4px 12px var(--card-shadow-hover);
}
.status {
  @apply rounded-full px-3 py-[5px] text-[11px] font-bold tracking-[0.5px] uppercase border border-transparent transition-all duration-300;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}
.status[data-status='SUCCESS'] {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
  border-color: var(--badge-success-border);
}
.status[data-status='RUNNING'] {
  background: linear-gradient(135deg, var(--badge-running-bg-start) 0%, var(--badge-running-bg-end) 100%);
  color: var(--badge-running-text);
  border-color: var(--badge-running-border);
}
.status[data-status='FAILED'] {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border-color: var(--badge-failed-border);
}
.status[data-status='PENDING'] {
  background: linear-gradient(135deg, var(--badge-pending-bg-start) 0%, var(--badge-pending-bg-end) 100%);
  color: var(--badge-pending-text);
  border-color: var(--badge-pending-border);
}
.link-btn {
  @apply font-bold inline-flex items-center gap-1.5 transition-all duration-300;
  color: var(--primary);
}

.link-btn:hover {
  display: grid;
  @apply gap-[10px];
  color: var(--primary-dark);
}

.form-grid {
  display: grid;
  @apply gap-3;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.actions {
  @apply flex items-center gap-[10px] flex-wrap;
}

.section-header {
  @apply flex justify-between items-center gap-[10px];
}

.filters {
  @apply flex items-end gap-3 flex-wrap mb-2;
}

.filter-group {
  @apply flex flex-col gap-1 min-w-[140px];
}

.filter-input {
  @apply border-2 rounded-lg px-[10px] py-1.5 text-[13px] h-8 transition-all duration-300;
  border-color: var(--border-primary);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.filter-input:focus {
  @apply outline-none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.filter-input:hover:not(:disabled) {
  border-color: var(--border-secondary);
}

.small-label {
  @apply text-xs;
}

.filter-actions {
  @apply flex items-center gap-2 flex-wrap ml-auto;
}
.trend-chip {
  @apply border-2 rounded-full px-3.5 py-1.5 h-8 font-bold text-xs cursor-pointer leading-none uppercase tracking-[0.3px] transition-all duration-300;
  border-color: var(--filter-chip-border);
  background: linear-gradient(135deg, var(--filter-chip-bg-start) 0%, var(--filter-chip-bg-end) 100%);
  color: var(--filter-chip-text);
  box-shadow: 0 2px 4px var(--filter-chip-shadow);
}

.trend-chip:hover:not(.active) {
  @apply -translate-y-px;
  border-color: var(--filter-chip-border-hover);
  box-shadow: 0 4px 8px var(--filter-chip-shadow-hover);
}

.trend-chip.active {
  background: linear-gradient(135deg, var(--filter-chip-active-bg-start) 0%, var(--filter-chip-active-bg-end) 100%);
  color: var(--filter-chip-active-text);
  border-color: var(--filter-chip-active-border);
  box-shadow: 0 4px 12px var(--filter-chip-active-shadow);
}
.qg-inline {
  @apply flex items-center gap-2;
}

.trend-chart {
  @apply flex gap-[10px] items-end min-h-[160px] mt-2;
}

.trend-col {
  @apply flex-1 min-w-[30px] flex flex-col items-center gap-1.5;
}

.trend-bar-outer {
  @apply w-full rounded-lg h-[120px] flex items-end transition-all duration-300;
  background: var(--trend-bar-bg);
}

.trend-bar-vertical {
  @apply w-full rounded-lg min-h-1 transition-all duration-300;
  background: linear-gradient(180deg, var(--primary), var(--primary-light));
}

.trend-label {
  @apply text-xs text-center transition-colors duration-300;
  color: var(--text-secondary);
}

.primary-button {
  @apply border-0 rounded-lg px-5 py-2.5 font-semibold text-sm cursor-pointer transition-all duration-300;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  color: var(--button-text);
  box-shadow: 0 2px 4px var(--primary-shadow);
}

.primary-button:hover:not(:disabled) {
  @apply -translate-y-px;
  box-shadow: 0 4px 12px var(--primary-shadow-hover);
}

.primary-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.integrations-content {
  @apply flex flex-col gap-6;
}

.filters-section {
  @apply flex flex-wrap gap-3 my-4 p-4 rounded-lg border;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
  border-color: var(--border-primary);
}

.loading-state,
.error-state,
.empty-state {
  @apply p-6 text-center;
}

.error-state {
  color: var(--error-text);
}

.empty-state {
  color: var(--text-secondary);
}
</style>
