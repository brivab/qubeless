# Configuration des Tests E2E

Ce guide explique comment configurer et exécuter les tests E2E pour Qubeless.

## Prérequis

Les tests E2E nécessitent que l'ensemble du système soit en cours d'exécution:

1. **PostgreSQL** - Base de données
2. **Redis** - Queue et cache
3. **MinIO** - Stockage S3 (optionnel pour certains tests)
4. **API** - API Qubeless
5. **Worker** - Worker d'analyse (optionnel)

## Configuration Rapide avec Docker Compose

### 1. Démarrer les Services

```bash
# Démarrer tous les services
docker-compose -f docker-compose.dev.yml up -d

# Vérifier que les services sont en cours d'exécution
docker-compose -f docker-compose.dev.yml ps
```

Services démarrés:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO: `localhost:9000`
- API: `localhost:3001`
- Web: `localhost:8081`

### 2. Attendre que l'API soit Prête

```bash
# Vérifier le health check
curl http://localhost:3001/api/health

# Devrait retourner: {"status":"ok","timestamp":"..."}
```

### 3. Lancer les Tests E2E

```bash
pnpm test:e2e
```

## Configuration Manuelle (Développement Local)

Si vous développez sans Docker, suivez ces étapes:

### 1. Démarrer PostgreSQL

```bash
# Via Docker
docker run -d \
  --name qubeless-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=qubeless \
  -p 5432:5432 \
  postgres:15-alpine

# Ou via votre installation locale
pg_ctl start
createdb qubeless
```

### 2. Démarrer Redis

```bash
# Via Docker
docker run -d \
  --name qubeless-redis \
  -p 6379:6379 \
  redis:7-alpine

# Ou via votre installation locale
redis-server
```

### 3. Démarrer MinIO (Optionnel)

```bash
# Via Docker
docker run -d \
  --name qubeless-minio \
  -e MINIO_ROOT_USER=minio \
  -e MINIO_ROOT_PASSWORD=minio123 \
  -p 9000:9000 \
  -p 9001:9001 \
  minio/minio server /data --console-address ":9001"
```

### 4. Configurer les Variables d'Environnement

```bash
cd apps/api
touch .env
```

Éditer `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qubeless
REDIS_HOST=localhost
REDIS_PORT=6379
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
JWT_SECRET=super-secret-change-me
```

### 5. Exécuter les Migrations

```bash
cd apps/api
pnpm prisma migrate deploy
# ou
pnpm prisma migrate dev
```

### 6. Créer l'Utilisateur Admin

L'API crée automatiquement l'utilisateur admin au démarrage si les variables `ADMIN_EMAIL` et `ADMIN_PASSWORD` sont définies.

### 7. Démarrer l'API

```bash
cd apps/api
pnpm dev
```

Vérifier que l'API est accessible:

```bash
curl http://localhost:3001/api/health
```

### 8. Lancer les Tests E2E

```bash
pnpm test:e2e
```

## Configuration des Tests E2E

Les tests E2E peuvent être configurés via variables d'environnement:

```bash
# tests/e2e/.env
API_URL=http://localhost:3001/api
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

Ou directement dans la commande:

```bash
API_URL=http://localhost:3001/api \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD=admin123 \
pnpm test:e2e
```

## Dépannage

### Erreur: "Login failed - Status: 500"

**Causes possibles:**

1. La base de données n'est pas accessible
2. Les migrations ne sont pas appliquées
3. L'utilisateur admin n'existe pas

**Solutions:**

```bash
# Vérifier la connexion à la base de données
psql postgresql://postgres:postgres@localhost:5432/qubeless -c "SELECT 1"

# Réappliquer les migrations
cd apps/api
pnpm prisma migrate deploy

# Vérifier les logs de l'API
# Si l'API tourne en dev: regarder la console
# Si l'API tourne dans Docker: docker-compose -f docker-compose.dev.yml logs api
```

### Erreur: "API is not healthy"

**Causes:**

- L'API n'est pas démarrée
- L'API est sur un autre port
- L'URL de l'API est incorrecte

**Solutions:**

```bash
# Vérifier que l'API écoute sur le bon port
curl http://localhost:3001/api/health

# Vérifier les services Docker
docker-compose -f docker-compose.dev.yml ps

# Redémarrer l'API
docker-compose -f docker-compose.dev.yml restart api
# ou
cd apps/api && pnpm dev
```

### Erreur: "Connection refused"

**Causes:**

- PostgreSQL n'est pas démarré
- Redis n'est pas démarré
- Ports déjà utilisés

**Solutions:**

```bash
# Vérifier les services
docker-compose -f docker-compose.dev.yml ps
netstat -an | grep 5432  # PostgreSQL
netstat -an | grep 6379  # Redis
netstat -an | grep 3001  # API

# Redémarrer tous les services
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
```

### Erreur: "Cannot create user - Email already exists"

**Solution:**
L'utilisateur admin existe déjà. C'est normal, les tests utiliseront cet utilisateur.

### Tests Lents ou Timeout

**Solutions:**

```bash
# Utiliser le mode quick (skip certains tests)
pnpm test:e2e:quick

# Augmenter le timeout dans les tests E2E
# Éditer tests/e2e/index.js et augmenter les timeouts axios
```

## Tests par Suite

Vous pouvez lancer des suites spécifiques:

```bash
# Authentication uniquement
pnpm test:e2e:auth

# Projects uniquement
pnpm test:e2e:projects

# Analyses uniquement
pnpm test:e2e:analyses

# Health & Monitoring
cd tests/e2e && pnpm test:health

# Audit
cd tests/e2e && pnpm test:audit

# RBAC
cd tests/e2e && pnpm test:rbac
```

## CI/CD

### GitHub Actions Exemple

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: qubeless
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run migrations
        run: |
          cd apps/api
          pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/qubeless

      - name: Build API
        run: |
          cd apps/api
          pnpm build

      - name: Start API (background)
        run: |
          cd apps/api
          pnpm start &
          sleep 10
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/qubeless
          REDIS_HOST: localhost
          ADMIN_EMAIL: admin@example.com
          ADMIN_PASSWORD: admin123

      - name: Run E2E Tests
        run: pnpm test:e2e
        env:
          API_URL: http://localhost:3001/api
          ADMIN_EMAIL: admin@example.com
          ADMIN_PASSWORD: admin123
```

## Checklist Avant de Lancer les Tests

- [ ] PostgreSQL est démarré et accessible
- [ ] Redis est démarré
- [ ] Les migrations sont appliquées
- [ ] L'API est démarrée
- [ ] L'endpoint `/api/health` retourne `{"status":"ok"}`
- [ ] Les variables d'environnement sont correctes
- [ ] L'utilisateur admin existe (ou sera créé au démarrage de l'API)

## Résumé des Commandes

```bash
# Setup complet avec Docker Compose
docker-compose -f docker-compose.dev.yml up -d
pnpm test:e2e

# Setup manuel
docker run -d --name qubeless-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=qubeless -p 5432:5432 postgres:15-alpine
docker run -d --name qubeless-redis -p 6379:6379 redis:7-alpine
cd apps/api && pnpm prisma migrate deploy && pnpm dev &
pnpm test:e2e

# Vérification
curl http://localhost:3001/api/health
```

## Support

Si vous rencontrez des problèmes:

1. Vérifiez les logs de l'API
2. Vérifiez que tous les services sont démarrés
3. Vérifiez les variables d'environnement
4. Consultez la section Dépannage ci-dessus
5. Ouvrez une issue sur GitHub avec les logs

## Documentation Complémentaire

- [Guide des tests](./testing.md)
- [Configuration Docker](../../docker-compose.dev.yml)
- [Référence des variables d'environnement production](./deploy.md#exemple-envproduction)
