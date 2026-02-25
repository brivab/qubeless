<script setup lang="ts">
import ScreenshotPlaceholder from './ScreenshotPlaceholder.vue';

defineProps<{
  tagline: string;
  statusLabel: string;
  summary: string;
  screenshotUrl?: string;
  screenshotAlt: string;
  placeholderAriaLabel: string;
  placeholderTitle: string;
  placeholderText: string;
}>();
</script>

<template>
  <section class="space-y-8" aria-labelledby="hero-title">
    <div class="space-y-5">
      <p class="text-sm font-semibold uppercase tracking-[0.2em] text-text-tertiary">
        {{ statusLabel }}
      </p>
      <div class="space-y-3">
        <h1 id="hero-title" class="text-3xl font-semibold leading-tight text-text-primary md:text-5xl">
          {{ tagline }}
        </h1>
        <p class="max-w-2xl text-sm text-text-secondary md:text-base">
          {{ summary }}
        </p>
      </div>
    </div>

    <div class="rounded-card border border-border-primary bg-bg-secondary p-4 md:p-5">
      <img
        v-if="screenshotUrl"
        :src="screenshotUrl"
        :alt="screenshotAlt"
        class="aspect-[16/9] w-full rounded-btn border border-border-primary bg-bg-tertiary object-cover"
      />
      <ScreenshotPlaceholder
        v-else
        :aria-label="placeholderAriaLabel"
        :title="placeholderTitle"
        :text="placeholderText"
      />
    </div>
  </section>
</template>
