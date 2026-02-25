#!/usr/bin/env node
import archiver from "archiver";
import axios, { type AxiosInstance } from "axios";
import { Command } from "commander";
import FormData from "form-data";
import fs from "fs";
import { createReadStream, createWriteStream } from "fs";
import { finished } from "stream/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { performance } from "perf_hooks";
import ignore from "ignore";

const execFileAsync = promisify(execFile);
const DEFAULT_CONFIG_FILE = ".codequalityrc.json";
const DEFAULT_POLL_INTERVAL = 2000;
const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 min

type ScannerConfig = {
  serverUrl: string;
  projectKey: string;
  branchName?: string;
};

type RunOptions = {
  config?: string;
  server?: string;
  project?: string;
  branch?: string;
  branchName?: string;
  sha?: string;
  prProvider?: string;
  prRepo?: string;
  prNumber?: number;
  prSourceBranch?: string;
  prTargetBranch?: string;
  pollInterval?: number;
  timeout?: number;
  noGate?: boolean;
  failOnAnalysisFailed?: boolean;
  verbose?: boolean;
  token?: string;
  coverage?: string;
  coverageFormat?: string;
};

type PullRequestContext = {
  provider: "GITHUB" | "GITLAB" | "BITBUCKET";
  repo: string;
  prNumber: number;
  sourceBranch: string;
  targetBranch: string;
};

function normalizeProvider(raw?: string): PullRequestContext["provider"] | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === "GITHUB" || upper === "GITLAB" || upper === "BITBUCKET") {
    return upper as PullRequestContext["provider"];
  }
  return null;
}

function buildPullRequestFromArgs(opts: RunOptions): PullRequestContext | null {
  const hasAny =
    Boolean(opts.prProvider) ||
    Boolean(opts.prRepo) ||
    Boolean(opts.prNumber) ||
    Boolean(opts.prSourceBranch) ||
    Boolean(opts.prTargetBranch);
  if (!hasAny) return null;

  const provider = normalizeProvider(opts.prProvider);
  if (!provider) {
    throw new Error("prProvider invalide (GITHUB|GITLAB|BITBUCKET)");
  }
  if (!opts.prRepo) {
    throw new Error("prRepo est requis");
  }
  if (opts.prNumber === undefined || Number.isNaN(opts.prNumber)) {
    throw new Error("prNumber est requis et doit être un nombre");
  }
  if (!opts.prSourceBranch) {
    throw new Error("prSourceBranch est requis");
  }
  if (!opts.prTargetBranch) {
    throw new Error("prTargetBranch est requis");
  }

  return {
    provider,
    repo: opts.prRepo,
    prNumber: Number(opts.prNumber),
    sourceBranch: opts.prSourceBranch,
    targetBranch: opts.prTargetBranch,
  };
}

function detectGitlabPullRequest(): PullRequestContext | null {
  const prNumberRaw = process.env.CI_MERGE_REQUEST_IID;
  const repo = process.env.CI_MERGE_REQUEST_PROJECT_PATH ?? process.env.CI_PROJECT_PATH;
  const sourceBranch = process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME;
  const targetBranch = process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME;
  if (!prNumberRaw || !repo || !sourceBranch || !targetBranch) return null;
  const prNumber = Number(prNumberRaw);
  if (Number.isNaN(prNumber)) return null;
  return {
    provider: "GITLAB",
    repo,
    prNumber,
    sourceBranch,
    targetBranch,
  };
}

function detectGithubPullRequest(): PullRequestContext | null {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return null;
  try {
    const raw = fs.readFileSync(eventPath, "utf8");
    const payload = JSON.parse(raw) as any;
    const pr = payload.pull_request;
    if (!pr) return null;
    const repo = pr.base?.repo?.full_name;
    const sourceBranch = pr.head?.ref;
    const targetBranch = pr.base?.ref;
    const prNumber = Number(pr.number);
    if (!repo || !sourceBranch || !targetBranch || Number.isNaN(prNumber)) return null;
    return {
      provider: "GITHUB",
      repo,
      prNumber,
      sourceBranch,
      targetBranch,
    };
  } catch {
    return null;
  }
}

function detectBitbucketPullRequest(): PullRequestContext | null {
  const prNumberRaw = process.env.BITBUCKET_PR_ID;
  const repo = process.env.BITBUCKET_REPO_FULL_NAME;
  const sourceBranch = process.env.BITBUCKET_BRANCH;
  const targetBranch = process.env.BITBUCKET_PR_DESTINATION_BRANCH;
  if (!prNumberRaw || !repo || !sourceBranch || !targetBranch) return null;
  const prNumber = Number(prNumberRaw);
  if (Number.isNaN(prNumber)) return null;
  return {
    provider: "BITBUCKET",
    repo,
    prNumber,
    sourceBranch,
    targetBranch,
  };
}

function detectPullRequestContext(): PullRequestContext | null {
  return detectGitlabPullRequest() ?? detectGithubPullRequest() ?? detectBitbucketPullRequest();
}

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

async function runGit(cmd: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", cmd);
    return stdout.trim();
  } catch {
    return null;
  }
}

function normalizeServerUrl(raw: string) {
  if (!raw) return raw;
  // Keep explicit /api base, only trim trailing slashes to avoid double "//"
  return raw.replace(/\/+$/, "");
}

async function detectGit(branchOverride?: string, shaOverride?: string) {
  const branch = branchOverride ?? (await runGit(["rev-parse", "--abbrev-ref", "HEAD"]));
  const sha = shaOverride ?? (await runGit(["rev-parse", "HEAD"]));
  return { branch, sha };
}

function loadConfig(configPath: string): ScannerConfig {
  try {
    const content = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(content) as ScannerConfig;
    return parsed;
  } catch (err) {
    throw new Error(`Impossible de lire la config ${configPath}: ${(err as Error).message}`);
  }
}

function saveDefaultConfig(configPath: string) {
  const defaultConfig: ScannerConfig = {
    serverUrl: "http://localhost:3001",
    projectKey: "my-project",
    branchName: "main"
  };
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf8");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function deriveProjectName(key: string) {
  const spaced = key.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadGitignorePatterns(rootDir: string): string[] {
  const gitignorePath = path.join(rootDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) return [];
  const raw = fs.readFileSync(gitignorePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const patterns: string[] = [];
  for (const line of lines) {
    let p = line.replace(/^\/+/, "");
    if (p.endsWith("/")) {
      p = `${p}**`;
    }
    patterns.push(p);
    patterns.push(`**/${p}`);
  }
  return patterns;
}

async function createSourceZip(rootDir: string, verbose: boolean): Promise<{ zipPath: string; size: number }> {
  const tmpDir = path.join(os.tmpdir(), "qubeless-scanner");
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const zipPath = path.join(tmpDir, `source-${Date.now()}.zip`);

  const ig = ignore().add([".git/", "node_modules/", "dist/", "build/"]);
  const gitignorePatterns = loadGitignorePatterns(rootDir);
  if (gitignorePatterns.length) {
    ig.add(gitignorePatterns);
  }

  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("warning", (err) => console.warn("Archive warning:", err.message));
  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);
  const start = performance.now();
  archive.glob("**/*", {
    cwd: rootDir,
    dot: true,
    ignore: [...DEFAULT_EXCLUDES, ...gitignorePatterns],
    // fallback filter with ignore lib for edge cases
    // archiver passes entry with name/path relative to cwd
    // @ts-expect-error archiver filter typing
    filter: (entry: { name: string }) => !ig.ignores(entry.name)
  });

  await archive.finalize();
  await finished(output);
  const { size } = await fs.promises.stat(zipPath);

  if (verbose) {
    const dur = Math.round(performance.now() - start);
    console.log(`Zip créé: ${zipPath} (${formatBytes(size)} en ${dur}ms)`);
  }

  return { zipPath, size };
}

async function submitAnalysis(
  client: AxiosInstance,
  opts: {
    serverUrl: string;
    projectKey: string;
    branchName: string;
    commitSha: string;
    zipPath: string;
    coveragePath?: string;
    coverageFormat?: string;
    pullRequest?: PullRequestContext | null;
  },
) {
  const url = `${opts.serverUrl.replace(/\/$/, "")}/projects/${encodeURIComponent(opts.projectKey)}/analyses`;
  console.log(`[scanner] POST ${url}`);
  const form = new FormData();

  // Important: Ajouter TOUS les champs texte AVANT les fichiers
  if (!opts.pullRequest) {
    form.append("branch", opts.branchName);
    form.append("branchName", opts.branchName);
  }
  form.append("commitSha", opts.commitSha);
  if (opts.pullRequest) {
    form.append("provider", opts.pullRequest.provider);
    form.append("repo", opts.pullRequest.repo);
    form.append("prNumber", String(opts.pullRequest.prNumber));
    form.append("sourceBranch", opts.pullRequest.sourceBranch);
    form.append("targetBranch", opts.pullRequest.targetBranch);
  }

  // Ajouter coverageFormat AVANT les fichiers si présent
  if (opts.coveragePath) {
    const coverageFormat = opts.coverageFormat || "LCOV";
    console.log(`[scanner] Ajout du fichier de couverture: ${opts.coveragePath} (${coverageFormat})`);
    form.append("coverageFormat", coverageFormat);
  }

  // Puis ajouter les fichiers
  form.append("sourceZip", createReadStream(opts.zipPath), {
    filename: path.basename(opts.zipPath),
    contentType: "application/zip"
  });

  if (opts.coveragePath) {
    form.append("coverageFile", createReadStream(opts.coveragePath), {
      filename: path.basename(opts.coveragePath),
      contentType: "text/plain"
    });
  }

  const response = await client.post(url, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 300000, // 5 minutes timeout for upload
    validateStatus: () => true
  });
  const data = response.data ?? {};
  if (response.status >= 400) {
    if (response.status === 404) {
      throw new Error(
        `Upload échoué (${response.status}): projet "${opts.projectKey}" introuvable sur ${opts.serverUrl}`,
      );
    }
    throw new Error(`Upload échoué (${response.status}): ${JSON.stringify(data)}`);
  }
  const analysisId = data.analysisId ?? data.id ?? data.analysis?.id;
  if (!analysisId) {
    throw new Error("Le serveur n'a pas renvoyé d'analysisId");
  }
  return {
    analysisId,
    webUrl: data.webUrl as string | undefined,
    statusUrl: data.statusUrl as string | undefined,
    gateUrl: data.gateUrl as string | undefined,
  };
}

async function fetchAnalysisStatus(client: AxiosInstance, serverUrl: string, analysisId: string, statusUrl?: string) {
  const url = statusUrl ?? `${serverUrl.replace(/\/$/, "")}/analyses/${encodeURIComponent(analysisId)}`;
  console.log(`[scanner] GET ${url}`);
  const { data } = await client.get(url);
  const status = data.status ?? data.analysis?.status ?? data.state;
  if (!status) {
    throw new Error("Réponse de statut invalide");
  }
  return status as string;
}

async function fetchQualityGate(
  client: AxiosInstance,
  serverUrl: string,
  analysisId: string,
  gateUrl?: string,
) {
  const url = gateUrl ?? `${serverUrl.replace(/\/$/, "")}/analyses/${encodeURIComponent(analysisId)}/quality-gate-status`;
  console.log(`[scanner] GET ${url}`);
  const { data } = await client.get(url);
  const overall = (data.status ?? data.overall ?? "").toString().toUpperCase();
  return { overall, data };
}

async function ensureProjectExists(client: AxiosInstance, serverUrl: string, projectKey: string, verbose: boolean) {
  const base = serverUrl.replace(/\/$/, "");
  const projectUrl = `${base}/projects/${encodeURIComponent(projectKey)}`;

  try {
    const res = await client.get(projectUrl, { validateStatus: () => true });
    if (res.status === 200) {
      if (verbose) console.log(`[scanner] Projet ${projectKey} déjà présent (${projectUrl})`);
      return;
    }
    if (res.status !== 404) {
      throw new Error(`Impossible de vérifier le projet (${res.status}): ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    if (!axios.isAxiosError(err)) throw err;
    if (err.response && err.response.status !== 404) {
      throw new Error(`Erreur lors du check projet (${err.response.status}): ${JSON.stringify(err.response.data)}`);
    }
  }

  const createUrl = `${base}/projects`;
  const payload = { key: projectKey, name: deriveProjectName(projectKey) || projectKey };
  if (verbose) console.log(`[scanner] Projet absent, création via POST ${createUrl} payload=${JSON.stringify(payload)}`);
  const resCreate = await client.post(createUrl, payload, { validateStatus: () => true });
  if (resCreate.status >= 400) {
    throw new Error(`Création du projet échouée (${resCreate.status}): ${JSON.stringify(resCreate.data)}`);
  }
  if (verbose) console.log(`[scanner] Projet créé: ${projectKey}`);
}

async function ensureQualityGateExists(client: AxiosInstance, serverUrl: string, projectKey: string, verbose: boolean) {
  const base = serverUrl.replace(/\/$/, "");
  const gateUrl = `${base}/projects/${encodeURIComponent(projectKey)}/quality-gate`;

  try {
    const res = await client.get(gateUrl, { validateStatus: () => true });
    if (res.status === 200) {
      if (verbose) console.log(`[scanner] Quality gate déjà présent pour ${projectKey}`);
      return;
    }
    if (res.status !== 404) {
      throw new Error(`Check quality gate échoué (${res.status}): ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    if (!axios.isAxiosError(err)) throw err;
    if (err.response && err.response.status !== 404) {
      throw new Error(`Erreur lors du check quality gate (${err.response.status}): ${JSON.stringify(err.response.data)}`);
    }
  }

  const payload = { name: "Default" };
  if (verbose) console.log(`[scanner] Quality gate absent, création via POST ${gateUrl}`);
  const resCreate = await client.post(gateUrl, payload, { validateStatus: () => true });
  if (resCreate.status >= 400) {
    throw new Error(
      `Création du quality gate échouée (${resCreate.status}): ${JSON.stringify(resCreate.data)}`,
    );
  }
  if (verbose) console.log(`[scanner] Quality gate créé pour ${projectKey}`);
}

async function waitForAnalysis(
  client: AxiosInstance,
  serverUrl: string,
  analysisId: string,
  statusUrl: string | undefined,
  options: { pollInterval: number; timeout: number; failOnAnalysisFailed: boolean },
) {
  const started = performance.now();
  let lastStatus: string | null = null;
  while (true) {
    if (performance.now() - started > options.timeout) {
      throw new Error("Timeout atteint en attendant l'analyse");
    }
    let status: string;
    try {
      status = await fetchAnalysisStatus(client, serverUrl, analysisId, statusUrl);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        throw new Error(`Analyse ${analysisId} introuvable (404)`);
      }
      throw err;
    }

    if (status !== lastStatus) {
      const elapsed = Math.round((performance.now() - started) / 1000);
      console.log(`Statut: ${status} (${elapsed}s)`);
      lastStatus = status;
    } else {
      process.stdout.write(".");
    }

    if (status === "SUCCESS") {
      return status;
    }
    if (status === "FAILED") {
      if (options.failOnAnalysisFailed) {
        throw new Error("Analyse en échec (FAILED)");
      }
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, options.pollInterval));
  }
}

async function handleRun(commandOpts: RunOptions) {
  const cwd = process.cwd();
  const configPath = path.resolve(commandOpts.config ?? path.join(cwd, DEFAULT_CONFIG_FILE));
  const config = loadConfig(configPath);

  const serverUrl = normalizeServerUrl(commandOpts.server ?? config.serverUrl);
  const projectKey = commandOpts.project ?? config.projectKey;
  if (!serverUrl || !projectKey) {
    throw new Error("serverUrl et projectKey sont requis (config ou options)");
  }

  const token = commandOpts.token ?? process.env.SCANNER_TOKEN;
  const client = axios.create({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const branchOverride = commandOpts.branch ?? commandOpts.branchName;
  const gitInfo = await detectGit(branchOverride, commandOpts.sha);
  const branchName = branchOverride ?? gitInfo.branch ?? config.branchName ?? "main";
  const commitSha = commandOpts.sha ?? gitInfo.sha;
  if (!branchName) {
    throw new Error("branchName requis (via --branch, config ou git)");
  }
  if (!commitSha) {
    throw new Error("commitSha requis (via --sha ou git)");
  }

  const prContext = buildPullRequestFromArgs(commandOpts) ?? detectPullRequestContext();
  if (prContext && commandOpts.branch) {
    if (commandOpts.verbose) {
      console.warn("[scanner] --branch ignoré car un contexte PR est présent.");
    }
  }
  if (prContext && commandOpts.verbose) {
    console.log("[scanner] PR context détecté:", prContext);
  }

  if (commandOpts.verbose) {
    console.log("Config:", {
      serverUrl,
      projectKey,
      branchName,
      commitSha,
      configPath,
      tokenPresent: Boolean(token),
      prContext: prContext ?? undefined,
    });
  }

  const { zipPath, size } = await createSourceZip(cwd, Boolean(commandOpts.verbose));
  console.log(`Archive prête (${formatBytes(size)})`);

  // Valider le fichier de couverture si fourni
  let coveragePath: string | undefined;
  if (commandOpts.coverage) {
    const coverageFullPath = path.resolve(cwd, commandOpts.coverage);
    if (!fs.existsSync(coverageFullPath)) {
      throw new Error(`Fichier de couverture introuvable: ${coverageFullPath}`);
    }
    coveragePath = coverageFullPath;
    if (commandOpts.verbose) {
      console.log(`Fichier de couverture trouvé: ${coveragePath}`);
    }
  }

  await ensureProjectExists(client, serverUrl, projectKey, Boolean(commandOpts.verbose));
  await ensureQualityGateExists(client, serverUrl, projectKey, Boolean(commandOpts.verbose));

  const { analysisId, webUrl, statusUrl, gateUrl } = await submitAnalysis(client, {
    serverUrl,
    projectKey,
    branchName,
    commitSha,
    zipPath,
    coveragePath,
    coverageFormat: commandOpts.coverageFormat,
    pullRequest: prContext,
  });
  console.log(`Analyse créée: ${analysisId}`);
  if (webUrl) {
    console.log(`URL: ${webUrl}`);
  }

  const pollInterval = commandOpts.pollInterval ?? DEFAULT_POLL_INTERVAL;
  const timeout = commandOpts.timeout ?? DEFAULT_TIMEOUT;
  const failOnAnalysisFailed = commandOpts.failOnAnalysisFailed ?? true;

  let finalStatus: string;
  try {
    finalStatus = await waitForAnalysis(client, serverUrl, analysisId, statusUrl, {
      pollInterval,
      timeout,
      failOnAnalysisFailed,
    });
  } catch (err: any) {
    console.error(err?.message ?? "Erreur pendant le polling");
    process.exit(1);
    return;
  }

  if (finalStatus === "FAILED") {
    console.error("Analyse FAILED");
    process.exit(1);
    return;
  }

  if (commandOpts.noGate) {
    console.log("Quality gate ignoré (--no-gate)");
    process.exit(0);
    return;
  }

  try {
    const gate = await fetchQualityGate(client, serverUrl, analysisId, gateUrl);
    console.log(`Quality Gate: ${gate.overall}`);
    if (gate.overall === "PASS") {
      process.exit(0);
      return;
    }
    if (gate.overall === "FAIL") {
      process.exit(2);
      return;
    }
    console.warn(`Quality gate inconnu: ${gate.overall}`);
    process.exit(1);
  } catch (err: any) {
    console.error(`Erreur quality gate: ${err?.message ?? err}`);
    process.exit(1);
  }
}

function handleInit(configPath: string) {
  const fullPath = path.resolve(configPath);
  if (fs.existsSync(fullPath)) {
    console.log(`Config déjà présente: ${fullPath}`);
    return;
  }
  saveDefaultConfig(fullPath);
  console.log(`Config créée: ${fullPath}`);
}

async function main() {
  const program = new Command();
  program.name("scanner").description("Qubeless scanner CLI");

  // pnpm ajoute parfois un "--" en tête; on le retire pour éviter de bloquer le parsing
  const argv = process.argv.slice();
  if (argv[2] === "--") {
    argv.splice(2, 1);
  }

  program
    .command("init")
    .description("Initialiser la configuration du scanner")
    .option("-c, --config <path>", "Chemin du fichier config", DEFAULT_CONFIG_FILE)
    .action((opts) => {
      handleInit(opts.config);
    });

  program
    .command("run")
    .description("Soumettre et suivre une analyse")
    .option("-c, --config <path>", "Chemin du fichier config", DEFAULT_CONFIG_FILE)
    .option("--server <url>", "URL du serveur API")
    .option("--project <key>", "Project key")
    .option("--branch <branch>", "Branche (override)")
    .option("--branch-name <branch>", "Alias de --branch")
    .option("--branchName <branch>", "Alias camelCase de --branch")
    .option("--sha <sha>", "Commit SHA (override)")
    .option("--pr-provider <provider>", "PR provider (GITHUB|GITLAB|BITBUCKET)")
    .option("--pr-repo <repo>", "PR repo (org/repo ou group/project)")
    .option("--pr-number <number>", "PR number", (v) => Number(v))
    .option("--pr-source-branch <branch>", "PR source branch")
    .option("--pr-target-branch <branch>", "PR target branch")
    .option("--coverage <path>", "Chemin vers le fichier de couverture (LCOV, Cobertura, JaCoCo)")
    .option("--coverage-format <format>", "Format du fichier de couverture (LCOV, COBERTURA, JACOCO)", "LCOV")
    .option("--poll-interval <ms>", "Intervalle de polling", (v) => Number(v), DEFAULT_POLL_INTERVAL)
    .option("--timeout <ms>", "Timeout du polling", (v) => Number(v), DEFAULT_TIMEOUT)
    .option("--no-gate", "Ignorer la récupération du quality gate", false)
    .option("--fail-on-analysis-failed", "Retourner 1 si l'analyse est FAILED", true)
    .option("--verbose", "Logs verbeux", false)
    .option("--token <token>", "Token API (sinon SCANNER_TOKEN)")
    .action((opts: RunOptions) => {
      handleRun(opts).catch((err) => {
        console.error(err?.message ?? err);
        process.exit(1);
      });
    });

  program.parse(argv);
}

main();
