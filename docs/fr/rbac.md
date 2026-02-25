# RBAC (Role-Based Access Control)

## Vue d'ensemble

Le système RBAC de Qubeless fournit un contrôle d'accès granulaire avec :
- **Rôles globaux** : ADMIN ou USER (au niveau utilisateur)
- **Rôles de projet** : PROJECT_ADMIN, PROJECT_MAINTAINER, ou PROJECT_VIEWER (par projet)
- **Mode de compatibilité** : pour une migration progressive sans régression

## Modèle de données

### Rôles globaux (UserRole)

```prisma
enum UserRole {
  ADMIN  // Accès complet à tous les projets
  USER   // Utilisateur standard (par défaut)
}
```

Le rôle global est stocké dans `User.globalRole`.

### Rôles de projet (ProjectRole)

```prisma
enum ProjectRole {
  PROJECT_ADMIN       // Peut gérer le projet et ses membres
  PROJECT_MAINTAINER  // Peut modifier le projet
  PROJECT_VIEWER      // Lecture seule
}
```

### ProjectMembership

```prisma
model ProjectMembership {
  id        String      @id @default(uuid())
  userId    String      @db.Uuid
  projectId String
  role      ProjectRole
  createdAt DateTime    @default(now())

  @@unique([userId, projectId])
}
```

## Configuration

### Variable d'environnement

```bash
# Mode d'autorisation (défaut: COMPAT)
AUTHZ_MODE=COMPAT  # ou STRICT
```

### Modes de fonctionnement

#### Mode COMPAT (Compatibilité)

- **Comportement** : Tous les utilisateurs authentifiés peuvent accéder à tous les projets
- **Usage** : Mode par défaut pour éviter les régressions lors de la migration
- **Memberships** : Utilisés pour l'UI mais non obligatoires pour l'accès

**Quand utiliser** :
- Phase de transition
- Lorsque vous créez les memberships de projet
- Pour tester le système sans bloquer l'accès

#### Mode STRICT

- **Comportement** : L'accès aux projets nécessite :
  - Être ADMIN (rôle global), OU
  - Avoir un ProjectMembership sur le projet
- **Usage** : Mode de production avec contrôle d'accès complet
- **Memberships** : Obligatoires pour les utilisateurs non-admin

**Quand utiliser** :
- Une fois tous les memberships créés
- En production avec une gestion stricte des accès

## Utilisation dans NestJS

### Importer le module

```typescript
import { AuthorizationModule } from './modules/authorization';

@Module({
  imports: [AuthorizationModule],
})
export class AppModule {}
```

### Protéger une route

#### Accès basique au projet

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ProjectMembershipGuard } from './modules/authorization';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class ProjectController {
  @Get()
  async getProject(@Param('projectId') projectId: string) {
    // L'utilisateur a accès au projet (vérifié par le guard)
  }
}
```

#### Exiger un rôle spécifique

```typescript
import { ProjectRoles } from './modules/authorization';
import { ProjectRole } from '@prisma/client';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class ProjectController {
  @Delete()
  @ProjectRoles(ProjectRole.PROJECT_ADMIN)
  async deleteProject(@Param('projectId') projectId: string) {
    // Seuls les PROJECT_ADMIN peuvent accéder
  }

  @Put()
  @ProjectRoles(ProjectRole.PROJECT_ADMIN, ProjectRole.PROJECT_MAINTAINER)
  async updateProject(@Param('projectId') projectId: string) {
    // PROJECT_ADMIN et PROJECT_MAINTAINER peuvent accéder
  }
}
```

### Vérifier les permissions programmatiquement

```typescript
import { AuthorizationService } from './modules/authorization';

@Injectable()
export class MyService {
  constructor(private readonly authz: AuthorizationService) {}

  async doSomething(userId: string, projectId: string, userRole: UserRole) {
    // Vérifier l'accès au projet
    const hasAccess = await this.authz.canAccessProject(
      userId,
      projectId,
      userRole,
    );

    if (!hasAccess) {
      throw new ForbiddenException();
    }

    // Vérifier un rôle spécifique
    const isAdmin = await this.authz.hasProjectRole(
      userId,
      projectId,
      ProjectRole.PROJECT_ADMIN,
    );

    // Obtenir le membership
    const membership = await this.authz.getProjectMembership(userId, projectId);
  }
}
```

## Migration

### Étape 1 : Appliquer la migration Prisma

```bash
cd apps/api
npx prisma migrate deploy
```

Cela va :
- Ajouter l'enum `ProjectRole`
- Ajouter `USER` à l'enum `UserRole`
- Renommer `User.role` en `User.globalRole`
- Créer la table `ProjectMembership`

### Étape 2 : Seed de l'admin

```bash
cd apps/api
npm run seed
```

Le script de seed va automatiquement promouvoir l'utilisateur admin existant à `globalRole=ADMIN`.

### Étape 3 : Créer les memberships (optionnel en mode COMPAT)

En mode COMPAT, vous pouvez progressivement créer les memberships :

```typescript
await prisma.projectMembership.create({
  data: {
    userId: 'user-id',
    projectId: 'project-id',
    role: ProjectRole.PROJECT_ADMIN,
  },
});
```

### Étape 4 : Passer en mode STRICT

Une fois tous les memberships créés :

```bash
# Dans .env
AUTHZ_MODE=STRICT
```

Redémarrez l'application. Les utilisateurs sans membership ne pourront plus accéder aux projets.

## Règles d'autorisation

### Hiérarchie des rôles globaux

1. **ADMIN** : Bypass complet, accès à tous les projets
2. **USER** : Accès basé sur les memberships (en mode STRICT)

### Hiérarchie des rôles de projet

Les rôles de projet ne sont **pas hiérarchiques** par défaut. Si vous utilisez `@ProjectRoles()`, vous devez lister explicitement tous les rôles autorisés :

```typescript
// ❌ Mauvais : seul PROJECT_ADMIN peut accéder
@ProjectRoles(ProjectRole.PROJECT_ADMIN)

// ✅ Bon : PROJECT_ADMIN et PROJECT_MAINTAINER peuvent accéder
@ProjectRoles(ProjectRole.PROJECT_ADMIN, ProjectRole.PROJECT_MAINTAINER)
```

## Tests

Des tests unitaires complets sont fournis :

```bash
# Tester le service
npm test -- authorization.service.spec.ts

# Tester le guard
npm test -- project-membership.guard.spec.ts
```

Les tests couvrent :
- ✅ Bypass pour ADMIN en mode COMPAT et STRICT
- ✅ Accès pour tous en mode COMPAT
- ✅ Vérification des memberships en mode STRICT
- ✅ Vérification des rôles requis
- ✅ Extraction du projectId depuis params/query/body

## Troubleshooting

### Erreur : "Project ID not found in request"

Le guard cherche le `projectId` dans :
1. `request.params.projectId`
2. `request.params.id` (pour les routes `/projects/:id`)
3. `request.query.projectId`
4. `request.body.projectId`

Assurez-vous que votre route contient le projectId dans l'un de ces emplacements.

### Erreur : "You do not have permission to access this project" (mode STRICT)

- Vérifiez que l'utilisateur a un ProjectMembership
- Vérifiez que le rôle du membership correspond aux rôles requis par `@ProjectRoles()`
- Les ADMIN ont toujours accès (vérifiez le `globalRole`)

### Les utilisateurs ne peuvent plus accéder aux projets après migration

Vous êtes probablement en mode STRICT sans avoir créé les memberships. Solutions :
1. Passer temporairement en mode COMPAT
2. Créer les memberships nécessaires
3. Repasser en mode STRICT

## Bonnes pratiques

1. **Démarrer en COMPAT** : Utilisez `AUTHZ_MODE=COMPAT` lors du déploiement initial
2. **Créer les memberships progressivement** : Ajoutez les utilisateurs aux projets
3. **Tester en STRICT** : Testez en environnement de staging avant la production
4. **ADMIN avec parcimonie** : Limitez le nombre d'utilisateurs avec `globalRole=ADMIN`
5. **Documenter les rôles** : Clarifiez qui a besoin de quel rôle de projet

## API Types (packages/shared)

Les types TypeScript sont disponibles dans `@qubeless/shared` :

```typescript
import { UserRole, ProjectRole, ProjectMembershipDTO } from '@qubeless/shared';

// UserRole = 'ADMIN' | 'USER'
// ProjectRole = 'PROJECT_ADMIN' | 'PROJECT_MAINTAINER' | 'PROJECT_VIEWER'
```

## Prochaines étapes possibles

- Ajouter une UI pour gérer les memberships
- Implémenter des rôles personnalisés
- Ajouter des permissions granulaires (au-delà des rôles)
- Logger les tentatives d'accès refusées
- Ajouter des endpoints API pour gérer les memberships
