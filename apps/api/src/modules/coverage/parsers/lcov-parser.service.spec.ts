import { Test, TestingModule } from '@nestjs/testing';
import { LcovParserService } from './lcov-parser.service';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('LcovParserService', () => {
  let service: LcovParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LcovParserService],
    }).compile();

    service = module.get<LcovParserService>(LcovParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parse', () => {
    it('should parse valid LCOV content', async () => {
      const lcovContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample.lcov'),
        'utf-8',
      );

      const result = await service.parse(lcovContent);

      expect(result).toBeDefined();
      expect(result.totalLines).toBe(17);
      expect(result.coveredLines).toBe(15);
      expect(result.totalBranches).toBe(6);
      expect(result.coveredBranches).toBe(4);
      expect(result.coveragePercent).toBeCloseTo(88.24, 2);
      expect(result.files).toHaveLength(2);
    });

    it('should parse LCOV from Buffer', async () => {
      const lcovBuffer = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample.lcov'),
      );

      const result = await service.parse(lcovBuffer);

      expect(result).toBeDefined();
      expect(result.totalLines).toBe(17);
    });

    it('should parse file details correctly', async () => {
      const lcovContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample.lcov'),
        'utf-8',
      );

      const result = await service.parse(lcovContent);

      const firstFile = result.files[0];
      expect(firstFile.filePath).toBe('src/utils/math.ts');
      expect(firstFile.lines).toBe(10);
      expect(firstFile.coveredLines).toBe(10);
      expect(firstFile.branches).toBe(2);
      expect(firstFile.coveredBranches).toBe(2);
      expect(firstFile.lineHits).toBeDefined();
      expect(firstFile.lineHits['1']).toBe(1);
      expect(firstFile.lineHits['2']).toBe(10);
    });

    it('should handle uncovered lines', async () => {
      const lcovContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample.lcov'),
        'utf-8',
      );

      const result = await service.parse(lcovContent);

      const secondFile = result.files[1];
      expect(secondFile.filePath).toBe('src/services/calculator.ts');
      expect(secondFile.lines).toBe(7);
      expect(secondFile.coveredLines).toBe(5);
      expect(secondFile.lineHits['6']).toBe(0);
      expect(secondFile.lineHits['7']).toBe(0);
    });

    it('should throw error for empty LCOV content', async () => {
      await expect(service.parse('')).rejects.toThrow('Failed to parse LCOV file');
    });

    it('should throw error for invalid LCOV content', async () => {
      await expect(service.parse('invalid lcov content')).rejects.toThrow(
        'Failed to parse LCOV file',
      );
    });
  });
});
