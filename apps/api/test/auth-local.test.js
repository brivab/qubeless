const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { ValidationPipe } = require('@nestjs/common');
const Redis = require('ioredis');
const bcrypt = require('bcrypt');

const multipartModule = require('@fastify/multipart');
const previousRedisDb = process.env.REDIS_DB;
const testRedisDb = process.env.REDIS_DB ?? '11';
process.env.REDIS_DB = testRedisDb;
const { AppModule } = require('../dist/app.module');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');

const multipart = multipartModule.default ?? multipartModule;

const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

let app;
let baseUrl;

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

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for auth-local tests');
  }

  app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  await app.register(multipart);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const authService = app.get(AuthService);
  await authService.ensureAdminUser();
  const prisma = app.get(PrismaService);
  await ensureDeterministicAdminUser(prisma);
  await clearRedisTestDb();

  await app.listen(0, '127.0.0.1');
  baseUrl = (await app.getUrl()).replace(/\/$/, '');
});

after(async () => {
  await clearRedisTestDb();
  if (previousRedisDb === undefined) {
    delete process.env.REDIS_DB;
  } else {
    process.env.REDIS_DB = previousRedisDb;
  }
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

function getCookieHeader(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    const cookies = response.headers.getSetCookie();
    if (cookies?.length) {
      return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
    }
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return null;
  return setCookie.split(';')[0];
}

test('auth local flow (login, protected route, logout)', async () => {
  const loginPayload = JSON.stringify({ email: adminEmail, password: adminPassword });
  const loginResult = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: loginPayload,
  });

  assert.ok(
    [200, 201].includes(loginResult.response.status),
    `Login failed with status=${loginResult.response.status} body=${JSON.stringify(loginResult.body)}`,
  );

  const token = loginResult.body?.accessToken;
  const cookie = getCookieHeader(loginResult.response);

  assert.ok(token || cookie, 'Expected access token or session cookie');

  const authHeaders = token
    ? { Authorization: `Bearer ${token}` }
    : cookie
      ? { Cookie: cookie }
      : {};

  const meResult = await apiRequest('/api/users/me', {
    method: 'GET',
    headers: authHeaders,
  });

  assert.equal(meResult.response.status, 200);
  assert.equal(meResult.body?.email, adminEmail);

  const loggedOutResult = await apiRequest('/api/users/me', {
    method: 'GET',
    headers: {},
  });

  assert.equal(loggedOutResult.response.status, 401);
});
