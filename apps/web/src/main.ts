import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';

import './assets/main.css';

console.log('[app] starting web app', { apiUrl: import.meta.env.VITE_API_URL });

async function bootstrap() {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);

  // Initialize theme before mounting
  const theme = useThemeStore();
  theme.initTheme();
  console.log('[app] theme initialized', { theme: theme.theme });

  // Initialize auth before mounting so the token is ready for API calls
  const auth = useAuthStore();
  await auth.initialize();
  console.log('[app] auth initialized', { authenticated: auth.isAuthenticated });

  app.use(router);
  app.mount('#app');
}

bootstrap().catch((err) => {
  console.error('[app] failed to bootstrap', err);
});
