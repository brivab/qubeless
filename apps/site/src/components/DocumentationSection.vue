<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

type Locale = 'en' | 'fr';

type DocLink = {
  title: string;
  description: string;
  href: string;
};

type DocCategory = {
  title: string;
  description: string;
  links: DocLink[];
};

type IndexedDoc = {
  key: string;
  path: string;
  title: string;
  description: string;
  categoryTitle: string;
};

const DEFAULT_GITHUB_URL = 'https://github.com/qubeless/qubeless-monorepo';
const ENV_GITHUB_URL = (import.meta.env.VITE_GITHUB_URL as string | undefined)?.trim();
const GITHUB_BASE_URL = (ENV_GITHUB_URL && ENV_GITHUB_URL.length > 0 ? ENV_GITHUB_URL : DEFAULT_GITHUB_URL).replace(/\/+$/, '');
const DOCS_REPOSITORY_BASE_URL = `${GITHUB_BASE_URL}/blob/main/docs`;
const DOCS_REPOSITORY_BLOB_MARKER = '/blob/main/docs/';
const DOCS_HASH_PREFIX = '#/docs';

const buildDocLink = (path: string) => `${DOCS_REPOSITORY_BASE_URL}/${path}`;

const docsContentByLocale: Record<
  Locale,
  {
    title: string;
    description: string;
    quickStartTitle: string;
    quickStartSteps: string[];
    categories: DocCategory[];
  }
> = {
  en: {
    title: 'Documentation',
    description:
      'Use this page as your entry point to install, operate, and extend Qubeless.',
    quickStartTitle: 'Start in 4 steps',
    quickStartSteps: [
      'Install dependencies and run the local stack from the root README.',
      'Read the production deployment guide to deploy, debug, and monitor the platform.',
      'Configure scanner submission and PR/MR webhooks for your repositories.',
      'Apply quality gates and review metrics in the dashboard.'
    ],
    categories: [
      {
        title: 'Getting Started',
        description: 'Initial setup and first deployment.',
        links: [
          {
            title: 'Docs Index',
            description: 'Overview of all available guides.',
            href: buildDocLink('README.md')
          },
          {
            title: 'Production Deployment',
            description: 'Single guide for deployment, debugging, and monitoring.',
            href: buildDocLink('en/deploy.md')
          }
        ]
      },
      {
        title: 'Using Qubeless',
        description: 'Run analyses and integrate with your delivery workflow.',
        links: [
          {
            title: 'Local Submit',
            description: 'Run analysis submission from local or CI.',
            href: buildDocLink('en/local-submit.md')
          },
          {
            title: 'PR/MR Webhooks',
            description: 'Automate quality checks on pull/merge requests.',
            href: buildDocLink('en/pr-webhooks.md')
          },
          {
            title: 'LLM Issue Resolution',
            description: 'Set up provider, prompt template, and resolve issues via AI.',
            href: buildDocLink('en/llm-issue-resolution.md')
          },
          {
            title: 'Testing Guide',
            description: 'Run unit, integration, and end-to-end tests.',
            href: buildDocLink('en/testing.md')
          },
          {
            title: 'API Swagger',
            description: 'Explore and test REST endpoints from Swagger UI.',
            href: buildDocLink('en/api-swagger.md')
          }
        ]
      },
      {
        title: 'Operations',
        description: 'Security, scaling, and maintenance.',
        links: [
          {
            title: 'Backup and Restore',
            description: 'Protect PostgreSQL and object storage data.',
            href: buildDocLink('en/backup-restore.md')
          },
          {
            title: 'Worker Limits',
            description: 'Control analyzer execution resources.',
            href: buildDocLink('en/worker-limits.md')
          }
        ]
      },
      {
        title: 'Extensibility',
        description: 'Customize analyzers for your engineering standards.',
        links: [
          {
            title: 'Custom Analyzer Guide',
            description: 'Create and integrate custom analyzer images.',
            href: buildDocLink('en/custom-analyzer.md')
          },
          {
            title: 'Analyzer Contract',
            description: 'Expected input/output format for analyzer containers.',
            href: buildDocLink('en/analyzer-contract.md')
          }
        ]
      }
    ]
  },
  fr: {
    title: 'Documentation',
    description:
      "Cette page sert de point d'entrée pour installer, exploiter et étendre Qubeless.",
    quickStartTitle: 'Démarrer en 4 étapes',
    quickStartSteps: [
      "Installez les dépendances et démarrez la stack locale depuis le README racine.",
      'Lisez le guide de déploiement production pour déployer, diagnostiquer et monitorer la plateforme.',
      'Configurez la soumission scanner et les webhooks PR/MR pour vos dépôts.',
      'Appliquez des quality gates et suivez les métriques dans le dashboard.'
    ],
    categories: [
      {
        title: 'Démarrage',
        description: 'Installation initiale et premier déploiement.',
        links: [
          {
            title: 'Index de la doc',
            description: 'Vue d’ensemble de tous les guides.',
            href: buildDocLink('README.md')
          },
          {
            title: 'Déploiement production',
            description: 'Guide unique pour déployer, diagnostiquer et monitorer.',
            href: buildDocLink('en/deploy.md')
          }
        ]
      },
      {
        title: 'Utilisation',
        description: 'Lancer des analyses et intégrer le workflow delivery.',
        links: [
          {
            title: 'Local Submit',
            description: 'Soumission locale ou CI.',
            href: buildDocLink('en/local-submit.md')
          },
          {
            title: 'Webhooks PR/MR',
            description: 'Automatiser les checks de qualité.',
            href: buildDocLink('en/pr-webhooks.md')
          },
          {
            title: 'Résolution IA des issues',
            description: 'Configurer provider/prompt LLM et résoudre les issues.',
            href: buildDocLink('fr/llm-issue-resolution.md')
          },
          {
            title: 'Guide de tests',
            description: 'Tests unitaires, intégration et E2E.',
            href: buildDocLink('en/testing.md')
          },
          {
            title: 'Swagger API',
            description: 'Explorer et tester les endpoints REST.',
            href: buildDocLink('fr/api-swagger.md')
          }
        ]
      },
      {
        title: 'Opérations',
        description: 'Sécurité, montée en charge et maintenance.',
        links: [
          {
            title: 'Backup and Restore',
            description: 'Sauvegarder PostgreSQL et le stockage objet.',
            href: buildDocLink('en/backup-restore.md')
          },
          {
            title: 'Worker Limits',
            description: "Contrôler les ressources d'exécution.",
            href: buildDocLink('en/worker-limits.md')
          }
        ]
      },
      {
        title: 'Extensibilité',
        description: 'Créer des analyseurs adaptés à votre contexte.',
        links: [
          {
            title: 'Custom Analyzer Guide',
            description: 'Créer et intégrer des analyseurs custom.',
            href: buildDocLink('en/custom-analyzer.md')
          },
          {
            title: 'Analyzer Contract',
            description: 'Format I/O attendu pour les conteneurs analyseurs.',
            href: buildDocLink('en/analyzer-contract.md')
          }
        ]
      }
    ]
  }
};

const props = defineProps<{
  locale: Locale;
}>();

const markdownModules = import.meta.glob('../../../../docs/**/*.md', { as: 'raw' }) as Record<
  string,
  () => Promise<string>
>;
const docsFeatureImageModules = import.meta.glob('../assets/features/*', {
  eager: true,
  import: 'default'
}) as Record<string, string>;

const docsFeatureImagesByName = new Map(
  Object.entries(docsFeatureImageModules).map(([modulePath, assetUrl]) => {
    const filename = modulePath.split('/').pop() ?? modulePath;
    return [filename, assetUrl] as const;
  })
);

const activeDocKey = ref('');
const activeDocHtml = ref('');
const activeDocLoading = ref(false);
const activeDocError = ref('');
const markdownContentRef = ref<HTMLElement | null>(null);

let mermaidModulePromise: Promise<any> | null = null;

const currentDocsContent = computed(() => docsContentByLocale[props.locale]);

const normalizeDocPath = (value: string) =>
  value
    .trim()
    .replace(/^\.\//, '')
    .replace(/^docs\//, '');

const createDocKey = (path: string) =>
  normalizeDocPath(path)
    .replace(/\.md$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();

const getDocPathFromHref = (href: string) => {
  const markerIndex = href.indexOf(DOCS_REPOSITORY_BLOB_MARKER);
  if (markerIndex < 0) {
    return '';
  }
  const rawPath = href.slice(markerIndex + DOCS_REPOSITORY_BLOB_MARKER.length);
  return normalizeDocPath(rawPath);
};

const indexedCategories = computed(() =>
  currentDocsContent.value.categories.map((category) => ({
    title: category.title,
    docs: category.links
      .map((link) => {
        const path = getDocPathFromHref(link.href);
        if (!path) {
          return null;
        }
        return {
          key: createDocKey(path),
          path,
          title: link.title,
          description: link.description,
          categoryTitle: category.title
        } as IndexedDoc;
      })
      .filter((doc): doc is IndexedDoc => doc !== null)
  }))
);

const indexedDocs = computed(() => indexedCategories.value.flatMap((category) => category.docs));

const indexedDocsByKey = computed(() => new Map(indexedDocs.value.map((doc) => [doc.key, doc])));
const indexedDocKeyByPath = computed(() => new Map(indexedDocs.value.map((doc) => [doc.path, doc.key])));
const activeDoc = computed(() => indexedDocsByKey.value.get(activeDocKey.value) ?? null);
const isSwaggerDoc = computed(() => {
  const path = activeDoc.value?.path ?? '';
  return path === 'en/api-swagger.md' || path === 'fr/api-swagger.md';
});

const normalizeSwaggerUiUrl = (rawUrl: string) => {
  if (typeof window === 'undefined') {
    return rawUrl;
  }

  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    const isLocalSwaggerHost = localHosts.includes(parsed.hostname);
    const isLocalSiteHost = localHosts.includes(window.location.hostname);
    const isSwaggerPath = parsed.pathname.startsWith('/api/docs');

    if (isLocalSwaggerHost && isLocalSiteHost && parsed.origin !== window.location.origin && isSwaggerPath) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const swaggerUiUrl = computed(() => {
  const explicitDocsUrl = import.meta.env.VITE_SWAGGER_UI_URL as string | undefined;
  if (explicitDocsUrl) {
    return normalizeSwaggerUiUrl(explicitDocsUrl);
  }

  const apiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiBaseUrl) {
    const normalizedApiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    if (normalizedApiBaseUrl.endsWith('/api')) {
      return `${normalizedApiBaseUrl}/docs`;
    }
    return `${normalizedApiBaseUrl}/api/docs`;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/docs`;
  }

  return '/api/docs';
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const loadMermaid = async () => {
  if (mermaidModulePromise) {
    return mermaidModulePromise;
  }

  mermaidModulePromise = import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
  )
    .then((module) => module.default)
    .catch(() => null);

  return mermaidModulePromise;
};

const renderMermaidBlocks = async () => {
  if (typeof window === 'undefined' || !markdownContentRef.value || !activeDocHtml.value) {
    return;
  }

  const mermaidTargets = Array.from(
    markdownContentRef.value.querySelectorAll<HTMLElement>('.doc-mermaid[data-mermaid]')
  );
  if (mermaidTargets.length === 0) {
    return;
  }

  const mermaid = await loadMermaid();
  if (!mermaid) {
    return;
  }

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

  for (let index = 0; index < mermaidTargets.length; index += 1) {
    const target = mermaidTargets[index];
    const serialized = target.dataset.mermaid ?? '';
    if (!serialized) {
      continue;
    }

    const source = decodeURIComponent(serialized);
    const diagramId = `doc-mermaid-${activeDocKey.value}-${index}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      const rendered = await mermaid.render(diagramId, source);
      target.innerHTML = rendered.svg;
      target.classList.add('doc-mermaid-ready');
    } catch {
      target.innerHTML = `<pre class="overflow-x-auto rounded-btn border border-border-primary bg-bg-primary p-4"><code class="text-sm">${escapeHtml(source)}</code></pre>`;
    }
  }
};


const resolveRelativeDocPath = (basePath: string, relativePath: string) => {
  const normalizedRelativePath = normalizeDocPath(relativePath);
  if (normalizedRelativePath.startsWith('en/') || normalizedRelativePath.startsWith('fr/')) {
    return normalizedRelativePath;
  }

  const segments = basePath.split('/');
  segments.pop();

  for (const segment of normalizedRelativePath.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return normalizeDocPath(segments.join('/'));
};

const resolveMarkdownHref = (href: string, basePath: string, currentDocKey: string) => {
  if (!href) {
    return `${DOCS_HASH_PREFIX}/${currentDocKey}`;
  }
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    return href;
  }
  if (href.startsWith('#')) {
    return `${DOCS_HASH_PREFIX}/${currentDocKey}`;
  }

  const [rawPathPart] = href.split('#');
  const resolvedPath = resolveRelativeDocPath(basePath, rawPathPart);
  const normalizedResolvedPath = normalizeDocPath(resolvedPath);
  const mappedDocKey = indexedDocKeyByPath.value.get(normalizedResolvedPath);

  if (mappedDocKey) {
    return `${DOCS_HASH_PREFIX}/${mappedDocKey}`;
  }

  return `${DOCS_REPOSITORY_BASE_URL}/${normalizedResolvedPath}`;
};

const renderInlineMarkdown = (value: string, basePath: string, currentDocKey: string) => {
  let html = escapeHtml(value);

  const resolveMarkdownImageSource = (source: string) => {
    const normalizedSource = source.trim();
    const sourceWithoutQuery = normalizedSource.split('#')[0].split('?')[0];
    const sourceFilename = sourceWithoutQuery.split('/').pop() ?? sourceWithoutQuery;
    const mappedFeatureImageUrl = docsFeatureImagesByName.get(sourceFilename);
    if (mappedFeatureImageUrl) {
      return mappedFeatureImageUrl;
    }

    return resolveMarkdownHref(normalizedSource, basePath, currentDocKey);
  };

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, source: string) => {
    const resolvedSource = resolveMarkdownImageSource(source);
    return `<img src="${resolvedSource}" alt="${alt}" loading="lazy" class="doc-image" />`;
  });

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
    const resolvedHref = resolveMarkdownHref(href, basePath, currentDocKey);
    const isExternal = resolvedHref.startsWith('http://') || resolvedHref.startsWith('https://');
    const rel = isExternal ? 'noreferrer' : '';
    const target = isExternal ? '_blank' : '';
    return `<a href="${resolvedHref}" ${target ? `target="${target}"` : ''} ${rel ? `rel="${rel}"` : ''} class="text-accent-primary hover:text-accent-secondary underline">${label}</a>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-bg-tertiary px-1.5 py-0.5 text-[0.9em]">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return html;
};

const splitTableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isTableDelimiterLine = (line: string) => {
  const normalizedLine = line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '');

  if (!normalizedLine.includes('-')) {
    return false;
  }

  const segments = normalizedLine.split('|').map((segment) => segment.trim());
  if (segments.length === 0) {
    return false;
  }

  return segments.every((segment) => /^:?-{3,}:?$/.test(segment));
};

const isThematicBreakLine = (line: string) => /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);

const renderMarkdown = (value: string, basePath: string, currentDocKey: string) => {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  let index = 0;

  const flushParagraph = (paragraphLines: string[]) => {
    if (paragraphLines.length === 0) {
      return;
    }
    const paragraphText = paragraphLines.join(' ');
    htmlParts.push(`<p class="mb-4 leading-7">${renderInlineMarkdown(paragraphText, basePath, currentDocKey)}</p>`);
  };

  while (index < lines.length) {
    const line = lines[index];

    if (/^```/.test(line)) {
      const language = line.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      const codeContent = codeLines.join('\n');
      if (language.toLowerCase() === 'mermaid') {
        htmlParts.push(
          `<div class="doc-mermaid-block mb-5 rounded-btn border border-border-primary bg-bg-primary p-4"><div class="doc-mermaid" data-mermaid="${encodeURIComponent(codeContent)}"></div></div>`
        );
      } else {
        htmlParts.push(
          `<pre class="mb-5 overflow-x-auto rounded-btn border border-border-primary bg-bg-primary p-4"><code class="text-sm ${language ? `language-${escapeHtml(language)}` : ''}">${escapeHtml(codeContent)}</code></pre>`
        );
      }
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const tag = `h${Math.min(level, 6)}`;
      const sizeClass = level === 1 ? 'text-3xl' : level === 2 ? 'text-2xl' : 'text-xl';
      htmlParts.push(
        `<${tag} class="mt-7 mb-3 font-semibold ${sizeClass} text-text-primary">${renderInlineMarkdown(text, basePath, currentDocKey)}</${tag}>`
      );
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const listItems: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        const itemText = lines[index].replace(/^\s*[-*]\s+/, '').trim();
        listItems.push(`<li>${renderInlineMarkdown(itemText, basePath, currentDocKey)}</li>`);
        index += 1;
      }
      htmlParts.push(`<ul class="mb-4 list-disc space-y-1 pl-6">${listItems.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        const itemText = lines[index].replace(/^\s*\d+\.\s+/, '').trim();
        listItems.push(`<li>${renderInlineMarkdown(itemText, basePath, currentDocKey)}</li>`);
        index += 1;
      }
      htmlParts.push(`<ol class="mb-4 list-decimal space-y-1 pl-6">${listItems.join('')}</ol>`);
      continue;
    }

    if (/^\s*>\s+/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s+/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s+/, '').trim());
        index += 1;
      }
      htmlParts.push(
        `<blockquote class="mb-4 border-l-4 border-border-primary pl-4 text-text-secondary">${renderInlineMarkdown(quoteLines.join(' '), basePath, currentDocKey)}</blockquote>`
      );
      continue;
    }

    if (isThematicBreakLine(line)) {
      htmlParts.push('<hr class="doc-divider" />');
      index += 1;
      continue;
    }

    if (
      line.includes('|') &&
      index + 1 < lines.length &&
      isTableDelimiterLine(lines[index + 1])
    ) {
      const headers = splitTableCells(line);
      const rows: string[][] = [];

      index += 2;
      while (
        index < lines.length &&
        lines[index].trim() &&
        lines[index].includes('|') &&
        !isTableDelimiterLine(lines[index])
      ) {
        rows.push(splitTableCells(lines[index]));
        index += 1;
      }

      const headerHtml = headers
        .map((header) => `<th>${renderInlineMarkdown(header, basePath, currentDocKey)}</th>`)
        .join('');

      const bodyHtml = rows
        .map((row) => {
          const normalizedRow = headers.map((_, cellIndex) => row[cellIndex] ?? '');
          const cellsHtml = normalizedRow
            .map((cell) => `<td>${renderInlineMarkdown(cell, basePath, currentDocKey)}</td>`)
            .join('');
          return `<tr>${cellsHtml}</tr>`;
        })
        .join('');

      htmlParts.push(
        `<div class="doc-table-wrap"><table class="doc-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
      );
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const paragraphLines: string[] = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !/^\s*>\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    flushParagraph(paragraphLines);
  }

  return htmlParts.join('');
};

const getDocKeyFromHash = (hash: string) => {
  if (!hash.startsWith(DOCS_HASH_PREFIX)) {
    return '';
  }
  const suffix = hash.slice(DOCS_HASH_PREFIX.length);
  if (!suffix.startsWith('/')) {
    return '';
  }
  return decodeURIComponent(suffix.slice(1).split('?')[0]);
};

const setHashForDoc = (docKey: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  const nextHash = `${DOCS_HASH_PREFIX}/${encodeURIComponent(docKey)}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
};

const loadActiveDoc = async () => {
  const doc = activeDoc.value;
  if (!doc) {
    activeDocHtml.value = '';
    activeDocError.value = '';
    return;
  }

  const modulePath = `../../../../docs/${doc.path}`;
  const loadMarkdown = markdownModules[modulePath];
  if (!loadMarkdown) {
    activeDocError.value = props.locale === 'fr' ? 'Document introuvable.' : 'Document not found.';
    activeDocHtml.value = '';
    return;
  }

  activeDocLoading.value = true;
  activeDocError.value = '';

  try {
    const markdownContent = await loadMarkdown();
    activeDocHtml.value = renderMarkdown(markdownContent, doc.path, doc.key);
  } catch {
    activeDocError.value =
      props.locale === 'fr'
        ? 'Impossible de charger ce document.'
        : 'Unable to load this document.';
    activeDocHtml.value = '';
  } finally {
    activeDocLoading.value = false;
  }
};

const syncDocFromHash = () => {
  const docs = indexedDocs.value;
  if (docs.length === 0) {
    activeDocKey.value = '';
    return;
  }

  if (typeof window === 'undefined') {
    activeDocKey.value = docs[0].key;
    return;
  }

  const hashDocKey = getDocKeyFromHash(window.location.hash);
  if (hashDocKey && indexedDocsByKey.value.has(hashDocKey)) {
    activeDocKey.value = hashDocKey;
    return;
  }

  activeDocKey.value = docs[0].key;
  if (window.location.hash.startsWith(DOCS_HASH_PREFIX)) {
    setHashForDoc(docs[0].key);
  }
};

const selectDoc = (docKey: string) => {
  activeDocKey.value = docKey;
  setHashForDoc(docKey);
};

const handleHashChange = () => {
  syncDocFromHash();
};

onMounted(() => {
  syncDocFromHash();
  loadActiveDoc();

  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', handleHashChange);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('hashchange', handleHashChange);
  }
});

watch(() => props.locale, syncDocFromHash);
watch(activeDocKey, loadActiveDoc);
watch(activeDocHtml, async () => {
  await nextTick();
  void renderMermaidBlocks();
});
</script>

<template>
  <section class="space-y-8" aria-labelledby="documentation-title">
    <div class="space-y-3">
      <h1 id="documentation-title" class="text-3xl font-semibold leading-tight text-text-primary md:text-5xl">
        {{ currentDocsContent.title }}
      </h1>
      <p class="max-w-3xl text-sm text-text-secondary md:text-base">
        {{ currentDocsContent.description }}
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8">
      <aside class="rounded-card border border-border-primary bg-bg-secondary p-4 lg:sticky lg:top-24 lg:self-start">
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          {{ props.locale === 'fr' ? 'Index documentation' : 'Documentation index' }}
        </p>
        <div class="mt-3 space-y-4">
          <section v-for="category in indexedCategories" :key="category.title" class="space-y-1.5">
            <h2 class="px-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">
              {{ category.title }}
            </h2>
            <nav class="space-y-1 text-sm">
              <a
                v-for="doc in category.docs"
                :key="doc.key"
                :href="`${DOCS_HASH_PREFIX}/${doc.key}`"
                class="block rounded-btn border px-3 py-2 transition-colors duration-200"
                :class="
                  activeDocKey === doc.key
                    ? 'border-border-primary bg-bg-primary font-semibold text-text-primary'
                    : 'border-transparent text-text-secondary hover:border-border-primary hover:bg-bg-primary hover:text-text-primary'
                "
                @click.prevent="selectDoc(doc.key)"
              >
                {{ doc.title }}
              </a>
            </nav>
          </section>
        </div>
      </aside>

      <article class="space-y-6 md:space-y-7">
        <section class="rounded-card border border-border-primary bg-bg-secondary p-5 md:p-6">
          <h2 class="text-2xl font-semibold text-text-primary">
            {{ activeDoc?.title ?? (props.locale === 'fr' ? 'Documentation' : 'Documentation') }}
          </h2>
          <p v-if="activeDoc" class="mt-2 text-sm text-text-secondary">
            {{ activeDoc.description }}
          </p>
          <p v-if="activeDoc" class="mt-1 text-xs text-text-tertiary">
            {{ activeDoc.categoryTitle }}
          </p>
        </section>

        <section v-if="activeDocLoading" class="rounded-card border border-border-primary bg-bg-secondary p-5 text-sm text-text-secondary">
          {{ props.locale === 'fr' ? 'Chargement du document...' : 'Loading document...' }}
        </section>

        <section
          v-else-if="activeDocError"
          class="rounded-card border border-border-primary bg-bg-secondary p-5 text-sm text-red-700"
        >
          {{ activeDocError }}
        </section>

        <section v-else class="rounded-card border border-border-primary bg-bg-secondary p-5 md:p-6">
          <div ref="markdownContentRef" class="doc-markdown text-sm text-text-secondary" v-html="activeDocHtml"></div>
        </section>

        <section
          v-if="isSwaggerDoc"
          class="rounded-card border border-border-primary bg-bg-secondary p-5 md:p-6"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-xs text-text-tertiary">
              {{ props.locale === 'fr' ? "Swagger UI intégré dans la page." : 'Swagger UI embedded in this page.' }}
            </p>
            <a
              :href="swaggerUiUrl"
              target="_blank"
              rel="noreferrer"
              class="rounded-btn border border-border-primary bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors duration-200 hover:bg-bg-tertiary"
            >
              {{ props.locale === 'fr' ? 'Ouvrir dans un nouvel onglet' : 'Open in a new tab' }}
            </a>
          </div>
          <iframe
            class="swagger-frame mt-4"
            :src="swaggerUiUrl"
            title="Swagger UI"
            loading="lazy"
            referrerpolicy="no-referrer"
          ></iframe>
          <p class="mt-3 text-xs text-text-tertiary">
            {{
              props.locale === 'fr'
                ? "Si l'intégration est bloquée par la politique de sécurité du navigateur, utilisez le lien ci-dessus."
                : 'If embedding is blocked by browser security policy, use the link above.'
            }}
          </p>
        </section>
      </article>
    </div>
  </section>
</template>

<style scoped>
.doc-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.doc-markdown :deep(h1:first-child),
.doc-markdown :deep(h2:first-child),
.doc-markdown :deep(h3:first-child),
.doc-markdown :deep(h4:first-child) {
  margin-top: 0;
}

.doc-markdown :deep(.doc-mermaid-block) {
  overflow-x: auto;
}

.doc-markdown :deep(.doc-mermaid-ready svg) {
  width: 100%;
  height: auto;
  max-width: 100%;
}

.doc-markdown :deep(.doc-divider) {
  margin: 1.2rem 0;
  border: 0;
  border-top: 1px solid var(--border-primary);
}

.doc-markdown :deep(.doc-table-wrap) {
  margin-bottom: 1rem;
  overflow-x: auto;
  border: 1px solid var(--border-primary);
  border-radius: 0.75rem;
}

.doc-markdown :deep(.doc-table) {
  width: 100%;
  min-width: 32rem;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.doc-markdown :deep(.doc-table th),
.doc-markdown :deep(.doc-table td) {
  border-bottom: 1px solid var(--border-primary);
  border-right: 1px solid var(--border-primary);
  padding: 0.5rem 0.65rem;
  vertical-align: top;
}

.doc-markdown :deep(.doc-table th) {
  background: var(--bg-tertiary);
  font-weight: 600;
  text-align: left;
  color: var(--text-primary);
}

.doc-markdown :deep(.doc-table th:last-child),
.doc-markdown :deep(.doc-table td:last-child) {
  border-right: none;
}

.doc-markdown :deep(.doc-table tbody tr:last-child td) {
  border-bottom: none;
}

.doc-markdown :deep(.doc-image) {
  display: block;
  width: 100%;
  max-width: 60rem;
  height: auto;
  margin: 0.75rem 0 1rem;
  border: 1px solid var(--border-primary);
  border-radius: 0.75rem;
  background: var(--bg-primary);
}

.swagger-frame {
  width: 100%;
  min-height: 70vh;
  border: 1px solid var(--border-primary);
  border-radius: 0.75rem;
  background: var(--bg-primary);
}
</style>
