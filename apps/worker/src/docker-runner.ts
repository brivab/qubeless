import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import Docker, { type Container } from 'dockerode';
import { assertAnalyzerMeasures, assertAnalyzerReport, AnalyzerReport } from '@qubeless/shared';

export interface DockerRunOptions {
  dockerImage: string;
  workspacePath: string;
  outPath: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  memoryMb?: number;
  cpuLimit?: number;
}

export interface DockerRunResult {
  success: boolean;
  exitCode?: number;
  containerId?: string;
  reportPath?: string;
  measuresPath?: string;
  logPath: string;
  report?: AnalyzerReport;
  measures?: Record<string, number>;
  error?: string;
  errorType?: 'timeout' | 'oom' | 'docker' | 'exit_code' | 'unknown';
}

export class DockerRunner {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * Check if Docker daemon is accessible and operational
   */
  async checkHealth(): Promise<void> {
    // Try to get Docker version as a health check
    await (this.docker as any).version();
  }

  async run(options: DockerRunOptions): Promise<DockerRunResult> {
    const {
      dockerImage,
      workspacePath,
      outPath,
      env = {},
      timeoutMs = 5 * 60 * 1000,
      memoryMb,
      cpuLimit,
    } = options;

    await fsp.mkdir(outPath, { recursive: true });
    const logPath = path.join(outPath, 'run.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    const binds = [`${workspacePath}:/workspace:ro`, `${outPath}:/out`];
    const envVars = Object.entries(env).map(([key, value]) => `${key}=${value}`);

    let containerId: string | undefined;
    let containerRef: unknown = null;
    let timedOut = false;
    const timer = setTimeout(async () => {
      if (containerId) {
        timedOut = true;
        try {
          const container = this.docker.getContainer(containerId);
          await container.kill({ force: true });
        } catch (e) {
          // ignore kill errors
        }
      }
    }, timeoutMs);

    try {
      // Build HostConfig with optional resource limits
      const hostConfig: any = {
        Binds: binds,
        AutoRemove: false,
      };

      // Apply memory limit if specified (convert MB to bytes)
      if (memoryMb !== undefined && memoryMb > 0) {
        hostConfig.Memory = memoryMb * 1024 * 1024;
      }

      // Apply CPU limit if specified (in units of 1e-9 CPUs)
      if (cpuLimit !== undefined && cpuLimit > 0) {
        hostConfig.NanoCpus = cpuLimit * 1e9;
      }

      const container = await this.docker.createContainer({
        Image: dockerImage,
        Tty: false,
        Env: envVars,
        HostConfig: hostConfig,
      });
      containerId = container.id;
      containerRef = container;

      await container.start();

      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
      });
      // Pipe logs to file
      container.modem.demuxStream(stream, logStream, logStream);

      const { StatusCode } = await container.wait();
      clearTimeout(timer);

      logStream.end();

      const reportPath = path.join(outPath, 'report.json');
      const measuresPath = path.join(outPath, 'measures.json');

      const exitCode = StatusCode ?? 0;
      const okExitCodes = new Set([0, 1]); // allow linters that exit 1 on findings

      // Check if container was killed due to timeout
      if (timedOut) {
        return {
          success: false,
          exitCode,
          containerId,
          logPath,
          reportPath,
          measuresPath,
          error: `Analysis timed out after ${timeoutMs}ms`,
          errorType: 'timeout',
        };
      }

      // Check for OOM kill (exit code 137 typically indicates SIGKILL, often from OOM)
      if (exitCode === 137) {
        // Inspect container to check if it was OOM killed
        try {
          const containerInfo = await container.inspect();
          const oomKilled = containerInfo?.State?.OOMKilled;
          if (oomKilled) {
            return {
              success: false,
              exitCode,
              containerId,
              logPath,
              reportPath,
              measuresPath,
              error: `Analysis failed: Out of memory (limit: ${memoryMb ? memoryMb + 'MB' : 'default'})`,
              errorType: 'oom',
            };
          }
        } catch (e) {
          // Ignore inspection errors, fall through to generic exit code handling
        }
      }

      if (!okExitCodes.has(exitCode)) {
        return {
          success: false,
          exitCode,
          containerId,
          logPath,
          reportPath,
          measuresPath,
          error: `Container exited with code ${exitCode}`,
          errorType: 'exit_code',
        };
      }

      let report = await this.safeReadReport(reportPath);
      let measures = await this.safeReadMeasures(measuresPath);

      if (!report) {
        report = { analyzer: { name: 'unknown', version: 'unknown' }, issues: [] };
        await fsp.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8').catch(() => undefined);
      }
      if (!measures) {
        measures = { metrics: {} };
        await fsp.writeFile(measuresPath, JSON.stringify(measures, null, 2), 'utf8').catch(() => undefined);
      }

      return {
        success: true,
        exitCode,
        containerId,
        reportPath,
        measuresPath,
        logPath,
        report,
        measures: measures?.metrics,
      };
    } catch (error: any) {
      clearTimeout(timer);
      logStream.end();

      // Check if timeout occurred during execution
      if (timedOut) {
        return {
          success: false,
          containerId,
          logPath,
          reportPath: path.join(outPath, 'report.json'),
          measuresPath: path.join(outPath, 'measures.json'),
          error: `Analysis timed out after ${timeoutMs}ms`,
          errorType: 'timeout',
        };
      }

      // Determine error type based on error message
      let errorType: 'docker' | 'unknown' = 'unknown';
      let errorMessage = error?.message ?? 'Docker run failed';

      if (errorMessage.includes('docker') || errorMessage.includes('container') || errorMessage.includes('image')) {
        errorType = 'docker';
        errorMessage = `Docker error: ${errorMessage}`;
      }

      return {
        success: false,
        containerId,
        logPath,
        reportPath: path.join(outPath, 'report.json'),
        measuresPath: path.join(outPath, 'measures.json'),
        error: errorMessage,
        errorType,
      };
    } finally {
      clearTimeout(timer);
      logStream.end();
      if (containerRef) {
        try {
          const ref = containerRef as Container & { remove?: (options?: { force?: boolean }) => Promise<unknown> };
          if (ref.remove) {
            await ref.remove({ force: true });
          }
        } catch (e) {
          // ignore cleanup errors
        }
      }
    }
  }

  private async safeReadReport(reportPath: string) {
    try {
      const content = await fsp.readFile(reportPath, 'utf8');
      const parsed = JSON.parse(content);
      assertAnalyzerReport(parsed);
      return parsed;
    } catch (error: any) {
      // return null to let the caller decide how to handle missing/invalid report
      return null;
    }
  }

  private async safeReadMeasures(measuresPath: string) {
    try {
      const content = await fsp.readFile(measuresPath, 'utf8');
      const parsed = JSON.parse(content);
      assertAnalyzerMeasures(parsed);
      return parsed;
    } catch (error: any) {
      return null;
    }
  }
}
