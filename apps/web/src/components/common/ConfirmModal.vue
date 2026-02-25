<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-card" @click.stop>
        <div class="modal-header">
          <h3>{{ title }}</h3>
          <button class="close-btn" @click="$emit('update:modelValue', false)" aria-label="Close">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <p>{{ message }}</p>
        </div>
        <div class="modal-footer">
          <button class="ghost-button" @click="$emit('update:modelValue', false)">
            {{ cancelText || 'Cancel' }}
          </button>
          <button :class="dangerConfirm ? 'danger-button' : ''" @click="handleConfirm">
            {{ confirmText || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  dangerConfirm?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
}>();

function handleOverlayClick() {
  emit('update:modelValue', false);
}

function handleConfirm() {
  emit('confirm');
  emit('update:modelValue', false);
}
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 bg-modal-overlay backdrop-blur-sm;
  @apply flex items-center justify-center z-[1000] p-5;
}

.modal-card {
  @apply bg-modal-bg rounded-2xl shadow-[0_20px_60px_rgba(15,23,42,0.3)];
  @apply max-w-[480px] w-full overflow-hidden;
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from {
    @apply opacity-0 translate-y-5;
  }
  to {
    @apply opacity-100 translate-y-0;
  }
}

.modal-header {
  @apply flex justify-between items-center px-6 py-5 border-b-2 border-modal-border;
}

.modal-header h3 {
  @apply m-0 text-lg font-bold text-text-primary;
}

.close-btn {
  @apply bg-transparent border-0 text-text-muted text-2xl font-bold;
  @apply cursor-pointer p-0 w-8 h-8 flex items-center justify-center;
  @apply rounded-lg transition-all duration-200;
}

.close-btn:hover {
  @apply bg-bg-tertiary text-text-primary;
}

.modal-body {
  @apply p-6;
}

.modal-body p {
  @apply m-0 text-text-secondary text-sm leading-relaxed;
}

.modal-footer {
  @apply flex justify-end gap-3 px-6 py-4;
  @apply border-t-2 border-modal-border bg-bg-secondary;
}

.danger-button {
  @apply text-white border border-[#b91c1c];
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.danger-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
  @apply shadow-[0_6px_16px_rgba(185,28,28,0.35)];
}
</style>
