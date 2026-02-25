import { Injectable, BadRequestException } from '@nestjs/common';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import { CoverageParser, ParsedCoverage, ParsedFileCoverage } from './base-parser.interface';

const parseXml = promisify(parseString);

@Injectable()
export class JacocoParserService implements CoverageParser {
  async parse(content: string | Buffer): Promise<ParsedCoverage> {
    try {
      const xmlContent = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await parseXml(xmlContent);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!result || !result.report) {
        throw new BadRequestException('Invalid JaCoCo XML format');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const report = result.report;
      const packages = report.package || [];

      const files: ParsedFileCoverage[] = [];
      let totalLines = 0;
      let coveredLines = 0;
      let totalBranches = 0;
      let coveredBranches = 0;

      for (const pkg of packages) {
        const packageName = pkg.$.name || '';
        const sourcefiles = pkg.sourcefile || [];

        for (const sourcefile of sourcefiles) {
          const filename = sourcefile.$.name || 'unknown';
          const fullPath = packageName ? `${packageName}/${filename}` : filename;
          const lines = sourcefile.line || [];
          const lineHits: Record<string, number> = {};
          let fileLines = 0;
          let fileCoveredLines = 0;
          let fileBranches = 0;
          let fileCoveredBranches = 0;

          for (const line of lines) {
            const lineNumber = line.$.nr;
            const instructionsCovered = parseInt(line.$.ci || '0', 10);
            const instructionsMissed = parseInt(line.$.mi || '0', 10);
            const branchesCovered = parseInt(line.$.cb || '0', 10);
            const branchesMissed = parseInt(line.$.mb || '0', 10);

            // A line is covered if any instructions were executed
            const isLineCovered = instructionsCovered > 0;
            lineHits[lineNumber] = isLineCovered ? 1 : 0;

            fileLines++;
            if (isLineCovered) {
              fileCoveredLines++;
            }

            // Count branches
            const lineBranches = branchesCovered + branchesMissed;
            if (lineBranches > 0) {
              fileBranches += lineBranches;
              fileCoveredBranches += branchesCovered;
            }
          }

          files.push({
            filePath: fullPath,
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
      throw new BadRequestException(`Failed to parse JaCoCo XML: ${message}`);
    }
  }
}
