import { Test, TestingModule } from '@nestjs/testing';
import { JacocoParserService } from './jacoco-parser.service';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('JacocoParserService', () => {
  let service: JacocoParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JacocoParserService],
    }).compile();

    service = module.get<JacocoParserService>(JacocoParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parse', () => {
    it('should parse valid JaCoCo XML content', async () => {
      const jacocoContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-jacoco.xml'),
        'utf-8',
      );

      const result = await service.parse(jacocoContent);

      expect(result).toBeDefined();
      expect(result.totalLines).toBe(17);
      expect(result.coveredLines).toBe(15);
      expect(result.totalBranches).toBe(8);
      expect(result.coveredBranches).toBe(4);
      expect(result.coveragePercent).toBeCloseTo(88.24, 2);
      expect(result.files).toHaveLength(2);
    });

    it('should parse JaCoCo XML from Buffer', async () => {
      const jacocoBuffer = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-jacoco.xml'),
      );

      const result = await service.parse(jacocoBuffer);

      expect(result).toBeDefined();
      expect(result.totalLines).toBe(17);
    });

    it('should parse file details correctly', async () => {
      const jacocoContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-jacoco.xml'),
        'utf-8',
      );

      const result = await service.parse(jacocoContent);

      const firstFile = result.files[0];
      expect(firstFile.filePath).toBe('com/example/utils/MathUtils.java');
      expect(firstFile.lines).toBe(10);
      expect(firstFile.coveredLines).toBe(10);
      expect(firstFile.branches).toBe(3);
      expect(firstFile.coveredBranches).toBe(2);
      expect(firstFile.lineHits).toBeDefined();
      expect(firstFile.lineHits['1']).toBe(1);
      expect(firstFile.lineHits['2']).toBe(1);
    });

    it('should handle branch coverage correctly', async () => {
      const jacocoContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-jacoco.xml'),
        'utf-8',
      );

      const result = await service.parse(jacocoContent);

      const firstFile = result.files[0];
      // Line 10 has 1 missed and 2 covered branches
      expect(firstFile.branches).toBe(3);
      expect(firstFile.coveredBranches).toBe(2);
    });

    it('should handle uncovered lines based on instructions', async () => {
      const jacocoContent = readFileSync(
        join(__dirname, '../../../../test/fixtures/coverage/sample-jacoco.xml'),
        'utf-8',
      );

      const result = await service.parse(jacocoContent);

      const secondFile = result.files[1];
      expect(secondFile.filePath).toBe('com/example/services/Calculator.java');
      expect(secondFile.lines).toBe(7);
      expect(secondFile.coveredLines).toBe(5);
      // Lines with mi > 0 and ci = 0 are uncovered
      expect(secondFile.lineHits['6']).toBe(0);
      expect(secondFile.lineHits['7']).toBe(0);
    });

    it('should throw error for empty XML content', async () => {
      await expect(service.parse('')).rejects.toThrow();
    });

    it('should throw error for invalid JaCoCo XML', async () => {
      await expect(service.parse('<invalid>xml</invalid>')).rejects.toThrow(
        'Invalid JaCoCo XML format',
      );
    });

    it('should throw error for malformed XML', async () => {
      await expect(service.parse('not xml at all')).rejects.toThrow(
        'Failed to parse JaCoCo XML',
      );
    });
  });
});
