<template>
  <div class="loading-state">
    <div class="spinner"></div>
    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message?: string;
}>();
</script>

<style scoped>
.loading-state {
  @apply flex flex-col items-center justify-center gap-3 p-8 text-text-muted;
}

.spinner {
  @apply w-10 h-10 border-4 border-border-secondary rounded-full;
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  @apply m-0 text-sm font-semibold;
}
</style>
