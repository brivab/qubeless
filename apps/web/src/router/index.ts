import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '../views/LoginView.vue';
import DashboardView from '../views/DashboardView.vue';
import MainLayout from '../components/MainLayout.vue';
import { useAuthStore } from '../stores/auth';
import ProjectsView from '../views/ProjectsView.vue';
import ProjectDetailView from '../views/ProjectDetailView.vue';
import AnalysisDetailView from '../views/AnalysisDetailView.vue';
import AdminTokensView from '../views/AdminTokensView.vue';
import AdminAuditLogsView from '../views/AdminAuditLogsView.vue';
import AdminAnalyzersView from '../views/AdminAnalyzersView.vue';
import AdminLlmProvidersView from '../views/AdminLlmProvidersView.vue';
import AdminLlmPromptsView from '../views/AdminLlmPromptsView.vue';
import AdminHomeView from '../views/AdminHomeView.vue';
import ProjectQuickstartView from '../views/ProjectQuickstartView.vue';
import RuleProfilesView from '../views/RuleProfilesView.vue';
import CoverageDetailView from '../views/CoverageDetailView.vue';
import DuplicationDetailView from '../views/DuplicationDetailView.vue';
import OrganizationsView from '../views/OrganizationsView.vue';
import OrganizationDetailView from '../views/OrganizationDetailView.vue';
import OrganizationSettingsView from '../views/OrganizationSettingsView.vue';
import OrganizationCreateView from '../views/OrganizationCreateView.vue';
import PortfolioView from '../views/PortfolioView.vue';
import VcsTokensView from '../views/VcsTokensView.vue';
import SecurityView from '../views/SecurityView.vue';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    public?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          redirect: { name: 'dashboard' },
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
          meta: { requiresAuth: true },
        },
        {
          path: 'projects',
          name: 'projects',
          component: ProjectsView,
          meta: { requiresAuth: true },
        },
        {
          path: 'portfolio',
          name: 'portfolio',
          component: PortfolioView,
          meta: { requiresAuth: true },
        },
        {
          path: 'organizations',
          name: 'organizations',
          component: OrganizationsView,
          meta: { requiresAuth: true },
        },
        {
          path: 'organizations/new',
          name: 'organization-create',
          component: OrganizationCreateView,
          meta: { requiresAuth: true },
        },
        {
          path: 'organizations/:slug',
          name: 'organization',
          component: OrganizationDetailView,
          meta: { requiresAuth: true },
        },
        {
          path: 'organizations/:slug/settings',
          name: 'organization-settings',
          component: OrganizationSettingsView,
          meta: { requiresAuth: true },
        },
        {
          path: 'projects/:key',
          name: 'project',
          component: ProjectDetailView,
          meta: { requiresAuth: true },
        },
        {
          path: 'projects/:key/quickstart',
          name: 'project-quickstart',
          component: ProjectQuickstartView,
          meta: { requiresAuth: true },
        },
        {
          path: 'projects/:key/rules',
          name: 'project-rules',
          component: RuleProfilesView,
          meta: { requiresAuth: true },
        },
        {
          path: 'analyses/:id',
          name: 'analysis',
          component: AnalysisDetailView,
          meta: { requiresAuth: true },
        },
        {
          path: 'analyses/:id/coverage',
          name: 'coverage',
          component: CoverageDetailView,
          meta: { requiresAuth: true },
        },
        {
          path: 'analyses/:id/duplication',
          name: 'duplication',
          component: DuplicationDetailView,
          meta: { requiresAuth: true },
        },
        {
          path: 'vcs-tokens',
          name: 'user-vcs-tokens',
          component: VcsTokensView,
          meta: { requiresAuth: true },
        },
        {
          path: 'security',
          name: 'security',
          component: SecurityView,
          meta: { requiresAuth: true },
        },
        {
          path: 'admin',
          name: 'admin',
          component: AdminHomeView,
          meta: { requiresAuth: true },
        },
        {
          path: 'admin/tokens',
          name: 'tokens',
          component: AdminTokensView,
          meta: { requiresAuth: true },
        },
        {
          path: 'admin/analyzers',
          name: 'analyzers',
          component: AdminAnalyzersView,
          meta: { requiresAuth: true },
        },
        {
          path: 'admin/audit-logs',
          name: 'audit-logs',
          component: AdminAuditLogsView,
          meta: { requiresAuth: true },
        },
        {
          path: 'admin/llm-providers',
          name: 'llm-providers',
          component: AdminLlmProvidersView,
          meta: { requiresAuth: true },
        },
        {
          path: 'admin/llm-prompts',
          name: 'llm-prompts',
          component: AdminLlmPromptsView,
          meta: { requiresAuth: true },
        },
      ],
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore();
  if (!auth.initialized) {
    await auth.initialize();
  }

  if (to.meta.public) {
    if (auth.isAuthenticated && to.name === 'login') {
      return next({ name: 'dashboard' });
    }
    return next();
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next({ name: 'login', query: { redirect: to.fullPath } });
  }

  return next();
});

export default router;
