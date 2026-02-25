import { Injectable, BadRequestException } from '@nestjs/common';
import { CoverageFormat } from '@prisma/client';
import { CoverageParser } from './base-parser.interface';
import { LcovParserService } from './lcov-parser.service';
import { CoberturaParserService } from './cobertura-parser.service';
import { JacocoParserService } from './jacoco-parser.service';

@Injectable()
export class ParserFactoryService {
  constructor(
    private readonly lcovParser: LcovParserService,
    private readonly coberturaParser: CoberturaParserService,
    private readonly jacocoParser: JacocoParserService,
  ) {}

  getParser(format: CoverageFormat): CoverageParser {
    switch (format) {
      case CoverageFormat.LCOV:
        return this.lcovParser;
      case CoverageFormat.COBERTURA:
        return this.coberturaParser;
      case CoverageFormat.JACOCO:
        return this.jacocoParser;
      default:
        throw new BadRequestException(`Unsupported coverage format: ${format}`);
    }
  }
}
