# Tests E2E Qubeless

Suite de tests end-to-end pour valider toutes les fonctionnalités de l'API Qubeless pendant que l'environnement Docker Compose tourne en local.

## Fonctionnalités testées

### Authentification

- Login admin JWT
- Récupération du profil utilisateur
- Liste des fournisseurs SSO disponibles
- Création et gestion de tokens API

### Gestion des projets

- Création de projet
- Liste et récupération de projets
- Configuration des paramètres (leak period)
- Métriques dans le temps

### Analyseurs

- Création d'analyseurs
- Liste des analyseurs
- Configuration d'analyseurs par projet

### Règles et profils

- Création de règles personnalisées
- Liste des règles
- Création de profils de règles
- Activation de profils
- Activation/désactivation de règles

### Quality Gates

- Création de quality gates
- Ajout de conditions
- Vérification du statut

### Analyses

- Création d'analyses avec rapport
- Liste des analyses
- Récupération des détails
- Résumé des issues
- Liste des issues avec filtres
- Résolution d'issues
- Historique des résolutions
- Artifacts d'analyse

## Prérequis

L'environnement Docker Compose doit être démarré et fonctionnel:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Vérifiez que tous les services sont opérationnels:

- API: http://localhost:3001
- Web: http://localhost:8081
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- MinIO: http://localhost:9000

## Utilisation

### Lancer tous les tests

Depuis la racine du monorepo:

```bash
pnpm test:e2e
```

### Mode rapide (tests essentiels uniquement)

```bash
pnpm test:e2e:quick
```

### Tests par catégorie

```bash
# Tests d'authentification uniquement
pnpm test:e2e:auth

# Tests de projets uniquement
pnpm test:e2e:projects

# Tests d'analyses uniquement
pnpm test:e2e:analyses
```

### Depuis le dossier tests/e2e

```bash
cd tests/e2e

# Installer les dépendances
pnpm install

# Tous les tests
pnpm test

# Tests rapides
pnpm test:quick

# Tests spécifiques
pnpm test:auth
pnpm test:projects
pnpm test:analyses
pnpm test:sso
```

## Options disponibles

### Filtrer par catégorie

```bash
node index.js --only=auth
node index.js --only=projects
node index.js --only=analyses
node index.js --only=analyzers
node index.js --only=rules
node index.js --only=quality-gates
```

### Mode rapide

```bash
node index.js --quick
```

Saute certains tests optionnels pour une exécution plus rapide.

## Variables d'environnement

Les tests utilisent les variables d'environnement suivantes (avec valeurs par défaut):

```bash
API_URL=http://localhost:3001/api
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

Pour personnaliser:

```bash
API_URL=http://localhost:3001/api ADMIN_EMAIL=admin@test.com pnpm test:e2e
```

## Résultats des tests

Les tests affichent des résultats colorés dans le terminal:

- ✓ Vert: Test réussi
- ✗ Rouge: Test échoué
- ⊘ Jaune: Test sauté

Un résumé final est affiché avec:

- Nombre de tests passés
- Nombre de tests échoués
- Nombre de tests sautés
- Durée totale d'exécution
- Taux de réussite

## Exemple de sortie

```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           QUBELESS E2E TESTS                               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

============================================================
  Pre-flight Checks
============================================================

▶ Health Check
  ✓ API is healthy

============================================================
  Authentication Tests
============================================================

▶ Authentication - Login
  ✓ Admin login successful
    Token expires in: 1d

▶ Authentication - Get Current User
  ✓ Get current user successful
    Email: admin@example.com
    Role: ADMIN

...

============================================================
  Test Summary
============================================================
  Passed:  42
  Failed:  0
  Skipped: 3
  Duration: 5.23s
============================================================

✓ All tests passed! (100.0%)
```

## Dépannage

### L'API ne répond pas

Vérifiez que Docker Compose est bien démarré:

```bash
docker-compose -f docker-compose.dev.yml ps
```

### Tests d'authentification échouent

Vérifiez les credentials admin dans le fichier [docker-compose.dev.yml](../../docker-compose.dev.yml):

```yaml
ADMIN_EMAIL: admin@example.com
ADMIN_PASSWORD: admin123
```

### Timeout ou erreurs de connexion

Attendez quelques secondes que tous les services soient complètement démarrés après `docker-compose -f docker-compose.dev.yml up`.

### Base de données vide

Si c'est le premier démarrage, l'API devrait créer automatiquement l'utilisateur admin. Sinon, redémarrez le conteneur API:

```bash
docker-compose -f docker-compose.dev.yml restart api
```

## Développement

### Ajouter de nouveaux tests

1. Créez une nouvelle fonction de test dans [index.js](index.js):

```javascript
async function testMaNouvelleFonctionnalite() {
  logger.subsection('Ma Nouvelle Fonctionnalité');
  try {
    const response = await api.get('/mon-endpoint');

    if (response.status === 200) {
      logger.success('Test réussi');
      return true;
    } else {
      logger.error('Test échoué', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Test échoué', error);
    return false;
  }
}
```

2. Ajoutez l'appel dans la fonction `runTests()`:

```javascript
// Ma nouvelle section de tests
logger.section('Mes Nouveaux Tests');
await testMaNouvelleFonctionnalite();
```

### Structure des fichiers

```
tests/e2e/
├── package.json         # Configuration du package
├── index.js            # Script principal de tests
├── utils.js            # Utilitaires (logger, helpers)
└── README.md           # Documentation (ce fichier)
```

## Intégration CI/CD

Pour intégrer ces tests dans un pipeline CI/CD:

```yaml
# Exemple GitHub Actions
- name: Start services
  run: docker-compose -f docker-compose.dev.yml up -d

- name: Wait for API
  run: |
    timeout 60 bash -c 'until curl -f http://localhost:3001/api/health; do sleep 2; done'

- name: Run E2E tests
  run: pnpm test:e2e

- name: Stop services
  run: docker-compose -f docker-compose.dev.yml down
```

## Licence

Même licence que le projet Qubeless.
