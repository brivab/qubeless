const { PrismaClient } = require('@prisma/client');
const { execFileSync } = require('node:child_process');

const MIGRATIONS_TO_CHECK = {
  '0018_sso_identity': resolveSsoIdentityMigration,
  '20251224143440_add_rbac': resolveRbacMigration,
};

function isMissingMigrationsTable(error) {
  const message = String(error?.message ?? '');
  return /_prisma_migrations/i.test(message) && /does not exist|undefined table|relation/i.test(message);
}

async function resolveSsoIdentityMigration(prisma, migrationName) {
  console.log(`[prisma] found failed "${migrationName}" migration`);

  const tableResult = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'SsoIdentity'
    ) AS exists
  `;
  const tableExists = Boolean(tableResult?.[0]?.exists);

  const enumResult = await prisma.$queryRaw`
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SsoProvider') AS exists
  `;
  const enumExists = Boolean(enumResult?.[0]?.exists);

  if (tableExists) {
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM "SsoIdentity"
    `;
    const rowCount = Number(countResult?.[0]?.count ?? 0);

    if (rowCount > 0) {
      console.error(
        `[prisma] SsoIdentity contains ${rowCount} row(s); aborting auto-fix to avoid data loss`,
      );
      process.exit(1);
    }

    console.warn('[prisma] Dropping SsoIdentity table to retry failed migration');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "SsoIdentity" CASCADE');
  }

  if (enumExists) {
    console.warn('[prisma] Dropping enum SsoProvider to retry failed migration');
    await prisma.$executeRawUnsafe('DROP TYPE IF EXISTS "SsoProvider"');
  }

  console.log(`[prisma] resolving failed migration ${migrationName} (--rolled-back)`);
  execFileSync(
    'pnpm',
    ['--filter', '@qubeless/api', 'exec', 'prisma', 'migrate', 'resolve', '--rolled-back', migrationName],
    { stdio: 'inherit' },
  );
}

async function resolveRbacMigration(prisma, migrationName) {
  console.log(`[prisma] found failed "${migrationName}" migration`);

  // Check ProjectRole enum
  const projectRoleResult = await prisma.$queryRaw`
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectRole') AS exists
  `;
  const projectRoleExists = Boolean(projectRoleResult?.[0]?.exists);

  // Check UserRole_new enum (intermediate state)
  const userRoleNewResult = await prisma.$queryRaw`
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole_new') AS exists
  `;
  const userRoleNewExists = Boolean(userRoleNewResult?.[0]?.exists);

  // Check ProjectMembership table
  const tableResult = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ProjectMembership'
    ) AS exists
  `;
  const projectMembershipExists = Boolean(tableResult?.[0]?.exists);

  // Check for role_old column
  const roleOldResult = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'User' AND column_name = 'role_old'
    ) AS exists
  `;
  const roleOldExists = Boolean(roleOldResult?.[0]?.exists);

  // Clean up partial state
  if (projectMembershipExists) {
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM "ProjectMembership"
    `;
    const rowCount = Number(countResult?.[0]?.count ?? 0);

    if (rowCount > 0) {
      console.error(`[prisma] ProjectMembership contains ${rowCount} row(s); manual intervention required`);
      process.exit(1);
    }

    console.warn('[prisma] Dropping ProjectMembership table to retry migration');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ProjectMembership" CASCADE');
  }

  if (projectRoleExists) {
    console.warn('[prisma] Dropping ProjectRole enum to retry migration');
    await prisma.$executeRawUnsafe('DROP TYPE IF EXISTS "ProjectRole" CASCADE');
  }

  if (userRoleNewExists) {
    console.warn('[prisma] Dropping UserRole_new enum to retry migration');
    await prisma.$executeRawUnsafe('DROP TYPE IF EXISTS "UserRole_new" CASCADE');
  }

  if (roleOldExists) {
    console.warn('[prisma] Restoring User.role column from role_old');
    await prisma.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN IF EXISTS "globalRole"');
    await prisma.$executeRawUnsafe('ALTER TABLE "User" RENAME COLUMN "role_old" TO "role"');
  }

  console.log(`[prisma] resolving failed migration ${migrationName} (--rolled-back)`);
  execFileSync(
    'pnpm',
    ['--filter', '@qubeless/api', 'exec', 'prisma', 'migrate', 'resolve', '--rolled-back', migrationName],
    { stdio: 'inherit' },
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[prisma] DATABASE_URL not set, skipping migration resolve');
    return;
  }

  const prisma = new PrismaClient();
  try {
    let rows;
    try {
      rows = await prisma.$queryRaw`
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        WHERE finished_at IS NULL
          AND rolled_back_at IS NULL
      `;
    } catch (error) {
      if (isMissingMigrationsTable(error)) {
        console.log('[prisma] _prisma_migrations missing, skipping auto-resolve');
        return;
      }
      throw error;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return;
    }

    for (const row of rows) {
      const migrationName = row.migration_name;
      const resolver = MIGRATIONS_TO_CHECK[migrationName];

      if (resolver) {
        await resolver(prisma, migrationName);
      } else {
        console.warn(`[prisma] No auto-resolver for failed migration "${migrationName}"`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[prisma] auto-resolve failed', error);
  process.exit(1);
});
