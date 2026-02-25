/**
 * E2E Tests for Security Headers
 * Tests that verify the correct security headers are set by Helmet
 */

const test = require('node:test');
const assert = require('node:assert');

const API_URL = process.env.API_URL || 'http://localhost:3001';

test('Security Headers - API should return all required security headers', async () => {
  const response = await fetch(`${API_URL}/api/health`);

  // X-Frame-Options
  assert.ok(
    response.headers.get('x-frame-options'),
    'X-Frame-Options header should be present'
  );
  assert.strictEqual(
    response.headers.get('x-frame-options').toLowerCase(),
    'deny',
    'X-Frame-Options should be DENY'
  );

  // X-Content-Type-Options
  assert.ok(
    response.headers.get('x-content-type-options'),
    'X-Content-Type-Options header should be present'
  );
  assert.strictEqual(
    response.headers.get('x-content-type-options').toLowerCase(),
    'nosniff',
    'X-Content-Type-Options should be nosniff'
  );

  // Strict-Transport-Security (HSTS)
  assert.ok(
    response.headers.get('strict-transport-security'),
    'Strict-Transport-Security header should be present'
  );
  const hsts = response.headers.get('strict-transport-security');
  assert.ok(
    hsts.includes('max-age=31536000'),
    'HSTS should have max-age=31536000 (1 year)'
  );
  assert.ok(
    hsts.includes('includeSubDomains'),
    'HSTS should include subdomains'
  );

  // Referrer-Policy
  assert.ok(
    response.headers.get('referrer-policy'),
    'Referrer-Policy header should be present'
  );
  assert.strictEqual(
    response.headers.get('referrer-policy'),
    'strict-origin-when-cross-origin',
    'Referrer-Policy should be strict-origin-when-cross-origin'
  );

  // Content-Security-Policy
  assert.ok(
    response.headers.get('content-security-policy'),
    'Content-Security-Policy header should be present'
  );
  const csp = response.headers.get('content-security-policy');
  assert.ok(
    csp.includes("default-src 'self'"),
    'CSP should have default-src self'
  );
  assert.ok(
    csp.includes("object-src 'none'"),
    'CSP should block objects'
  );
  assert.ok(
    csp.includes("frame-src 'none'"),
    'CSP should block frames'
  );
});

test('Security Headers - API should set security headers on all endpoints', async () => {
  const endpoints = [
    '/api/health',
    '/api/docs',
    '/api/metrics',
  ];

  for (const endpoint of endpoints) {
    const response = await fetch(`${API_URL}${endpoint}`);

    // Check at least key security headers are present
    assert.ok(
      response.headers.get('x-frame-options'),
      `${endpoint} should have X-Frame-Options header`
    );
    assert.ok(
      response.headers.get('x-content-type-options'),
      `${endpoint} should have X-Content-Type-Options header`
    );
    assert.ok(
      response.headers.get('content-security-policy'),
      `${endpoint} should have Content-Security-Policy header`
    );
  }
});

test('Security Headers - CSP should allow Swagger UI scripts', async () => {
  const response = await fetch(`${API_URL}/api/docs`);
  const csp = response.headers.get('content-security-policy');

  assert.ok(
    csp.includes("'unsafe-inline'"),
    'CSP should allow unsafe-inline for Swagger UI'
  );
});

test('Security Headers - CORS should be configured correctly', async () => {
  const response = await fetch(`${API_URL}/api/health`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:8081',
      'Access-Control-Request-Method': 'GET',
    },
  });

  // CORS headers should be present
  const accessControlAllowOrigin = response.headers.get('access-control-allow-origin');
  assert.ok(
    accessControlAllowOrigin,
    'Access-Control-Allow-Origin should be present'
  );
});

test('Security Headers - No sensitive information in headers', async () => {
  const response = await fetch(`${API_URL}/api/health`);

  // Check that we don't expose sensitive server info
  const serverHeader = response.headers.get('server');
  const xPoweredBy = response.headers.get('x-powered-by');

  // These headers should either not exist or not reveal sensitive info
  if (xPoweredBy) {
    assert.fail('X-Powered-By header should be removed for security');
  }
});

test('Security Headers - Cross-Origin policies', async () => {
  const response = await fetch(`${API_URL}/api/health`);

  // Check Cross-Origin policies
  const coep = response.headers.get('cross-origin-embedder-policy');
  const corp = response.headers.get('cross-origin-resource-policy');

  // COEP should be false (disabled for MinIO compatibility)
  // CORP should be cross-origin
  if (corp) {
    assert.strictEqual(
      corp,
      'cross-origin',
      'Cross-Origin-Resource-Policy should be cross-origin for MinIO'
    );
  }
});
