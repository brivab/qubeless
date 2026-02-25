# Worker Resource Limits

This document describes how to configure resource limits for Docker analyzers executed by the worker.

## Overview

To prevent Docker analyzers from monopolizing machine resources, the worker can apply limits on:
- **Execution time** (timeout)
- **Memory** (RAM)
- **CPU**

These limits are configurable via environment variables and are applied at the Docker container level.

## Configuration

### Environment variables

Add these variables to your `.env` or `.env.local` file:

```bash
# Execution timeout in milliseconds (default: 600000 = 10 minutes)
ANALYZER_TIMEOUT_MS=600000

# Memory limit in megabytes (default: not set)
ANALYZER_MEMORY_MB=1024

# CPU limit in number of CPUs (default: not set)
# 1 = 1 full CPU, 0.5 = 50% of a CPU, etc.
ANALYZER_CPU_LIMIT=1
```

### Default values

If the variables are not defined:
- **ANALYZER_TIMEOUT_MS**: 600000 ms (10 minutes)
- **ANALYZER_MEMORY_MB**: not set (no memory limit)
- **ANALYZER_CPU_LIMIT**: not set (no CPU limit)

## Behavior

### Timeout (execution time limit)

When an analyzer exceeds the configured timeout:
- The Docker container is killed (`docker kill`)
- The analysis is marked as **FAILED**
- The error message states: `Analysis timed out after {timeoutMs}ms`
- The error type is: `timeout`

### Out Of Memory (OOM)

When an analyzer exceeds the memory limit:
- Docker kills the container (OOM Kill)
- The analysis is marked as **FAILED**
- The error message states: `Analysis failed: Out of memory (limit: {memoryMb}MB)`
- The error type is: `oom`

### CPU Limit

The CPU limit restricts processor usage:
- `1` = 1 full CPU (100%)
- `0.5` = 50% of a CPU
- `2` = 2 full CPUs

This limit does not stop the container, it simply slows down its execution to not exceed the limit.

### Docker Errors

In case of Docker errors (image not found, network issue, etc.):
- The analysis is marked as **FAILED**
- The error message starts with: `Docker error: ...`
- The error type is: `docker`

### Abnormal Exit Code

If the container terminates with an exit code other than 0 or 1:
- The analysis is marked as **FAILED**
- The error message states: `Container exited with code {exitCode}`
- The error type is: `exit_code`

Note: code 1 is accepted because some linters return 1 when they find issues.

## Logs and diagnostics

All analyzer failures are logged with the following information:
- `analysisId`: ID of the analysis
- `analyzer`: Key of the analyzer
- `dockerImage`: Docker image used
- `exitCode`: Exit code of the container
- `error`: Error message
- `errorType`: Type of error (`timeout`, `oom`, `docker`, `exit_code`, `unknown`)
- `containerId`: ID of the Docker container
- `logPath`: Path to the container logs

Container logs are always saved in `{outDir}/run.log` and uploaded to S3/MinIO.

## Backward compatibility

If no environment variables are defined, the behavior is identical to the previous version:
- Default timeout of 10 minutes
- No memory limit
- No CPU limit

This ensures compatibility with existing installations.

## Configuration examples

### Configuration for development environment

```bash
# Short timeout to quickly detect issues
ANALYZER_TIMEOUT_MS=120000  # 2 minutes

# Light limits
ANALYZER_MEMORY_MB=512
ANALYZER_CPU_LIMIT=0.5
```

### Configuration for production environment

```bash
# Generous timeout
ANALYZER_TIMEOUT_MS=600000  # 10 minutes

# Limits to prevent resource monopolization
ANALYZER_MEMORY_MB=2048
ANALYZER_CPU_LIMIT=2
```

### Configuration for machine with limited resources

```bash
# Moderate timeout
ANALYZER_TIMEOUT_MS=300000  # 5 minutes

# Strict limits
ANALYZER_MEMORY_MB=512
ANALYZER_CPU_LIMIT=0.5
```

## Monitoring

To monitor resource usage and analyzer failures:

1. Check worker logs for error messages with `errorType`
2. Consult the `run.log` files uploaded to S3/MinIO
3. Monitor analyses marked as FAILED in the database

## Troubleshooting

### Analyzers are regularly killed (timeout)

- Increase `ANALYZER_TIMEOUT_MS`
- Verify that analyzers are not blocked (deadlock, network wait, etc.)

### Analyzers are killed for OOM

- Increase `ANALYZER_MEMORY_MB`
- Check if the analyzer has a memory leak
- Optimize the analyzer configuration if possible

### Analyses are very slow

- Increase `ANALYZER_CPU_LIMIT`
- Check the CPU load of the host machine
- Reduce `WORKER_CONCURRENCY` if multiple workers are running in parallel

## Technical implementation

Limits are applied via Docker options:
- `HostConfig.Memory`: memory limit in bytes
- `HostConfig.NanoCpus`: CPU limit in nanocpus (1 CPU = 1e9 nanocpus)

The timeout is managed by a `setTimeout` that kills the container with `docker kill`.
