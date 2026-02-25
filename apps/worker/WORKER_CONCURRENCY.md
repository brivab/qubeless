# Worker Concurrency - Documentation

## Vue d'ensemble

Le worker d'analyses supporte maintenant l'exécution parallèle de plusieurs jobs avec une gestion robuste des retries et des statuts.

## Configuration (Variables d'environnement)

### WORKER_CONCURRENCY (défaut: 2)
Nombre de jobs traités en parallèle par le worker.
- `1` : Traitement séquentiel (comportement original)
- `2+` : Traitement concurrent de plusieurs analyses

**Exemple:**
```bash
WORKER_CONCURRENCY=4  # Traite jusqu'à 4 analyses en parallèle
```

### WORKER_JOB_ATTEMPTS (défaut: 2)
Nombre maximum de tentatives pour chaque job en cas d'échec.

**Exemple:**
```bash
WORKER_JOB_ATTEMPTS=3  # Chaque job peut être tenté jusqu'à 3 fois
```

### WORKER_BACKOFF_MS (défaut: 5000)
Délai initial (en millisecondes) pour le backoff exponentiel entre les retries.

Le délai réel pour chaque retry est calculé avec: `WORKER_BACKOFF_MS * 2^(tentative - 1)`

**Exemple:**
```bash
WORKER_BACKOFF_MS=10000  # 10s, 20s, 40s... entre les tentatives
```

## Gestion des statuts Analysis

### Transitions de statut

1. **PENDING → RUNNING**
   - Se produit **uniquement** lors de la première tentative
   - Le champ `startedAt` est défini
   - Un statut PR "pending" est publié (si applicable)

2. **RUNNING → SUCCESS**
   - Se produit après la complétion réussie de:
     - Tous les analyzers
     - L'ingestion en base de données
     - L'évaluation de la quality gate
   - Le champ `finishedAt` est défini
   - Le statut PR approprié est publié (success/failure selon quality gate)

3. **RUNNING → FAILED**
   - Se produit **uniquement** après l'épuisement de toutes les tentatives
   - Le champ `finishedAt` est défini
   - Un statut PR "failure" est publié

### Important: Cohérence des statuts lors des retries

- Les retries ne modifient **PAS** le statut (il reste `RUNNING`)
- Seul le dernier échec (après toutes les tentatives) définit le statut à `FAILED`
- Cela garantit qu'une analyse n'est jamais marquée `FAILED` prématurément

## Logs structurés

Tous les logs incluent maintenant:
- `analysisId`: Identifiant unique de l'analyse
- `correlationId`: Alias de `analysisId` pour la traçabilité
- `attempt`: Numéro de la tentative en cours
- `maxAttempts`: Nombre maximum de tentatives configuré

**Exemple de log:**
```json
{
  "jobId": "abc-123",
  "correlationId": "analysis-456",
  "analysisId": "analysis-456",
  "attempt": 2,
  "maxAttempts": 3,
  "msg": "Processing analysis job"
}
```

## Comportement du Retry

### Scénario 1: Succès immédiat
```
Tentative 1 → SUCCESS
Statut: PENDING → RUNNING → SUCCESS
```

### Scénario 2: Échec puis succès (avec WORKER_JOB_ATTEMPTS=3)
```
Tentative 1 → ÉCHEC (erreur temporaire)
  ↓ backoff: 5000ms
Tentative 2 → ÉCHEC (erreur temporaire)
  ↓ backoff: 10000ms
Tentative 3 → SUCCESS
Statut: PENDING → RUNNING → SUCCESS
```

### Scénario 3: Échecs complets (avec WORKER_JOB_ATTEMPTS=2)
```
Tentative 1 → ÉCHEC
  ↓ backoff: 5000ms
Tentative 2 → ÉCHEC (dernière tentative)
Statut: PENDING → RUNNING → FAILED
```

## Backoff exponentiel

Le délai entre les tentatives augmente exponentiellement:

```javascript
delay = WORKER_BACKOFF_MS * 2^(attemptsMade - 1)
```

**Exemple avec WORKER_BACKOFF_MS=5000:**
- Tentative 1 → Échec
- Délai: 5000ms (5s)
- Tentative 2 → Échec
- Délai: 10000ms (10s)
- Tentative 3 → ...

## Tests

### Exécuter les tests
```bash
cd apps/worker
pnpm test
```

### Tests disponibles

1. **Retry avec succès après échec**
   - Vérifie qu'un job qui échoue puis réussit est bien traité

2. **Échec après épuisement des tentatives**
   - Vérifie qu'un job qui échoue continuellement est marqué comme échoué

3. **Application du backoff exponentiel**
   - Vérifie que les délais entre tentatives augmentent exponentiellement

4. **Traitement concurrent indépendant**
   - Vérifie que plusieurs jobs peuvent être traités en parallèle avec leurs propres retries

## Non-régression

### Comportement par défaut (WORKER_CONCURRENCY=1)

Avec la configuration par défaut ou `WORKER_CONCURRENCY=1`, le comportement est **identique** à l'implémentation précédente:
- Les jobs sont traités séquentiellement
- Un seul job est actif à la fois
- Les transitions de statut sont identiques

**Test de validation:**
```bash
WORKER_CONCURRENCY=1 WORKER_JOB_ATTEMPTS=2 pnpm dev
```

### Migration depuis l'ancien comportement

Si vous utilisiez déjà le worker:
1. **Aucun changement nécessaire** si vous ne définissez pas les nouvelles variables
2. Les valeurs par défaut garantissent un comportement rétrocompatible
3. Pour bénéficier du parallélisme, augmentez `WORKER_CONCURRENCY`

## Exemples de configuration

### Développement (rapide, peu de parallélisme)
```bash
WORKER_CONCURRENCY=1
WORKER_JOB_ATTEMPTS=2
WORKER_BACKOFF_MS=1000
```

### Production (robuste, parallélisme modéré)
```bash
WORKER_CONCURRENCY=4
WORKER_JOB_ATTEMPTS=3
WORKER_BACKOFF_MS=5000
```

### Haute disponibilité (parallélisme élevé)
```bash
WORKER_CONCURRENCY=10
WORKER_JOB_ATTEMPTS=5
WORKER_BACKOFF_MS=10000
```

## Monitoring

### Logs à surveiller

1. **Démarrage du worker**
```json
{
  "queueName": "analysis-queue",
  "workerConcurrency": 4,
  "workerJobAttempts": 3,
  "workerBackoffMs": 5000,
  "msg": "Worker service starting"
}
```

2. **Retry en cours**
```json
{
  "analysisId": "xyz",
  "attempt": 2,
  "maxAttempts": 3,
  "msg": "Retrying analysis job"
}
```

3. **Échec final**
```json
{
  "analysisId": "xyz",
  "totalAttempts": 3,
  "msg": "All retry attempts exhausted, marking analysis as FAILED"
}
```

## Limitations et considérations

1. **Ressources système**: Augmenter `WORKER_CONCURRENCY` augmente la charge sur:
   - CPU (exécution Docker)
   - Mémoire (workspaces en parallèle)
   - I/O (MinIO, PostgreSQL)

2. **Redis**: La queue Redis doit supporter la charge de concurrency

3. **Docker**: Le daemon Docker doit pouvoir gérer plusieurs conteneurs simultanés

4. **Base de données**: PostgreSQL doit gérer les connexions concurrentes

## Troubleshooting

### Les jobs ne sont pas retryés
- Vérifiez que `WORKER_JOB_ATTEMPTS > 1`
- Vérifiez les logs pour voir si l'erreur est bien levée (`throw error`)

### Les jobs sont traités séquentiellement malgré WORKER_CONCURRENCY > 1
- Vérifiez que la variable est bien définie au démarrage du worker
- Vérifiez les logs de démarrage qui affichent la configuration

### Le backoff ne semble pas fonctionner
- Le backoff est géré par BullMQ, vérifiez que Redis fonctionne correctement
- Les logs montrent le délai calculé à chaque backoff

### Une analyse reste en RUNNING indéfiniment
- Vérifiez si le worker est toujours actif
- Vérifiez les logs d'erreur - un crash peut laisser le statut RUNNING
- Une reconnexion du worker reprendra le job
