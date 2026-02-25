# Provider LLM, prompt et résolution d'issue par IA

Ce guide explique comment :

1. Configurer un provider LLM.
2. Configurer et activer un template de prompt.
3. Résoudre une issue avec l'IA depuis l'UI Qubeless.

## Prérequis

- Vous êtes authentifié dans Qubeless.
- Vous avez un accès admin pour configurer les providers et prompts LLM.
- Vous avez déjà un projet avec au moins une analyse contenant des issues.

## 1) Configurer un provider LLM (Admin)

Chemin UI :

- `Admin -> LLM Providers`
- Route : `/admin/llm-providers`

Créez un provider avec :

- `name` : nom affiché dans Qubeless.
- `providerType` : famille de provider (exemple : `openai`).
- `baseUrl` : endpoint API compatible OpenAI.
- `model` : identifiant du modèle.
- `token` : clé API du provider.
- `headersJson` (optionnel) : en-têtes HTTP supplémentaires en JSON.
- `isDefault` (optionnel) : provider de fallback si un projet n'en sélectionne pas.

Ensuite, cliquez sur `Test` dans la carte provider pour valider la connectivité.

Endpoints API :

- `GET /admin/llm-providers`
- `POST /admin/llm-providers`
- `PUT /admin/llm-providers/:id`
- `DELETE /admin/llm-providers/:id`
- `POST /admin/llm-providers/:id/test`

## 2) Configurer un template de prompt LLM (Admin)

Chemin UI :

- `Admin -> LLM Prompts`
- Route : `/admin/llm-prompts`

Créez un template avec :

- `name` : nom de famille du template.
- `version` : version du template (exemple : `v1`).
- `systemPrompt` : comportement global et contraintes.
- `taskPrompt` : instructions de génération du correctif.
- `isActive` : active ce template.

Comportement important :

- Qubeless ajoute un input structuré (issue/contexte) à `taskPrompt`.
- Qubeless impose un format de sortie JSON strict pour les fichiers modifiés.
- Un seul prompt est utilisé à l'exécution : le prompt actif.

Endpoints API :

- `GET /admin/llm-prompts`
- `POST /admin/llm-prompts`
- `PUT /admin/llm-prompts/:id`
- `DELETE /admin/llm-prompts/:id`
- `POST /admin/llm-prompts/:id/activate`

## 3) Configurer les réglages LLM du projet

Chemin UI :

- Ouvrez votre projet
- Onglet `LLM` dans le détail projet

Vous pouvez :

- sélectionner un provider spécifique au projet, ou conserver le provider par défaut,
- définir des overrides optionnels :
  - `temperature` (0 à 2)
  - `topP` (0 à 1)
  - `maxTokens` (1 à 200000)

Endpoints API :

- `GET /projects/:key/llm-settings`
- `PUT /projects/:key/llm-settings`

## 4) Résoudre une issue via IA

Flow UI :

1. Ouvrez une analyse.
2. Allez dans `Issues`.
3. Sur une issue, cliquez `Resolve via LLM`.
4. Ouvrez `LLM runs` pour suivre le statut et la sortie.

![Resolve issue via AI - Flow UI](src/assets/features/auto-fix-light.png)

Statuts d'un run :

- `QUEUED`
- `RUNNING`
- `SUCCESS`
- `FAILED`

En cas de succès, Qubeless crée une branche + PR/MR dans votre VCS et enregistre :

- le résumé du run,
- les fichiers générés,
- le lien de la PR/MR créée.

Endpoints liés aux issues :

- `POST /issues/:id/resolve` (démarre un run LLM)
- `GET /issues/:id/llm-runs` (historique des runs)

## Pré-requis runtime pour la résolution IA

Le job de résolution IA nécessite :

- un provider LLM effectif (provider projet ou provider par défaut),
- un template de prompt actif,
- un artefact `SOURCE_ZIP` pour l'analyse de l'issue,
- un contexte de pull request/merge request sur l'analyse,
- un token VCS (token utilisateur, global, ou token d'environnement).

Si un prérequis manque, le run échoue avec un message explicite dans `LLM runs`.
