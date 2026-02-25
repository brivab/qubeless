<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ filePath }}</h3>
        <div v-if="fileCoverage" class="flex items-center gap-4 text-sm">
          <span class="text-gray-600 dark:text-gray-400">
            Lines: {{ fileCoverage.coveredLines }}/{{ fileCoverage.lines }}
            <span class="font-semibold" :class="coverageColorClass">
              ({{ fileCoverage.coveragePercent?.toFixed(2) }}%)
            </span>
          </span>
          <span v-if="fileCoverage.branches > 0" class="text-gray-600 dark:text-gray-400">
            Branches: {{ fileCoverage.coveredBranches }}/{{ fileCoverage.branches }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <div v-else-if="error" class="px-6 py-4 text-sm text-red-600 dark:text-red-400">
      {{ error }}
    </div>

    <div v-else-if="fileCoverage" class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="(line, index) in displayLines"
            :key="index"
            :class="getLineClass(index + 1)"
          >
            <td class="px-4 py-1 text-xs text-gray-500 dark:text-gray-400 text-right w-16 select-none">
              {{ index + 1 }}
            </td>
            <td class="px-4 py-1 text-xs text-gray-600 dark:text-gray-400 text-right w-16 select-none">
              <span v-if="fileCoverage.lineHits && fileCoverage.lineHits[String(index + 1)] !== undefined">
                {{ fileCoverage.lineHits[String(index + 1)] }}×
              </span>
            </td>
            <td class="px-4 py-1 font-mono text-xs text-gray-900 dark:text-gray-100 whitespace-pre">
              {{ line }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="px-6 py-8 text-sm text-gray-500 dark:text-gray-400 text-center">
      No coverage data available for this file
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getFileCoverage, type FileCoverage } from '../services/api';

const props = defineProps<{
  analysisId: string;
  filePath: string;
  sourceCode?: string; // Optional pre-loaded source code
}>();

const fileCoverage = ref<FileCoverage | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const displayLines = computed(() => {
  if (!props.sourceCode) return [];
  return props.sourceCode.split('\n');
});

const coverageColorClass = computed(() => {
  if (!fileCoverage.value?.coveragePercent) return 'text-gray-600';
  const percent = fileCoverage.value.coveragePercent;
  if (percent >= 80) return 'text-green-600 dark:text-green-400';
  if (percent >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
});

const getLineClass = (lineNumber: number): string => {
  if (!fileCoverage.value?.lineHits) return '';

  const lineKey = String(lineNumber);
  const hits = fileCoverage.value.lineHits[lineKey];

  if (hits === undefined) {
    // Line not instrumented (non-executable)
    return 'bg-gray-50 dark:bg-gray-900';
  } else if (hits > 0) {
    // Line covered
    return 'bg-green-50 dark:bg-green-900/20';
  } else {
    // Line not covered
    return 'bg-red-50 dark:bg-red-900/20';
  }
};

onMounted(async () => {
  try {
    loading.value = true;
    fileCoverage.value = await getFileCoverage(props.analysisId, props.filePath);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load file coverage';
  } finally {
    loading.value = false;
  }
});
</script>
