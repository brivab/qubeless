<template>
  <span class="issue-status-badge" :data-status="status">
    {{ label || status }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  status: 'OPEN' | 'FALSE_POSITIVE' | 'ACCEPTED_RISK' | 'RESOLVED';
  label?: string;
}>();
</script>

<style scoped>
.issue-status-badge {
  @apply px-3 py-[5px] rounded-btn text-[11px] font-bold uppercase tracking-[0.3px];
  @apply border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.08)];
  @apply inline-block transition-all duration-300;
}

.issue-status-badge[data-status='OPEN'] {
  background: linear-gradient(135deg, var(--badge-open-bg-start) 0%, var(--badge-open-bg-end) 100%);
  @apply text-badge-open-text border-badge-open-border;
}

.issue-status-badge[data-status='FALSE_POSITIVE'] {
  background: linear-gradient(135deg, var(--badge-false-positive-bg-start) 0%, var(--badge-false-positive-bg-end) 100%);
  @apply text-[var(--badge-false-positive-text)] border-[var(--badge-false-positive-border)];
}

.issue-status-badge[data-status='ACCEPTED_RISK'] {
  background: linear-gradient(135deg, var(--badge-accepted-risk-bg-start) 0%, var(--badge-accepted-risk-bg-end) 100%);
  @apply text-[var(--badge-accepted-risk-text)] border-[var(--badge-accepted-risk-border)];
}

.issue-status-badge[data-status='RESOLVED'] {
  background: linear-gradient(135deg, var(--badge-resolved-bg-start) 0%, var(--badge-resolved-bg-end) 100%);
  @apply text-badge-resolved-text border-badge-resolved-border;
}
</style>
