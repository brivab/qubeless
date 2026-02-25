<script setup lang="ts">
defineProps<{
  title: string;
  dockerComposeSnippet: string;
  docsUrl: string;
  hint: string;
  docsLabel: string;
}>();
</script>

<template>
  <section class="space-y-5" aria-labelledby="install-title">
    <div class="space-y-2">
      <h2 id="install-title" class="text-2xl font-semibold text-text-primary md:text-3xl">{{ title }}</h2>
      <p class="text-sm text-text-secondary md:text-base">{{ hint }}</p>
    </div>

    <div class="rounded-card border border-border-primary bg-bg-secondary p-4 md:p-5">
      <pre class="overflow-x-auto rounded-btn border border-code-border bg-code-bg px-4 py-3 text-sm text-code-text"><code>{{ dockerComposeSnippet }}</code></pre>
      <a
        :href="docsUrl"
        target="_blank"
        rel="noreferrer"
        class="mt-4 inline-flex items-center rounded-btn border border-border-primary bg-bg-secondary px-3 py-2 text-sm font-semibold text-text-primary transition-colors duration-200 hover:border-border-hover hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary"
      >
        {{ docsLabel }}
      </a>
    </div>
  </section>
</template>
