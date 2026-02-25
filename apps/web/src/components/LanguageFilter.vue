<template>
  <div class="language-filter">
    <label class="filter-label">{{ t('filters.language') }}</label>
    <select v-model="selectedLanguage" @change="onLanguageChange" class="filter-select">
      <option value="">{{ t('filters.allLanguages') }}</option>
      <option v-for="lang in availableLanguages" :key="lang" :value="lang">
        {{ lang }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '@/i18n';

const props = defineProps<{
  modelValue?: string;
  projectKey?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const { t } = useI18n();
const selectedLanguage = ref(props.modelValue || '');
const availableLanguages = ref<string[]>([
  'JavaScript/TypeScript',
  'Python',
  'Java',
  'Go',
  'PHP',
  'Rust',
  'C#',
  'Ruby',
  'Swift',
  'Kotlin',
]);

onMounted(() => {
  // Dans une version future, on pourrait charger dynamiquement les langages
  // disponibles depuis l'API basé sur les projets existants
});

function onLanguageChange() {
  emit('update:modelValue', selectedLanguage.value);
}
</script>

<style scoped>
.language-filter {
  @apply flex flex-col gap-1 min-w-[180px];
}

.filter-label {
  @apply text-xs font-semibold text-text-secondary uppercase tracking-[0.5px];
  @apply transition-colors duration-300;
}

.filter-select {
  @apply py-2 px-3 border-2 border-border-primary rounded-lg text-sm;
  @apply bg-bg-primary text-text-primary cursor-pointer;
  @apply transition-all duration-300 ease-in-out;
}

.filter-select:hover {
  @apply border-border-secondary;
}

.filter-select:focus {
  @apply outline-none border-[var(--primary)] shadow-[0_0_0_3px_var(--primary-shadow)];
}
</style>
