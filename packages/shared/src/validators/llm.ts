import { LlmOutput } from '../index';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizePath(value: string): string {
  let normalized = value.trim();
  if (normalized.startsWith('a/') || normalized.startsWith('b/')) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}`);
  value.forEach((entry) => {
    if (!isNonEmptyString(entry)) throw new Error(`Invalid ${field}`);
  });
}

function assertFileArray(value: unknown): asserts value is { path: string; content: string }[] {
  if (!Array.isArray(value)) throw new Error('Invalid files');
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid files');
    if (!isNonEmptyString((entry as any).path)) throw new Error('Invalid files');
    if (typeof (entry as any).content !== 'string') throw new Error('Invalid files');
  });
}

export function extractPatchFilePaths(patch: string): string[] {
  const files = new Set<string>();
  const lines = patch.split('\n');

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (match) {
        files.add(normalizePath(match[1]));
        files.add(normalizePath(match[2]));
      }
      continue;
    }

    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      const filePath = line.replace(/^(\+\+\+|---)\s+/, '').trim();
      if (!filePath || filePath === '/dev/null') continue;
      files.add(normalizePath(filePath));
    }
  }

  return Array.from(files);
}

export function assertLlmOutput(data: any): asserts data is LlmOutput {
  if (!data || typeof data !== 'object') throw new Error('Invalid LLM output');
  if (!isNonEmptyString(data.summary)) throw new Error('Invalid summary');
  assertFileArray(data.files);
  assertStringArray(data.notes, 'notes');
}

export function isLlmOutput(data: any): data is LlmOutput {
  try {
    assertLlmOutput(data);
    return true;
  } catch {
    return false;
  }
}

export function parseLlmOutputJson(text: string): LlmOutput {
  const parsed = JSON.parse(text);
  assertLlmOutput(parsed);
  return parsed;
}

export function assertLlmOutputScope(output: LlmOutput, allowedFiles: string[]): void {
  assertLlmOutput(output);

  if (!Array.isArray(allowedFiles) || allowedFiles.length === 0) {
    throw new Error('Invalid allowedFiles');
  }

  const allowedSet = new Set(allowedFiles.map(normalizePath));
  if (!output.files.length) {
    throw new Error('No files provided in LLM output');
  }

  const seen = new Set<string>();
  for (const file of output.files) {
    const normalized = normalizePath(file.path);
    if (!allowedSet.has(normalized)) {
      throw new Error(`File out of scope: ${file.path}`);
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate file entry: ${file.path}`);
    }
    seen.add(normalized);
  }
}
