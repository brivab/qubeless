# Soumettre la codebase en local / CI

## Commande

```
pnpm submit --server http://localhost:3001 --project <PROJECT_KEY> [options]
```

(Si vous préférez, `pnpm submit -- --server ...` reste supporté.)

## Options principales

- `--server` : URL du serveur (ex. `http://localhost:3001`)
- `--project` : projectKey cible
- `--branch` / `--sha` : overrides si `git` est indisponible ou si le repo n'est pas initialisé
- `--exclude <pattern...>` : patterns glob supplémentaires à exclure du zip
- `--verbose` : traces détaillées (git, patterns, destination du zip)
- `--wait` : attend la fin de l'analyse côté serveur
- `--poll-interval <ms>` : intervalle de polling (ms, défaut 2000)
- `--timeout <ms>` : timeout global du wait (ms, défaut 600000)
- `--fail-on-analysis-failed` (défaut: true) : exit 1 si le statut d'analyse est `FAILED`
- `--no-gate` : saute la requête de quality gate (utile si indisponible)
- `--branch-name` / `--branchName` : alias de `--branch`

## Fonctionnement

- Récupère la branche (`git rev-parse --abbrev-ref HEAD`) et le commit (`git rev-parse HEAD`).
  - Si git est absent ou que le dossier n'est pas un repo, passer `--branch` et `--sha`.
- Crée un zip de la racine du repo (dans un dossier temporaire, ex. `/tmp/qubeless-submit`).
  - Exclusions par défaut : `.git/`, `node_modules/`, `dist/`, `build/`, `.turbo/`, `.nx/`, `.cache/`, `.DS_Store`, `tmp/`, `temp/`, `.tmp/`.
  - Le zip est streamé et affiche sa taille en sortie.
- Envoie un `multipart/form-data` vers `POST /projects/:projectKey/analyses` avec `branchName`, `commitSha` et `sourceZip`.
- Affiche l'`analysisId`, le `status` (si présent) et éventuellement une URL si fournie par l'API.
- Les tokens API sont pris en charge via `--token` ou `SCANNER_TOKEN` (Bearer).
- Si `--wait` est passé :
  - Poll `GET /analyses/:id` jusqu'à `SUCCESS` ou `FAILED` (2s par défaut, timeout 10 min).
  - En cas de succès, appelle `GET /analyses/:id/quality-gate-status` (sauf `--no-gate`).
  - Affiche l'état final et le résultat du quality gate (PASS/FAIL).

## Dépannage

- **Git indisponible / pas de repo** : fournir `--branch` et `--sha`.
- **Erreur API** : vérifier l'URL `--server`, que le projet existe et que l'infra (`docker-compose -f docker-compose.dev.yml`) tourne.
- **Zip trop volumineux** : ajouter des exclusions ciblées via `--exclude` ou nettoyer les artefacts locaux.
- **Fichiers non désirés** : vérifier les patterns d'exclusion (`--verbose` montre la liste complète utilisée).
- **Timeout / polling** : augmenter `--timeout` ou `--poll-interval`.
- **Quality gate indisponible** : utiliser `--no-gate` pour ignorer la récupération du gate.

## Codes de sortie

- `0` : analyse `SUCCESS` et quality gate `PASS`
- `2` : analyse `SUCCESS` mais quality gate `FAIL`
- `1` : erreur réseau/serveur, timeout, ou analyse `FAILED` (sauf si `--fail-on-analysis-failed=false`)
- `130` : interruption utilisateur (Ctrl+C)

## Exemple “CI local”

```bash
#!/usr/bin/env bash
set -euo pipefail

SERVER="http://localhost:3001"
PROJECT="myproj"

pnpm submit --server "$SERVER" --project "$PROJECT" --wait --verbose
STATUS=$?

if [ "$STATUS" -eq 2 ]; then
  echo "Quality gate failed"; exit 2
fi

exit "$STATUS"
```

## Scanner (mode PR/CI)

Une CLI plus complète est disponible via `pnpm scanner run`, notamment pour :

- auto-créer le projet et la quality gate si absents,
- utiliser les tokens API,
- suivre l'analyse + récupérer la quality gate,
- lire `.gitignore` et exclure automatiquement les répertoires classiques,
- supporter les PR via `--branch` ou détection git.

Exemple :

```bash
pnpm scanner run \
  --server http://localhost:3001/api \
  --project my-project \
  --wait \
  --verbose
```

Voir `packages/scanner/.codequalityrc.json` pour la config par défaut.
