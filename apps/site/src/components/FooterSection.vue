<script setup lang="ts">
defineProps<{
  projectName: string;
  githubUrl: string;
  docsUrl: string;
  issuesUrl: string;
  footerLabel: string;
  navLabel: string;
  githubLabel: string;
  docsLabel: string;
  issuesLabel: string;
}>();
</script>

<template>
  <footer class="border-t border-border-primary">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-sm font-semibold text-text-primary">{{ projectName }}</p>
        <p class="mt-1 text-sm text-text-secondary">{{ footerLabel }}</p>
      </div>
      <nav class="flex flex-wrap gap-4 text-sm font-semibold text-text-primary" :aria-label="navLabel">
        <a
          :href="githubUrl"
          target="_blank"
          rel="noreferrer"
          class="hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
        >
          {{ githubLabel }}
        </a>
        <a
          :href="docsUrl"
          :target="docsUrl.startsWith('http') ? '_blank' : undefined"
          :rel="docsUrl.startsWith('http') ? 'noreferrer' : undefined"
          class="hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
        >
          {{ docsLabel }}
        </a>
        <a
          :href="issuesUrl"
          target="_blank"
          rel="noreferrer"
          class="hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
        >
          {{ issuesLabel }}
        </a>
      </nav>
    </div>
  </footer>
</template>
