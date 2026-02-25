# Worker Resource Limits

Ce document décrit comment configurer les limites de ressources pour les analyseurs Docker exécutés par le worker.

## Vue d'ensemble

Pour empêcher les analyseurs Docker de monopoliser les ressources de la machine, le worker peut appliquer des limites de :
- **Temps d'exécution** (timeout)
- **Mémoire** (RAM)
- **CPU**

Ces limites sont configurables via des variables d'environnement et sont appliquées au niveau du conteneur Docker.

## Configuration

### Variables d'environnement

Ajoutez ces variables dans votre fichier `.env` ou `.env.local` :

```bash
# Timeout d'exécution en millisecondes (défaut: 600000 = 10 minutes)
ANALYZER_TIMEOUT_MS=600000

# Limite de mémoire en mégaoctets (défaut: non défini)
ANALYZER_MEMORY_MB=1024

# Limite de CPU en nombre de CPUs (défaut: non défini)
# 1 = 1 CPU complet, 0.5 = 50% d'un CPU, etc.
ANALYZER_CPU_LIMIT=1
```

### Valeurs par défaut

Si les variables ne sont pas définies :
- **ANALYZER_TIMEOUT_MS** : 600000 ms (10 minutes)
- **ANALYZER_MEMORY_MB** : non défini (pas de limite mémoire)
- **ANALYZER_CPU_LIMIT** : non défini (pas de limite CPU)

## Comportement

### Timeout (délai d'exécution)

Lorsqu'un analyseur dépasse le timeout configuré :
- Le conteneur Docker est tué (`docker kill`)
- L'analyse est marquée comme **FAILED**
- Le message d'erreur indique : `Analysis timed out after {timeoutMs}ms`
- Le type d'erreur est : `timeout`

### Out Of Memory (OOM)

Lorsqu'un analyseur dépasse la limite mémoire :
- Docker tue le conteneur (OOM Kill)
- L'analyse est marquée comme **FAILED**
- Le message d'erreur indique : `Analysis failed: Out of memory (limit: {memoryMb}MB)`
- Le type d'erreur est : `oom`

### Limite CPU

La limite CPU restreint l'utilisation du processeur :
- `1` = 1 CPU complet (100%)
- `0.5` = 50% d'un CPU
- `2` = 2 CPUs complets

Cette limite n'arrête pas le conteneur, elle ralentit simplement son exécution pour ne pas dépasser la limite.

### Erreurs Docker

En cas d'erreur Docker (image introuvable, problème de réseau, etc.) :
- L'analyse est marquée comme **FAILED**
- Le message d'erreur commence par : `Docker error: ...`
- Le type d'erreur est : `docker`

### Exit Code anormal

Si le conteneur se termine avec un code de sortie autre que 0 ou 1 :
- L'analyse est marquée comme **FAILED**
- Le message d'erreur indique : `Container exited with code {exitCode}`
- Le type d'erreur est : `exit_code`

Note : le code 1 est accepté car certains linters retournent 1 lorsqu'ils trouvent des problèmes.

## Logs et diagnostics

Tous les échecs d'analyseur sont loggés avec les informations suivantes :
- `analysisId` : ID de l'analyse
- `analyzer` : Clé de l'analyseur
- `dockerImage` : Image Docker utilisée
- `exitCode` : Code de sortie du conteneur
- `error` : Message d'erreur
- `errorType` : Type d'erreur (`timeout`, `oom`, `docker`, `exit_code`, `unknown`)
- `containerId` : ID du conteneur Docker
- `logPath` : Chemin vers les logs du conteneur

Les logs du conteneur sont toujours sauvegardés dans `{outDir}/run.log` et uploadés vers S3/MinIO.

## Non-régression

Si aucune variable d'environnement n'est définie, le comportement est identique à la version précédente :
- Timeout par défaut de 10 minutes
- Pas de limite mémoire
- Pas de limite CPU

Cela garantit la compatibilité avec les installations existantes.

## Exemples de configuration

### Configuration pour environnement de développement

```bash
# Timeout court pour détecter rapidement les problèmes
ANALYZER_TIMEOUT_MS=120000  # 2 minutes

# Limites légères
ANALYZER_MEMORY_MB=512
ANALYZER_CPU_LIMIT=0.5
```

### Configuration pour environnement de production

```bash
# Timeout généreux
ANALYZER_TIMEOUT_MS=600000  # 10 minutes

# Limites pour éviter la monopolisation des ressources
ANALYZER_MEMORY_MB=2048
ANALYZER_CPU_LIMIT=2
```

### Configuration pour machine avec ressources limitées

```bash
# Timeout modéré
ANALYZER_TIMEOUT_MS=300000  # 5 minutes

# Limites strictes
ANALYZER_MEMORY_MB=512
ANALYZER_CPU_LIMIT=0.5
```

## Monitoring

Pour surveiller l'utilisation des ressources et les échecs d'analyseur :

1. Vérifiez les logs du worker pour les messages d'erreur avec `errorType`
2. Consultez les fichiers `run.log` uploadés vers S3/MinIO
3. Surveillez les analyses marquées comme FAILED dans la base de données

## Dépannage

### Les analyseurs se font tuer régulièrement (timeout)

- Augmentez `ANALYZER_TIMEOUT_MS`
- Vérifiez que les analyseurs ne sont pas bloqués (deadlock, attente réseau, etc.)

### Les analyseurs se font tuer pour OOM

- Augmentez `ANALYZER_MEMORY_MB`
- Vérifiez si l'analyseur a une fuite mémoire
- Optimisez la configuration de l'analyseur si possible

### Les analyses sont très lentes

- Augmentez `ANALYZER_CPU_LIMIT`
- Vérifiez la charge CPU de la machine hôte
- Réduisez `WORKER_CONCURRENCY` si plusieurs workers tournent en parallèle

## Implémentation technique

Les limites sont appliquées via les options Docker :
- `HostConfig.Memory` : limite mémoire en octets
- `HostConfig.NanoCpus` : limite CPU en nanocpus (1 CPU = 1e9 nanocpus)

Le timeout est géré par un `setTimeout` qui tue le conteneur avec `docker kill`.
