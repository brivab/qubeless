import { BadRequestException } from '@nestjs/common';
import { CoverageFormat } from '@prisma/client';
import { ParserFactoryService } from './parser-factory.service';

describe('ParserFactoryService', () => {
  const lcovParser = { parse: jest.fn() };
  const coberturaParser = { parse: jest.fn() };
  const jacocoParser = { parse: jest.fn() };

  let service: ParserFactoryService;

  beforeEach(() => {
    service = new ParserFactoryService(
      lcovParser as any,
      coberturaParser as any,
      jacocoParser as any,
    );
  });

  it('should return LCOV parser for CoverageFormat.LCOV', () => {
    const result = service.getParser(CoverageFormat.LCOV);

    expect(result).toBe(lcovParser);
  });

  it('should return Cobertura parser for CoverageFormat.COBERTURA', () => {
    const result = service.getParser(CoverageFormat.COBERTURA);

    expect(result).toBe(coberturaParser);
  });

  it('should return JaCoCo parser for CoverageFormat.JACOCO', () => {
    const result = service.getParser(CoverageFormat.JACOCO);

    expect(result).toBe(jacocoParser);
  });

  it('should throw BadRequestException for unsupported coverage format', () => {
    expect(() => service.getParser('UNKNOWN_FORMAT' as CoverageFormat)).toThrow(
      new BadRequestException('Unsupported coverage format: UNKNOWN_FORMAT'),
    );
  });
});
