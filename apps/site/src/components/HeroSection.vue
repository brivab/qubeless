<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import ScreenshotPlaceholder from './ScreenshotPlaceholder.vue';

type HeroScreenshot = {
  url: string;
  alt: string;
};

const props = defineProps<{
  tagline: string;
  statusLabel: string;
  summary: string;
  screenshots?: HeroScreenshot[];
  placeholderAriaLabel: string;
  placeholderTitle: string;
  placeholderText: string;
}>();

const currentScreenshotIndex = ref(0);
const screenshots = computed(() => props.screenshots ?? []);
const currentScreenshot = computed(() => screenshots.value[currentScreenshotIndex.value]);
const AUTO_SCROLL_INTERVAL_MS = 3500;

let autoScrollInterval: ReturnType<typeof setInterval> | undefined;
let isMounted = false;

const goToScreenshot = (nextIndex: number) => {
  if (screenshots.value.length === 0) {
    currentScreenshotIndex.value = 0;
    return;
  }
  const normalizedIndex = ((nextIndex % screenshots.value.length) + screenshots.value.length) % screenshots.value.length;
  currentScreenshotIndex.value = normalizedIndex;
};

const goToNextScreenshot = () => {
  goToScreenshot(currentScreenshotIndex.value + 1);
};

const clearAutoScroll = () => {
  if (!autoScrollInterval) {
    return;
  }
  clearInterval(autoScrollInterval);
  autoScrollInterval = undefined;
};

const startAutoScroll = () => {
  clearAutoScroll();
  if (screenshots.value.length <= 1) {
    return;
  }
  autoScrollInterval = setInterval(() => {
    goToNextScreenshot();
  }, AUTO_SCROLL_INTERVAL_MS);
};

watch(
  () => screenshots.value.length,
  (nextLength) => {
    if (nextLength === 0) {
      currentScreenshotIndex.value = 0;
      return;
    }
    if (currentScreenshotIndex.value >= nextLength) {
      currentScreenshotIndex.value = 0;
    }
    if (isMounted) {
      startAutoScroll();
    }
  }
);

onMounted(() => {
  isMounted = true;
  startAutoScroll();
});

onUnmounted(() => {
  isMounted = false;
  clearAutoScroll();
});
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

    <div class="rounded-card border border-border-primary bg-bg-secondary p-4 md:relative md:left-1/2 md:w-[min(100vw-3rem,74rem)] md:-translate-x-1/2 md:p-5">
      <div v-if="currentScreenshot">
        <div class="overflow-hidden rounded-btn">
          <Transition name="hero-slide-ltr" mode="out-in">
            <img
              :key="currentScreenshot.url"
              :src="currentScreenshot.url"
              :alt="currentScreenshot.alt"
              class="block aspect-[16/9] w-full border border-border-primary bg-bg-tertiary object-cover md:aspect-[16/8]"
            />
          </Transition>
        </div>
      </div>
      <ScreenshotPlaceholder
        v-else
        :aria-label="placeholderAriaLabel"
        :title="placeholderTitle"
        :text="placeholderText"
      />
    </div>
  </section>
</template>

<style scoped>
.hero-slide-ltr-enter-active,
.hero-slide-ltr-leave-active {
  transition: transform 500ms ease, opacity 500ms ease;
}

.hero-slide-ltr-enter-from {
  opacity: 0;
  transform: translateX(-100%);
}

.hero-slide-ltr-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
