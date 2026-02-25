# Prometheus Metrics

This document describes the implementation of technical metrics for monitoring the Qubeless platform.

## Configuration

### Enabling metrics

Metrics are **disabled by default** for security reasons. To enable them, set the following environment variable:

```bash
# In apps/api/.env
METRICS_ENABLED=true
```

### Restart required

After modifying the configuration, restart the API service:

```bash
pnpm --filter @qubeless/api dev
```

## Endpoint

### GET /api/metrics

Endpoint exposing metrics in Prometheus format.

- **URL**: `http://localhost:3001/api/metrics`
- **Method**: `GET`
- **Format**: `text/plain; version=0.0.4` (Prometheus format)
- **Authentication**: Public (no authentication required)
- **Status**:
  - `200 OK`: Metrics available
  - `503 Service Unavailable`: Metrics disabled

### Example request

```bash
curl http://localhost:3001/api/metrics
```

### Example response

```
# HELP analyses_total Total number of analyses started
# TYPE analyses_total counter
analyses_total{project="my-project",status="completed"} 42
analyses_total{project="my-project",status="failed"} 3

# HELP analyses_failed_total Total number of failed analyses
# TYPE analyses_failed_total counter
analyses_failed_total{project="my-project",reason="timeout"} 2
analyses_failed_total{project="my-project",reason="docker"} 1

# HELP analysis_duration_seconds Duration of analyses in seconds
# TYPE analysis_duration_seconds histogram
analysis_duration_seconds_bucket{project="my-project",status="completed",le="30"} 5
analysis_duration_seconds_bucket{project="my-project",status="completed",le="60"} 15
analysis_duration_seconds_bucket{project="my-project",status="completed",le="120"} 28
analysis_duration_seconds_bucket{project="my-project",status="completed",le="300"} 38
analysis_duration_seconds_bucket{project="my-project",status="completed",le="600"} 41
analysis_duration_seconds_bucket{project="my-project",status="completed",le="+Inf"} 42
analysis_duration_seconds_sum{project="my-project",status="completed"} 8234.5
analysis_duration_seconds_count{project="my-project",status="completed"} 42

# HELP queue_depth Number of jobs waiting in the analysis queue
# TYPE queue_depth gauge
queue_depth{state="waiting"} 3
queue_depth{state="active"} 2
queue_depth{state="delayed"} 0
queue_depth{state="failed"} 1

# HELP running_analyses Number of currently running analyses
# TYPE running_analyses gauge
running_analyses 2

# HELP db_query_duration_seconds Database query duration in seconds
# TYPE db_query_duration_seconds histogram
db_query_duration_seconds_bucket{operation="health_check",le="0.001"} 15
db_query_duration_seconds_bucket{operation="health_check",le="0.005"} 42
...

# HELP redis_operation_duration_seconds Redis operation duration in seconds
# TYPE redis_operation_duration_seconds histogram
redis_operation_duration_seconds_bucket{operation="health_check",le="0.001"} 98
...

# HELP minio_operation_duration_seconds MinIO operation duration in seconds
# TYPE minio_operation_duration_seconds histogram
minio_operation_duration_seconds_bucket{operation="health_check",le="0.01"} 12
...
```

## Available metrics

### Analysis metrics

#### `analyses_total` (Counter)

Total number of analyses started.

**Labels**:

- `project`: Project key (e.g., `my-project`)
- `status`: Analysis status (`completed`, `failed`)

#### `analyses_failed_total` (Counter)

Total number of failed analyses.

**Labels**:

- `project`: Project key
- `reason`: Failure reason (`timeout`, `memory`, `docker`, `storage`, `network`, `other`)

#### `analysis_duration_seconds` (Histogram)

Duration of analyses in seconds.

**Labels**:

- `project`: Project key
- `status`: Analysis status (`completed`, `failed`)

**Buckets**: 30s, 60s, 120s, 300s, 600s, 1200s, 1800s, 3600s

### Queue metrics

#### `queue_depth` (Gauge)

Number of jobs in the analysis queue.

**Labels**:

- `state`: Job state (`waiting`, `active`, `delayed`, `failed`)

#### `running_analyses` (Gauge)

Number of currently running analyses.

### Infrastructure metrics

#### `db_query_duration_seconds` (Histogram)

Latency of PostgreSQL queries.

**Labels**:

- `operation`: Operation type (e.g., `health_check`)

**Buckets**: 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s, 5s

#### `redis_operation_duration_seconds` (Histogram)

Latency of Redis operations.

**Labels**:

- `operation`: Operation type (e.g., `health_check`)

**Buckets**: 1ms, 5ms, 10ms, 50ms, 100ms, 500ms

#### `minio_operation_duration_seconds` (Histogram)

Latency of MinIO/S3 operations.

**Labels**:

- `operation`: Operation type (e.g., `health_check`)

**Buckets**: 10ms, 50ms, 100ms, 500ms, 1s, 5s, 10s

### Default system metrics

In addition to application metrics, the following system metrics are automatically collected:

- `process_cpu_user_seconds_total`: User CPU time
- `process_cpu_system_seconds_total`: System CPU time
- `process_resident_memory_bytes`: Resident memory
- `process_heap_bytes`: Heap:3001
- `nodejs_eventloop_lag_seconds`: Node.js event loop latency
- `nodejs_gc_duration_seconds`: Garbage collection duration

## Integration with Prometheus

### Prometheus configuration

Add the following job to your `prometheus.yml` file:

```yaml
scrape_configs:
  - job_name: 'qubeless-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /api/metrics
```

### Example PromQL queries

#### Analysis failure rate

```promql
rate(analyses_failed_total[5m])
```

#### Median analysis duration by project

```promql
histogram_quantile(0.5, rate(analysis_duration_seconds_bucket[5m]))
```

#### Pending analyses

```promql
queue_depth{state="waiting"}
```

#### P95 latency of database requests

```promql
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))
```

## Grafana

### Recommended dashboards

1. **Qubeless overview**
   - Total analyses (by project)
   - Success/failure rate
   - Average analysis duration
   - Queue depth

2. **Infrastructure performance**
   - PostgreSQL latency
   - Redis latency
   - MinIO latency
   - System metrics (CPU, memory)

3. **Detailed analyses**
   - Distribution of analysis duration
   - Failure reasons
   - Running vs pending analyses

### Example Grafana panel

**Panel: Analysis duration**

```promql
# Query A: Average duration
rate(analysis_duration_seconds_sum[5m]) / rate(analysis_duration_seconds_count[5m])

# Query B: P95
histogram_quantile(0.95, rate(analysis_duration_seconds_bucket[5m]))
```

## Recommended alerts

### High failure rate

```yaml
- alert: HighAnalysisFailureRate
  expr: rate(analyses_failed_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'High analysis failure rate'
    description: 'The analysis failure rate exceeds 10% over the last 5 minutes'
```

### Queue overloaded

```yaml
- alert: AnalysisQueueBacklog
  expr: queue_depth{state="waiting"} > 20
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: 'Analysis queue overloaded'
    description: 'More than 20 analyses pending for 10 minutes'
```

### High database latency

```yaml
- alert: HighDatabaseLatency
  expr: histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'High database latency'
    description: 'The P95 latency of queries exceeds 1 second'
```

## Security

### Sensitive data

The implementation ensures that **no sensitive data is exposed**:

- ✅ No secrets or tokens
- ✅ No user data (emails, names, etc.)
- ✅ No source code content
- ✅ Only aggregated technical metrics

### Labels

The labels used are:

- Project keys (public technical identifiers)
- States and statuses (enumerations)
- Operation types (function names)

### Access

Although the endpoint is public (no authentication), it is recommended to:

- Keep it disabled in production if not used
- Restrict network access at the firewall/ingress level
- Only expose the endpoint to authorized monitoring systems

## Troubleshooting

### Metrics disabled

**Problem**: `503 Service Unavailable` when accessing `/api/metrics`

**Solution**: Verify that `METRICS_ENABLED=true` in your `.env` and restart the API.

### Empty metrics

**Problem**: The endpoint returns few or no metrics

**Possible cause**:

- No analyses have been launched yet
- The service was just started

**Solution**: Launch a few analyses to generate metrics.

### Queue depth always at 0

**Problem**: `queue_depth` remains at 0

**Cause**:

- No analyses running or pending
- Worker is processing jobs too quickly

**Solution**: This is normal if your system has no load. Launch multiple analyses to observe changes.

## Performance

### Impact on performance

Enabling metrics has minimal impact:

- CPU overhead: < 1%
- Memory overhead: ~10-20 MB
- Added latency: < 1ms per metered operation

### Optimizations

- Queue metrics are updated every 10 seconds (configurable)
- Histograms use pre-defined buckets
- No collection if `METRICS_ENABLED=false`

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [prom-client (Node.js)](https://github.com/siimon/prom-client)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
