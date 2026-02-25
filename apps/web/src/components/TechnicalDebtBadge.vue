<template>
  <span class="debt-badge" :data-rating="rating">
    {{ rating }}
  </span>
</template>

<script setup lang="ts">
import type { MaintainabilityRating } from '../services/api';

defineProps<{
  rating: MaintainabilityRating;
}>();
</script>

<style scoped>
.debt-badge {
  @apply py-[6px] px-[14px] rounded-xl text-[13px] font-extrabold tracking-[0.5px];
  @apply border-2 border-transparent shadow-[0_2px_6px_var(--card-shadow)];
  @apply transition-all duration-300 ease-in-out inline-block min-w-[36px] text-center;
}

/* A - Excellent (≤ 5%) */
.debt-badge[data-rating='A'] {
  @apply bg-gradient-to-br from-[var(--badge-minor-bg-start)] to-[var(--badge-minor-bg-end)];
  @apply text-[var(--badge-minor-text)] border-[var(--badge-minor-border)];
}

/* B - Bon (≤ 10%) */
.debt-badge[data-rating='B'] {
  @apply bg-gradient-to-br from-[var(--success-bg-light)] to-[var(--success-bg)];
  @apply text-[var(--success-text-dark)] border-[var(--success-border)];
}

/* C - Moyen (≤ 20%) */
.debt-badge[data-rating='C'] {
  @apply bg-gradient-to-br from-[var(--badge-critical-bg-start)] to-[var(--badge-critical-bg-end)];
  @apply text-[var(--badge-critical-text)] border-[var(--badge-critical-border)];
}

/* D - Mauvais (≤ 50%) */
.debt-badge[data-rating='D'] {
  @apply bg-gradient-to-br from-[var(--warning-bg-light)] to-[var(--warning-bg)];
  @apply text-[var(--warning-text-dark)] border-[var(--warning-border)];
}

/* E - Très mauvais (> 50%) */
.debt-badge[data-rating='E'] {
  @apply bg-gradient-to-br from-[var(--badge-blocker-bg-start)] to-[var(--badge-blocker-bg-end)];
  @apply text-[var(--badge-blocker-text)] border-[var(--badge-blocker-border)];
}

.debt-badge:hover {
  @apply -translate-y-[1px] shadow-[0_4px_8px_var(--card-shadow-hover)];
}
</style>
