# Analysis Quotas - System Load Management

## Overview

This document describes the quota mechanism implemented to prevent system overload when creating analyses.

## Objectives

- **Prevent overload**: Limit the number of simultaneous analyses to protect system resources
- **Fairness**: Prevent a single project from monopolizing available workers
- **User experience**: Provide clear error messages when limits are reached

## Configuration

Quotas are configurable via environment variables:

### Environment Variables

| Variable                  | Description                                                                | Default Value | Example |
| ------------------------- | -------------------------------------------------------------------------- | ------------- | ------- |
| `MAX_RUNNING_ANALYSES`    | Maximum number of analyses running simultaneously across the entire system | `5`           | `10`    |
| `MAX_RUNNING_PER_PROJECT` | Maximum number of analyses running simultaneously per project              | `2`           | `3`     |

### Configuration in `.env`

```env
# Analysis Quotas
MAX_RUNNING_ANALYSES=5
MAX_RUNNING_PER_PROJECT=2
```

## Operation

### Quota Verification

When creating an analysis (via `POST /api/projects/:key/analyses`), the system performs the following checks **before** creating the analysis:

1. **Global quota**: Counts the total number of analyses with `RUNNING` status
   - If this number is ≥ `MAX_RUNNING_ANALYSES`, the request is rejected

2. **Per-project quota**: Counts the number of `RUNNING` analyses for the specific project
   - If this number is ≥ `MAX_RUNNING_PER_PROJECT`, the request is rejected

### Behavior When Quota is Exceeded

When a quota is exceeded:

- **HTTP Code**: `429 Too Many Requests`
- **Response Format**:
  ```json
  {
    "statusCode": 429,
    "message": "Maximum concurrent analyses limit reached (5 running). Please wait for some analyses to complete.",
    "error": "Too Many Requests"
  }
  ```

### Error Messages

Two types of messages are possible:

1. **Global quota exceeded**:

   ```
   Maximum concurrent analyses limit reached (5 running). Please wait for some analyses to complete.
   ```

2. **Per-project quota exceeded**:
   ```
   Maximum concurrent analyses per project limit reached (2 running for this project). Please wait for some analyses to complete.
   ```

## Implementation Details

### Modified Files

1. **[deploy.md](./deploy.md)**: Addition of environment variables in the `.env.production` reference block
2. **[analyses.service.ts](../apps/api/src/modules/analyses/analyses.service.ts)**:
   - Addition of the `checkQuotas()` method
   - Call of this method in `createForProject()` and `createForProjectWithUpload()`

### Main Code

```typescript
private async checkQuotas(projectId: string): Promise<void> {
  // Count total running analyses
  const totalRunning = await this.prisma.analysis.count({
    where: { status: AnalysisStatus.RUNNING },
  });

  if (totalRunning >= this.maxRunningAnalyses) {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Maximum concurrent analyses limit reached (${this.maxRunningAnalyses} running). Please wait for some analyses to complete.`,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Count running analyses for this project
  const projectRunning = await this.prisma.analysis.count({
    where: {
      projectId,
      status: AnalysisStatus.RUNNING,
    },
  });

  if (projectRunning >= this.maxRunningPerProject) {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Maximum concurrent analyses per project limit reached (${this.maxRunningPerProject} running for this project). Please wait for some analyses to complete.`,
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
```

## Tests

### Unit Tests

Unit tests are located in [analyses.service.spec.ts](../apps/api/src/modules/analyses/analyses.service.spec.ts).

Tested scenarios:

- ✅ Analysis creation when quotas are not exceeded
- ✅ Rejection with 429 when global quota is reached
- ✅ Rejection with 429 when per-project quota is reached
- ✅ Authorization when just below global quota
- ✅ Authorization when just below per-project quota
- ✅ Independent verification of per-project quotas
- ✅ Use of default values

### Manual Testing

To test manually:

1. **Configure low quotas** (to facilitate testing):

   ```env
   MAX_RUNNING_ANALYSES=2
   MAX_RUNNING_PER_PROJECT=1
   ```

2. **Simulate running analyses**:

   ```sql
   -- Set analyses to RUNNING status
   UPDATE "Analysis" SET status = 'RUNNING' WHERE id IN ('id1', 'id2');
   ```

3. **Attempt to create a new analysis**:

   ```bash
   curl -X POST http://localhost:3001/api/projects/my-project/analyses \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"commitSha": "abc123", "branch": "main"}'
   ```

4. **Verify the 429 response** with the appropriate message

## Non-Regression

The default values were chosen to be sufficiently large:

- `MAX_RUNNING_ANALYSES=5`: Allows multiple simultaneous analyses
- `MAX_RUNNING_PER_PROJECT=2`: Allows multiple projects to operate in parallel

These values should not interfere with normal usage while protecting the system against overload.

## Possible Future Improvements

- [ ] Add Prometheus metrics to track quota rejections
- [ ] Implement a queue system to queue analyses instead of rejecting them
- [ ] Add differentiated quotas by plan/project type
- [ ] Implement a priority system for certain critical projects
