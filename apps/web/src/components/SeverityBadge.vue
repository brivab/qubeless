<template>
  <span class="severity-badge" :data-severity="severity">
    {{ label || severity }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
  label?: string;
}>();
</script>

<style scoped>
.severity-badge {
  @apply px-3 py-[5px] rounded-btn text-[11px] font-bold uppercase tracking-[0.3px];
  @apply border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.08)];
  @apply transition-all duration-300 inline-block;
}

.severity-badge[data-severity='BLOCKER'] {
  background: linear-gradient(135deg, var(--badge-blocker-bg-start) 0%, var(--badge-blocker-bg-end) 100%);
  @apply text-badge-blocker-text border-badge-blocker-border;
}

.severity-badge[data-severity='CRITICAL'] {
  background: linear-gradient(135deg, var(--badge-critical-bg-start) 0%, var(--badge-critical-bg-end) 100%);
  @apply text-badge-critical-text border-badge-critical-border;
}

.severity-badge[data-severity='MAJOR'] {
  background: linear-gradient(135deg, var(--badge-major-bg-start) 0%, var(--badge-major-bg-end) 100%);
  @apply text-badge-major-text border-badge-major-border;
}

.severity-badge[data-severity='MINOR'] {
  background: linear-gradient(135deg, var(--badge-minor-bg-start) 0%, var(--badge-minor-bg-end) 100%);
  @apply text-badge-minor-text border-badge-minor-border;
}

.severity-badge[data-severity='INFO'] {
  background: linear-gradient(135deg, var(--badge-info-bg-start) 0%, var(--badge-info-bg-end) 100%);
  @apply text-badge-info-text border-badge-info-border;
}
</style>
