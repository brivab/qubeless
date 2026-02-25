import { Injectable, BadRequestException } from '@nestjs/common';
import { CoverageParser, ParsedCoverage, ParsedFileCoverage } from './base-parser.interface';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const lcovParse = require('lcov-parse');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseLcov = (content: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    lcovParse(content, (err: Error | null, data: any) => {
      if (err) reject(err);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      else resolve(data);
    });
  });
};

@Injectable()
export class LcovParserService implements CoverageParser {
  async parse(content: string | Buffer): Promise<ParsedCoverage> {
    try {
      const lcovContent = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
      const lcovData = await parseLcov(lcovContent);

      if (!lcovData || lcovData.length === 0) {
        throw new BadRequestException('Empty or invalid LCOV file');
      }

      const files: ParsedFileCoverage[] = [];
      let totalLines = 0;
      let coveredLines = 0;
      let totalBranches = 0;
      let coveredBranches = 0;

      for (const fileData of lcovData) {
        const lineHits: Record<string, number> = {};
        let fileLines = 0;
        let fileCoveredLines = 0;

        // Process line coverage
        if (fileData.lines && fileData.lines.details) {
          for (const lineDetail of fileData.lines.details) {
            const lineNumber = lineDetail.line.toString();
            const hitCount = lineDetail.hit;
            lineHits[lineNumber] = hitCount;
            fileLines++;
            if (hitCount > 0) {
              fileCoveredLines++;
            }
          }
        }

        // Process branch coverage
        const fileBranches = fileData.branches?.found || 0;
        const fileCoveredBranches = fileData.branches?.hit || 0;

        files.push({
          filePath: fileData.file || 'unknown',
          lines: fileLines,
          coveredLines: fileCoveredLines,
          branches: fileBranches,
          coveredBranches: fileCoveredBranches,
          lineHits,
        });

        totalLines += fileLines;
        coveredLines += fileCoveredLines;
        totalBranches += fileBranches;
        coveredBranches += fileCoveredBranches;
      }

      const coveragePercent = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;

      return {
        totalLines,
        coveredLines,
        totalBranches,
        coveredBranches,
        coveragePercent: Math.round(coveragePercent * 100) / 100, // Round to 2 decimals
        files,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to parse LCOV file: ${message}`);
    }
  }
}
