#!/usr/bin/env node
import archiver, { ArchiverError } from "archiver";
import axios from "axios";
import { Command } from "commander";
import FormData from "form-data";
import fs from "fs";
import { createReadStream, createWriteStream } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { execFile } from "child_process";
import { finished } from "stream/promises";
import { performance } from "perf_hooks";

const execFileAsync = promisify(execFile);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_EXCLUDES = [
  "**/.git/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.turbo/**",
  "**/.nx/**",
  "**/.cache/**",
  "**/coverage/**",
  "**/.DS_Store",
  "**/tmp/**",
  "**/temp/**",
  "**/.tmp/**"
];

type SubmitOptions = {
  server: string;
  project: string;
  branch?: string;
  sha?: string;
  exclude?: string[];
  verbose?: boolean;
  wait?: boolean;
  pollInterval?: number;
  timeout?: number;
  failOnAnalysisFailed?: boolean;
  noGate?: boolean;
};

async function runGitCommand(args: string[], cwd: string, verbose: boolean): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  } catch (error) {
    if (verbose) {
      console.error(`Git command failed (${args.join(" ")}):`, (error as Error).message);
    }
    return null;
  }
}

async function resolveGitInfo(cwd: string, opts: SubmitOptions): Promise<{ branchName: string; commitSha: string }> {
  const branchName = opts.branch ?? (await runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"], cwd, Boolean(opts.verbose)));
  const commitSha = opts.sha ?? (await runGitCommand(["rev-parse", "HEAD"], cwd, Boolean(opts.verbose)));

  if (!branchName || !commitSha) {
    const missing = [
      !branchName ? "--branch" : null,
      !commitSha ? "--sha" : null
    ].filter(Boolean);
    const hint = missing.length ? ` Provide ${missing.join(" and ")} manually.` : "";
    throw new Error(`Unable to resolve git metadata from ${cwd}.${hint}`);
  }

  return { branchName, commitSha };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

async function createSourceZip(rootDir: string, excludes: string[], verbose: boolean): Promise<{ zipPath: string; size: number }> {
  const tmpDir = path.join(os.tmpdir(), "qubeless-submit");
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const zipPath = path.join(tmpDir, `source-${Date.now()}.zip`);
  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  const start = performance.now();
  archive.on("warning", (err: ArchiverError) => {
    console.warn("Archive warning:", err.message);
  });
  archive.on("error", (err: Error) => {
    throw err;
  });

  archive.pipe(output);
  archive.glob("**/*", {
    cwd: rootDir,
    dot: true,
    ignore: excludes
  });

  await archive.finalize();
  await finished(output);

  const { size } = await fs.promises.stat(zipPath);

  if (verbose) {
    const durationMs = performance.now() - start;
    console.log(`Zipped workspace to ${zipPath} in ${Math.round(durationMs)}ms`);
  }

  return { zipPath, size };
}

type SubmitResponse = {
  analysisId: string;
  webUrl?: string;
};

async function submitAnalysis(opts: SubmitOptions): Promise<SubmitResponse> {
  const cwd = process.cwd();
  const { branchName, commitSha } = await resolveGitInfo(cwd, opts);

  const excludes = [...DEFAULT_EXCLUDES, ...(opts.exclude ?? [])];
  if (opts.verbose) {
    console.log("Using exclude patterns:", excludes.join(", "));
  }

  const { zipPath, size } = await createSourceZip(cwd, excludes, Boolean(opts.verbose));
  console.log(`Zip size: ${formatBytes(size)}`);

  const url = `${opts.server.replace(/\/$/, "")}/projects/${encodeURIComponent(opts.project)}/analyses`;
  if (opts.verbose) {
    console.log(`Submitting to ${url}`);
  }

  const form = new FormData();
  form.append("branchName", branchName);
  form.append("commitSha", commitSha);
  form.append("sourceZip", createReadStream(zipPath), {
    filename: path.basename(zipPath),
    contentType: "application/zip"
  });

  try {
    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    const data = response.data ?? {};
    const analysisId = data.analysisId ?? data.id ?? data.analysis?.id;
    if (!analysisId) {
      throw new Error("Server did not return an analysis id");
    }
    console.log(`Analysis created with id: ${analysisId ?? "unknown"}`);
    if (data.status) {
      console.log(`Status: ${data.status}`);
    }
    if (data.webUrl) {
      console.log(`View analysis: ${data.webUrl}`);
    }
    return { analysisId, webUrl: data.webUrl };
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? error.response?.data || error.message
      : (error as Error).message;
    throw new Error(`Failed to submit analysis: ${message}`);
  }
}

type AnalysisStatus = {
  status: string;
  webUrl?: string;
};

async function fetchAnalysisStatus(server: string, analysisId: string): Promise<AnalysisStatus> {
  const url = `${server.replace(/\/$/, "")}/analyses/${encodeURIComponent(analysisId)}`;
  const response = await axios.get(url);
  const data = response.data ?? {};
  const status = data.status ?? data.analysis?.status ?? data.state;
  if (!status) {
    throw new Error(`No status returned for analysis ${analysisId}`);
  }
  return { status, webUrl: data.webUrl ?? data.analysis?.webUrl };
}

type QualityGateResult = {
  overall: string;
  [key: string]: unknown;
};

async function fetchQualityGate(server: string, analysisId: string): Promise<QualityGateResult> {
  const url = `${server.replace(/\/$/, "")}/analyses/${encodeURIComponent(analysisId)}/quality-gate-status`;
  const response = await axios.get(url);
  const data = response.data ?? {};
  const overall = data.overall ?? data.status;
  if (!overall) {
    throw new Error("Quality gate response missing overall status");
  }
  return data;
}

function main() {
  const program = new Command();

  const rawArgs = process.argv.slice(2);
  const cleanedArgs = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

  program
    .name("submit")
    .description("Submit the current workspace for analysis")
    .requiredOption("--server <url>", "API server URL, e.g. http://localhost:3001")
    .requiredOption("--project <key>", "Project key")
    .option("--branch <branch>", "Override branch name when git is unavailable")
    .option("--sha <sha>", "Override commit SHA when git is unavailable")
    .option("--exclude <pattern...>", "Additional glob patterns to exclude from the zip")
    .option("--wait", "Wait for analysis completion", false)
    .option("--poll-interval <ms>", "Polling interval in ms", (value) => Number(value), 2000)
    .option("--timeout <ms>", "Timeout in ms while waiting for analysis", (value) => Number(value), 600000)
    .option("--fail-on-analysis-failed", "Exit with code 1 if analysis ends in FAILED", true)
    .option("--no-gate", "Skip quality gate check (when waiting)", false)
    .option("--verbose", "Enable verbose logging", false)
    .parse(["node", "submit", ...cleanedArgs]);

  const options = program.opts<SubmitOptions>();

  submitAnalysis(options)
    .then(async ({ analysisId, webUrl }) => {
      if (!options.wait) {
        if (webUrl) {
          console.log(`View analysis: ${webUrl}`);
        } else {
          console.log("Re-run with --wait to poll for completion and quality gate.");
        }
        return;
      }

      const start = performance.now();
      let exitCode = 0;
      let lastStatus: string | null = null;
      let currentStatus: string | null = null;
      let analysisComplete = false;

      const abortHandler = () => {
        console.log("\nInterrupted by user.");
        process.exit(130);
      };
      process.on("SIGINT", abortHandler);

      try {
        while (true) {
          if (performance.now() - start > (options.timeout ?? 600000)) {
            throw new Error(`Timeout waiting for analysis ${analysisId}`);
          }

          let statusPayload: AnalysisStatus;
          try {
            statusPayload = await fetchAnalysisStatus(options.server, analysisId);
          } catch (err) {
            const message = axios.isAxiosError(err)
              ? err.response?.status === 404
                ? `Analysis ${analysisId} not found (404)`
                : err.response?.data || err.message
              : (err as Error).message;
            throw new Error(`Failed to fetch analysis status: ${message}`);
          }

          currentStatus = statusPayload.status;
          if (currentStatus !== lastStatus) {
            const elapsedSec = Math.round((performance.now() - start) / 1000);
            console.log(`Status: ${currentStatus}${elapsedSec ? ` (${elapsedSec}s)` : ""}`);
            lastStatus = currentStatus;
          } else if (options.verbose) {
            process.stdout.write(".");
          }

          if (currentStatus === "SUCCESS" || currentStatus === "FAILED") {
            analysisComplete = true;
            break;
          }

          await sleep(options.pollInterval ?? 2000);
        }

        if (!analysisComplete) {
          throw new Error("Analysis did not complete");
        }

        const elapsedSec = Math.round((performance.now() - start) / 1000);

        if (currentStatus === "FAILED") {
          console.log(`Analysis status: FAILED (${elapsedSec}s)`);
          if (options.failOnAnalysisFailed !== false) {
            exitCode = 1;
          }
          if (webUrl) {
            console.log(`View analysis: ${webUrl}`);
          }
          console.log(`Total elapsed: ${elapsedSec}s`);
          process.exitCode = exitCode;
          return;
        }

        console.log(`Analysis status: SUCCESS (${elapsedSec}s)`);

        if (options.noGate) {
          console.log(`Total elapsed: ${elapsedSec}s`);
          process.exitCode = exitCode;
          return;
        }

        let gate;
        try {
          gate = await fetchQualityGate(options.server, analysisId);
        } catch (err) {
          const message = axios.isAxiosError(err)
            ? err.response?.data || err.message
            : (err as Error).message;
          console.error(`Failed to fetch quality gate: ${message}`);
          const totalSec = Math.round((performance.now() - start) / 1000);
          console.log(`Total elapsed: ${totalSec}s`);
          process.exitCode = 1;
          return;
        }

        const overall = String(gate.overall ?? gate.status).toUpperCase();
        console.log(`Quality Gate: ${overall}`);
        if (gate.conditions && Array.isArray(gate.conditions)) {
          const summary = gate.conditions
            .map((c: any) => `${c.metric}: ${c.status}`)
            .join(", ");
          if (summary) {
            console.log(`Conditions: ${summary}`);
          }
        }

        if (overall === "PASS") {
          exitCode = 0;
        } else if (overall === "FAIL") {
          exitCode = 2;
        } else {
          console.warn(`Unknown quality gate status "${overall}"`);
          exitCode = 1;
        }

        const totalSec = Math.round((performance.now() - start) / 1000);
        console.log(`Total elapsed: ${totalSec}s`);

        process.exitCode = exitCode;
      } catch (err) {
        console.error((err as Error).message);
        process.exitCode = 1;
      } finally {
        process.off("SIGINT", abortHandler);
      }
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}

main();
