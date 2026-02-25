<template>
  <div v-if="error" class="error-banner">
    <div class="error-icon">⚠️</div>
    <div class="error-content">
      <strong>Error</strong>
      <p>{{ error }}</p>
    </div>
    <button v-if="dismissible" class="dismiss-btn" @click="$emit('dismiss')" aria-label="Dismiss">
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  error: string | null;
  dismissible?: boolean;
}>();

defineEmits<{
  dismiss: [];
}>();
</script>

<style scoped>
.error-banner {
  @apply flex items-start gap-3 px-4 py-3.5 rounded-xl;
  @apply border-2 border-[#fca5a5] text-[#b91c1c];
  @apply shadow-[0_4px_12px_rgba(185,28,28,0.15)];
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
}

.error-icon {
  @apply text-xl leading-none;
}

.error-content {
  @apply flex-1 flex flex-col gap-1;
}

.error-content strong {
  @apply font-bold text-sm;
}

.error-content p {
  @apply m-0 text-[13px] text-[#991b1b];
}

.dismiss-btn {
  @apply bg-transparent border-0 text-[#b91c1c] text-lg font-bold;
  @apply cursor-pointer p-0 w-6 h-6 flex items-center justify-center;
  @apply rounded transition-all duration-200;
}

.dismiss-btn:hover {
  @apply bg-[rgba(185,28,28,0.1)];
}
</style>
