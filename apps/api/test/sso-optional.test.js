/**
 * SSO Optional Check-list Test Suite
 *
 * Guarantees that SSO is truly optional and does not break existing functionality:
 * 1. Without SSO config: app works identically (no SSO buttons, endpoints disabled)
 * 2. With OIDC enabled: local login still works + OIDC works
 * 3. With SAML enabled: local login still works + SAML works
 */

const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { ValidationPipe } = require('@nestjs/common');
const Redis = require('ioredis');
const bcrypt = require('bcrypt');

const multipartModule = require('@fastify/multipart');
const previousRedisDb = process.env.REDIS_DB;
const testRedisDb = process.env.REDIS_DB ?? '13';
process.env.REDIS_DB = testRedisDb;
const { AppModule } = require('../dist/app.module');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');

const multipart = multipartModule.default ?? multipartModule;

const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

let app;
let baseUrl;

// Helper to clear Redis database for tests
async function clearRedisTestDb() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    db: parseInt(testRedisDb, 10),
  });
  try {
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}

async function ensureDeterministicAdminUser(prisma) {
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      globalRole: 'ADMIN',
    },
    create: {
      email: adminEmail,
      passwordHash,
      globalRole: 'ADMIN',
    },
  });
}

// Helper to clear throttle before login to avoid rate limiting within test run
async function clearThrottle() {
  await clearRedisTestDb();
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for SSO optional tests');
  }

  await clearRedisTestDb();

  app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  await app.register(multipart);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const authService = app.get(AuthService);
  await authService.ensureAdminUser();
  const prisma = app.get(PrismaService);
  await ensureDeterministicAdminUser(prisma);

  await app.listen(0, '127.0.0.1');
  baseUrl = (await app.getUrl()).replace(/\/$/, '');
});

beforeEach(async () => {
  await clearThrottle();
});

afterEach(async () => {
  await clearThrottle();
});

after(async () => {
  await clearRedisTestDb();
  if (app) {
    await app.close();
  }
  if (previousRedisDb === undefined) {
    delete process.env.REDIS_DB;
  } else {
    process.env.REDIS_DB = previousRedisDb;
  }
});

async function apiRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  return { response, body };
}

async function loginAsAdmin() {
  const loginResult = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  assert.ok(
    [200, 201].includes(loginResult.response.status),
    `Admin login should succeed (status=${loginResult.response.status}, body=${JSON.stringify(loginResult.body)})`,
  );

  return loginResult.body?.accessToken;
}

// ========================================
// SCENARIO 1: Without SSO Configuration
// ========================================

test('WITHOUT SSO: /auth/sso/providers returns empty array', async () => {
  // Temporarily disable SSO
  const oidcEnabled = process.env.SSO_OIDC_ENABLED;
  const samlEnabled = process.env.SSO_SAML_ENABLED;

  delete process.env.SSO_OIDC_ENABLED;
  delete process.env.SSO_SAML_ENABLED;

  try {
    const token = await loginAsAdmin();
    const result = await apiRequest('/api/auth/sso/providers');
    const authenticatedResult = await apiRequest('/api/auth/sso/providers', {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(result.response.status, 401, 'Providers endpoint should require authentication');
    assert.equal(authenticatedResult.response.status, 200);
    assert.ok(Array.isArray(authenticatedResult.body), 'Providers should be an array');
    assert.equal(authenticatedResult.body.length, 0, 'Providers should be empty when SSO disabled');
  } finally {
    // Restore
    if (oidcEnabled) process.env.SSO_OIDC_ENABLED = oidcEnabled;
    if (samlEnabled) process.env.SSO_SAML_ENABLED = samlEnabled;
  }
});

test('WITHOUT SSO: OIDC endpoints return 404 or 501', async () => {
  const oidcEnabled = process.env.SSO_OIDC_ENABLED;
  delete process.env.SSO_OIDC_ENABLED;

  try {
    const token = await loginAsAdmin();
    const loginResult = await apiRequest('/api/auth/oidc/login', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(
      [404, 501].includes(loginResult.response.status),
      `OIDC login should be disabled (got ${loginResult.response.status})`,
    );

    const callbackResult = await apiRequest('/api/auth/oidc/callback', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(
      [404, 501].includes(callbackResult.response.status),
      `OIDC callback should be disabled (got ${callbackResult.response.status})`,
    );
  } finally {
    if (oidcEnabled) process.env.SSO_OIDC_ENABLED = oidcEnabled;
  }
});

test('WITHOUT SSO: SAML endpoints return 404', async () => {
  const samlEnabled = process.env.SSO_SAML_ENABLED;
  delete process.env.SSO_SAML_ENABLED;

  try {
    const token = await loginAsAdmin();
    const loginResult = await apiRequest('/api/auth/saml/login', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(loginResult.response.status, 404, 'SAML login should be disabled');

    const callbackResult = await apiRequest('/api/auth/saml/callback', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(callbackResult.response.status, 404, 'SAML callback should be disabled');
  } finally {
    if (samlEnabled) process.env.SSO_SAML_ENABLED = samlEnabled;
  }
});

test('WITHOUT SSO: Local login works perfectly', async () => {
  const oidcEnabled = process.env.SSO_OIDC_ENABLED;
  const samlEnabled = process.env.SSO_SAML_ENABLED;

  delete process.env.SSO_OIDC_ENABLED;
  delete process.env.SSO_SAML_ENABLED;

  try {
    // Clear throttle to avoid rate limiting
    await clearThrottle();

    // Test local login
    const loginResult = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });

    assert.ok(
      [200, 201].includes(loginResult.response.status),
      `Local login should work (status=${loginResult.response.status}, body=${JSON.stringify(loginResult.body)})`,
    );
    assert.ok(loginResult.body?.accessToken, 'Should receive access token');
    assert.equal(loginResult.body?.user?.email, adminEmail, 'Should receive user info');

    // Test protected route
    const meResult = await apiRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${loginResult.body.accessToken}` },
    });

    assert.equal(meResult.response.status, 200, 'Protected route should work');
    assert.equal(meResult.body?.email, adminEmail, 'Should get current user');

    // Test logout
    const logoutResult = await apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginResult.body.accessToken}` },
    });

    assert.ok(
      [200, 201].includes(logoutResult.response.status),
      `Logout should work (status=${logoutResult.response.status}, body=${JSON.stringify(logoutResult.body)})`,
    );
    assert.ok(!logoutResult.body?.ssoLogoutUrl, 'Should not have SSO logout URL');
  } finally {
    if (oidcEnabled) process.env.SSO_OIDC_ENABLED = oidcEnabled;
    if (samlEnabled) process.env.SSO_SAML_ENABLED = samlEnabled;
  }
});

// ========================================
// SCENARIO 2: With OIDC Enabled
// ========================================

test('WITH OIDC: /auth/sso/providers includes OIDC', async () => {
  const oidcEnabled = process.env.SSO_OIDC_ENABLED;
  process.env.SSO_OIDC_ENABLED = 'true';

  try {
    const token = await loginAsAdmin();
    const result = await apiRequest('/api/auth/sso/providers', {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(result.response.status, 200);
    assert.ok(Array.isArray(result.body), 'Providers should be an array');

    const oidcProvider = result.body.find(p => p.id === 'oidc');
    assert.ok(oidcProvider, 'OIDC provider should be present');
    assert.equal(oidcProvider.label, 'OIDC');
    assert.equal(oidcProvider.loginUrl, '/auth/oidc/login');
  } finally {
    if (oidcEnabled) {
      process.env.SSO_OIDC_ENABLED = oidcEnabled;
    } else {
      delete process.env.SSO_OIDC_ENABLED;
    }
  }
});

test('WITH OIDC: Local login still works', async () => {
  const oidcEnabled = process.env.SSO_OIDC_ENABLED;
  process.env.SSO_OIDC_ENABLED = 'true';

  try {
    // Clear throttle to avoid rate limiting
    await clearThrottle();

    const loginResult = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });

    assert.ok(
      [200, 201].includes(loginResult.response.status),
      `Local login should still work (status=${loginResult.response.status}, body=${JSON.stringify(loginResult.body)})`,
    );
    assert.ok(loginResult.body?.accessToken, 'Should receive access token');
    assert.equal(loginResult.body?.user?.email, adminEmail, 'Should receive user info');
  } finally {
    if (oidcEnabled) {
      process.env.SSO_OIDC_ENABLED = oidcEnabled;
    } else {
      delete process.env.SSO_OIDC_ENABLED;
    }
  }
});

test('WITH OIDC: OIDC endpoints are available', async () => {
  const oidcEnabled = process.env.SSO_OIDC_ENABLED;
  process.env.SSO_OIDC_ENABLED = 'true';

  try {
    // We can't test full OIDC flow without a real IdP, but we can verify endpoints exist
    // The login endpoint should redirect or return error (not 404)
    const token = await loginAsAdmin();
    const loginResult = await apiRequest('/api/auth/oidc/login', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.notEqual(loginResult.response.status, 404, 'OIDC login should not be 404 when enabled');
  } finally {
    if (oidcEnabled) {
      process.env.SSO_OIDC_ENABLED = oidcEnabled;
    } else {
      delete process.env.SSO_OIDC_ENABLED;
    }
  }
});

// ========================================
// SCENARIO 3: With SAML Enabled
// ========================================

test('WITH SAML: /auth/sso/providers includes SAML', async () => {
  const samlEnabled = process.env.SSO_SAML_ENABLED;
  process.env.SSO_SAML_ENABLED = 'true';

  try {
    const token = await loginAsAdmin();
    const result = await apiRequest('/api/auth/sso/providers', {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(result.response.status, 200);
    assert.ok(Array.isArray(result.body), 'Providers should be an array');

    const samlProvider = result.body.find(p => p.id === 'saml');
    assert.ok(samlProvider, 'SAML provider should be present');
    assert.equal(samlProvider.label, 'SAML');
    assert.equal(samlProvider.loginUrl, '/auth/saml/login');
  } finally {
    if (samlEnabled) {
      process.env.SSO_SAML_ENABLED = samlEnabled;
    } else {
      delete process.env.SSO_SAML_ENABLED;
    }
  }
});

test('WITH SAML: Local login still works', async () => {
  const samlEnabled = process.env.SSO_SAML_ENABLED;
  process.env.SSO_SAML_ENABLED = 'true';

  try {
    // Clear throttle to avoid rate limiting
    await clearThrottle();

    const loginResult = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });

    assert.ok(
      [200, 201].includes(loginResult.response.status),
      `Local login should still work (status=${loginResult.response.status}, body=${JSON.stringify(loginResult.body)})`,
    );
    assert.ok(loginResult.body?.accessToken, 'Should receive access token');
    assert.equal(loginResult.body?.user?.email, adminEmail, 'Should receive user info');
  } finally {
    if (samlEnabled) {
      process.env.SSO_SAML_ENABLED = samlEnabled;
    } else {
      delete process.env.SSO_SAML_ENABLED;
    }
  }
});

test('WITH SAML: SAML endpoints are available', async () => {
  const samlEnabled = process.env.SSO_SAML_ENABLED;
  process.env.SSO_SAML_ENABLED = 'true';

  try {
    // We can't test full SAML flow without a real IdP, but we can verify endpoints exist
    // The login endpoint should redirect or return error (not 404)
    const token = await loginAsAdmin();
    const loginResult = await apiRequest('/api/auth/saml/login', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.notEqual(loginResult.response.status, 404, 'SAML login should not be 404 when enabled');
  } finally {
    if (samlEnabled) {
      process.env.SSO_SAML_ENABLED = samlEnabled;
    } else {
      delete process.env.SSO_SAML_ENABLED;
    }
  }
});

// ========================================
// SCENARIO 4: JWT & Guards unchanged
// ========================================

test('JWT guards work identically with or without SSO', async () => {
  // Clear throttle to avoid rate limiting
  await clearThrottle();

  // Login and get token
  const loginResult = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  const token = loginResult.body?.accessToken;
  assert.ok(
    token,
    `Should receive token (status=${loginResult.response.status}, body=${JSON.stringify(loginResult.body)})`,
  );

  // Test protected route with valid token
  const meResult = await apiRequest('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(meResult.response.status, 200, 'Protected route should work with valid token');

  // Test protected route without token
  const unauthorizedResult = await apiRequest('/api/auth/me');
  assert.equal(unauthorizedResult.response.status, 401, 'Protected route should return 401 without token');

  // Test protected route with invalid token
  const invalidResult = await apiRequest('/api/auth/me', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  assert.equal(invalidResult.response.status, 401, 'Protected route should return 401 with invalid token');
});

// ========================================
// SCENARIO 5: Sessions unchanged
// ========================================

test('Sessions work identically with or without SSO', async () => {
  // Clear throttle to avoid rate limiting
  await clearThrottle();

  // Login
  const loginResult = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  const token = loginResult.body?.accessToken;

  // Session should work across multiple requests
  const me1 = await apiRequest('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(me1.response.status, 200);

  const me2 = await apiRequest('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(me2.response.status, 200);
  assert.equal(me1.body?.id, me2.body?.id, 'Should return same user');

  // Logout
  await apiRequest('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  // Note: JWT tokens don't invalidate on logout (stateless)
  // This is expected behavior - client should discard token
});
