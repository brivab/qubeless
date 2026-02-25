import { Injectable, BadRequestException } from '@nestjs/common';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import { CoverageParser, ParsedCoverage, ParsedFileCoverage } from './base-parser.interface';

const parseXml = promisify(parseString);

@Injectable()
export class CoberturaParserService implements CoverageParser {
  async parse(content: string | Buffer): Promise<ParsedCoverage> {
    try {
      const xmlContent = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await parseXml(xmlContent);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!result || !result.coverage) {
        throw new BadRequestException('Invalid Cobertura XML format');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const coverage = result.coverage;
      const packages = coverage.packages?.[0]?.package || [];

      const files: ParsedFileCoverage[] = [];
      let totalLines = 0;
      let coveredLines = 0;
      let totalBranches = 0;
      let coveredBranches = 0;

      for (const pkg of packages) {
        const classes = pkg.classes?.[0]?.class || [];

        for (const cls of classes) {
          const filename = cls.$.filename || cls.$.name || 'unknown';
          const lines = cls.lines?.[0]?.line || [];
          const lineHits: Record<string, number> = {};
          let fileLines = 0;
          let fileCoveredLines = 0;
          let fileBranches = 0;
          let fileCoveredBranches = 0;

          for (const line of lines) {
            const lineNumber = line.$.number;
            const hits = parseInt(line.$.hits || '0', 10);
            const isBranch = line.$.branch === 'true';

            lineHits[lineNumber] = hits;
            fileLines++;
            if (hits > 0) {
              fileCoveredLines++;
            }

            if (isBranch) {
              fileBranches++;
              const conditionCoverage = line.$['condition-coverage'];
              if (conditionCoverage) {
                // Parse condition-coverage format: "50% (1/2)"
                const match = conditionCoverage.match(/\((\d+)\/(\d+)\)/);
                if (match) {
                  const covered = parseInt(match[1], 10);
                  fileCoveredBranches += covered;
                }
              } else if (hits > 0) {
                fileCoveredBranches++;
              }
            }
          }

          files.push({
            filePath: filename,
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
      }

      const coveragePercent = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;

      return {
        totalLines,
        coveredLines,
        totalBranches,
        coveredBranches,
        coveragePercent: Math.round(coveragePercent * 100) / 100,
        files,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to parse Cobertura XML: ${message}`);
    }
  }
}
