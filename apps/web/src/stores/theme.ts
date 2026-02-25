import { defineStore } from 'pinia';
import { ref } from 'vue';

export type Theme = 'light' | 'dark';

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'light');

  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    applyTheme();
  };

  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme;
    applyTheme();
  };

  const applyTheme = () => {
    document.documentElement.setAttribute('data-theme', theme.value);
    localStorage.setItem('theme', theme.value);
  };

  const initTheme = () => {
    // Detect system preference if no saved theme
    if (!localStorage.getItem('theme')) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme.value = prefersDark ? 'dark' : 'light';
    }
    applyTheme();
  };

  return {
    theme,
    toggleTheme,
    setTheme,
    initTheme,
  };
});
