# Système d'Audit

Système d'audit minimal et fiable pour tracer les actions sensibles dans Qubeless.

## Modèle de données

### AuditLog
- `id` (UUID) - Identifiant unique
- `actorUserId` (UUID, nullable) - ID de l'utilisateur qui effectue l'action
- `action` (AuditAction) - Type d'action effectuée
- `targetType` (string, nullable) - Type d'entité ciblée (ex: "Project", "User")
- `targetId` (string, nullable) - ID de l'entité ciblée
- `metadata` (JSON, nullable) - Métadonnées contextuelles (limitées et sanitizées)
- `createdAt` (DateTime) - Date de création de l'entrée d'audit
- `actor` (User relation) - Relation vers l'utilisateur acteur

### Actions auditées

```typescript
enum AuditAction {
  // Authentification
  AUTH_LOGIN
  AUTH_LOGOUT

  // Projets
  PROJECT_CREATE
  PROJECT_UPDATE
  PROJECT_DELETE

  // Quality Gates
  QUALITY_GATE_CREATE
  QUALITY_GATE_UPDATE
  QUALITY_GATE_DELETE

  // Analyzers
  ANALYZER_ENABLE
  ANALYZER_DISABLE
  ANALYZER_CONFIG_UPDATE

  // Tokens API
  TOKEN_CREATE
  TOKEN_DELETE

  // Membres de projet
  PROJECT_MEMBER_ADD
  PROJECT_MEMBER_UPDATE
  PROJECT_MEMBER_REMOVE
}
```

## Événements audités

Le système trace les actions suivantes:

### Authentification
- **Login** (`AUTH_LOGIN`) - Connexion locale ou SSO
  - Metadata: `{ method: 'local' | 'sso' }`

- **Logout** (`AUTH_LOGOUT`) - Déconnexion
  - Metadata: `{ method: 'local' | 'sso', provider?: 'OIDC' | 'SAML' }`

### Projets
- **Création** (`PROJECT_CREATE`)
  - Metadata: `{ projectKey, projectName }`

- **Modification** (`PROJECT_UPDATE`)
  - Metadata: `{ projectKey, changedFields }`

### Membres de projet
- **Ajout** (`PROJECT_MEMBER_ADD`)
  - Metadata: `{ projectKey, projectId, memberEmail, memberUserId, role }`

- **Modification** (`PROJECT_MEMBER_UPDATE`)
  - Metadata: `{ projectKey, projectId, memberEmail, memberUserId, oldRole, newRole }`

- **Suppression** (`PROJECT_MEMBER_REMOVE`)
  - Metadata: `{ projectKey, projectId, memberEmail, memberUserId, role }`

## Sécurité et sanitization

### Données sensibles exclues
Le système **ne logue JAMAIS** les données sensibles suivantes:
- Mots de passe (`password`, `passwordHash`)
- Tokens (`token`, `access_token`, `refresh_token`, `id_token`)
- Secrets (`secret`, `apiKey`)
- Assertions SAML (`assertion`, `samlResponse`)

### Sanitization automatique
La méthode `sanitizeMetadata()` supprime automatiquement les champs sensibles des métadonnées avant enregistrement, y compris dans les objets imbriqués.

## Utilisation

### Enregistrer une action d'audit

```typescript
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class MyService {
  constructor(private readonly auditService: AuditService) {}

  async createProject(data: CreateProjectDto, userId?: string) {
    // ... création du projet

    await this.auditService.log({
      actorUserId: userId,
      action: AuditAction.PROJECT_CREATE,
      targetType: 'Project',
      targetId: project.id,
      metadata: {
        projectKey: project.key,
        projectName: project.name,
      },
    });

    return project;
  }
}
```

### Consulter les logs d'audit

```typescript
// Récupérer tous les logs d'un utilisateur
const logs = await auditService.findMany({
  actorUserId: 'user-123',
  limit: 50,
  offset: 0,
});

// Filtrer par action
const logins = await auditService.findMany({
  action: AuditAction.AUTH_LOGIN,
});

// Filtrer par cible
const projectLogs = await auditService.findMany({
  targetType: 'Project',
  targetId: 'project-123',
});

// Récupérer un log spécifique
const log = await auditService.findById('audit-log-id');
```

### API REST

#### Lister les logs d'audit
```
GET /audit/logs?actorUserId=xxx&action=AUTH_LOGIN&limit=100&offset=0
```

Paramètres query optionnels:
- `actorUserId` - Filtrer par utilisateur
- `action` - Filtrer par type d'action
- `targetType` - Filtrer par type de cible
- `targetId` - Filtrer par ID de cible
- `limit` - Nombre de résultats (défaut: 100)
- `offset` - Décalage pour pagination

Réponse:
```json
{
  "data": [
    {
      "id": "audit-123",
      "actorUserId": "user-123",
      "action": "AUTH_LOGIN",
      "targetType": null,
      "targetId": null,
      "metadata": { "method": "local" },
      "createdAt": "2025-12-25T10:00:00.000Z",
      "actor": {
        "id": "user-123",
        "email": "user@example.com"
      }
    }
  ],
  "total": 1
}
```

#### Récupérer un log spécifique
```
GET /audit/logs/:id
```

## Intégration dans les modules

Pour ajouter l'audit à un module:

1. **Importer AuditModule** dans le module
```typescript
@Module({
  imports: [PrismaModule, AuditModule],
  // ...
})
export class MyModule {}
```

2. **Injecter AuditService** dans le service
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditService: AuditService,
) {}
```

3. **Appeler `auditService.log()`** après les opérations sensibles

4. **Passer l'userId** depuis le contrôleur en utilisant `@CurrentUser()`
```typescript
@Post()
async create(
  @Body() dto: CreateDto,
  @CurrentUser() user?: AuthPayload,
) {
  return this.service.create(dto, user?.sub);
}
```

## Tests unitaires

Les tests se trouvent dans [audit.service.spec.ts](./audit.service.spec.ts) et couvrent:
- Création d'entrées d'audit
- Sanitization des données sensibles
- Gestion des acteurs null
- Pagination et filtrage
- Recherche par ID

Exécution des tests:
```bash
npm run test -- audit.service.spec.ts
```

## Prochaines étapes possibles

Pour étendre le système d'audit:

1. **Ajouter plus d'événements**:
   - Quality Gates (create, update, delete)
   - Analyzers (enable, disable, config update)
   - API Tokens (create, delete)
   - Analyses (create, delete)

2. **Ajouter des fonctionnalités**:
   - Export CSV des logs
   - Alertes sur actions critiques
   - Retention policy (suppression automatique après X jours)
   - Dashboard d'audit dans le frontend

3. **Améliorer la sécurité**:
   - Vérification d'intégrité (hash)
   - Signature numérique
   - Immutabilité renforcée
