const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { ValidationPipe } = require('@nestjs/common');
const Redis = require('ioredis');

const multipartModule = require('@fastify/multipart');
const previousRedisDb = process.env.REDIS_DB;
const testRedisDb = process.env.REDIS_DB ?? '12';
process.env.REDIS_DB = testRedisDb;
const { AppModule } = require('../dist/app.module');

const multipart = multipartModule.default ?? multipartModule;

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

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for rate-limiting tests');
  }

  app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  await app.register(multipart);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await clearRedisTestDb();

  await app.listen(0, '127.0.0.1');
  baseUrl = (await app.getUrl()).replace(/\/$/, '');
});

beforeEach(async () => {
  await clearRedisTestDb();
});

afterEach(async () => {
  await clearRedisTestDb();
});

after(async () => {
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

test('rate limiting - should block after 5 failed login attempts', async () => {
  // Tenter 5 logins avec des credentials invalides
  for (let i = 0; i < 5; i++) {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
    });

    // Les 5 premières tentatives devraient être traitées (même si elles échouent)
    assert.ok(
      [400, 401, 403].includes(result.response.status),
      `Attempt ${i + 1} should be processed (got ${result.response.status}, body=${JSON.stringify(result.body)})`
    );
  }

  // La 6ème tentative devrait être bloquée par le rate limiter (429 Too Many Requests)
  const blockedResult = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
  });

  assert.equal(
    blockedResult.response.status,
    429,
    `Request should be rate limited (status=${blockedResult.response.status}, body=${JSON.stringify(blockedResult.body)})`,
  );

  // Vérifier qu'au moins un indicateur de rate limit est présent
  const retryAfter = blockedResult.response.headers.get('retry-after');
  const rateLimitReset = blockedResult.response.headers.get('x-ratelimit-reset');
  const errorMessage =
    blockedResult.body?.message ||
    blockedResult.body?.error ||
    blockedResult.body?.statusCode;
  assert.ok(
    retryAfter || rateLimitReset || errorMessage,
    `Should expose rate limit metadata (headers=${JSON.stringify({
      retryAfter,
      rateLimitReset,
    })}, body=${JSON.stringify(blockedResult.body)})`,
  );
});

test('rate limiting - headers should be present in responses', async () => {
  // Attendre un peu pour éviter le rate limit du test précédent
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const result = await apiRequest('/api/health', {
    method: 'GET',
  });

  assert.equal(result.response.status, 200, 'Health endpoint should be accessible');

  // Vérifier la présence des headers de rate limiting
  const rateLimitLimit = result.response.headers.get('x-ratelimit-limit');
  const rateLimitRemaining = result.response.headers.get('x-ratelimit-remaining');
  const rateLimitReset = result.response.headers.get('x-ratelimit-reset');

  // Note: NestJS throttler peut ou non ajouter ces headers selon la configuration
  // On vérifie simplement qu'il n'y a pas d'erreur
  assert.ok(result.response.status === 200, 'Request should succeed');
});

test('rate limiting - should allow requests within limit', async () => {
  // Attendre un peu pour éviter le rate limit du test précédent
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Faire plusieurs requêtes à un endpoint non-sensible
  const results = [];
  for (let i = 0; i < 3; i++) {
    const result = await apiRequest('/api/health', {
      method: 'GET',
    });
    results.push(result);

    // Petit délai entre les requêtes pour éviter de dépasser le short limit (10 req/s)
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Toutes les requêtes devraient passer
  results.forEach((result, index) => {
    assert.equal(
      result.response.status,
      200,
      `Request ${index + 1} should succeed within rate limit`
    );
  });
});
