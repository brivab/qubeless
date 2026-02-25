<template>
  <div class="page">
    <div class="page-header">
      <div>
        <p class="muted" style="margin: 0;">Portfolio</p>
        <h2 style="margin: 4px 0 0;">All Projects ({{ portfolioData?.total || 0 }})</h2>
      </div>
      <div style="display: flex; gap: 12px; align-items: flex-end;">
        <button class="ghost-button" @click="toggleFilters" data-cy="portfolio-toggle-filters">
          {{ showFilters ? 'Hide Filters' : 'Filters' }} ▼
        </button>
        <button class="primary-button" @click="exportCSV" :disabled="loading || !portfolioData?.projects.length" data-cy="portfolio-export-csv">
          Export CSV
        </button>
        <button class="ghost-button" @click="load" :disabled="loading" data-cy="portfolio-refresh">Refresh</button>
      </div>
    </div>

    <!-- Filters Panel -->
    <div v-if="showFilters" class="card filters-panel">
      <div class="filters-grid">
        <div class="filter-group">
          <label>Organization</label>
          <select v-model="filters.organizationId" @change="applyFilters">
            <option :value="undefined">All Organizations</option>
            <option v-for="org in organizations" :key="org.id" :value="org.id">
              {{ org.name }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Quality Gate</label>
          <select v-model="filters.qualityGateStatus" @change="applyFilters">
            <option :value="undefined">All</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Min Coverage (%)</label>
          <input type="number" v-model.number="filters.minCoverage" min="0" max="100" @change="applyFilters" />
        </div>

        <div class="filter-group">
          <label>Max Coverage (%)</label>
          <input type="number" v-model.number="filters.maxCoverage" min="0" max="100" @change="applyFilters" />
        </div>

        <div class="filter-group">
          <label>Min Debt Ratio (%)</label>
          <input type="number" v-model.number="filters.minDebtRatio" min="0" max="100" @change="applyFilters" />
        </div>

        <div class="filter-group">
          <label>Max Debt Ratio (%)</label>
          <input type="number" v-model.number="filters.maxDebtRatio" min="0" max="100" @change="applyFilters" />
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="primary-button" @click="applyFilters">Apply</button>
        <button class="ghost-button" @click="resetFilters">Reset</button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div v-if="portfolioData?.summary" class="summary-cards">
      <div class="summary-card" data-cy="portfolio-summary-projects">
        <div class="summary-label">Projects</div>
        <div class="summary-value">{{ portfolioData.summary.totalProjects }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Analyses</div>
        <div class="summary-value">{{ portfolioData.summary.totalAnalyses }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Issues</div>
        <div class="summary-value">{{ portfolioData.summary.totalIssues }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Avg Coverage</div>
        <div class="summary-value">{{ portfolioData.summary.avgCoverage.toFixed(1) }}%</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Avg Debt Ratio</div>
        <div class="summary-value">{{ portfolioData.summary.avgDebtRatio.toFixed(1) }}%</div>
      </div>
    </div>

    <div v-if="loading" class="card">Loading portfolio...</div>
    <div v-else-if="error" class="card error-card">{{ error }}</div>
    <div v-else-if="portfolioData">
      <!-- Projects Table -->
      <div class="card table-container" data-cy="portfolio-table">
        <table class="portfolio-table">
          <thead>
            <tr>
              <th @click="sortBy('name')" class="sortable">
                Project {{ getSortIndicator('name') }}
              </th>
              <th>Organization</th>
              <th @click="sortBy('issues')" class="sortable">
                Gate {{ getSortIndicator('issues') }}
              </th>
              <th @click="sortBy('issues')" class="sortable">
                Issues {{ getSortIndicator('issues') }}
              </th>
              <th @click="sortBy('coverage')" class="sortable">
                Coverage {{ getSortIndicator('coverage') }}
              </th>
              <th @click="sortBy('debt')" class="sortable">
                Debt {{ getSortIndicator('debt') }}
              </th>
              <th @click="sortBy('lastAnalysis')" class="sortable">
                Last Scan {{ getSortIndicator('lastAnalysis') }}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in portfolioData.projects" :key="project.id">
              <td>
                <div>
                  <div style="font-weight: 600;">{{ project.name }}</div>
                  <div class="muted" style="font-size: 12px;">{{ project.key }}</div>
                </div>
              </td>
              <td>{{ project.organizationName }}</td>
              <td>
                <span v-if="project.lastAnalysis" :class="getGateBadgeClass(project.lastAnalysis.qualityGateStatus)">
                  {{ project.lastAnalysis.qualityGateStatus === 'PASSED' ? '✅ PASS' : '❌ FAIL' }}
                </span>
                <span v-else class="muted">N/A</span>
              </td>
              <td>{{ project.lastAnalysis?.issuesCount ?? 'N/A' }}</td>
              <td>
                <span v-if="project.lastAnalysis?.coverage !== null && project.lastAnalysis?.coverage !== undefined">
                  {{ project.lastAnalysis.coverage.toFixed(1) }}%
                </span>
                <span v-else class="muted">N/A</span>
              </td>
              <td>
                <span v-if="project.lastAnalysis?.debtRatio !== null && project.lastAnalysis?.debtRatio !== undefined">
                  {{ project.lastAnalysis.debtRatio.toFixed(1) }}%
                </span>
                <span v-else class="muted">N/A</span>
              </td>
              <td>
                <span v-if="project.lastAnalysis">
                  {{ formatRelativeTime(project.lastAnalysis.createdAt) }}
                </span>
                <span v-else class="muted">Never</span>
              </td>
              <td>
                <RouterLink :to="{ name: 'project', params: { key: project.key } }" class="table-link">
                  View
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="portfolioData.total > pageSize" class="pagination">
        <button @click="previousPage" :disabled="currentPage === 0" class="ghost-button">
          Previous
        </button>
        <span class="muted">
          Showing {{ currentPage * pageSize + 1 }} - {{ Math.min((currentPage + 1) * pageSize, portfolioData.total) }} of {{ portfolioData.total }}
        </span>
        <button @click="nextPage" :disabled="(currentPage + 1) * pageSize >= portfolioData.total" class="ghost-button">
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getPortfolio, exportPortfolioCSV, getOrganizations, type PortfolioResponse, type PortfolioQueryParams, type Organization, type PortfolioSortBy, type SortOrder } from '../services/api';
import { useAuthStore } from '../stores/auth';

const portfolioData = ref<PortfolioResponse | null>(null);
const organizations = ref<Organization[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const showFilters = ref(false);
const currentPage = ref(0);
const pageSize = 50;

const filters = ref<PortfolioQueryParams>({
  sortBy: 'name',
  sortOrder: 'asc',
});

const auth = useAuthStore();

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const params: PortfolioQueryParams = {
      ...filters.value,
      limit: pageSize,
      offset: currentPage.value * pageSize,
    };
    portfolioData.value = await getPortfolio(params);
  } catch (err: any) {
    console.error('Failed to load portfolio', err);
    error.value = err?.message ?? 'Failed to load portfolio data';
  } finally {
    loading.value = false;
  }
}

async function loadOrganizations() {
  try {
    organizations.value = await getOrganizations();
  } catch (err: any) {
    console.error('Failed to load organizations', err);
  }
}

function toggleFilters() {
  showFilters.value = !showFilters.value;
}

function applyFilters() {
  currentPage.value = 0;
  load();
}

function resetFilters() {
  filters.value = {
    sortBy: 'name',
    sortOrder: 'asc',
  };
  currentPage.value = 0;
  load();
}

function sortBy(column: PortfolioSortBy) {
  if (filters.value.sortBy === column) {
    filters.value.sortOrder = filters.value.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    filters.value.sortBy = column;
    filters.value.sortOrder = 'asc';
  }
  applyFilters();
}

function getSortIndicator(column: PortfolioSortBy): string {
  if (filters.value.sortBy === column) {
    return filters.value.sortOrder === 'asc' ? '↑' : '↓';
  }
  return '';
}

function getGateBadgeClass(status: string): string {
  return status === 'PASSED' ? 'gate-pass' : 'gate-fail';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return '1d ago';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

async function exportCSV() {
  try {
    const params: PortfolioQueryParams = {
      ...filters.value,
    };
    const blob = await exportPortfolioCSV(params);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('Failed to export CSV', err);
    error.value = err?.message ?? 'Failed to export CSV';
  }
}

function previousPage() {
  if (currentPage.value > 0) {
    currentPage.value--;
    load();
  }
}

function nextPage() {
  if (portfolioData.value && (currentPage.value + 1) * pageSize < portfolioData.value.total) {
    currentPage.value++;
    load();
  }
}

onMounted(async () => {
  if (!auth.initialized) {
    await auth.initialize();
  }
  await Promise.all([load(), loadOrganizations()]);
});
</script>

<style scoped>
.page {
  @apply flex flex-col gap-4;
}

.page-header {
  @apply flex justify-between items-center mb-4;
}

.filters-panel {
  @apply p-5;
}

.filters-grid {
  display: grid;
  @apply gap-4;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.filter-group {
  @apply flex flex-col gap-1.5;
}

.filter-group label {
  @apply text-[13px] font-semibold;
  color: var(--text-muted);
}

.filter-group select,
.filter-group input {
  @apply px-3 py-2 border rounded-md text-sm transition-all duration-200;
  border-color: var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
}

.filter-group select:hover,
.filter-group input:hover {
  border-color: var(--input-border-hover);
}

.filter-group select:focus,
.filter-group input:focus {
  @apply outline-none;
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--input-shadow-focus);
}

.summary-cards {
  display: grid;
  @apply gap-4;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.summary-card {
  @apply border rounded-lg p-5 text-center transition-all duration-200;
  background: linear-gradient(135deg, var(--badge-type-bg-start) 0%, var(--badge-type-bg-end) 100%);
  border-color: var(--badge-type-border);
  box-shadow: 0 2px 4px var(--card-shadow);
}

.summary-card:hover {
  @apply -translate-y-0.5;
  box-shadow: 0 4px 8px var(--card-shadow-hover);
}

.summary-label {
  @apply text-[13px] font-semibold uppercase tracking-[0.5px] mb-2;
  color: var(--badge-type-text);
}

.summary-value {
  @apply text-[32px] font-bold;
  color: var(--badge-type-text);
}

.error-card {
  color: var(--error-text);
}

.table-container {
  @apply overflow-x-auto p-0;
}

.portfolio-table {
  @apply w-full;
  border-collapse: collapse;
}

.portfolio-table th,
.portfolio-table td {
  @apply px-4 py-3 text-left border-b;
  border-color: var(--row-border);
}

.portfolio-table th {
  @apply font-semibold text-[13px] uppercase tracking-[0.5px];
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.portfolio-table th.sortable {
  @apply cursor-pointer select-none transition-all duration-200;
}

.portfolio-table th.sortable:hover {
  background: var(--row-hover-bg);
  color: var(--text-primary);
}

.portfolio-table tbody tr {
  @apply transition-colors duration-200;
}

.portfolio-table tbody tr:hover {
  background: var(--row-hover-bg);
}

.gate-pass {
  @apply inline-block px-2 py-1 rounded text-xs font-semibold border;
  background: linear-gradient(135deg, var(--badge-success-bg-start), var(--badge-success-bg-end));
  color: var(--badge-success-text);
  border-color: var(--badge-success-border);
  box-shadow: 0 2px 4px var(--badge-success-shadow);
}

.gate-fail {
  @apply inline-block px-2 py-1 rounded text-xs font-semibold border;
  background: linear-gradient(135deg, var(--badge-failed-bg-start), var(--badge-failed-bg-end));
  color: var(--badge-failed-text);
  border-color: var(--badge-failed-border);
  box-shadow: 0 2px 4px var(--badge-failed-shadow);
}

.table-link {
  @apply font-semibold no-underline transition-colors duration-200;
  color: var(--primary);
}

.table-link:hover {
  @apply underline;
  color: var(--primary-dark);
}

.pagination {
  @apply flex justify-center items-center gap-4 py-4;
}

.primary-button {
  @apply border-0 px-4 py-2 rounded-md font-semibold cursor-pointer transition-all duration-200;
  background: linear-gradient(135deg, var(--btn-bg-start), var(--btn-bg-end));
  color: var(--button-text);
  box-shadow: 0 2px 4px var(--btn-shadow);
}

.primary-button:hover:not(:disabled) {
  @apply -translate-y-px;
  box-shadow: 0 4px 8px var(--btn-shadow-hover);
}

.primary-button:active:not(:disabled) {
  @apply translate-y-0;
  box-shadow: 0 2px 4px var(--btn-shadow-active);
}

.primary-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.ghost-button {
  @apply border px-4 py-2 rounded-md font-semibold cursor-pointer transition-all duration-200;
  background: linear-gradient(135deg, var(--ghost-btn-bg-start), var(--ghost-btn-bg-end));
  border-color: var(--ghost-btn-border);
  color: var(--ghost-btn-text);
  box-shadow: 0 2px 4px var(--ghost-btn-shadow);
}

.ghost-button:hover:not(:disabled) {
  @apply -translate-y-px;
  background: linear-gradient(135deg, var(--ghost-btn-bg-hover-start), var(--ghost-btn-bg-hover-end));
  border-color: var(--ghost-btn-border-hover);
  box-shadow: 0 4px 8px var(--ghost-btn-shadow-hover);
}

.ghost-button:active:not(:disabled) {
  @apply translate-y-0;
}

.ghost-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
