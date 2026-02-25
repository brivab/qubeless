/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-var-requires */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { ValidationPipe } = require('@nestjs/common');

const multipartModule = require('@fastify/multipart');
const { AppModule } = require('../dist/app.module');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');

const multipart = multipartModule.default ?? multipartModule;

const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';

let app;
let baseUrl;
let prisma;

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for logout tests');
  }

  app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  await app.register(multipart);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const authService = app.get(AuthService);
  await authService.ensureAdminUser();

  prisma = app.get(PrismaService);

  await app.listen(0, '127.0.0.1');
  baseUrl = (await app.getUrl()).replace(/\/$/, '');
});

after(async () => {
  if (app) {
    await app.close();
  }
});

async function apiRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  return { response, body };
}

test('local user logout - no SSO redirect', async () => {
  // Get local admin user
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  assert.ok(adminUser, 'Admin user should exist');

  // Login with this user (using AuthService directly to avoid rate limiting)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const authService = app.get(AuthService);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const loginResponse = await authService.loginWithUser(adminUser);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const token = loginResponse.accessToken;
  assert.ok(token, 'Expected access token');

  // Call logout endpoint
  const logoutResult = await apiRequest('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.ok(
    [200, 201].includes(logoutResult.response.status),
    `Expected 200 or 201, got ${logoutResult.response.status}`,
  );
  assert.ok(!logoutResult.body?.ssoLogoutUrl, 'Local user should not have SSO logout URL');
});

test('SSO user logout - with OIDC logout URL', async () => {
  // Create SSO user with OIDC identity
  const ssoEmail = 'oidc-user@example.com';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const ssoUser = await prisma.user.create({
    data: {
      email: ssoEmail,
      passwordHash: 'not-used',
      globalRole: 'ADMIN',
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await prisma.ssoIdentity.create({
    data: {
      provider: 'OIDC',
      subject: 'oidc-subject-123',
      email: ssoEmail,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userId: ssoUser.id,
    },
  });

  // Login with this user (using AuthService directly)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const authService = app.get(AuthService);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const loginResponse = await authService.loginWithUser(ssoUser);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const token = loginResponse.accessToken;

  // Mock OIDC logout URL in environment (would normally be set in .env)
  const originalEnv = process.env.SSO_OIDC_LOGOUT_URL;
  process.env.SSO_OIDC_LOGOUT_URL = 'https://idp.example.com/oidc/logout';

  try {
    // Call logout endpoint
    const logoutResult = await apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.ok(
      [200, 201].includes(logoutResult.response.status),
      `Expected 200 or 201, got ${logoutResult.response.status}`,
    );
    assert.equal(
      logoutResult.body?.ssoLogoutUrl,
      'https://idp.example.com/oidc/logout',
      'OIDC user should receive logout URL',
    );
  } finally {
    // Restore environment
    if (originalEnv) {
      process.env.SSO_OIDC_LOGOUT_URL = originalEnv;
    } else {
      delete process.env.SSO_OIDC_LOGOUT_URL;
    }

    // Clean up test user
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.ssoIdentity.deleteMany({ where: { userId: ssoUser.id } });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.user.delete({ where: { id: ssoUser.id } });
  }
});

test('SSO user logout - with SAML logout URL', async () => {
  // Create SSO user with SAML identity
  const ssoEmail = 'saml-user@example.com';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const ssoUser = await prisma.user.create({
    data: {
      email: ssoEmail,
      passwordHash: 'not-used',
      globalRole: 'ADMIN',
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await prisma.ssoIdentity.create({
    data: {
      provider: 'SAML',
      subject: 'saml-subject-456',
      email: ssoEmail,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userId: ssoUser.id,
    },
  });

  // Login with this user
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const authService = app.get(AuthService);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const loginResponse = await authService.loginWithUser(ssoUser);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const token = loginResponse.accessToken;

  // Mock SAML logout URL
  const originalEnv = process.env.SSO_SAML_LOGOUT_URL;
  process.env.SSO_SAML_LOGOUT_URL = 'https://idp.example.com/saml/logout';

  try {
    // Call logout endpoint
    const logoutResult = await apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.ok(
      [200, 201].includes(logoutResult.response.status),
      `Expected 200 or 201, got ${logoutResult.response.status}`,
    );
    assert.equal(
      logoutResult.body?.ssoLogoutUrl,
      'https://idp.example.com/saml/logout',
      'SAML user should receive logout URL',
    );
  } finally {
    // Restore environment
    if (originalEnv) {
      process.env.SSO_SAML_LOGOUT_URL = originalEnv;
    } else {
      delete process.env.SSO_SAML_LOGOUT_URL;
    }

    // Clean up test user
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.ssoIdentity.deleteMany({ where: { userId: ssoUser.id } });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.user.delete({ where: { id: ssoUser.id } });
  }
});

test('SSO user logout - no logout URL configured', async () => {
  // Create SSO user with OIDC identity
  const ssoEmail = 'oidc-nourl@example.com';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const ssoUser = await prisma.user.create({
    data: {
      email: ssoEmail,
      passwordHash: 'not-used',
      globalRole: 'ADMIN',
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await prisma.ssoIdentity.create({
    data: {
      provider: 'OIDC',
      subject: 'oidc-subject-nourl',
      email: ssoEmail,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userId: ssoUser.id,
    },
  });

  // Login with this user
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const authService = app.get(AuthService);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const loginResponse = await authService.loginWithUser(ssoUser);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const token = loginResponse.accessToken;

  try {
    // Call logout endpoint without logout URL configured
    const logoutResult = await apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.ok(
      [200, 201].includes(logoutResult.response.status),
      `Expected 200 or 201, got ${logoutResult.response.status}`,
    );
    assert.ok(
      !logoutResult.body?.ssoLogoutUrl,
      'SSO user without configured logout URL should not receive one',
    );
  } finally {
    // Clean up test user
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.ssoIdentity.deleteMany({ where: { userId: ssoUser.id } });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.user.delete({ where: { id: ssoUser.id } });
  }
});
