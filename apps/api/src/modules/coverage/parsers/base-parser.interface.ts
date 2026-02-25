export interface ParsedCoverage {
  totalLines: number;
  coveredLines: number;
  totalBranches: number;
  coveredBranches: number;
  coveragePercent: number;
  files: ParsedFileCoverage[];
}

export interface ParsedFileCoverage {
  filePath: string;
  lines: number;
  coveredLines: number;
  branches: number;
  coveredBranches: number;
  lineHits: Record<string, number>; // { "1": 3, "2": 0, "3": 5 }
}

export interface CoverageParser {
  parse(content: string | Buffer): Promise<ParsedCoverage>;
}
