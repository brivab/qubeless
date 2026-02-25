<template>
  <Teleport to="body">
    <div v-if="visible" class="toast" :class="type">
      <div class="toast-icon">{{ icon }}</div>
      <div class="toast-message">{{ message }}</div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';

const props = defineProps<{
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}>();

const visible = ref(false);

const icon = computed(() => {
  switch (props.type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'info':
    default:
      return 'ℹ';
  }
});

watch(
  () => props.message,
  (newMessage) => {
    if (newMessage) {
      visible.value = true;
      setTimeout(() => {
        visible.value = false;
      }, props.duration || 3000);
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.toast {
  @apply fixed top-6 right-6 z-[2000];
  @apply flex items-center gap-3 px-5 py-3.5 rounded-xl;
  @apply shadow-[0_12px_32px_rgba(15,23,42,0.3)] font-semibold text-sm;
  @apply min-w-[280px] max-w-[420px];
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    @apply opacity-0 translate-x-[100px];
  }
  to {
    @apply opacity-100 translate-x-0;
  }
}

.toast.success {
  background: linear-gradient(135deg, #ecfdf3 0%, #d1fae5 100%);
  @apply border-2 border-[#86efac] text-[#166534];
}

.toast.error {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  @apply border-2 border-[#fca5a5] text-[#b91c1c];
}

.toast.info {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  @apply border-2 border-[#7dd3fc] text-[#075985];
}

.toast-icon {
  @apply text-xl font-bold leading-none;
}

.toast-message {
  @apply flex-1;
}
</style>
