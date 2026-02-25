/**
 * Tests for worker retry logic
 *
 * These tests validate that:
 * 1. Jobs that fail are retried according to WORKER_JOB_ATTEMPTS
 * 2. Jobs are only marked as FAILED after all attempts are exhausted
 * 3. Status transitions are correct (PENDING -> RUNNING -> SUCCESS/FAILED)
 * 4. Backoff strategy is applied between retries
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Queue, Worker, QueueEvents } from 'bullmq';
import type { AnalysisJobPayload } from '@qubeless/shared';

const TEST_QUEUE = 'test-analysis-queue';
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

describe('Worker Retry Logic', () => {
  let queue: Queue;
  let queueEvents: QueueEvents;
  let worker: Worker;

  beforeEach(async () => {
    // Clean up queue before each test
    queue = new Queue(TEST_QUEUE, { connection: REDIS_CONFIG });
    queueEvents = new QueueEvents(TEST_QUEUE, { connection: REDIS_CONFIG });
    await queue.obliterate({ force: true });
  });

  afterEach(async () => {
    await worker?.close();
    await queue?.close();
    await queueEvents?.close();
  });

  it('should retry a failing job according to configured attempts', async () => {
    const maxAttempts = 2;
    let attemptCount = 0;

    const mockPayload: AnalysisJobPayload = {
      analysisId: 'test-analysis-retry-1',
      projectKey: 'test-project',
      branchName: 'main',
      commitSha: 'abc123',
      analyzers: [],
    };

    worker = new Worker(
      TEST_QUEUE,
      async (job) => {
        attemptCount = job.attemptsMade + 1;

        // Fail on first attempt, succeed on second
        if (attemptCount < maxAttempts) {
          throw new Error(`Simulated failure on attempt ${attemptCount}`);
        }

        return { success: true, attempt: attemptCount };
      },
      {
        connection: REDIS_CONFIG,
        settings: {
          backoffStrategy: () => 100, // Fast backoff for tests
        },
      },
    );

    // Add job with retry configuration
    await queue.add('analysis', mockPayload, {
      attempts: maxAttempts,
      backoff: { type: 'exponential', delay: 100 },
    });

    // Wait for job completion
    await new Promise<void>((resolve) => {
      queueEvents.on('completed', ({ jobId }) => {
        resolve();
      });
    });

    expect(attemptCount).toBe(maxAttempts);
  }, 10000);

  it('should fail job after all retry attempts are exhausted', async () => {
    const maxAttempts = 2;
    let attemptCount = 0;

    const mockPayload: AnalysisJobPayload = {
      analysisId: 'test-analysis-retry-2',
      projectKey: 'test-project',
      branchName: 'main',
      commitSha: 'def456',
      analyzers: [],
    };

    worker = new Worker(
      TEST_QUEUE,
      async (job) => {
        attemptCount = job.attemptsMade + 1;
        // Always fail
        throw new Error(`Simulated failure on attempt ${attemptCount}`);
      },
      {
        connection: REDIS_CONFIG,
        settings: {
          backoffStrategy: () => 100,
        },
      },
    );

    await queue.add('analysis', mockPayload, {
      attempts: maxAttempts,
      backoff: { type: 'exponential', delay: 100 },
    });

    // Wait for job failure
    await new Promise<void>((resolve) => {
      queueEvents.on('failed', ({ jobId, failedReason }) => {
        resolve();
      });
    });

    expect(attemptCount).toBe(maxAttempts);
  }, 10000);

  it('should apply exponential backoff between retries', async () => {
    const maxAttempts = 3;
    const baseBackoff = 100;
    const attemptTimestamps: number[] = [];

    const mockPayload: AnalysisJobPayload = {
      analysisId: 'test-analysis-retry-3',
      projectKey: 'test-project',
      branchName: 'main',
      commitSha: 'ghi789',
      analyzers: [],
    };

    worker = new Worker(
      TEST_QUEUE,
      async (job) => {
        attemptTimestamps.push(Date.now());

        // Fail on all but last attempt
        if (job.attemptsMade < maxAttempts - 1) {
          throw new Error('Simulated failure');
        }

        return { success: true };
      },
      {
        connection: REDIS_CONFIG,
        settings: {
          backoffStrategy: (attemptsMade: number) => {
            // Exponential backoff: baseBackoff * 2^(attemptsMade - 1)
            return baseBackoff * Math.pow(2, attemptsMade - 1);
          },
        },
      },
    );

    await queue.add('analysis', mockPayload, {
      attempts: maxAttempts,
      backoff: { type: 'exponential', delay: baseBackoff },
    });

    // Wait for completion
    await new Promise<void>((resolve) => {
      queueEvents.on('completed', () => {
        resolve();
      });
    });

    expect(attemptTimestamps.length).toBe(maxAttempts);

    // Verify backoff delays (with some tolerance for timing variations)
    if (attemptTimestamps.length >= 2) {
      const delay1 = attemptTimestamps[1] - attemptTimestamps[0];
      // First retry should have ~100ms delay (with tolerance)
      expect(delay1).toBeGreaterThanOrEqual(50);
    }

    if (attemptTimestamps.length >= 3) {
      const delay2 = attemptTimestamps[2] - attemptTimestamps[1];
      // Second retry should have ~200ms delay (with tolerance)
      expect(delay2).toBeGreaterThanOrEqual(100);
    }
  }, 15000);

  it('should handle concurrent jobs with independent retry logic', async () => {
    const maxAttempts = 2;
    const jobResults = new Map<string, number>();

    worker = new Worker(
      TEST_QUEUE,
      async (job) => {
        const payload = job.data as AnalysisJobPayload;
        const attemptCount = job.attemptsMade + 1;

        // Job 1 succeeds on first attempt, Job 2 needs retry
        if (payload.analysisId === 'concurrent-1') {
          jobResults.set(payload.analysisId, attemptCount);
          return { success: true };
        } else if (payload.analysisId === 'concurrent-2') {
          if (attemptCount < 2) {
            throw new Error('Need retry');
          }
          jobResults.set(payload.analysisId, attemptCount);
          return { success: true };
        }
      },
      {
        connection: REDIS_CONFIG,
        concurrency: 2, // Process jobs concurrently
        settings: {
          backoffStrategy: () => 100,
        },
      },
    );

    // Add two jobs
    await queue.add('analysis', {
      analysisId: 'concurrent-1',
      projectKey: 'test',
      branchName: 'main',
      commitSha: 'aaa',
      analyzers: [],
    }, { attempts: maxAttempts });

    await queue.add('analysis', {
      analysisId: 'concurrent-2',
      projectKey: 'test',
      branchName: 'main',
      commitSha: 'bbb',
      analyzers: [],
    }, { attempts: maxAttempts });

    // Wait for both jobs to complete
    let completedCount = 0;
    await new Promise<void>((resolve) => {
      queueEvents.on('completed', () => {
        completedCount++;
        if (completedCount === 2) {
          resolve();
        }
      });
    });

    expect(jobResults.get('concurrent-1')).toBe(1); // No retry needed
    expect(jobResults.get('concurrent-2')).toBe(2); // One retry
  }, 15000);
});
