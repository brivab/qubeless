export type VcsProvider = 'GITHUB' | 'GITLAB' | 'BITBUCKET';

export interface CommitFile {
  path: string;
  content: string;
}

export interface CreateBranchInput {
  repo: string;
  branch: string;
  baseBranch: string;
}

export interface CommitFilesInput {
  repo: string;
  branch: string;
  message: string;
  files: CommitFile[];
}

export interface CreatePullRequestInput {
  repo: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  body: string;
}

export interface PullRequestResult {
  number: number;
  url: string;
}

export interface VcsClient {
  provider: VcsProvider;
  createBranch(input: CreateBranchInput): Promise<string>;
  commitFiles(input: CommitFilesInput): Promise<string>;
  createPullRequest(input: CreatePullRequestInput): Promise<PullRequestResult>;
}

function encodePath(value: string) {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function splitRepo(repo: string) {
  const parts = repo.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid repo format: ${repo}`);
  }
  return { owner: parts[0], name: parts.slice(1).join('/') };
}

class GithubClient implements VcsClient {
  provider: VcsProvider = 'GITHUB';
  private token: string;
  private apiBaseUrl: string;

  constructor(token: string, baseUrl?: string) {
    this.token = token;
    this.apiBaseUrl = normalizeGithubBaseUrl(baseUrl);
  }

  private async getBranchHeadSha(repo: string, branch: string): Promise<string> {
    const url = `${this.apiBaseUrl}/repos/${repo}/git/ref/heads/${encodePath(branch)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'User-Agent': 'qubeless-worker',
        Accept: 'application/vnd.github+json',
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to fetch GitHub branch (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = JSON.parse(text) as { object: { sha: string } };
    return json.object.sha;
  }

  async createBranch(input: CreateBranchInput): Promise<string> {
    const baseSha = await this.getBranchHeadSha(input.repo, input.baseBranch);
    const url = `${this.apiBaseUrl}/repos/${input.repo}/git/refs`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'User-Agent': 'qubeless-worker',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${input.branch}`,
        sha: baseSha,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status !== 422 || !text.includes('Reference already exists')) {
        throw new Error(`Failed to create GitHub branch (${res.status}): ${text.slice(0, 200)}`);
      }
    }

    return baseSha;
  }

  private async getFileSha(repo: string, path: string, branch: string): Promise<string | null> {
    const url = `${this.apiBaseUrl}/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'User-Agent': 'qubeless-worker',
        Accept: 'application/vnd.github+json',
      },
    });
    if (res.status === 404) return null;
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to fetch GitHub file (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = JSON.parse(text) as { sha?: string };
    return json.sha ?? null;
  }

  async commitFiles(input: CommitFilesInput): Promise<string> {
    let lastCommitSha = '';
    for (const file of input.files) {
      const existingSha = await this.getFileSha(input.repo, file.path, input.branch);
      const url = `${this.apiBaseUrl}/repos/${input.repo}/contents/${encodePath(file.path)}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'User-Agent': 'qubeless-worker',
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.message,
          content: Buffer.from(file.content, 'utf8').toString('base64'),
          branch: input.branch,
          sha: existingSha ?? undefined,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Failed to update GitHub file (${res.status}): ${text.slice(0, 200)}`);
      }

      const json = JSON.parse(text) as { commit?: { sha?: string } };
      if (json.commit?.sha) {
        lastCommitSha = json.commit.sha;
      }
    }

    if (!lastCommitSha) {
      throw new Error('No GitHub commits created.');
    }
    return lastCommitSha;
  }

  async createPullRequest(input: CreatePullRequestInput): Promise<PullRequestResult> {
    const url = `${this.apiBaseUrl}/repos/${input.repo}/pulls`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'User-Agent': 'qubeless-worker',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: input.title,
        head: input.sourceBranch,
        base: input.targetBranch,
        body: input.body,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to create GitHub PR (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = JSON.parse(text) as { number: number; html_url: string };
    return { number: json.number, url: json.html_url };
  }
}

class GitlabClient implements VcsClient {
  provider: VcsProvider = 'GITLAB';
  private token: string;
  private apiBaseUrl: string;

  constructor(token: string, baseUrl?: string) {
    this.token = token;
    const normalized = normalizeGitlabBaseUrl(baseUrl);
    this.apiBaseUrl = `${normalized}/api/v4`;
  }

  private normalizeRepoFilePath(path: string) {
    return path.replace(/^\/+/, '');
  }

  private async getBranchHeadSha(repo: string, branch: string): Promise<string> {
    const projectId = encodeURIComponent(repo);
    const url = `${this.apiBaseUrl}/projects/${projectId}/repository/branches/${encodePath(branch)}`;
    const res = await fetch(url, {
      headers: {
        'Private-Token': this.token,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to fetch GitLab branch (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = JSON.parse(text) as { commit?: { id?: string } };
    if (!json.commit?.id) {
      throw new Error('GitLab branch response missing commit id');
    }
    return json.commit.id;
  }

  async createBranch(input: CreateBranchInput): Promise<string> {
    const projectId = encodeURIComponent(input.repo);
    const baseSha = await this.getBranchHeadSha(input.repo, input.baseBranch);
    const url = `${this.apiBaseUrl}/projects/${projectId}/repository/branches?branch=${encodeURIComponent(
      input.branch,
    )}&ref=${encodeURIComponent(input.baseBranch)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Private-Token': this.token,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status !== 400 || !text.includes('already exists')) {
        throw new Error(`Failed to create GitLab branch (${res.status}): ${text.slice(0, 200)}`);
      }
    }

    return baseSha;
  }

  private async fileExists(repo: string, path: string, branch: string): Promise<boolean> {
    const projectId = encodeURIComponent(repo);
    const normalizedPath = this.normalizeRepoFilePath(path);
    const url = `${this.apiBaseUrl}/projects/${projectId}/repository/files/${encodePath(
      normalizedPath,
    )}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
      headers: {
        'Private-Token': this.token,
      },
    });
    if (res.status === 404) return false;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch GitLab file (${res.status}): ${text.slice(0, 200)}`);
    }
    return true;
  }

  private async buildCommitActions(input: CommitFilesInput) {
    return Promise.all(
      input.files.map(async (file) => {
        const normalizedPath = this.normalizeRepoFilePath(file.path);
        const exists = await this.fileExists(input.repo, normalizedPath, input.branch);
        return {
          action: exists ? 'update' : 'create',
          file_path: normalizedPath,
          content: file.content,
        };
      }),
    );
  }

  async commitFiles(input: CommitFilesInput): Promise<string> {
    const projectId = encodeURIComponent(input.repo);
    const url = `${this.apiBaseUrl}/projects/${projectId}/repository/commits`;
    const headers = {
      'Private-Token': this.token,
      'Content-Type': 'application/json',
    };

    let actions = await this.buildCommitActions(input);
    let res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        branch: input.branch,
        commit_message: input.message,
        actions,
      }),
    });

    let text = await res.text();
    if (!res.ok && res.status === 400 && text.includes('already exists')) {
      // Fallback: force update actions if GitLab thinks files already exist
      actions = actions.map((action) =>
        action.action === 'create' ? { ...action, action: 'update' } : action,
      );
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branch: input.branch,
          commit_message: input.message,
          actions,
        }),
      });
      text = await res.text();
    }

    if (!res.ok) {
      throw new Error(`Failed to create GitLab commit (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = JSON.parse(text) as { id?: string };
    if (!json.id) {
      throw new Error('GitLab commit response missing id');
    }
    return json.id;
  }

  async createPullRequest(input: CreatePullRequestInput): Promise<PullRequestResult> {
    const projectId = encodeURIComponent(input.repo);
    const url = `${this.apiBaseUrl}/projects/${projectId}/merge_requests`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Private-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_branch: input.sourceBranch,
        target_branch: input.targetBranch,
        title: input.title,
        description: input.body,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to create GitLab MR (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = JSON.parse(text) as { iid: number; web_url: string };
    return { number: json.iid, url: json.web_url };
  }
}

class BitbucketClient implements VcsClient {
  provider: VcsProvider = 'BITBUCKET';
  private token: string;
  private apiBaseUrl: string;

  constructor(token: string, baseUrl?: string) {
    this.token = token;
    this.apiBaseUrl = normalizeBitbucketBaseUrl(baseUrl);
  }

  private buildAuthHeader() {
    if (this.token.includes(':') && !this.token.toLowerCase().startsWith('bearer ')) {
      return `Basic ${Buffer.from(this.token).toString('base64')}`;
    }
    return this.token.toLowerCase().startsWith('bearer ') ? this.token : `Bearer ${this.token}`;
  }

  private resolveRepo(repo: string) {
    const { owner, name } = splitRepo(repo);
    return { workspace: owner, repoSlug: name };
  }

  private async getBranchHeadSha(repo: string, branch: string): Promise<string> {
    const { workspace, repoSlug } = this.resolveRepo(repo);
    const url = `${this.apiBaseUrl}/repositories/${workspace}/${repoSlug}/refs/branches/${encodePath(
      branch,
    )}`;
    const res = await fetch(url, {
      headers: {
        Authorization: this.buildAuthHeader(),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to fetch Bitbucket branch (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = JSON.parse(text) as { target?: { hash?: string } };
    if (!json.target?.hash) {
      throw new Error('Bitbucket branch response missing hash');
    }
    return json.target.hash;
  }

  async createBranch(input: CreateBranchInput): Promise<string> {
    const { workspace, repoSlug } = this.resolveRepo(input.repo);
    const baseSha = await this.getBranchHeadSha(input.repo, input.baseBranch);
    const url = `${this.apiBaseUrl}/repositories/${workspace}/${repoSlug}/refs/branches`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.buildAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.branch,
        target: { hash: baseSha },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status !== 400 || !text.includes('already exists')) {
        throw new Error(`Failed to create Bitbucket branch (${res.status}): ${text.slice(0, 200)}`);
      }
    }

    return baseSha;
  }

  async commitFiles(input: CommitFilesInput): Promise<string> {
    const { workspace, repoSlug } = this.resolveRepo(input.repo);
    const url = `${this.apiBaseUrl}/repositories/${workspace}/${repoSlug}/src`;
    const form = new FormData();
    form.set('branch', input.branch);
    form.set('message', input.message);
    for (const file of input.files) {
      const blob = new Blob([file.content], { type: 'text/plain' });
      form.append(file.path, blob, file.path);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.buildAuthHeader(),
      },
      body: form,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to create Bitbucket commit (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = JSON.parse(text) as { hash?: string };
    if (!json.hash) {
      throw new Error('Bitbucket commit response missing hash');
    }
    return json.hash;
  }

  async createPullRequest(input: CreatePullRequestInput): Promise<PullRequestResult> {
    const { workspace, repoSlug } = this.resolveRepo(input.repo);
    const url = `${this.apiBaseUrl}/repositories/${workspace}/${repoSlug}/pullrequests`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.buildAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: input.title,
        description: input.body,
        source: { branch: { name: input.sourceBranch } },
        destination: { branch: { name: input.targetBranch } },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Failed to create Bitbucket PR (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = JSON.parse(text) as { id?: number; links?: { html?: { href?: string } } };
    if (!json.id) {
      throw new Error('Bitbucket PR response missing id');
    }
    return { number: json.id, url: json.links?.html?.href ?? '' };
  }
}

export function createVcsClient(
  provider: VcsProvider,
  token: string,
  options?: { gitlabBaseUrl?: string; githubBaseUrl?: string; bitbucketBaseUrl?: string },
): VcsClient {
  if (provider === 'GITHUB') {
    return new GithubClient(token, options?.githubBaseUrl);
  }
  if (provider === 'BITBUCKET') {
    return new BitbucketClient(token, options?.bitbucketBaseUrl);
  }
  return new GitlabClient(token, options?.gitlabBaseUrl);
}

function normalizeGitlabBaseUrl(value?: string) {
  const fallback = 'https://gitlab.com';
  if (!value) return fallback;
  let base = value.trim();
  if (!base) return fallback;
  base = base.replace(/\/+$/, '');
  if (base.endsWith('/api/v4')) {
    base = base.slice(0, -'/api/v4'.length);
  }
  return base || fallback;
}

function normalizeGithubBaseUrl(value?: string) {
  const fallback = 'https://api.github.com';
  if (!value) return fallback;
  const base = value.trim().replace(/\/+$/, '');
  if (!base) return fallback;

  const baseWithScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  try {
    const host = new URL(baseWithScheme).host.toLowerCase();
    if (host === 'github.com' || host === 'www.github.com' || host === 'api.github.com') {
      return fallback;
    }
  } catch {
    // Ignore parse errors and fall through to string-based normalization.
  }

  if (baseWithScheme.endsWith('/api/v3')) return baseWithScheme;
  if (baseWithScheme.includes('api.github.com')) return fallback;
  return `${baseWithScheme}/api/v3`;
}

function normalizeBitbucketBaseUrl(value?: string) {
  const fallback = 'https://api.bitbucket.org/2.0';
  if (!value) return fallback;
  const base = value.trim().replace(/\/+$/, '');
  if (!base) return fallback;
  if (base.endsWith('/2.0')) return base;
  return `${base}/2.0`;
}
