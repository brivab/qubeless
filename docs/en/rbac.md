# RBAC (Role-Based Access Control)

## Overview

The Qubeless RBAC system provides granular access control with:
- **Global roles**: ADMIN or USER (at the user level)
- **Project roles**: PROJECT_ADMIN, PROJECT_MAINTAINER, or PROJECT_VIEWER (per project)
- **Compatibility mode**: for progressive migration without regression

## Data model

### Global roles (UserRole)

```prisma
enum UserRole {
  ADMIN  // Full access to all projects
  USER   // Standard user (default)
}
```

The global role is stored in `User.globalRole`.

### Project roles (ProjectRole)

```prisma
enum ProjectRole {
  PROJECT_ADMIN       // Can manage the project and its members
  PROJECT_MAINTAINER  // Can modify the project
  PROJECT_VIEWER      // Read-only
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

### Environment variable

```bash
# Authorization mode (default: COMPAT)
AUTHZ_MODE=COMPAT  # or STRICT
```

### Operating modes

#### COMPAT mode (Compatibility)

- **Behavior**: All authenticated users can access all projects
- **Usage**: Default mode to avoid regressions during migration
- **Memberships**: Used for UI but not mandatory for access

**When to use**:
- Transition phase
- When you are creating project memberships
- To test the system without blocking access

#### STRICT mode

- **Behavior**: Project access requires:
  - Being ADMIN (global role), OR
  - Having a ProjectMembership on the project
- **Usage**: Production mode with complete access control
- **Memberships**: Mandatory for non-admin users

**When to use**:
- Once all memberships are created
- In production with strict access management

## Usage in NestJS

### Import the module

```typescript
import { AuthorizationModule } from './modules/authorization';

@Module({
  imports: [AuthorizationModule],
})
export class AppModule {}
```

### Protect a route

#### Basic project access

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ProjectMembershipGuard } from './modules/authorization';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class ProjectController {
  @Get()
  async getProject(@Param('projectId') projectId: string) {
    // User has access to the project (verified by the guard)
  }
}
```

#### Require a specific role

```typescript
import { ProjectRoles } from './modules/authorization';
import { ProjectRole } from '@prisma/client';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectMembershipGuard)
export class ProjectController {
  @Delete()
  @ProjectRoles(ProjectRole.PROJECT_ADMIN)
  async deleteProject(@Param('projectId') projectId: string) {
    // Only PROJECT_ADMIN can access
  }

  @Put()
  @ProjectRoles(ProjectRole.PROJECT_ADMIN, ProjectRole.PROJECT_MAINTAINER)
  async updateProject(@Param('projectId') projectId: string) {
    // PROJECT_ADMIN and PROJECT_MAINTAINER can access
  }
}
```

### Check permissions programmatically

```typescript
import { AuthorizationService } from './modules/authorization';

@Injectable()
export class MyService {
  constructor(private readonly authz: AuthorizationService) {}

  async doSomething(userId: string, projectId: string, userRole: UserRole) {
    // Check project access
    const hasAccess = await this.authz.canAccessProject(
      userId,
      projectId,
      userRole,
    );

    if (!hasAccess) {
      throw new ForbiddenException();
    }

    // Check for a specific role
    const isAdmin = await this.authz.hasProjectRole(
      userId,
      projectId,
      ProjectRole.PROJECT_ADMIN,
    );

    // Get the membership
    const membership = await this.authz.getProjectMembership(userId, projectId);
  }
}
```

## Migration

### Step 1: Apply Prisma migration

```bash
cd apps/api
npx prisma migrate deploy
```

This will:
- Add the `ProjectRole` enum
- Add `USER` to the `UserRole` enum
- Rename `User.role` to `User.globalRole`
- Create the `ProjectMembership` table

### Step 2: Seed the admin

```bash
cd apps/api
npm run seed
```

The seed script will automatically promote the existing admin user to `globalRole=ADMIN`.

### Step 3: Create memberships (optional in COMPAT mode)

In COMPAT mode, you can progressively create memberships:

```typescript
await prisma.projectMembership.create({
  data: {
    userId: 'user-id',
    projectId: 'project-id',
    role: ProjectRole.PROJECT_ADMIN,
  },
});
```

### Step 4: Switch to STRICT mode

Once all memberships are created:

```bash
# In .env
AUTHZ_MODE=STRICT
```

Restart the application. Users without membership will no longer be able to access projects.

## Authorization rules

### Global role hierarchy

1. **ADMIN**: Complete bypass, access to all projects
2. **USER**: Access based on memberships (in STRICT mode)

### Project role hierarchy

Project roles are **not hierarchical** by default. If you use `@ProjectRoles()`, you must explicitly list all authorized roles:

```typescript
// ❌ Wrong: only PROJECT_ADMIN can access
@ProjectRoles(ProjectRole.PROJECT_ADMIN)

// ✅ Correct: PROJECT_ADMIN and PROJECT_MAINTAINER can access
@ProjectRoles(ProjectRole.PROJECT_ADMIN, ProjectRole.PROJECT_MAINTAINER)
```

## Tests

Complete unit tests are provided:

```bash
# Test the service
npm test -- authorization.service.spec.ts

# Test the guard
npm test -- project-membership.guard.spec.ts
```

The tests cover:
- ✅ Bypass for ADMIN in COMPAT and STRICT modes
- ✅ Access for everyone in COMPAT mode
- ✅ Membership verification in STRICT mode
- ✅ Verification of required roles
- ✅ Extraction of projectId from params/query/body

## Troubleshooting

### Error: "Project ID not found in request"

The guard looks for `projectId` in:
1. `request.params.projectId`
2. `request.params.id` (for routes `/projects/:id`)
3. `request.query.projectId`
4. `request.body.projectId`

Make sure your route contains the projectId in one of these locations.

### Error: "You do not have permission to access this project" (STRICT mode)

- Check that the user has a ProjectMembership
- Check that the membership role matches the roles required by `@ProjectRoles()`
- ADMINs always have access (check `globalRole`)

### Users can no longer access projects after migration

You are likely in STRICT mode without having created memberships. Solutions:
1. Temporarily switch to COMPAT mode
2. Create the necessary memberships
3. Switch back to STRICT mode

## Best practices

1. **Start in COMPAT**: Use `AUTHZ_MODE=COMPAT` when deploying initially
2. **Create memberships progressively**: Add users to projects
3. **Test in STRICT**: Test in staging environment before production
4. **ADMIN sparingly**: Limit the number of users with `globalRole=ADMIN`
5. **Document roles**: Clarify who needs which project role

## API Types (packages/shared)

TypeScript types are available in `@qubeless/shared`:

```typescript
import { UserRole, ProjectRole, ProjectMembershipDTO } from '@qubeless/shared';

// UserRole = 'ADMIN' | 'USER'
// ProjectRole = 'PROJECT_ADMIN' | 'PROJECT_MAINTAINER' | 'PROJECT_VIEWER'
```

## Possible next steps

- Add a UI to manage memberships
- Implement custom roles
- Add granular permissions (beyond roles)
- Log denied access attempts
- Add API endpoints to manage memberships
