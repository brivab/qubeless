<template>
  <div class="app-shell">
    <div class="mobile-header">
      <div class="brand">Qubeless</div>
      <button class="ghost-button" @click="toggleNav">{{ t('nav.menu') }}</button>
    </div>

    <div class="backdrop" v-if="mobileNavOpen" @click="closeNav"></div>

    <aside class="sidebar" :class="{ open: mobileNavOpen }">
      <div class="sidebar-top">
        <div class="brand">Qubeless</div>
        <button class="ghost-button close-btn mobile-only" @click="closeNav">✕</button>
      </div>

      <!-- Organization Switcher -->
      <div class="org-switcher" v-if="organizations.length > 0">
        <label class="sidebar-label">{{ t('nav.organization') }}</label>
        <select :value="currentOrgSlug" @change="onOrgChange" class="org-select">
          <option v-for="org in organizations" :key="org.id" :value="org.slug">
            {{ org.name }}
          </option>
        </select>
      </div>

      <nav>
        <RouterLink
          class="nav-link"
          to="/dashboard"
          :class="{ active: route.path.startsWith('/dashboard') }"
          data-cy="nav-dashboard"
          @click="closeNav"
        >
          {{ t('nav.dashboard') }}
        </RouterLink>
        <RouterLink
          class="nav-link"
          to="/projects"
          :class="{ active: route.path.startsWith('/projects') }"
          data-cy="nav-projects"
          @click="closeNav"
        >
          {{ t('nav.projects') }}
        </RouterLink>
        <RouterLink
          class="nav-link"
          to="/portfolio"
          :class="{ active: route.path.startsWith('/portfolio') }"
          data-cy="nav-portfolio"
          @click="closeNav"
        >
          Portfolio
        </RouterLink>
        <RouterLink
          class="nav-link"
          to="/vcs-tokens"
          :class="{ active: route.path.startsWith('/vcs-tokens') }"
          data-cy="nav-vcs-tokens"
          @click="closeNav"
        >
          {{ t('nav.vcsTokens') }}
        </RouterLink>
        <RouterLink
          class="nav-link"
          to="/organizations"
          :class="{ active: route.path.startsWith('/organizations') }"
          data-cy="nav-organizations"
          @click="closeNav"
        >
          {{ t('organizations.title') }}
        </RouterLink>
        <div v-if="isAdmin" class="nav-section">
          <button
            class="nav-section-toggle"
            type="button"
            :aria-expanded="(!adminCollapsed).toString()"
            @click="toggleAdminSection"
          >
            <span>{{ t('nav.admin') }}</span>
            <span class="nav-section-caret" :class="{ collapsed: adminCollapsed }">▾</span>
          </button>
          <div v-show="!adminCollapsed" class="nav-section-links">
            <RouterLink
              class="nav-link nav-link-sub"
              to="/admin"
              :class="{ active: route.path === '/admin' }"
              data-cy="nav-admin-home"
              @click="closeNav"
            >
              {{ t('nav.adminHome') }}
            </RouterLink>
            <RouterLink
              class="nav-link nav-link-sub"
              to="/admin/tokens"
              :class="{ active: route.path.startsWith('/admin/tokens') }"
              data-cy="nav-admin-tokens"
              @click="closeNav"
            >
              {{ t('nav.tokens') }}
            </RouterLink>
            <RouterLink
              class="nav-link nav-link-sub"
              to="/admin/analyzers"
              :class="{ active: route.path.startsWith('/admin/analyzers') }"
              data-cy="nav-admin-analyzers"
              @click="closeNav"
            >
              {{ t('nav.analyzers') }}
            </RouterLink>
            <RouterLink
              class="nav-link nav-link-sub"
              to="/admin/llm-providers"
              :class="{ active: route.path.startsWith('/admin/llm-providers') }"
              data-cy="nav-admin-llm-providers"
              @click="closeNav"
            >
              {{ t('nav.llmProviders') }}
            </RouterLink>
            <RouterLink
              class="nav-link nav-link-sub"
              to="/admin/llm-prompts"
              :class="{ active: route.path.startsWith('/admin/llm-prompts') }"
              data-cy="nav-admin-llm-prompts"
              @click="closeNav"
            >
              {{ t('nav.llmPrompts') }}
            </RouterLink>
            <RouterLink
              class="nav-link nav-link-sub"
              to="/admin/audit-logs"
              :class="{ active: route.path.startsWith('/admin/audit-logs') }"
              data-cy="nav-admin-audit-logs"
              @click="closeNav"
            >
              {{ t('nav.auditLogs') }}
            </RouterLink>
            <RouterLink
              class="nav-link nav-link-sub"
              to="/security"
              :class="{ active: route.path.startsWith('/security') }"
              data-cy="nav-security"
              @click="closeNav"
            >
              {{ t('nav.security') }}
            </RouterLink>
          </div>
        </div>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-meta">
          {{ t('nav.connected') }} : <span style="color: #fff;">{{ auth.user?.email ?? t('common.notAvailable') }}</span>
        </div>
        <div class="theme-language-row">
          <ThemeToggle />
          <div class="language-selector">
            <label class="sidebar-label">{{ t('nav.language') }}</label>
            <select :value="locale" @change="onLocaleChange">
              <option value="en">{{ t('language.english') }}</option>
              <option value="fr">{{ t('language.french') }}</option>
            </select>
          </div>
        </div>
        <button @click="handleLogout" data-cy="nav-logout">{{ t('nav.logout') }}</button>
      </div>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useOrganizationsStore } from '../stores/organizations';
import { useI18n, type Locale } from '../i18n';
import ThemeToggle from './ThemeToggle.vue';

const auth = useAuthStore();
const orgsStore = useOrganizationsStore();
const router = useRouter();
const route = useRoute();
const mobileNavOpen = ref(false);
const isAdmin = computed(() => auth.user?.globalRole === 'ADMIN');
const { t, locale, setLocale } = useI18n();
const ADMIN_COLLAPSE_KEY = 'qubeless.adminNavCollapsed';
const adminCollapsed = ref(false);

const organizations = computed(() => orgsStore.organizations);
const currentOrgSlug = computed(() => orgsStore.currentOrgSlug);

onMounted(async () => {
  await orgsStore.fetchOrganizations();
  orgsStore.loadCurrentOrgFromStorage();
  adminCollapsed.value = localStorage.getItem(ADMIN_COLLAPSE_KEY) === 'true';
});

const toggleNav = () => {
  mobileNavOpen.value = !mobileNavOpen.value;
};

const closeNav = () => {
  mobileNavOpen.value = false;
};

const toggleAdminSection = () => {
  adminCollapsed.value = !adminCollapsed.value;
  localStorage.setItem(ADMIN_COLLAPSE_KEY, adminCollapsed.value ? 'true' : 'false');
};

const handleLogout = async () => {
  await auth.logout();
  closeNav();

  // Only redirect if we're not being redirected to SSO logout
  // (if there was an ssoLogoutUrl, the user will already be redirected)
  if (!auth.token) {
    router.push({ name: 'login' });
  }
};

const onLocaleChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as Locale;
  setLocale(value);
};

const onOrgChange = (event: Event) => {
  const slug = (event.target as HTMLSelectElement).value;
  const org = organizations.value.find(o => o.slug === slug);
  if (org) {
    orgsStore.setCurrentOrganization(org);
  }
};
</script>

<style scoped>
.org-switcher {
  @apply px-4 mb-5 flex flex-col gap-1.5;
}

.org-select {
  @apply px-3 py-2.5 border border-border-secondary rounded-lg;
  @apply bg-bg-primary text-text-primary font-semibold text-sm;
  @apply cursor-pointer shadow-ghost transition-all duration-200;
}

.org-select:hover {
  @apply bg-bg-tertiary border-border-hover shadow-ghost-hover -translate-y-px;
}

.org-select:focus {
  @apply outline-none border-primary shadow-[0_0_0_3px_var(--primary-shadow)];
}

.sidebar-footer {
  @apply mt-auto flex flex-col gap-2.5;
}

.sidebar-meta {
  @apply text-[13px] text-sidebar-text font-semibold transition-colors duration-theme;
}

.theme-language-row {
  @apply flex items-end gap-2.5;
}

.language-selector {
  @apply flex flex-col gap-1.5 flex-1;
}

.sidebar-label {
  @apply text-[11px] uppercase tracking-wide text-text-tertiary transition-colors duration-theme;
}

.nav-section {
  @apply flex flex-col gap-2;
}

.nav-link-sub {
  @apply text-[13px] py-2.5 pl-6 pr-3.5;
}

.nav-section-toggle {
  @apply flex items-center justify-between gap-3 text-[12px] uppercase tracking-wide text-sidebar-text;
  @apply px-3.5 py-2 rounded-btn border border-sidebar-nav-border bg-sidebar-nav-bg;
  @apply cursor-pointer text-left transition-[background,color,transform] duration-200;
}

.nav-section-toggle:hover {
  @apply bg-sidebar-nav-hover text-sidebar-text;
}

.nav-section-caret {
  @apply transition-transform duration-200 text-[12px] text-sidebar-text-secondary;
}

.nav-section-caret.collapsed {
  @apply -rotate-90;
}

.nav-section-links {
  @apply flex flex-col gap-2;
}

.language-selector select {
  @apply py-2 pr-9 pl-3 border border-border-secondary rounded-lg;
  @apply bg-bg-primary text-text-secondary font-semibold text-[13px];
  @apply cursor-pointer shadow-ghost transition-all duration-200;
}

.language-selector select:hover:not(:disabled) {
  @apply bg-bg-tertiary border-border-hover shadow-ghost-hover -translate-y-px;
}

.language-selector select:focus {
  @apply outline-none border-border-hover shadow-input-focus;
}
</style>
