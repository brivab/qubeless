# Health and Readiness Endpoints

This document describes the health monitoring endpoints for the Qubeless platform, designed for production deployments with orchestrators like Docker, Kubernetes, and other container management systems.

## Overview

The platform provides two types of health checks:

- **Liveness probe** (`/health`) - Verifies the process is alive and running
- **Readiness probe** (`/ready`) - Verifies all dependencies are accessible and the system is ready to handle requests

## Overview of Health Checks

The health check system uses multiple verification layers:

1. **Liveness** (`/health`) - Process is running
2. **Readiness** (`/ready`) - All dependencies are accessible
3. **Platform Status** (`/status`) - User-friendly status for frontend display
4. **Worker Detection** - Active workers are verified by checking BullMQ queue workers

---

## API Service

### GET /api/health

**Purpose:** Liveness probe - checks if the API process is running.

**Use case:** Container orchestrators use this to detect if the process has crashed and needs to be restarted.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-12-25T10:30:00.000Z"
}
```

**Status codes:**

- `200 OK` - Process is alive

**Performance:** This endpoint is very fast (<1ms) as it performs no external checks.

**Example:**

```bash
curl http://localhost:3001/api/health
```

---

### GET /api/ready

**Purpose:** Readiness probe - verifies all critical dependencies are accessible.

**Use case:** Container orchestrators use this to determine if the service should receive traffic. The service will be removed from load balancing if this check fails.

**Dependencies checked:**

- **PostgreSQL** - Database connection
- **Redis** - Queue and caching connection
- **MinIO/S3** - Object storage connection
- **Worker** - Active BullMQ workers connected to the queue

**Response (success):**

```json
{
  "status": "ok",
  "timestamp": "2025-12-25T10:30:00.000Z",
  "checks": {
    "postgres": {
      "status": "ok",
      "latency": 12
    },
    "redis": {
      "status": "ok",
      "latency": 8
    },
    "minio": {
      "status": "ok",
      "latency": 15
    }
  }
}
```

**Response (failure):**

```json
{
  "status": "error",
  "timestamp": "2025-12-25T10:30:00.000Z",
  "checks": {
    "postgres": {
      "status": "ok",
      "latency": 10
    },
    "redis": {
      "status": "error",
      "latency": 5002,
      "error": "Connection timeout"
    },
    "minio": {
      "status": "ok",
      "latency": 18
    }
  }
}
```

**Status codes:**

- `200 OK` - All dependencies are accessible, system is ready
- `503 Service Unavailable` - One or more dependencies are not accessible

**Performance:** This endpoint typically responds in 10-50ms depending on network latency to dependencies.

**Example:**

```bash
curl http://localhost:3001/api/ready
```

---

### GET /api/status

**Purpose:** Platform status for frontend display - provides user-friendly status information about the platform.

**Use case:** Frontend applications use this to display the platform health status to users on dashboards.

**Worker Detection:**
This endpoint actively checks if Worker processes are running by querying the BullMQ queue for active workers. This ensures accurate reporting of Worker availability beyond just checking if Redis is accessible.

**Response (operational):**

```json
{
  "status": "operational",
  "message": "All systems operational",
  "services": {
    "api": "online",
    "worker": "online",
    "database": "online"
  },
  "timestamp": "2025-12-25T10:30:00.000Z"
}
```

**Response (degraded - Worker offline):**

```json
{
  "status": "degraded",
  "message": "Some services experiencing issues",
  "services": {
    "api": "online",
    "worker": "offline",
    "database": "online"
  },
  "timestamp": "2025-12-25T10:30:00.000Z"
}
```

**Status codes:**

- `200 OK` - Always returns 200, check the `status` field in the response body
  - `operational` - All services are online
  - `degraded` - Some services are offline (non-critical)
  - `down` - Critical services are offline (API or Database)

**Performance:** This endpoint typically responds in 10-50ms, similar to `/ready`.

**Frontend Integration:**

- Automatically refreshes every 30 seconds
- Visual indicators (colors, icons) based on status
- Detailed service breakdown (API, Worker, Database)

**Example:**

```bash
curl http://localhost:3001/api/status
```

---

## Worker Service

The Worker service is a background job processor without an HTTP interface. Instead of HTTP endpoints, it logs its readiness state.

### Startup Readiness Checks

On startup, the Worker performs the following checks:

1. **PostgreSQL** - Database connection
2. **Redis** - Queue connection
3. **MinIO/S3** - Object storage connection
4. **Docker** - Docker daemon accessibility

**Success log:**

```json
{
  "level": "info",
  "msg": "Worker READY - all systems operational",
  "checks": [
    { "name": "postgres", "status": "ok", "latency": 15 },
    { "name": "redis", "status": "ok", "latency": 8 },
    { "name": "minio", "status": "ok", "latency": 12 },
    { "name": "docker", "status": "ok", "latency": 20 }
  ]
}
```

**Failure behavior:**
If any check fails, the Worker will:

1. Log an error with details about failed checks
2. Throw an error and exit with a non-zero exit code
3. Allow the container orchestrator to restart the service

**Failure log:**

```json
{
  "level": "error",
  "msg": "Worker NOT READY - some systems unavailable",
  "checks": [
    { "name": "postgres", "status": "ok", "latency": 10 },
    { "name": "redis", "status": "error", "latency": 5001, "error": "Connection timeout" },
    { "name": "minio", "status": "ok", "latency": 15 },
    { "name": "docker", "status": "ok", "latency": 18 }
  ],
  "failedChecks": [
    { "name": "redis", "status": "error", "latency": 5001, "error": "Connection timeout" }
  ]
}
```

---

## Docker Compose Configuration

Example health check configuration for `docker-compose.dev.yml`:

```yaml
services:
  api:
    image: qubeless/api:latest
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3001/api/health']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    ports:
      - '3001:3001'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      minio:
        condition: service_started

  worker:
    image: qubeless/worker:latest
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      minio:
        condition: service_started
    restart: unless-stopped
```

---

## Kubernetes Configuration

### API Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qubeless-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: qubeless-api
  template:
    metadata:
      labels:
        app: qubeless-api
    spec:
      containers:
        - name: api
          image: qubeless/api:latest
          ports:
            - containerPort: 3001
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/ready
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            successThreshold: 1
            failureThreshold: 2
```

### Worker Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qubeless-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: qubeless-worker
  template:
    metadata:
      labels:
        app: qubeless-worker
    spec:
      containers:
        - name: worker
          image: qubeless/worker:latest
          # Worker uses exit code for health - no HTTP probes needed
          # Container will restart if it exits with non-zero code
          # Monitor logs for "Worker READY" message
```

---

## Security Considerations

### No Sensitive Information Leakage

The health endpoints are designed to avoid leaking sensitive information:

- ✅ No database credentials or connection strings
- ✅ No internal IP addresses or hostnames
- ✅ No detailed stack traces
- ✅ Generic error messages (e.g., "Connection timeout" instead of specific errors)

### Authentication

The `/health` and `/ready` endpoints are **intentionally unauthenticated** to allow orchestrators and monitoring systems to access them. These endpoints should be:

- Accessible from internal networks only
- Blocked from public internet access via firewall rules or ingress configuration
- Rate-limited if exposed to prevent abuse

**Example Kubernetes NetworkPolicy:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-health-checks
spec:
  podSelector:
    matchLabels:
      app: qubeless-api
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: kube-system
      ports:
        - protocol: TCP
          port: 3001
```

---

## Response Time Expectations

| Endpoint      | Expected Latency | Notes                                       |
| ------------- | ---------------- | ------------------------------------------- |
| `/api/health` | < 5ms            | No external calls, process-only check       |
| `/api/ready`  | 10-50ms          | Performs network checks to all dependencies |

If response times exceed 100ms, investigate network latency or resource constraints on dependency services.

---

## Monitoring and Alerting

### Recommended Alerts

1. **API Liveness Failures**
   - Trigger: `/api/health` returns non-200 or times out
   - Action: Immediate page - service is down

2. **API Readiness Failures**
   - Trigger: `/api/ready` returns 503 for > 2 minutes
   - Action: Page - dependency issue

3. **Worker Not Ready**
   - Trigger: Worker container restarts > 3 times in 5 minutes
   - Action: Page - dependency or configuration issue

### Metrics to Track

- Health check response times
- Health check failure rates
- Dependency-specific failure counts (Postgres, Redis, MinIO)
- Worker restart count

---

## Troubleshooting

### API returns 503 on /ready

1. Check the response body to identify which dependency is failing
2. Verify network connectivity from the API container to the failed dependency
3. Check dependency service logs for errors
4. Verify credentials and configuration

**Common issues:**

- Postgres: Database not accepting connections, wrong password
- Redis: Redis not started, wrong host/port
- MinIO: Service not started, wrong credentials, network isolation

### Worker keeps restarting

1. Check container logs for "Worker NOT READY" messages
2. Identify which dependency check is failing
3. Verify network connectivity from Worker container
4. Check Docker daemon accessibility (Worker-specific)

**Common issues:**

- Docker socket not mounted (`/var/run/docker.sock`)
- Insufficient permissions to access Docker daemon
- Postgres/Redis/MinIO not reachable

---

## Testing Health Checks Locally

### Manual Testing

```bash
# Test API liveness
curl http://localhost:3001/api/health

# Test API readiness
curl http://localhost:3001/api/ready

# Test with verbose output
curl -v http://localhost:3001/api/ready

# Test readiness and check exit code
curl -f http://localhost:3001/api/ready && echo "Ready" || echo "Not ready"
```

### Simulating Failures

To test failure scenarios:

1. **Stop Redis:**

   ```bash
   docker-compose -f docker-compose.dev.yml stop redis
   curl http://localhost:3001/api/ready  # Should return 503
   ```

2. **Stop Postgres:**

   ```bash
   docker-compose -f docker-compose.dev.yml stop postgres
   curl http://localhost:3001/api/ready  # Should return 503
   ```

3. **Stop MinIO:**
   ```bash
   docker-compose -f docker-compose.dev.yml stop minio
   curl http://localhost:3001/api/ready  # Should return 503
   ```

---

## FAQ

**Q: Why are there two endpoints instead of just one?**

A: Liveness and readiness serve different purposes. Liveness (`/health`) tells the orchestrator if the process needs to be restarted. Readiness (`/ready`) tells it if the service should receive traffic. Separating them prevents unnecessary restarts when only dependencies are temporarily unavailable.

**Q: Why doesn't the Worker have HTTP endpoints?**

A: The Worker is a background job processor without an HTTP interface. It uses logs and exit codes to communicate its health status, which is the standard approach for non-HTTP services.

**Q: Can I use /health for both liveness and readiness?**

A: Not recommended. If you use `/health` for both, a temporary dependency outage will trigger container restarts, which can make the problem worse during recovery.

**Q: How fast should these endpoints respond?**

A: `/health` should respond in <5ms. `/ready` should respond in <100ms under normal conditions. Slower responses may indicate resource constraints.

**Q: Are these endpoints secure?**

A: They are designed to not leak sensitive information, but they should still be protected from public internet access using network policies or firewall rules.
