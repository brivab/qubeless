const { PrismaClient, UserRole, OrgRole } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';

  const existing = await prisma.user.findUnique({ where: { email } });
  let adminUser;

  if (existing) {
    console.log(`Admin user already exists (${email})`);
    // Ensure admin has ADMIN globalRole (migration compatibility)
    if (existing.globalRole !== UserRole.ADMIN) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { globalRole: UserRole.ADMIN },
      });
      console.log(`Updated existing admin user to globalRole=ADMIN`);
    }
    adminUser = existing;
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    adminUser = await prisma.user.create({
      data: { email, passwordHash, globalRole: UserRole.ADMIN },
    });

    console.log(`Admin user seeded (${email})`);
  }

  // Ensure default organization exists
  const defaultOrg = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Organization',
      slug: 'default',
      description: 'Default organization for initial setup',
    },
  });

  console.log(`Default organization ensured (${defaultOrg.slug})`);

  // Ensure admin is OWNER of default org
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: defaultOrg.id,
        userId: adminUser.id,
      },
    },
    update: { role: OrgRole.OWNER },
    create: {
      organizationId: defaultOrg.id,
      userId: adminUser.id,
      role: OrgRole.OWNER,
    },
  });

  console.log(`Admin user is OWNER of default organization`);

  await seedAnalyzersFromWorkspace(defaultOrg.id);
}

function toTitleCase(key) {
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function seedAnalyzersFromWorkspace(organizationId) {
  // Support both production (/app/analyzers) and local development (../../analyzers)
  let analyzersDir = '/app/analyzers';
  if (!fs.existsSync(analyzersDir)) {
    // Try local development path (from apps/api/prisma)
    analyzersDir = path.resolve(__dirname, '../../../analyzers');
  }

  if (!fs.existsSync(analyzersDir)) {
    console.log(`[analyzers] directory not found, skipping seed (tried: /app/analyzers and ${analyzersDir})`);
    return;
  }

  console.log(`[analyzers] scanning directory: ${analyzersDir}`);

  const entries = fs.readdirSync(analyzersDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  if (entries.length === 0) {
    console.log('[analyzers] no analyzer directories found, nothing to seed');
    return;
  }

  // Use ANALYZER_IMAGE_REGISTRY (default: qubeless) with analyzer- prefix
  // This matches the convention: qubeless/analyzer-<name>:<tag>
  const registry = process.env.ANALYZER_IMAGE_REGISTRY ?? 'qubeless';
  const tag = process.env.ANALYZER_IMAGE_TAG ?? 'latest';

  for (const entry of entries) {
    const key = entry.name;
    if (key.startsWith('.')) continue;

    const dockerfilePath = path.join(analyzersDir, key, 'Dockerfile');
    if (!fs.existsSync(dockerfilePath)) {
      console.log(`[analyzers] skip "${key}" (no Dockerfile found)`);
      continue;
    }

    // Convention: <registry>/analyzer-<name>:<tag>
    const dockerImage = `${registry}/analyzer-${key}:${tag}`;
    const name = toTitleCase(key);

    await prisma.analyzer.upsert({
      where: { key },
      update: { name, dockerImage, organizationId },
      create: { key, name, dockerImage, enabled: true, organizationId },
    });

    console.log(`[analyzers] seeded ${key} -> ${dockerImage}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
