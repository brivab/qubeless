# Analysis Quotas - Gestion de la Charge Système

## Vue d'ensemble

Ce document décrit le mécanisme de quotas implémenté pour éviter la surcharge du système lors de la création d'analyses.

## Objectifs

- **Prévenir la surcharge** : Limiter le nombre d'analyses simultanées pour protéger les ressources système
- **Équité** : Empêcher qu'un seul projet monopolise les workers disponibles
- **Expérience utilisateur** : Fournir des messages d'erreur clairs lorsque les limites sont atteintes

## Configuration

Les quotas sont configurables via des variables d'environnement :

### Variables d'environnement

| Variable                  | Description                                                                            | Valeur par défaut | Exemple |
| ------------------------- | -------------------------------------------------------------------------------------- | ----------------- | ------- |
| `MAX_RUNNING_ANALYSES`    | Nombre maximum d'analyses en cours d'exécution simultanément sur l'ensemble du système | `5`               | `10`    |
| `MAX_RUNNING_PER_PROJECT` | Nombre maximum d'analyses en cours d'exécution simultanément par projet                | `2`               | `3`     |

### Configuration dans `.env`

```env
# Analysis Quotas
MAX_RUNNING_ANALYSES=5
MAX_RUNNING_PER_PROJECT=2
```

## Fonctionnement

### Vérification des quotas

Lors de la création d'une analyse (via `POST /api/projects/:key/analyses`), le système effectue les vérifications suivantes **avant** de créer l'analyse :

1. **Quota global** : Compte le nombre total d'analyses avec le statut `RUNNING`
   - Si ce nombre est ≥ `MAX_RUNNING_ANALYSES`, la requête est rejetée

2. **Quota par projet** : Compte le nombre d'analyses `RUNNING` pour le projet spécifique
   - Si ce nombre est ≥ `MAX_RUNNING_PER_PROJECT`, la requête est rejetée

### Comportement en cas de dépassement

Lorsqu'un quota est dépassé :

- **Code HTTP** : `429 Too Many Requests`
- **Format de réponse** :
  ```json
  {
    "statusCode": 429,
    "message": "Maximum concurrent analyses limit reached (5 running). Please wait for some analyses to complete.",
    "error": "Too Many Requests"
  }
  ```

### Messages d'erreur

Deux types de messages sont possibles :

1. **Quota global dépassé** :

   ```
   Maximum concurrent analyses limit reached (5 running). Please wait for some analyses to complete.
   ```

2. **Quota par projet dépassé** :
   ```
   Maximum concurrent analyses per project limit reached (2 running for this project). Please wait for some analyses to complete.
   ```

## Points d'implémentation

### Fichiers modifiés

1. **[deploy.md](./deploy.md)** : Ajout des variables d'environnement dans le bloc de référence `.env.production`
2. **[analyses.service.ts](../apps/api/src/modules/analyses/analyses.service.ts)** :
   - Ajout de la méthode `checkQuotas()`
   - Appel de cette méthode dans `createForProject()` et `createForProjectWithUpload()`

### Code principal

```typescript
private async checkQuotas(projectId: string): Promise<void> {
  // Count total running analyses
  const totalRunning = await this.prisma.analysis.count({
    where: { status: AnalysisStatus.RUNNING },
  });

  if (totalRunning >= this.maxRunningAnalyses) {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Maximum concurrent analyses limit reached (${this.maxRunningAnalyses} running). Please wait for some analyses to complete.`,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Count running analyses for this project
  const projectRunning = await this.prisma.analysis.count({
    where: {
      projectId,
      status: AnalysisStatus.RUNNING,
    },
  });

  if (projectRunning >= this.maxRunningPerProject) {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Maximum concurrent analyses per project limit reached (${this.maxRunningPerProject} running for this project). Please wait for some analyses to complete.`,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
```

## Tests

### Tests unitaires

Les tests unitaires se trouvent dans [analyses.service.spec.ts](../apps/api/src/modules/analyses/analyses.service.spec.ts).

Scénarios testés :

- ✅ Création d'analyse quand les quotas ne sont pas dépassés
- ✅ Rejet avec 429 quand le quota global est atteint
- ✅ Rejet avec 429 quand le quota par projet est atteint
- ✅ Autorisation quand juste sous le quota global
- ✅ Autorisation quand juste sous le quota par projet
- ✅ Vérification indépendante des quotas par projet
- ✅ Utilisation des valeurs par défaut

### Test manuel

Pour tester manuellement :

1. **Configurer des quotas bas** (pour faciliter les tests) :

   ```env
   MAX_RUNNING_ANALYSES=2
   MAX_RUNNING_PER_PROJECT=1
   ```

2. **Simuler des analyses en cours** :

   ```sql
   -- Mettre des analyses en statut RUNNING
   UPDATE "Analysis" SET status = 'RUNNING' WHERE id IN ('id1', 'id2');
   ```

3. **Tenter de créer une nouvelle analyse** :

   ```bash
   curl -X POST http://localhost:3001/api/projects/my-project/analyses \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"commitSha": "abc123", "branch": "main"}'
   ```

4. **Vérifier la réponse 429** avec le message approprié

## Non-régression

Les valeurs par défaut ont été choisies pour être suffisamment larges :

- `MAX_RUNNING_ANALYSES=5` : Permet plusieurs analyses simultanées
- `MAX_RUNNING_PER_PROJECT=2` : Permet à plusieurs projets de fonctionner en parallèle

Ces valeurs ne devraient pas gêner un usage normal tout en protégeant le système contre une surcharge.

## Améliorations futures possibles

- [ ] Ajouter des métriques Prometheus pour suivre les refus de quota
- [ ] Implémenter un système de file d'attente pour mettre en attente les analyses au lieu de les rejeter
- [ ] Ajouter des quotas différenciés par plan/type de projet
- [ ] Mettre en place un système de priorité pour certains projets critiques
