<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
  title: string;
  diagram: string;
  bullets: Array<{ title: string; description: string }>;
  diagramAriaLabel: string;
  fallbackText: string;
}>();

const mermaidSvg = ref('');
const diagramError = ref(false);

const renderMermaidDiagram = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const mermaidModule = await import(
      /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
    );

    const mermaid = mermaidModule.default;
    const styles = window.getComputedStyle(document.documentElement);
    const background = styles.getPropertyValue('--bg-secondary').trim() || '#ffffff';
    const text = styles.getPropertyValue('--text-primary').trim() || '#0f172a';
    const border = styles.getPropertyValue('--border-primary').trim() || '#e2e8f0';
    const line = styles.getPropertyValue('--accent-primary').trim() || '#4f46e5';

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        fontFamily: 'Space Grotesk, Helvetica Neue, sans-serif',
        primaryColor: background,
        primaryTextColor: text,
        primaryBorderColor: border,
        lineColor: line
      }
    });

    const diagramId = `architecture-diagram-${Math.random().toString(36).slice(2, 9)}`;
    const rendered = await mermaid.render(diagramId, props.diagram);
    mermaidSvg.value = rendered.svg;
    diagramError.value = false;
  } catch {
    mermaidSvg.value = '';
    diagramError.value = true;
  }
};

onMounted(() => {
  void renderMermaidDiagram();
});

watch(
  () => props.diagram,
  () => {
    void renderMermaidDiagram();
  }
);
</script>

<template>
  <section class="space-y-6" aria-labelledby="architecture-title">
    <div class="space-y-2">
      <h2 id="architecture-title" class="text-2xl font-semibold text-text-primary md:text-3xl">{{ title }}</h2>
    </div>

    <div class="rounded-card border border-border-primary bg-bg-secondary p-4 md:p-5">
      <div
        v-if="mermaidSvg"
        class="[&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full"
        :aria-label="diagramAriaLabel"
        v-html="mermaidSvg"
      ></div>
      <p v-else-if="diagramError" class="text-sm text-text-secondary">{{ fallbackText }}</p>
    </div>

    <ul class="grid gap-3 md:grid-cols-2">
      <li
        v-for="item in bullets"
        :key="item.title"
        class="rounded-btn border border-border-primary bg-bg-secondary p-4"
      >
        <p class="text-sm font-semibold text-text-primary">{{ item.title }}</p>
        <p class="mt-1 text-sm text-text-secondary">{{ item.description }}</p>
      </li>
    </ul>
  </section>
</template>
