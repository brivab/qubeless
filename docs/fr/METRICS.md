# Métriques Prometheus

Ce document décrit l'implémentation des métriques techniques pour le monitoring de la plateforme Qubeless.

## Configuration

### Activation des métriques

Les métriques sont **désactivées par défaut** pour des raisons de sécurité. Pour les activer, définissez la variable d'environnement suivante :

```bash
# Dans apps/api/.env
METRICS_ENABLED=true
```

### Redémarrage requis

Après modification de la configuration, redémarrez le service API :

```bash
pnpm --filter @qubeless/api dev
```

## Endpoint

### GET /api/metrics

Endpoint exposant les métriques au format Prometheus.

- **URL** : `http://localhost:3001/api/metrics`
- **Méthode** : `GET`
- **Format** : `text/plain; version=0.0.4` (format Prometheus)
- **Authentification** : Public (pas d'authentification requise)
- **Statut** :
  - `200 OK` : Métriques disponibles
  - `503 Service Unavailable` : Métriques désactivées

### Exemple de requête

```bash
curl http://localhost:3001/api/metrics
```

### Exemple de réponse

```
# HELP analyses_total Total number of analyses started
# TYPE analyses_total counter
analyses_total{project="my-project",status="completed"} 42
analyses_total{project="my-project",status="failed"} 3

# HELP analyses_failed_total Total number of failed analyses
# TYPE analyses_failed_total counter
analyses_failed_total{project="my-project",reason="timeout"} 2
analyses_failed_total{project="my-project",reason="docker"} 1

# HELP analysis_duration_seconds Duration of analyses in seconds
# TYPE analysis_duration_seconds histogram
analysis_duration_seconds_bucket{project="my-project",status="completed",le="30"} 5
analysis_duration_seconds_bucket{project="my-project",status="completed",le="60"} 15
analysis_duration_seconds_bucket{project="my-project",status="completed",le="120"} 28
analysis_duration_seconds_bucket{project="my-project",status="completed",le="300"} 38
analysis_duration_seconds_bucket{project="my-project",status="completed",le="600"} 41
analysis_duration_seconds_bucket{project="my-project",status="completed",le="+Inf"} 42
analysis_duration_seconds_sum{project="my-project",status="completed"} 8234.5
analysis_duration_seconds_count{project="my-project",status="completed"} 42

# HELP queue_depth Number of jobs waiting in the analysis queue
# TYPE queue_depth gauge
queue_depth{state="waiting"} 3
queue_depth{state="active"} 2
queue_depth{state="delayed"} 0
queue_depth{state="failed"} 1

# HELP running_analyses Number of currently running analyses
# TYPE running_analyses gauge
running_analyses 2

# HELP db_query_duration_seconds Database query duration in seconds
# TYPE db_query_duration_seconds histogram
db_query_duration_seconds_bucket{operation="health_check",le="0.001"} 15
db_query_duration_seconds_bucket{operation="health_check",le="0.005"} 42
...

# HELP redis_operation_duration_seconds Redis operation duration in seconds
# TYPE redis_operation_duration_seconds histogram
redis_operation_duration_seconds_bucket{operation="health_check",le="0.001"} 98
...

# HELP minio_operation_duration_seconds MinIO operation duration in seconds
# TYPE minio_operation_duration_seconds histogram
minio_operation_duration_seconds_bucket{operation="health_check",le="0.01"} 12
...
```

## Métriques disponibles

### Métriques d'analyses

#### `analyses_total` (Counter)

Nombre total d'analyses démarrées.

**Labels** :

- `project` : Clé du projet (ex: `my-project`)
- `status` : Statut de l'analyse (`completed`, `failed`)

#### `analyses_failed_total` (Counter)

Nombre total d'analyses échouées.

**Labels** :

- `project` : Clé du projet
- `reason` : Raison de l'échec (`timeout`, `memory`, `docker`, `storage`, `network`, `other`)

#### `analysis_duration_seconds` (Histogram)

Durée des analyses en secondes.

**Labels** :

- `project` : Clé du projet
- `status` : Statut de l'analyse (`completed`, `failed`)

**Buckets** : 30s, 60s, 120s, 300s, 600s, 1200s, 1800s, 3600s

### Métriques de queue

#### `queue_depth` (Gauge)

Nombre de jobs dans la queue d'analyses.

**Labels** :

- `state` : État des jobs (`waiting`, `active`, `delayed`, `failed`)

#### `running_analyses` (Gauge)

Nombre d'analyses en cours d'exécution.

### Métriques d'infrastructure

#### `db_query_duration_seconds` (Histogram)

Latence des requêtes vers PostgreSQL.

**Labels** :

- `operation` : Type d'opération (ex: `health_check`)

**Buckets** : 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s, 5s

#### `redis_operation_duration_seconds` (Histogram)

Latence des opérations Redis.

**Labels** :

- `operation` : Type d'opération (ex: `health_check`)

**Buckets** : 1ms, 5ms, 10ms, 50ms, 100ms, 500ms

#### `minio_operation_duration_seconds` (Histogram)

Latence des opérations MinIO/S3.

**Labels** :

- `operation` : Type d'opération (ex: `health_check`)

**Buckets** : 10ms, 50ms, 100ms, 500ms, 1s, 5s, 10s

### Métriques système par défaut

En plus des métriques applicatives, les métriques système suivantes sont automatiquement collectées :

- `process_cpu_user_seconds_total` : Temps CPU utilisateur
- `process_cpu_system_seconds_total` : Temps CPU système
- `process_resident_memory_bytes` : Mémoire résidente
- `process_heap_bytes` : Taille du heap
- `nodejs_eventloop_lag_seconds` : Latence de l'event loop Node.js
- `nodejs_gc_duration_seconds` : Durée des garbage collections

## Intégration avec Prometheus

### Configuration Prometheus

Ajoutez le job suivant à votre fichier `prometheus.yml` :

```yaml
scrape_configs:
  - job_name: 'qubeless-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /api/metrics
```

### Exemple de requêtes PromQL

#### Taux d'échec des analyses

```promql
rate(analyses_failed_total[5m])
```

#### Durée médiane des analyses par projet

```promql
histogram_quantile(0.5, rate(analysis_duration_seconds_bucket[5m]))
```

#### Analyses en attente

```promql
queue_depth{state="waiting"}
```

#### Latence P95 des requêtes base de données

```promql
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))
```

## Grafana

### Dashboards recommandés

1. **Vue d'ensemble Qubeless**
   - Analyses total (par projet)
   - Taux de succès/échec
   - Durée moyenne des analyses
   - Queue depth

2. **Performance infrastructure**
   - Latence PostgreSQL
   - Latence Redis
   - Latence MinIO
   - Métriques système (CPU, mémoire)

3. **Analyses en détail**
   - Distribution des durées d'analyse
   - Raisons des échecs
   - Analyses en cours vs en attente

### Exemple de panel Grafana

**Panel : Durée des analyses**

```promql
# Query A : Durée moyenne
rate(analysis_duration_seconds_sum[5m]) / rate(analysis_duration_seconds_count[5m])

# Query B : P95
histogram_quantile(0.95, rate(analysis_duration_seconds_bucket[5m]))
```

## Alertes recommandées

### Taux d'échec élevé

```yaml
- alert: HighAnalysisFailureRate
  expr: rate(analyses_failed_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Taux d'échec d'analyses élevé"
    description: "Le taux d'échec des analyses dépasse 10% sur les 5 dernières minutes"
```

### Queue surchargée

```yaml
- alert: AnalysisQueueBacklog
  expr: queue_depth{state="waiting"} > 20
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Queue d'analyses surchargée"
    description: 'Plus de 20 analyses en attente depuis 10 minutes'
```

### Latence base de données élevée

```yaml
- alert: HighDatabaseLatency
  expr: histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'Latence base de données élevée'
    description: 'La latence P95 des requêtes dépasse 1 seconde'
```

## Sécurité

### Données sensibles

L'implémentation garantit qu'**aucune donnée sensible n'est exposée** :

- ✅ Pas de secrets ou tokens
- ✅ Pas de données utilisateur (emails, noms, etc.)
- ✅ Pas de contenu de code source
- ✅ Uniquement des métriques techniques agrégées

### Labels

Les labels utilisés sont :

- Clés de projets (identifiants techniques publics)
- États et statuts (énumérations)
- Types d'opérations (noms de fonctions)

### Accès

Bien que l'endpoint soit public (pas d'authentification), il est recommandé de :

- Le garder désactivé en production si non utilisé
- Restreindre l'accès réseau au niveau du firewall/ingress
- N'exposer l'endpoint qu'aux systèmes de monitoring autorisés

## Troubleshooting

### Métriques désactivées

**Problème** : `503 Service Unavailable` lors de l'accès à `/api/metrics`

**Solution** : Vérifiez que `METRICS_ENABLED=true` dans votre `.env` et redémarrez l'API.

### Métriques vides

**Problème** : L'endpoint retourne peu ou pas de métriques

**Cause possible** :

- Aucune analyse n'a encore été lancée
- Le service vient d'être démarré

**Solution** : Lancez quelques analyses pour générer des métriques.

### Queue depth toujours à 0

**Problème** : `queue_depth` reste à 0

**Cause** :

- Pas d'analyses en cours ou en attente
- Worker traite les jobs trop rapidement

**Solution** : C'est normal si votre système n'a pas de charge. Lancez plusieurs analyses pour observer l'évolution.

## Performance

### Impact sur les performances

L'activation des métriques a un impact minimal :

- Overhead CPU : < 1%
- Overhead mémoire : ~10-20 MB
- Latence ajoutée : < 1ms par opération métrisée

### Optimisations

- Les métriques de queue sont actualisées toutes les 10 secondes (configurable)
- Les histogrammes utilisent des buckets pré-définis
- Pas de collection si `METRICS_ENABLED=false`

## Références

- [Prometheus Documentation](https://prometheus.io/docs/)
- [prom-client (Node.js)](https://github.com/siimon/prom-client)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
