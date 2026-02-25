# Rate Limiting

Qubeless implements API rate limiting to protect against abuse, brute force attacks, and denial of service attempts.

## Overview

Rate limiting is automatically enabled on all API endpoints using a multi-level throttling system backed by Redis for distributed deployments.

## Rate Limit Levels

Three levels of rate limiting are configured by default:

### 1. Short-term (Burst Protection)

- **Window**: 1 second
- **Limit**: 10 requests
- **Purpose**: Prevent rapid-fire request bursts

### 2. Medium-term (Standard Usage)

- **Window**: 1 minute
- **Limit**: 100 requests
- **Purpose**: Normal API usage protection

### 3. Long-term (High Volume)

- **Window**: 15 minutes
- **Limit**: 1000 requests
- **Purpose**: Sustained high-volume usage protection

## Endpoint-Specific Limits

Certain endpoints have custom rate limits for enhanced security:

### Authentication Endpoints

**POST /api/auth/login**

- **Limit**: 5 attempts per minute
- **Purpose**: Brute force protection

This prevents automated password guessing attacks while allowing legitimate users to retry in case of typos.

### Webhook Endpoints

**POST /api/webhooks/github**
**POST /api/webhooks/gitlab**

- **Limit**: 50 webhooks per minute
- **Purpose**: DoS protection

This protects against webhook flooding while supporting typical CI/CD workflows.

## Response Headers

When rate limiting is active, the API includes the following headers in responses:

- `X-RateLimit-Limit`: Maximum number of requests allowed in the window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Timestamp (Unix epoch) when the limit will reset
- `Retry-After`: Seconds to wait before retrying (included in 429 responses)

## HTTP Status Codes

### 200-299: Success

Request was processed successfully within rate limits.

### 429: Too Many Requests

Rate limit exceeded. The response includes:

- `Retry-After` header indicating wait time in seconds
- Error message explaining the rate limit

Example response:

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## Configuration

Rate limiting is configured via environment variables in `.env`:

```bash
# Rate Limiting
THROTTLE_TTL=60000          # Default TTL in milliseconds
THROTTLE_LIMIT=100          # Default limit
THROTTLE_STORAGE=redis      # Storage backend (redis or memory)

# Redis connection (used for distributed rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Storage Backends

#### Redis (Recommended for Production)

- **Pros**: Distributed, persists across restarts, shared between instances
- **Cons**: Requires Redis server
- **Use case**: Production deployments, multi-instance setups

Configuration is automatically enabled when Redis is available.

#### In-Memory (Development Only)

- **Pros**: No dependencies, simple setup
- **Cons**: Not distributed, resets on restart
- **Use case**: Local development only

To use in-memory storage, Redis connection must not be available or fail.

## Best Practices

### For API Consumers

1. **Implement exponential backoff**: When receiving a 429 response, wait for the time specified in `Retry-After` before retrying.

2. **Monitor rate limit headers**: Check `X-RateLimit-Remaining` to avoid hitting limits.

3. **Use API tokens efficiently**: Don't create multiple tokens for the same purpose; limits are per-IP for unauthenticated requests.

4. **Batch operations**: Combine multiple operations into single requests when possible.

Example retry logic:

```javascript
async function apiRequestWithRetry(url, options) {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return apiRequestWithRetry(url, options);
  }

  return response;
}
```

### For Administrators

1. **Monitor rate limit metrics**: Track 429 responses to identify potential attacks or legitimate users hitting limits.

2. **Adjust limits for specific use cases**: If you have high-volume legitimate use cases, consider implementing custom limits.

3. **Use Redis in production**: Always use Redis-backed storage for production deployments to ensure rate limits work correctly across multiple API instances.

4. **Regular security reviews**: Review rate limit logs for patterns indicating abuse attempts.

## Troubleshooting

### Problem: Legitimate users hitting rate limits

**Solution**: Review your API usage patterns and adjust limits if needed. Consider implementing API token-based limits with higher thresholds for authenticated users.

### Problem: Rate limits not working across instances

**Solution**: Ensure Redis is properly configured and all API instances can connect to the same Redis server.

### Problem: Rate limits resetting unexpectedly

**Solution**: Check that Redis is not being cleared or restarted. Verify Redis persistence configuration.

## Testing Rate Limits

To test rate limiting locally:

```bash
# Run the rate limiting E2E tests
pnpm --filter @qubeless/api test rate-limiting.test.js

# Manual testing with curl
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -i | grep -E "HTTP|retry-after"
  echo "---"
done
```

The 6th request should return a 429 status code.

## Security Considerations

### IP-based Rate Limiting

Rate limits are applied per IP address for unauthenticated requests. Be aware that:

- Users behind NAT/proxy share the same IP
- Consider using API tokens for high-volume legitimate users
- Monitor for distributed attacks from multiple IPs

### Rate Limit Bypass Prevention

- Rate limit enforcement happens before authentication
- Headers are validated before rate limiting
- Redis keys are properly namespaced to prevent conflicts

### DDoS Protection

Rate limiting provides basic DDoS protection but should be combined with:

- CDN/WAF (e.g., Cloudflare)
- Network-level rate limiting
- Infrastructure auto-scaling

## Future Enhancements

Planned improvements to rate limiting:

- [ ] Per-user rate limits (different limits for authenticated vs anonymous)
- [ ] Per-API-token rate limits
- [ ] Configurable limits via admin UI
- [ ] Rate limit exemptions for specific IPs/tokens
- [ ] Enhanced metrics and dashboards for rate limit monitoring
- [ ] Automatic IP blocking after repeated limit violations

## Related Documentation

- [API Tokens](./api-tokens.md)
- [Security](./security.md)
- [Monitoring](./METRICS.md)
- [Deployment](./deploy.md)
