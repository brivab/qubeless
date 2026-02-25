# Security Headers

Qubeless implements comprehensive security headers to protect against common web vulnerabilities.

## Overview

Security headers are automatically configured using:

- **Helmet.js** for the API (Fastify)
- **Nginx** for the frontend

## API Security Headers

The API uses `@fastify/helmet` to automatically set security headers on all responses.

### Configured Headers

#### 1. Content-Security-Policy (CSP)

Prevents XSS attacks by controlling which resources can be loaded.

```
default-src 'self'
script-src 'self' 'unsafe-inline'  # 'unsafe-inline' required for Swagger UI
style-src 'self' 'unsafe-inline'
img-src 'self' data: https:
connect-src 'self'
font-src 'self'
object-src 'none'
media-src 'self'
frame-src 'none'
```

#### 2. Strict-Transport-Security (HSTS)

Forces HTTPS connections (when using HTTPS).

```
max-age=31536000; includeSubDomains; preload
```

- **max-age**: 1 year (31536000 seconds)
- **includeSubDomains**: Applies to all subdomains
- **preload**: Eligible for browser preload lists

#### 3. X-Frame-Options

Prevents clickjacking attacks.

```
DENY
```

Prevents the page from being loaded in any iframe.

#### 4. X-Content-Type-Options

Prevents MIME-sniffing.

```
nosniff
```

Forces browsers to respect the declared Content-Type.

#### 5. Referrer-Policy

Controls how much referrer information is sent.

```
strict-origin-when-cross-origin
```

- Same-origin: full URL
- Cross-origin HTTPS→HTTPS: origin only
- Cross-origin HTTPS→HTTP: no referrer

#### 6. Cross-Origin Policies

```
Cross-Origin-Embedder-Policy: false  # Disabled for MinIO compatibility
Cross-Origin-Resource-Policy: cross-origin
```

## Frontend Security Headers (Nginx)

The frontend Nginx server adds additional security headers.

### Configuration

Located in `apps/web/nginx.conf`:

```nginx
# Security Headers
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# CSP for SPA
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:3001; frame-ancestors 'none';" always;
```

### Additional Headers

#### X-XSS-Protection

Legacy XSS protection for older browsers.

```
1; mode=block
```

#### Permissions-Policy

Controls which browser features can be used.

```
geolocation=(), microphone=(), camera=()
```

Disables geolocation, microphone, and camera access.

## Testing Security Headers

### Manual Testing with curl

```bash
# Test API headers
curl -I http://localhost:3001/api/health

# Expected output should include:
# x-frame-options: DENY
# x-content-type-options: nosniff
# strict-transport-security: max-age=31536000; includeSubDomains; preload
# content-security-policy: ...
# referrer-policy: strict-origin-when-cross-origin
```

### Automated Tests

Run E2E tests:

```bash
# Test security headers
node apps/api/test/security-headers.test.js
```

Or with npm:

```bash
pnpm test:e2e:security
```

### Online Security Scanners

Test your deployed application with:

- [Security Headers](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [SSL Labs](https://www.ssllabs.com/ssltest/) (for HTTPS)

## Configuration

### Environment Variables

Configure security headers in `.env`:

```bash
# Security Headers
HELMET_ENABLED=true

# CSP Report URI (optional)
#CSP_REPORT_URI=https://your-domain.com/api/csp-report
```

### Disabling Helmet (Not Recommended)

To disable Helmet (for debugging only):

```typescript
// apps/api/src/main.ts
// Comment out:
// await app.register(helmet, { ... });
```

⚠️ **Warning**: Never disable security headers in production!

## CSP Violation Reporting (Optional)

You can optionally implement CSP violation reporting to monitor policy violations.

### Create CSP Report Endpoint

```typescript
// apps/api/src/modules/security/security.controller.ts
import { Controller, Post, Body, Logger } from '@nestjs/common';

@Controller('csp-report')
export class SecurityController {
  private readonly logger = new Logger(SecurityController.name);

  @Post()
  async reportCSPViolation(@Body() report: any) {
    this.logger.warn('CSP Violation', JSON.stringify(report, null, 2));
    // Optional: Store in database for analysis
    return { received: true };
  }
}
```

### Update CSP Directive

```typescript
contentSecurityPolicy: {
  directives: {
    // ... other directives
    reportUri: [process.env.CSP_REPORT_URI],
  },
}
```

## Best Practices

### 1. HTTPS Only in Production

Always use HTTPS in production. HSTS only works with HTTPS.

```nginx
# Nginx - Force HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    # ... SSL configuration

    # Enable HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

### 2. CSP Nonce for Scripts

For better security, use CSP nonces instead of `unsafe-inline`:

```typescript
// Generate nonce per request
const nonce = crypto.randomBytes(16).toString('base64');

contentSecurityPolicy: {
  directives: {
    scriptSrc: ["'self'", `'nonce-${nonce}'`],
  },
}
```

### 3. Monitor Security Headers

Add monitoring alerts for:

- Missing security headers
- CSP violations
- Unusual header patterns

## Troubleshooting

### Swagger UI Not Loading

If Swagger UI doesn't load due to CSP:

1. Check browser console for CSP violations
2. Verify `unsafe-inline` is allowed for scripts
3. Temporarily disable CSP for debugging:

```typescript
contentSecurityPolicy: false,
```

### MinIO/S3 Access Issues

If you have CORS issues with MinIO:

1. Verify `crossOriginEmbedderPolicy: false`
2. Verify `crossOriginResourcePolicy: { policy: 'cross-origin' }`
3. Check MinIO CORS configuration

### Frontend Not Loading Resources

If the frontend can't load resources:

1. Check CSP `connect-src` includes API URL
2. Verify `img-src` allows necessary sources
3. Check browser console for CSP violations

## Security Checklist

- ✅ Helmet configured in API
- ✅ Security headers in Nginx
- ✅ CSP policy configured
- ✅ HSTS enabled (production only)
- ✅ X-Frame-Options set to DENY
- ✅ X-Content-Type-Options set to nosniff
- ✅ Referrer-Policy configured
- ✅ Tests passing
- ✅ No sensitive information in headers
- ✅ HTTPS enforced in production

## Related Documentation

- [Rate Limiting](./rate-limiting.md)
- [Deployment](./deploy.md)
- [RBAC](./rbac.md)

## External Resources

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN: HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Content Security Policy Reference](https://content-security-policy.com/)
