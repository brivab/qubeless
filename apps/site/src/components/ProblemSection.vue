<script setup lang="ts">
defineProps<{
  title: string;
  lines: string[];
}>();
</script>

<template>
  <section class="space-y-4" aria-labelledby="problem-title">
    <h2 id="problem-title" class="text-2xl font-semibold text-text-primary md:text-3xl">{{ title }}</h2>
    <ul class="space-y-2 text-sm text-text-secondary md:text-base">
      <li v-for="line in lines" :key="line" class="flex gap-2">
        <span class="mt-2 h-1.5 w-1.5 rounded-full bg-accent-primary" aria-hidden="true"></span>
        <span>{{ line }}</span>
      </li>
    </ul>
  </section>
</template>
