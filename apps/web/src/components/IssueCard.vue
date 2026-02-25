<template>
  <div class="issue-card">
    <div class="issue-header">
      <div class="issue-title-row">
        <strong>{{ issue.message }}</strong>
        <span v-if="issue.isNew" class="pill-new">{{ t('issue.newLabel') }}</span>
      </div>
      <div class="issue-badges">
        <IssueStatusBadge
          v-if="issue.status !== 'OPEN'"
          :status="issue.status"
          :label="getIssueStatusLabel(issue.status)"
        />
        <SeverityBadge :severity="issue.severity" />
        <span class="badge badge-type">{{ issue.type }}</span>
      </div>
    </div>

    <div class="issue-location">
      <div class="muted">{{ issue.filePath }}</div>
      <div class="muted" v-if="issue.line">{{ t('issue.lineLabel') }} {{ issue.line }}</div>
    </div>

    <div class="issue-footer">
      <div class="muted" style="font-size: 13px;">{{ t('issue.ruleLabel') }} {{ issue.ruleKey }}</div>
      <div class="issue-actions">
        <button class="issue-status-button" @click="$emit('toggleMenu', issue.id)">
          <span v-if="issue.status === 'OPEN'">{{ t('issue.mark') }}</span>
          <span v-else>{{ t('issue.changeStatus') }}</span>
        </button>
        <div v-if="showMenu" class="issue-status-menu">
          <button @click="$emit('resolve', issue.id, 'OPEN')">{{ t('issue.statusOpen') }}</button>
          <button @click="$emit('resolve', issue.id, 'FALSE_POSITIVE')">{{ t('issue.statusFalsePositive') }}</button>
          <button @click="$emit('resolve', issue.id, 'ACCEPTED_RISK')">{{ t('issue.statusAcceptedRisk') }}</button>
          <button @click="$emit('resolve', issue.id, 'RESOLVED')">{{ t('issue.statusResolved') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Issue } from '../services/api';
import SeverityBadge from './SeverityBadge.vue';
import IssueStatusBadge from './IssueStatusBadge.vue';
import { useI18n } from '../i18n';

defineProps<{
  issue: Issue;
  showMenu?: boolean;
}>();

defineEmits<{
  toggleMenu: [issueId: string];
  resolve: [issueId: string, status: string];
}>();

const { t } = useI18n();

const getIssueStatusLabel = (status?: Issue['status'] | null) => {
  if (!status) return '';
  const key = `status.issue.${status}`;
  const label = t(key);
  return label === key ? status : label;
};
</script>

<style scoped>
.issue-card {
  @apply border-2 border-[var(--issue-card-border)] rounded-xl py-[14px] px-4;
  @apply bg-gradient-to-br from-[var(--issue-card-bg-start)] to-[var(--issue-card-bg-end)];
  @apply flex flex-col gap-[10px] transition-all duration-300 ease-in-out;
}

.issue-card:hover {
  @apply border-[var(--issue-card-border-hover)] shadow-[0_4px_12px_var(--issue-card-shadow-hover)];
}

.issue-header {
  @apply flex justify-between items-start gap-3;
}

.issue-title-row {
  @apply flex items-center gap-2 flex-1;
}

.issue-badges {
  @apply flex gap-[6px] flex-wrap;
}

.badge-type {
  @apply bg-gradient-to-br from-[var(--badge-type-bg-start)] to-[var(--badge-type-bg-end)];
  @apply text-[var(--badge-type-text)] border-[var(--badge-type-border)];
  @apply py-[5px] px-3 rounded-[10px] text-[11px] font-bold uppercase tracking-[0.3px];
  @apply border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.08)] transition-all duration-300;
}

.issue-location {
  @apply flex flex-col gap-[2px];
}

.issue-footer {
  @apply flex justify-between items-center mt-1;
}

.issue-actions {
  @apply relative;
}

.issue-status-button {
  @apply py-[6px] px-3 border border-[var(--ghost-btn-border)] rounded-lg;
  @apply bg-gradient-to-br from-[var(--ghost-btn-bg-start)] to-[var(--ghost-btn-bg-end)];
  @apply text-[var(--ghost-btn-text)] font-semibold text-[13px] cursor-pointer;
  @apply transition-all duration-200 ease-in-out shadow-[0_2px_4px_var(--ghost-btn-shadow)];
}

.issue-status-button:hover {
  @apply bg-gradient-to-br from-[var(--ghost-btn-bg-hover-start)] to-[var(--ghost-btn-bg-hover-end)];
  @apply border-[var(--ghost-btn-border-hover)] shadow-[0_4px_8px_var(--ghost-btn-shadow-hover)];
  @apply -translate-y-[1px];
}

.issue-status-menu {
  @apply absolute right-0 top-full mt-1;
  @apply bg-[var(--issue-menu-bg)] border-2 border-[var(--issue-menu-border)] rounded-[10px];
  @apply shadow-[0_10px_30px_var(--issue-menu-shadow)] z-10 min-w-[180px] overflow-hidden;
  @apply transition-all duration-300;
}

.issue-status-menu button {
  @apply block w-full text-left py-[8px] px-3 border rounded-lg cursor-pointer;
  @apply text-[13px] font-semibold transition-all duration-200;
  @apply text-[var(--ghost-btn-text)];
  @apply border-[var(--ghost-btn-border)];
  @apply bg-gradient-to-br from-[var(--ghost-btn-bg-start)] to-[var(--ghost-btn-bg-end)];
  @apply shadow-[0_2px_4px_var(--ghost-btn-shadow)];
}

.issue-status-menu button:hover {
  @apply bg-gradient-to-br from-[var(--ghost-btn-bg-hover-start)] to-[var(--ghost-btn-bg-hover-end)];
  @apply border-[var(--ghost-btn-border-hover)];
  @apply shadow-[0_4px_8px_var(--ghost-btn-shadow-hover)];
  @apply -translate-y-[1px];
}

.issue-status-menu button:active {
  @apply translate-y-[1px] shadow-[0_2px_4px_var(--ghost-btn-shadow)];
}

.issue-status-menu button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.pill-new {
  @apply bg-gradient-to-br from-[var(--badge-new-bg-start)] to-[var(--badge-new-bg-end)];
  @apply text-[var(--badge-new-text)] py-[3px] px-2 rounded-lg;
  @apply text-[10px] font-bold uppercase tracking-[0.5px];
  @apply border border-[var(--badge-new-border)] shadow-[0_2px_4px_var(--badge-new-shadow)];
  @apply transition-all duration-300;
}
</style>
