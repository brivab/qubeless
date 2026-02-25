<script setup lang="ts">
withDefaults(
  defineProps<{
    ariaLabel?: string;
    title?: string;
    text?: string;
  }>(),
  {
    ariaLabel: 'Dashboard screenshot placeholder',
    title: 'Screenshot',
    text: 'Add dashboard screenshot'
  }
);
</script>

<template>
  <div
    class="flex aspect-[16/9] w-full items-center justify-center rounded-btn border border-dashed border-border-secondary bg-bg-tertiary px-4 text-center"
    role="img"
    :aria-label="ariaLabel"
  >
    <div class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">{{ title }}</p>
      <p class="text-sm text-text-secondary">{{ text }}</p>
    </div>
  </div>
</template>
