<script setup lang="ts">
defineProps<{
  title: string;
  featuresTitle: string;
  differencesTitle: string;
  features: string[];
  differences: string[];
}>();
</script>

<template>
  <section class="space-y-6" aria-labelledby="features-title">
    <h2 id="features-title" class="text-2xl font-semibold text-text-primary md:text-3xl">{{ title }}</h2>

    <div class="grid gap-6 md:grid-cols-2">
      <article class="rounded-card border border-border-primary bg-bg-secondary p-5">
        <h3 class="text-lg font-semibold text-text-primary">{{ featuresTitle }}</h3>
        <ul class="mt-4 space-y-2 text-sm text-text-secondary">
          <li v-for="feature in features" :key="feature" class="flex gap-2">
            <span class="mt-2 h-1.5 w-1.5 rounded-full bg-accent-primary" aria-hidden="true"></span>
            <span>{{ feature }}</span>
          </li>
        </ul>
      </article>

      <article class="rounded-card border border-border-primary bg-bg-secondary p-5">
        <h3 class="text-lg font-semibold text-text-primary">{{ differencesTitle }}</h3>
        <ul class="mt-4 space-y-2 text-sm text-text-secondary">
          <li v-for="difference in differences" :key="difference" class="flex gap-2">
            <span class="mt-2 h-1.5 w-1.5 rounded-full bg-accent-primary" aria-hidden="true"></span>
            <span>{{ difference }}</span>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>
