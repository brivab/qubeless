const { PrismaClient } = require('@prisma/client');
const { execFileSync } = require('node:child_process');

const TARGET_MIGRATION = '20251224143440_add_rbac';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[prisma] DATABASE_URL not set, skipping migration resolve');
    return;
  }

  const prisma = new PrismaClient();
  try {
    // Check if migration failed
    let rows;
    try {
      rows = await prisma.$queryRaw`
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        WHERE migration_name = ${TARGET_MIGRATION}
          AND finished_at IS NULL
          AND rolled_back_at IS NULL
      `;
    } catch (error) {
      console.log('[prisma] Could not check migrations table, skipping auto-resolve');
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      console.log('[prisma] No failed RBAC migration found');
      return;
    }

    console.log(`[prisma] Found failed "${TARGET_MIGRATION}" migration, attempting to resolve...`);

    // Check what was already applied
    const enumResult = await prisma.$queryRaw`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectRole') AS exists
    `;
    const projectRoleExists = Boolean(enumResult?.[0]?.exists);

    const userEnumResult = await prisma.$queryRaw`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'UserRole'
    `;
    const hasUserValue = userEnumResult.some(row => row.enumlabel === 'USER');

    const columnResult = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'User' AND column_name = 'globalRole'
    `;
    const hasGlobalRole = columnResult.length > 0;

    const tableResult = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ProjectMembership'
      ) AS exists
    `;
    const projectMembershipExists = Boolean(tableResult?.[0]?.exists);

    console.log('[prisma] Current state:');
    console.log(`  - ProjectRole enum: ${projectRoleExists ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - UserRole has USER: ${hasUserValue ? 'YES' : 'NO'}`);
    console.log(`  - User.globalRole column: ${hasGlobalRole ? 'EXISTS' : 'MISSING'}`);
    console.log(`  - ProjectMembership table: ${projectMembershipExists ? 'EXISTS' : 'MISSING'}`);

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

      console.log('[prisma] Dropping ProjectMembership table to retry migration');
      await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "ProjectMembership" CASCADE');
    }

    if (projectRoleExists) {
      console.log('[prisma] Dropping ProjectRole enum to retry migration');
      await prisma.$executeRawUnsafe('DROP TYPE IF EXISTS "ProjectRole" CASCADE');
    }

    // Mark migration as rolled back
    console.log('[prisma] Marking migration as rolled back...');
    execFileSync(
      'pnpm',
      ['--filter', '@qubeless/api', 'exec', 'prisma', 'migrate', 'resolve', '--rolled-back', TARGET_MIGRATION],
      { stdio: 'inherit' },
    );

    console.log('[prisma] Migration resolved, please run "prisma migrate deploy" again');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[prisma] RBAC migration auto-resolve failed', error);
  process.exit(1);
});
