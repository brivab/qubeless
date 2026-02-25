# Analyzer ESLint

Analyzer Phase 2 pour exécuter ESLint sur `/workspace` et produire `report.json`, `measures.json`, `run.log`.

## Fonctionnement

1. Copie le workspace vers `/tmp/workspace` (le montage est en lecture seule dans le worker).
2. Si un `package.json` est présent, tente `npm ci` (ou `npm install` si pas de lock) dans la copie. Échec toléré, on bascule sur la version embarquée.
3. Détecte une config ESLint (`eslint.config.*`, `.eslintrc*`). Si aucune n’est trouvée, applique une config par défaut (JS/TS, `eslint:recommended`, parser TS).
4. Lance ESLint avec `--format json --output-file /out/eslint.json --ext .js,.jsx,.ts,.tsx`.
5. Convertit le JSON ESLint en format Phase 2 :
   - `ruleKey`: `eslint:<ruleId>` (fallback `eslint:unknown`)
   - `severity`: `error` → `MAJOR`, `warning` → `MINOR`
   - `type`: heuristique sécurité (`no-eval`, `security`, `detect-*`, etc.) → `VULNERABILITY`, sinon `BUG` si sévérité MAJOR, sinon `CODE_SMELL`
   - `fingerprint`: hash sha256 de `ruleKey|file|line|message`
6. Génère `measures.json` avec `issues_total`, `issues_error_count`, `issues_warning_count`, `issues_by_severity.*`, `issues_by_type.*`.

## Image et dépendances

- Image `node:20-bookworm-slim`
- ESLint embarqué : `eslint@8.57.0`, `@typescript-eslint/{parser,eslint-plugin}@6.21.0`, `typescript@5.4.5`, `eslint-plugin-security@2.1.0`
- `rsync` pour copier le workspace sans `node_modules`.

Variables utiles :
- `ANALYZER_IMAGE_REGISTRY` (default: `qubeless`) / `ANALYZER_IMAGE_TAG` (default: `latest`) - Used during analyzer seeding in the API (see `apps/api/prisma/seed.js`).
- Images suivent la convention: `<registry>/analyzer-<name>:<tag>` (ex: `qubeless/analyzer-eslint:latest`)

## Exécution locale

```sh
docker build -t eslint-analyzer analyzers/eslint
docker run --rm -v "$PWD:/workspace:ro" -v "$PWD/out:/out" eslint-analyzer
cat out/report.json
```

Le conteneur fonctionne même sans ESLint dans le projet : il utilisera la version embarquée et une config par défaut si nécessaire.
