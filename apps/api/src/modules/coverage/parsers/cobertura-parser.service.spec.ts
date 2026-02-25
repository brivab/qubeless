import { Test, TestingModule } from '@nestjs/testing';
import { CoberturaParserService } from './cobertura-parser.service';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('CoberturaParserService', () => {
  let service: CoberturaParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoberturaParserService],
    }).compile();

    service = module.get<CoberturaParserService>(CoberturaParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parse', () => {
    it('should parse valid Cobertura XML content', async () => {
      const coberturaContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-cobertura.xml'),
        'utf-8',
      );

      const result = await service.parse(coberturaContent);

      expect(result).toBeDefined();
      expect(result.totalLines).toBe(17);
      expect(result.coveredLines).toBe(15);
      expect(result.totalBranches).toBe(3);
      expect(result.coveredBranches).toBe(4);
      expect(result.coveragePercent).toBeCloseTo(88.24, 2);
      expect(result.files).toHaveLength(2);
    });

    it('should parse Cobertura XML from Buffer', async () => {
      const coberturaBuffer = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-cobertura.xml'),
      );

      const result = await service.parse(coberturaBuffer);

      expect(result).toBeDefined();
      expect(result.totalLines).toBe(17);
    });

    it('should parse file details correctly', async () => {
      const coberturaContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-cobertura.xml'),
        'utf-8',
      );

      const result = await service.parse(coberturaContent);

      const firstFile = result.files[0];
      expect(firstFile.filePath).toBe('utils/math.ts');
      expect(firstFile.lines).toBe(10);
      expect(firstFile.coveredLines).toBe(10);
      expect(firstFile.lineHits).toBeDefined();
      expect(firstFile.lineHits['1']).toBe(1);
      expect(firstFile.lineHits['2']).toBe(10);
    });

    it('should handle branch coverage correctly', async () => {
      const coberturaContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-cobertura.xml'),
        'utf-8',
      );

      const result = await service.parse(coberturaContent);

      const firstFile = result.files[0];
      expect(firstFile.branches).toBe(1);
      expect(firstFile.coveredBranches).toBe(2);
    });

    it('should handle uncovered lines', async () => {
      const coberturaContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-cobertura.xml'),
        'utf-8',
      );

      const result = await service.parse(coberturaContent);

      const secondFile = result.files[1];
      expect(secondFile.filePath).toBe('services/calculator.ts');
      expect(secondFile.lines).toBe(7);
      expect(secondFile.coveredLines).toBe(5);
      expect(secondFile.lineHits['6']).toBe(0);
      expect(secondFile.lineHits['7']).toBe(0);
    });

    it('should throw error for empty XML content', async () => {
      await expect(service.parse('')).rejects.toThrow();
    });

    it('should throw error for invalid Cobertura XML', async () => {
      await expect(service.parse('<invalid>xml</invalid>')).rejects.toThrow(
        'Invalid Cobertura XML format',
      );
    });

    it('should throw error for malformed XML', async () => {
      await expect(service.parse('not xml at all')).rejects.toThrow(
        'Failed to parse Cobertura XML',
      );
    });
  });
});
