# Qubeless : Intégration PR (GitHub & GitLab)

Ce document décrit le flux de bout en bout pour analyser une Pull Request / Merge Request avec Qubeless, publier un status check et un commentaire automatique.

## Pré-requis
- **API Qubeless** déployée avec les migrations à jour (support des PR + webhooks).
- **Worker** démarré avec accès réseau aux API GitHub/GitLab pour publier statuts/commentaires.
- Secrets :
  - `GITHUB_WEBHOOK_SECRET` (GitHub) / `GITLAB_WEBHOOK_SECRET` (GitLab) pour valider les webhooks.
  - `GITHUB_TOKEN` (ou `GITHUB_STATUS_TOKEN`) et/ou `GITLAB_TOKEN` (ou `GITLAB_STATUS_TOKEN`) avec droits d’écriture sur les statuts/commentaires de la PR/MR.
  - `WEB_APP_URL` pointant vers l’UI (utilisé pour les liens de status/commentaire).

## Webhooks API
- Endpoints :
  - `POST /api/webhooks/github`
  - `POST /api/webhooks/gitlab`
- Vérification de signature :
  - GitHub : header `X-Hub-Signature-256` (secret `GITHUB_WEBHOOK_SECRET`).
  - GitLab : header `X-Gitlab-Token` (secret `GITLAB_WEBHOOK_SECRET`).
- Événements pris en charge :
  - GitHub : `pull_request` actions `opened`, `synchronize`, `reopened`.
  - GitLab : MR actions `open`, `update`, `reopen`.
- Données extraites :
  - `repo` (full name), `prNumber`/`iid`, `sourceBranch`, `targetBranch`, `commitSha`.
- Effet :
  - Création/MAJ d’une entité PullRequest (auto-création du projet si absent, clé = repo full name).
  - Déclenchement d’une analyse associée à la PR.

## Pipeline worker (PR)
- Au démarrage de l’analyse : publication d’un status check `Code Quality` en `pending`.
- À la fin :
  - Quality Gate PASS → status `success`
  - Quality Gate FAIL → status `failure`
  - Échec technique → status `failure`
- Commentaire automatique (création ou mise à jour d’un seul commentaire par analyse) :
  - Contenu : statut Quality Gate (PASS/FAIL), nombre de *new issues*, breakdown par sévérité, lien vers la page d’analyse.
  - Marqueur interne `<!-- qubeless-analysis:<analysisId> -->` pour mettre à jour le commentaire sur re-run.

## Configuration GitHub
1. Créer un secret webhook (`GITHUB_WEBHOOK_SECRET`).
2. Sur le repo GitHub : Settings → Webhooks → ajouter :
   - Payload URL : `https://<host>/api/webhooks/github`
   - Content type : `application/json`
   - Secret : `GITHUB_WEBHOOK_SECRET`
   - Events : *Let me select* → `Pull requests`
3. Définir `GITHUB_TOKEN` (PAT ou GitHub App) avec scope `repo:status` / `public_repo` selon besoin.

## Configuration GitLab
1. Créer un secret webhook (`GITLAB_WEBHOOK_SECRET`).
2. Sur le projet GitLab : Settings → Webhooks :
   - URL : `https://<host>/api/webhooks/gitlab`
   - Secret Token : `GITLAB_WEBHOOK_SECRET`
   - Events : Merge request events.
3. Définir `GITLAB_TOKEN` avec droits “api” ou suffisamment pour commenter et publier des statuses.

## Variables d’environnement clés
- API :
  - `GITHUB_WEBHOOK_SECRET`, `GITLAB_WEBHOOK_SECRET`
- Worker :
  - `GITHUB_TOKEN` / `GITHUB_STATUS_TOKEN`
  - `GITLAB_TOKEN` / `GITLAB_STATUS_TOKEN`
  - `WEB_APP_URL` (ex. `http://localhost:5173`)

## Flux résumé
1. GitHub/GitLab envoie le webhook PR/MR.
2. API Qubeless valide la signature, crée/MAJ la PullRequest et déclenche l’analyse.
3. Worker :
   - publie `pending` sur la PR,
   - exécute les analyzers,
   - évalue la Quality Gate,
   - publie `success`/`failure` + commentaire synthétique.
4. L’UI affiche l’analyse PR avec issues, Quality Gate et lien dans le commentaire/status.

