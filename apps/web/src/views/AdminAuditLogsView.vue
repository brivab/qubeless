<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink to="/admin" class="muted" style="font-size: 14px">{{ t('auditLogs.back') }}</RouterLink>
        <h2 style="margin: 6px 0 0">{{ t('auditLogs.title') }}</h2>
        <p class="muted" style="margin: 4px 0 0">
          {{ t('auditLogs.subtitle') }}
        </p>
      </div>
      <button class="ghost-button" @click="loadLogs" :disabled="loading">{{ t('auditLogs.refresh') }}</button>
    </div>

    <!-- Filters -->
    <div class="card">
      <h3 style="margin-top: 0">{{ t('auditLogs.filtersTitle') }}</h3>
      <div class="form-grid">
        <label>
          <div class="muted">{{ t('auditLogs.actionLabel') }}</div>
          <select v-model="filters.action">
            <option value="">{{ t('auditLogs.allActions') }}</option>
            <option value="AUTH_LOGIN">{{ t('auditLogs.action.AUTH_LOGIN') }}</option>
            <option value="AUTH_LOGOUT">{{ t('auditLogs.action.AUTH_LOGOUT') }}</option>
            <option value="PROJECT_CREATE">{{ t('auditLogs.action.PROJECT_CREATE') }}</option>
            <option value="PROJECT_UPDATE">{{ t('auditLogs.action.PROJECT_UPDATE') }}</option>
            <option value="PROJECT_DELETE">{{ t('auditLogs.action.PROJECT_DELETE') }}</option>
            <option value="PROJECT_MEMBER_ADD">{{ t('auditLogs.action.PROJECT_MEMBER_ADD') }}</option>
            <option value="PROJECT_MEMBER_UPDATE">{{ t('auditLogs.action.PROJECT_MEMBER_UPDATE') }}</option>
            <option value="PROJECT_MEMBER_REMOVE">{{ t('auditLogs.action.PROJECT_MEMBER_REMOVE') }}</option>
            <option value="TOKEN_CREATE">{{ t('auditLogs.action.TOKEN_CREATE') }}</option>
            <option value="TOKEN_DELETE">{{ t('auditLogs.action.TOKEN_DELETE') }}</option>
            <option value="USER_CREATE">{{ t('auditLogs.action.USER_CREATE') }}</option>
            <option value="ANALYSIS_CREATE">{{ t('auditLogs.action.ANALYSIS_CREATE') }}</option>
            <option value="ISSUE_RESOLVE">{{ t('auditLogs.action.ISSUE_RESOLVE') }}</option>
          </select>
        </label>
        <label>
          <div class="muted">{{ t('auditLogs.userEmailLabel') }}</div>
          <input v-model="filters.userEmail" :placeholder="t('auditLogs.userEmailPlaceholder')" />
        </label>
        <label>
          <div class="muted">{{ t('auditLogs.startDateLabel') }}</div>
          <input type="date" v-model="filters.startDate" />
        </label>
        <label>
          <div class="muted">{{ t('auditLogs.endDateLabel') }}</div>
          <input type="date" v-model="filters.endDate" />
        </label>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
        <button @click="applyFilters" :disabled="loading">{{ t('auditLogs.applyFilters') }}</button>
        <button class="ghost-button" type="button" @click="resetFilters" :disabled="loading">{{ t('auditLogs.resetFilters') }}</button>
      </div>
    </div>

    <!-- Results -->
    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">{{ t('auditLogs.logsTitle') }}</h3>
        <span class="muted">{{ t('auditLogs.entriesCount', { count: total }) }}</span>
      </div>
      <div v-if="loading">{{ t('auditLogs.loading') }}</div>
      <div v-else-if="error" class="form-error">{{ error }}</div>
      <div v-else-if="logs.length === 0" class="muted">{{ t('auditLogs.noLogs') }}</div>
      <div v-else>
        <div class="audit-table">
          <table>
            <thead>
              <tr>
                <th>{{ t('auditLogs.dateHeader') }}</th>
                <th>{{ t('auditLogs.actionHeader') }}</th>
                <th>{{ t('auditLogs.userHeader') }}</th>
                <th>{{ t('auditLogs.targetHeader') }}</th>
                <th>{{ t('auditLogs.detailsHeader') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id">
                <td>
                  <div style="font-size: 13px;">{{ formatDate(log.createdAt) }}</div>
                </td>
                <td>
                  <div class="action-badge" :class="getActionClass(log.action)">
                    {{ formatAction(log.action) }}
                  </div>
                </td>
                <td>
                  <div v-if="log.actor" style="font-size: 13px;">
                    <div style="font-weight: 600;">{{ log.actor.email }}</div>
                    <div class="muted" style="font-size: 12px;">{{ log.actor.id.slice(0, 8) }}</div>
                  </div>
                  <div v-else class="muted" style="font-size: 13px;">{{ t('auditLogs.systemActor') }}</div>
                </td>
                <td>
                  <div v-if="log.targetType" style="font-size: 13px;">
                    <div class="muted">{{ log.targetType }}</div>
                    <div v-if="log.targetId" style="font-size: 12px; font-family: monospace;">
                      {{ log.targetId.slice(0, 12) }}...
                    </div>
                  </div>
                  <div v-else class="muted" style="font-size: 13px;">-</div>
                </td>
                <td>
                  <div v-if="log.metadata" style="font-size: 12px;">
                    <code class="metadata-code">{{ formatMetadata(log.metadata) }}</code>
                  </div>
                  <div v-else class="muted" style="font-size: 13px;">-</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination">
          <button
            class="ghost-button"
            @click="previousPage"
            :disabled="offset === 0 || loading"
          >
            {{ t('auditLogs.previous') }}
          </button>
          <span class="muted">
            {{ t('auditLogs.paginationInfo', { start: offset + 1, end: Math.min(offset + limit, total), total: total }) }}
          </span>
          <button
            class="ghost-button"
            @click="nextPage"
            :disabled="offset + limit >= total || loading"
          >
            {{ t('auditLogs.next') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getAdminAuditLogs, type AuditLog } from '../services/api';
import { useI18n } from '../i18n';

const { t, locale, getLocaleTag } = useI18n();

const logs = ref<AuditLog[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
const limit = ref(50);
const offset = ref(0);

const filters = ref({
  action: '',
  userEmail: '',
  startDate: '',
  endDate: '',
});

function formatDate(date: string) {
  return new Date(date).toLocaleString(getLocaleTag(locale.value), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAction(action: string): string {
  const key = `auditLogs.action.${action}`;
  const translated = t(key);
  return translated === key ? action : translated;
}

function getActionClass(action: string): string {
  if (action.includes('LOGIN')) return 'action-auth';
  if (action.includes('CREATE') || action.includes('ENABLE')) return 'action-create';
  if (action.includes('DELETE') || action.includes('REMOVE') || action.includes('DISABLE')) return 'action-delete';
  if (action.includes('UPDATE') || action.includes('CONFIG') || action.includes('RESOLVE')) return 'action-update';
  return '';
}

function formatMetadata(metadata: any): string {
  return JSON.stringify(metadata, null, 2);
}

async function loadLogs() {
  loading.value = true;
  error.value = null;
  try {
    const params: Record<string, string> = {
      limit: limit.value.toString(),
      offset: offset.value.toString(),
    };

    if (filters.value.action) params.action = filters.value.action;
    if (filters.value.startDate) params.startDate = new Date(filters.value.startDate).toISOString();
    if (filters.value.endDate) {
      const endDate = new Date(filters.value.endDate);
      endDate.setHours(23, 59, 59, 999);
      params.endDate = endDate.toISOString();
    }

    const result = await getAdminAuditLogs(params);
    logs.value = result.data;
    total.value = result.total;
  } catch (err: any) {
    error.value = err.message || t('auditLogs.errorLoading');
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  offset.value = 0;
  loadLogs();
}

function resetFilters() {
  filters.value = {
    action: '',
    userEmail: '',
    startDate: '',
    endDate: '',
  };
  offset.value = 0;
  loadLogs();
}

function nextPage() {
  offset.value += limit.value;
  loadLogs();
}

function previousPage() {
  offset.value = Math.max(0, offset.value - limit.value);
  loadLogs();
}

onMounted(() => {
  loadLogs();
});
</script>

<style scoped>
.form-grid {
  display: grid;
  @apply gap-4;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.audit-table {
  @apply overflow-x-auto mt-4;
}

.audit-table table {
  @apply w-full;
  border-collapse: collapse;
}

.audit-table th {
  @apply text-left p-3 font-semibold text-[13px] transition-all duration-300;
  background: var(--bg-tertiary);
  border-bottom: 2px solid var(--border-secondary);
  color: var(--text-primary);
}

.audit-table td {
  @apply p-3 align-top transition-all duration-300;
  border-bottom: 1px solid var(--border-primary);
  color: var(--text-primary);
}

.audit-table tbody tr:hover {
  background: var(--bg-tertiary);
}

.action-badge {
  @apply inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-all duration-300;
}

.action-auth {
  background: var(--info-bg-start);
  color: var(--info-text);
}

.action-create {
  background: var(--success-bg);
  color: var(--success-text);
}

.action-delete {
  background: var(--danger-bg);
  color: var(--danger-text);
}

.action-update {
  background: var(--warning-bg);
  color: var(--warning-text);
}

.metadata-code {
  @apply block p-2 rounded text-[11px] max-w-[300px] overflow-x-auto whitespace-pre font-mono transition-all duration-300;
  background: var(--code-bg);
  color: var(--code-text);
  border: 1px solid var(--code-border);
}

.pagination {
  @apply flex items-center justify-center gap-4 mt-6 pt-4 border-t transition-colors duration-300;
  border-color: var(--border-primary);
}

.section-header {
  @apply flex items-center justify-between mb-4;
}
</style>
