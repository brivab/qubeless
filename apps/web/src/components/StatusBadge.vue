<template>
  <span class="status-badge" :data-status="status">
    {{ label || status }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  status: 'SUCCESS' | 'RUNNING' | 'FAILED' | 'PENDING';
  label?: string;
}>();
</script>

<style scoped>
.status-badge {
  @apply rounded-full px-3 py-[5px] text-[11px] font-bold tracking-wide uppercase;
  @apply border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.08)];
  @apply inline-block transition-all duration-300;
}

.status-badge[data-status='SUCCESS'] {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  @apply text-badge-success-text border-badge-success-border;
}

.status-badge[data-status='RUNNING'] {
  background: linear-gradient(135deg, var(--badge-running-bg-start) 0%, var(--badge-running-bg-end) 100%);
  @apply text-badge-running-text border-badge-running-border;
}

.status-badge[data-status='FAILED'] {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  @apply text-badge-failed-text border-badge-failed-border;
}

.status-badge[data-status='PENDING'] {
  background: linear-gradient(135deg, var(--badge-pending-bg-start) 0%, var(--badge-pending-bg-end) 100%);
  @apply text-badge-pending-text border-badge-pending-border;
}
</style>
