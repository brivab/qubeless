<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import ArchitectureSection from './components/ArchitectureSection.vue';
import DocumentationSection from './components/DocumentationSection.vue';
import FeaturesSection from './components/FeaturesSection.vue';
import FooterSection from './components/FooterSection.vue';
import HeroSection from './components/HeroSection.vue';
import InstallSection from './components/InstallSection.vue';
import ProblemSection from './components/ProblemSection.vue';
import analysisDashboardScreenshot from './assets/features/analysis-dashboard-light.png';
import issuesFilteredCriticalScreenshot from './assets/features/issues-filtered-critical-light.png';
import metricsScreenshot from './assets/features/metrics-light.png';
import portfolioFiltersScreenshot from './assets/features/portfolio-filters-light.png';
import projectOverviewMetricsScreenshot from './assets/features/project-overview-metrics-light.png';

type Locale = 'en' | 'fr';
type Page = 'home' | 'docs';

const LOCALE_STORAGE_KEY = 'site-locale';
const HOME_PAGE_HASH = '#/';
const DOCS_PAGE_HASH = '#/docs';
const DEFAULT_GITHUB_URL = 'https://github.com/qubeless/qubeless-monorepo';
const DEFAULT_CLOUD_APP_URL = 'https://app.example.com';
const ENV_GITHUB_URL = (import.meta.env.VITE_GITHUB_URL as string | undefined)?.trim();
const ENV_CLOUD_APP_URL = (import.meta.env.VITE_DOMAIN_APP as string | undefined)?.trim();
const GITHUB_BASE_URL = (ENV_GITHUB_URL && ENV_GITHUB_URL.length > 0 ? ENV_GITHUB_URL : DEFAULT_GITHUB_URL).replace(/\/+$/, '');
const CLOUD_APP_URL = (ENV_CLOUD_APP_URL && ENV_CLOUD_APP_URL.length > 0 ? ENV_CLOUD_APP_URL : DEFAULT_CLOUD_APP_URL).replace(/\/+$/, '');
const GITHUB_DOCS_URL = `${GITHUB_BASE_URL}/tree/main/docs`;
const GITHUB_ISSUES_URL = `${GITHUB_BASE_URL}/issues`;

type ProjectLabels = {
  skipToContent: string;
  language: string;
  languageEnglish: string;
  languageFrench: string;
  headerHomeCta: string;
  headerGithubCta: string;
  headerCloudCta: string;
  headerDocsCta: string;
  screenshotPlaceholderAriaLabel: string;
  screenshotPlaceholderTitle: string;
  screenshotPlaceholderText: string;
  problemTitle: string;
  architectureTitle: string;
  architectureDiagramAriaLabel: string;
  architectureFallback: string;
  featuresTitle: string;
  featuresCoverageTitle: string;
  featuresDifferenceTitle: string;
  installTitle: string;
  footerNavLabel: string;
  footerGithubLabel: string;
  footerDocsLabel: string;
  footerIssuesLabel: string;
};

type HeroScreenshot = {
  url: string;
  alt: string;
};

type ProjectConfig = {
  projectName: string;
  tagline: string;
  githubUrl: string;
  cloudAppUrl: string;
  docsUrl: string;
  issuesUrl: string;
  dockerComposeSnippet: string;
  statusLabel: string;
  heroSummary: string;
  heroScreenshots: HeroScreenshot[];
  problemLines: string[];
  architectureDiagram: string;
  architectureBullets: Array<{ title: string; description: string }>;
  features: string[];
  differences: string[];
  installHint: string;
  installCtaLabel: string;
  footerLabel: string;
  labels: ProjectLabels;
  seo: {
    title: string;
    description: string;
  };
};

const projects: Record<Locale, ProjectConfig> = {
  en: {
    projectName: 'Qubeless',
    tagline: 'Modular platform for automated code quality analysis in CI/CD.',
    githubUrl: GITHUB_BASE_URL,
    cloudAppUrl: CLOUD_APP_URL,
    docsUrl: GITHUB_DOCS_URL,
    issuesUrl: GITHUB_ISSUES_URL,
    dockerComposeSnippet: 'docker compose -f docker-compose.dev.yml up',
    statusLabel: 'Open source & self-hosted',
    heroSummary: 'Dashboard + API + Worker to centralize analysis and quality decisions.',
    heroScreenshots: [
      { url: metricsScreenshot, alt: 'Qubeless dashboard metrics preview' },
      { url: projectOverviewMetricsScreenshot, alt: 'Qubeless project overview with key metrics' },
      { url: analysisDashboardScreenshot, alt: 'Qubeless analysis dashboard overview' },
      { url: portfolioFiltersScreenshot, alt: 'Qubeless portfolio filters view' },
      { url: issuesFilteredCriticalScreenshot, alt: 'Qubeless critical issues filtered view' },
    ],
    problemLines: [
      'Code quality tools are often scattered.',
      'CI/CD integration quickly becomes expensive to maintain.',
      'Teams need one place for metrics, issues, and quality gates.'
    ],
    architectureDiagram: `
flowchart LR
  CI[CI/CD Pipeline] --> API[API]
  API <--> Worker[Worker]
  API --> Dashboard[Dashboard]
  Worker <--> Analyzers[Docker Analyzers]

  classDef stage fill:#ffffff,stroke:#cbd5e1,stroke-width:1.5px,color:#0f172a,rx:10,ry:10;
  class CI,API,Worker,Analyzers,Dashboard stage;
`,
    architectureBullets: [
      { title: 'API', description: 'Receives analysis results and serves project data.' },
      { title: 'Worker', description: 'Orchestrates jobs and runs scans.' },
      { title: 'Docker analyzers', description: 'Wrap generic or project-specific analyzers.' },
      { title: 'Dashboard', description: 'Tracks metrics and code quality issues.' }
    ],
    features: [
      'Modular analysis through Docker containers',
      'Multi-language support depending on enabled analyzers',
      'Metrics: duplication, complexity, issue trends',
      'Issue tracking',
      'Connect any LLM through an OpenAI-compatible API',
      'Auto-fix issues via AI once an LLM is connected',
      'Configurable quality gates',
      'CI/CD integration',
      'Self-hosted: deploy on your own infrastructure with full data control'
    ],
    differences: [
      'Truly modular architecture',
      'Extensible through Docker images',
      'Create custom analyzers with project-specific rules',
      'Designed for modern CI/CD',
      'Open source & self-hosted: no mandatory SaaS, full control'
    ],
    installHint: 'For production setup, follow the full documentation.',
    installCtaLabel: 'Read installation guide',
    footerLabel: 'Open source - self-hosted',
    labels: {
      skipToContent: 'Skip to content',
      language: 'Language',
      languageEnglish: 'English',
      languageFrench: 'French',
      headerHomeCta: 'Home',
      headerGithubCta: 'GitHub',
      headerCloudCta: 'Cloud App',
      headerDocsCta: 'Documentation',
      screenshotPlaceholderAriaLabel: 'Dashboard screenshot placeholder',
      screenshotPlaceholderTitle: 'Screenshot',
      screenshotPlaceholderText: 'Add dashboard screenshot',
      problemTitle: 'The problem',
      architectureTitle: 'How it works',
      architectureDiagramAriaLabel: 'Mermaid architecture diagram',
      architectureFallback: 'CI/CD -> API <-> Worker <-> Docker analyzers, with Dashboard connected to API.',
      featuresTitle: 'Features',
      featuresCoverageTitle: 'What the platform covers',
      featuresDifferenceTitle: 'Why it is different',
      installTitle: 'Quick install',
      footerNavLabel: 'Project links',
      footerGithubLabel: 'GitHub',
      footerDocsLabel: 'Docs',
      footerIssuesLabel: 'Issues'
    },
    seo: {
      title: 'Qubeless | Modular code quality platform',
      description:
        'Qubeless centralizes Docker-based analysis, metrics, issues, and quality gates for CI/CD in an open source self-hosted model.'
    }
  },
  fr: {
    projectName: 'Qubeless',
    tagline: 'Plateforme modulaire d’analyse automatique de qualité de code pour CI/CD.',
    githubUrl: GITHUB_BASE_URL,
    cloudAppUrl: CLOUD_APP_URL,
    docsUrl: GITHUB_DOCS_URL,
    issuesUrl: GITHUB_ISSUES_URL,
    dockerComposeSnippet: 'docker compose -f docker-compose.dev.yml up',
    statusLabel: 'Open source & self-hosted',
    heroSummary: 'Dashboard + API + Worker pour centraliser les analyses et décisions qualité.',
    heroScreenshots: [
      { url: metricsScreenshot, alt: 'Aperçu des métriques dans le dashboard Qubeless' },
      { url: projectOverviewMetricsScreenshot, alt: 'Vue projet Qubeless avec indicateurs clés' },
      { url: analysisDashboardScreenshot, alt: "Vue d'ensemble du dashboard d'analyse Qubeless" },
      { url: portfolioFiltersScreenshot, alt: 'Vue des filtres portfolio dans Qubeless' },
      { url: issuesFilteredCriticalScreenshot, alt: 'Liste des issues critiques filtrées dans Qubeless' },
    ],
    problemLines: [
      'Les outils de qualité de code sont souvent dispersés.',
      'Leur intégration CI/CD devient vite coûteuse à maintenir.',
      'Les équipes ont besoin de centraliser métriques, issues et quality gates.'
    ],
    architectureDiagram: `
flowchart LR
  CI[Pipeline CI/CD] --> API[API]
  API <--> Worker[Worker]
  API --> Dashboard[Dashboard]
  Worker <--> Analyzers[Analyseurs Docker]

  classDef stage fill:#ffffff,stroke:#cbd5e1,stroke-width:1.5px,color:#0f172a,rx:10,ry:10;
  class CI,API,Worker,Analyzers,Dashboard stage;
`,
    architectureBullets: [
      { title: 'API', description: 'Reçoit les résultats et expose les données projet.' },
      { title: 'Worker', description: 'Orchestre les jobs et exécute les scans.' },
      { title: 'Analyseurs Docker', description: "Wrappe des outils d'analyse génériques ou spécifiques." },
      { title: 'Dashboard', description: 'Visualise métriques et issues de qualité.' }
    ],
    features: [
      'Analyse modulaire via conteneurs Docker',
      'Support multi-langages selon les analyseurs activés',
      'Métriques: duplication, complexité, tendances des issues',
      'Suivi des issues',
      "Connexion à un LLM au choix via API compatible OpenAI",
      "Auto-fix des issues via IA après connexion d'un LLM",
      'Quality gates configurables',
      'Intégration CI/CD',
      'Self-hosted: déployable sur votre infrastructure, contrôle total des données'
    ],
    differences: [
      'Architecture réellement modulaire',
      'Extensible via images Docker',
      'Créez des analyseurs customisés avec des règles spécifiques à votre contexte',
      'Pensé pour CI/CD moderne',
      'Open source & self-hosted: pas de SaaS imposé, contrôle total'
    ],
    installHint: 'Pour un déploiement complet, suivez la documentation.',
    installCtaLabel: 'Voir le guide d’installation',
    footerLabel: 'Open source - self-hosted',
    labels: {
      skipToContent: 'Aller au contenu',
      language: 'Langue',
      languageEnglish: 'Anglais',
      languageFrench: 'Français',
      headerHomeCta: 'Accueil',
      headerGithubCta: 'GitHub',
      headerCloudCta: 'App Cloud',
      headerDocsCta: 'Documentation',
      screenshotPlaceholderAriaLabel: 'Zone de capture dashboard',
      screenshotPlaceholderTitle: 'Capture',
      screenshotPlaceholderText: 'Ajoutez une capture du dashboard',
      problemTitle: 'Le problème',
      architectureTitle: 'Comment ça marche',
      architectureDiagramAriaLabel: "Schéma d'architecture Mermaid",
      architectureFallback: 'CI/CD -> API <-> Worker <-> Analyseurs Docker, avec Dashboard connecté à l’API.',
      featuresTitle: 'Fonctionnalités',
      featuresCoverageTitle: 'Ce que la plateforme couvre',
      featuresDifferenceTitle: 'Pourquoi c’est différent',
      installTitle: 'Installation rapide',
      footerNavLabel: 'Liens du projet',
      footerGithubLabel: 'GitHub',
      footerDocsLabel: 'Docs',
      footerIssuesLabel: 'Issues'
    },
    seo: {
      title: 'Qubeless | Plateforme modulaire de qualité de code',
      description:
        'Qubeless centralise analyses Docker, métriques, issues et quality gates pour vos pipelines CI/CD en mode open source self-hosted.'
    }
  }
};

const locale = ref<Locale>('en');
const currentPage = ref<Page>('home');
const project = computed(() => projects[locale.value]);

const setLocale = (nextLocale: Locale) => {
  locale.value = nextLocale;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  }
};

const getPageFromHash = (hash: string): Page => {
  return hash.startsWith(DOCS_PAGE_HASH) ? 'docs' : 'home';
};

const syncPageFromHash = () => {
  if (typeof window === 'undefined') {
    return;
  }
  currentPage.value = getPageFromHash(window.location.hash);
};

onMounted(() => {
  if (typeof window === 'undefined') {
    return;
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (storedLocale === 'fr' || storedLocale === 'en') {
    locale.value = storedLocale;
  }

  if (!window.location.hash) {
    window.location.hash = HOME_PAGE_HASH;
  }

  syncPageFromHash();
  window.addEventListener('hashchange', syncPageFromHash);
});

onUnmounted(() => {
  if (typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('hashchange', syncPageFromHash);
});

watch(
  [project, currentPage],
  ([nextProject, nextPage]) => {
    const pageSuffix = nextPage === 'docs' ? ' | Documentation' : '';
    document.title = `${nextProject.seo.title}${pageSuffix}`;

    let descriptionTag = document.querySelector('meta[name="description"]');

    if (!descriptionTag) {
      descriptionTag = document.createElement('meta');
      descriptionTag.setAttribute('name', 'description');
      document.head.appendChild(descriptionTag);
    }

    const description =
      nextPage === 'docs'
        ? 'Browse installation, operations, integrations, and extensibility guides for Qubeless.'
        : nextProject.seo.description;

    descriptionTag.setAttribute('content', description);
  },
  { immediate: true }
);
</script>

<template>
  <div class="min-h-screen bg-bg-primary text-text-primary">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-btn focus:bg-bg-secondary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {{ project.labels.skipToContent }}
    </a>

    <header class="sticky top-0 z-40 border-b border-border-primary bg-bg-secondary/80 backdrop-blur">
      <div class="mx-auto flex w-full max-w-[92rem] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <p class="text-lg font-semibold tracking-wide text-text-primary">{{ project.projectName }}</p>
        <div class="flex items-center gap-3">
          <label class="sr-only" for="site-locale-select">{{ project.labels.language }}</label>
          <select
            id="site-locale-select"
            :value="locale"
            class="w-auto min-w-[8rem] rounded-btn border border-border-primary bg-bg-secondary px-3 py-2 text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            @change="setLocale(($event.target as HTMLSelectElement).value as Locale)"
          >
            <option value="en">{{ project.labels.languageEnglish }}</option>
            <option value="fr">{{ project.labels.languageFrench }}</option>
          </select>
          <a
            :href="HOME_PAGE_HASH"
            class="inline-flex items-center justify-center rounded-btn border border-border-primary px-3 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="
              currentPage === 'home'
                ? 'border-transparent bg-gradient-btn text-white shadow-btn'
                : 'bg-bg-secondary text-text-primary hover:border-border-hover hover:bg-bg-tertiary'
            "
          >
            {{ project.labels.headerHomeCta }}
          </a>
          <a
            :href="DOCS_PAGE_HASH"
            class="inline-flex items-center justify-center rounded-btn px-3 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="
              currentPage === 'docs'
                ? 'bg-gradient-btn text-white shadow-btn'
                : 'border border-border-primary bg-bg-secondary text-text-primary hover:border-border-hover hover:bg-bg-tertiary'
            "
          >
            {{ project.labels.headerDocsCta }}
          </a>
          <a
            :href="project.cloudAppUrl"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center justify-center rounded-btn border border-border-primary bg-bg-secondary px-3 py-2 text-sm font-semibold text-text-primary transition-colors duration-200 hover:border-border-hover hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {{ project.labels.headerCloudCta }}
          </a>
          <a
            :href="project.githubUrl"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center justify-center rounded-btn border border-border-primary bg-bg-secondary px-3 py-2 text-sm font-semibold text-text-primary transition-colors duration-200 hover:border-border-hover hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {{ project.labels.headerGithubCta }}
          </a>
        </div>
      </div>
    </header>

    <main
      id="main-content"
      class="mx-auto w-full px-6 py-10 md:py-14"
      :class="currentPage === 'docs' ? 'max-w-[92rem]' : 'max-w-5xl'"
    >
      <div v-if="currentPage === 'home'" class="space-y-16 md:space-y-20">
        <HeroSection
          :tagline="project.tagline"
          :status-label="project.statusLabel"
          :summary="project.heroSummary"
          :screenshots="project.heroScreenshots"
          :placeholder-aria-label="project.labels.screenshotPlaceholderAriaLabel"
          :placeholder-title="project.labels.screenshotPlaceholderTitle"
          :placeholder-text="project.labels.screenshotPlaceholderText"
        />
        <ProblemSection :title="project.labels.problemTitle" :lines="project.problemLines" />
        <ArchitectureSection
          :title="project.labels.architectureTitle"
          :diagram="project.architectureDiagram"
          :bullets="project.architectureBullets"
          :diagram-aria-label="project.labels.architectureDiagramAriaLabel"
          :fallback-text="project.labels.architectureFallback"
        />
        <FeaturesSection
          :title="project.labels.featuresTitle"
          :features-title="project.labels.featuresCoverageTitle"
          :differences-title="project.labels.featuresDifferenceTitle"
          :features="project.features"
          :differences="project.differences"
        />
        <InstallSection
          :title="project.labels.installTitle"
          :docker-compose-snippet="project.dockerComposeSnippet"
          :docs-url="project.docsUrl"
          :hint="project.installHint"
          :docs-label="project.installCtaLabel"
        />
      </div>
      <DocumentationSection v-else :locale="locale" />
    </main>

    <FooterSection
      :project-name="project.projectName"
      :github-url="project.githubUrl"
      :docs-url="DOCS_PAGE_HASH"
      :issues-url="project.issuesUrl"
      :footer-label="project.footerLabel"
      :nav-label="project.labels.footerNavLabel"
      :github-label="project.labels.footerGithubLabel"
      :docs-label="project.labels.footerDocsLabel"
      :issues-label="project.labels.footerIssuesLabel"
    />
  </div>
</template>
