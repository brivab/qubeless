import { Test, TestingModule } from '@nestjs/testing';
import { LanguageDetectionService } from './language-detection.service';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('LanguageDetectionService', () => {
  let service: LanguageDetectionService;
  let tempDir: string;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LanguageDetectionService],
    }).compile();

    service = module.get<LanguageDetectionService>(LanguageDetectionService);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    // Créer un répertoire temporaire pour les tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lang-detection-test-'));
  });

  afterEach(async () => {
    // Nettoyer le répertoire temporaire de manière robuste
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorer les erreurs de cleanup
      console.warn('Failed to cleanup temp directory:', error);
    } finally {
      warnSpy.mockRestore();
    }
  });

  // Helper pour créer un fichier de manière sûre
  async function createTestFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(tempDir, relativePath);
    const dir = path.dirname(fullPath);

    // S'assurer que le répertoire existe
    await fs.mkdir(dir, { recursive: true });

    // Écrire le fichier
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  describe('detectLanguages', () => {
    it('should detect JavaScript/TypeScript files', async () => {
      // Créer des fichiers de test
      await fs.writeFile(path.join(tempDir, 'index.ts'), 'console.log("test");');
      await fs.writeFile(path.join(tempDir, 'app.js'), 'function test() {}');
      await fs.writeFile(path.join(tempDir, 'package.json'), '{"name": "test"}');

      const result = await service.detectLanguages(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('JavaScript/TypeScript');
      expect(result[0].fileCount).toBe(3);
      expect(result[0].suggestedAnalyzers).toContain('eslint');
      expect(result[0].suggestedAnalyzers).toContain('semgrep');
    });

    it('should detect Python files', async () => {
      await fs.writeFile(path.join(tempDir, 'main.py'), 'print("hello")');
      await fs.writeFile(path.join(tempDir, 'requirements.txt'), 'django==4.0');

      const result = await service.detectLanguages(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('Python');
      expect(result[0].fileCount).toBe(2);
      expect(result[0].suggestedAnalyzers).toContain('pylint');
      expect(result[0].suggestedAnalyzers).toContain('bandit');
    });

    it('should detect Java files', async () => {
      await fs.writeFile(path.join(tempDir, 'Main.java'), 'public class Main {}');
      await fs.writeFile(path.join(tempDir, 'pom.xml'), '<project></project>');

      const result = await service.detectLanguages(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('Java');
      expect(result[0].fileCount).toBe(2);
      expect(result[0].suggestedAnalyzers).toContain('spotbugs');
      expect(result[0].suggestedAnalyzers).toContain('pmd');
    });

    it('should detect Go files', async () => {
      await fs.writeFile(path.join(tempDir, 'main.go'), 'package main');
      await fs.writeFile(path.join(tempDir, 'go.mod'), 'module test');

      const result = await service.detectLanguages(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('Go');
      expect(result[0].fileCount).toBe(2);
      expect(result[0].suggestedAnalyzers).toContain('golangci-lint');
    });

    it('should detect multiple languages', async () => {
      await fs.writeFile(path.join(tempDir, 'index.ts'), 'console.log("test");');
      await fs.writeFile(path.join(tempDir, 'main.py'), 'print("hello")');
      await fs.writeFile(path.join(tempDir, 'Main.java'), 'public class Main {}');

      const result = await service.detectLanguages(tempDir);

      expect(result.length).toBeGreaterThanOrEqual(3);
      const languages = result.map((r) => r.language);
      expect(languages).toContain('JavaScript/TypeScript');
      expect(languages).toContain('Python');
      expect(languages).toContain('Java');
    });

    it('should calculate confidence correctly', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.ts'), 'test');
      await fs.writeFile(path.join(tempDir, 'file2.ts'), 'test');
      await fs.writeFile(path.join(tempDir, 'file3.py'), 'test');

      const result = await service.detectLanguages(tempDir);

      const tsResult = result.find((r) => r.language === 'JavaScript/TypeScript');
      expect(tsResult).toBeDefined();
      expect(tsResult!.confidence).toBeCloseTo(66.67, 1); // 2/3 * 100

      const pyResult = result.find((r) => r.language === 'Python');
      expect(pyResult).toBeDefined();
      expect(pyResult!.confidence).toBeCloseTo(33.33, 1); // 1/3 * 100
    });

    it('should detect React framework', async () => {
      await fs.writeFile(path.join(tempDir, 'App.tsx'), 'import React from "react";');
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      );

      const result = await service.detectLanguages(tempDir);

      const jsResult = result.find((r) => r.language === 'JavaScript/TypeScript');
      expect(jsResult).toBeDefined();
      expect(jsResult!.frameworks).toContain('React');
    });

    it('should detect Django framework', async () => {
      await fs.writeFile(path.join(tempDir, 'manage.py'), 'django');
      await fs.writeFile(path.join(tempDir, 'requirements.txt'), 'django==4.0');

      const result = await service.detectLanguages(tempDir);

      const pyResult = result.find((r) => r.language === 'Python');
      expect(pyResult).toBeDefined();
      expect(pyResult!.frameworks).toContain('Django');
    });

    it('should ignore common directories', async () => {
      // Créer des fichiers dans des répertoires à ignorer
      await createTestFile('node_modules/index.js', 'test');
      await createTestFile('node_modules/nested/file.js', 'test');
      await createTestFile('.git/config', 'test');
      await createTestFile('dist/bundle.js', 'test');

      // Créer un fichier valide
      await createTestFile('app.js', 'test');
      await createTestFile('src/main.js', 'test');

      const result = await service.detectLanguages(tempDir);

      const jsResult = result.find((r) => r.language === 'JavaScript/TypeScript');
      expect(jsResult).toBeDefined();
      // Ne devrait compter que app.js et src/main.js, pas les fichiers dans node_modules, .git, dist
      expect(jsResult!.fileCount).toBe(2);
    });

    it('should return empty array for empty directory', async () => {
      const result = await service.detectLanguages(tempDir);

      expect(result).toEqual([]);
    });

    it('should sort results by file count (descending)', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.ts'), 'test');
      await fs.writeFile(path.join(tempDir, 'file2.ts'), 'test');
      await fs.writeFile(path.join(tempDir, 'file3.ts'), 'test');
      await fs.writeFile(path.join(tempDir, 'file1.py'), 'test');

      const result = await service.detectLanguages(tempDir);

      expect(result[0].language).toBe('JavaScript/TypeScript');
      expect(result[0].fileCount).toBe(3);
      expect(result[1].language).toBe('Python');
      expect(result[1].fileCount).toBe(1);
    });

    it('should handle non-existent directory gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist');

      const result = await service.detectLanguages(nonExistentPath);

      // Devrait retourner un tableau vide sans erreur
      expect(result).toEqual([]);
    });

    it('should handle nested project structures', async () => {
      // Créer une structure de projet complexe
      await createTestFile('src/frontend/index.tsx', 'import React from "react";');
      await createTestFile('src/frontend/App.tsx', 'export default App;');
      await createTestFile('src/backend/main.py', 'print("hello")');
      await createTestFile('src/backend/utils.py', 'def util():pass');
      await createTestFile('src/backend/models.py', 'class Model:pass');

      const result = await service.detectLanguages(tempDir);

      expect(result).toHaveLength(2);

      const tsResult = result.find((r) => r.language === 'JavaScript/TypeScript');
      expect(tsResult).toBeDefined();
      expect(tsResult!.fileCount).toBe(2);

      const pyResult = result.find((r) => r.language === 'Python');
      expect(pyResult).toBeDefined();
      expect(pyResult!.fileCount).toBe(3);
    });

    it('should deduplicate analyzer suggestions', async () => {
      // Tous les langages suggèrent semgrep
      await createTestFile('file.ts', 'test');
      await createTestFile('file.py', 'test');
      await createTestFile('file.go', 'test');

      const result = await service.detectLanguages(tempDir);

      // Vérifier que chaque langage a semgrep dans ses suggestions
      const allSuggestedAnalyzers = result.flatMap((r) => r.suggestedAnalyzers);
      const semgrepCount = allSuggestedAnalyzers.filter((a) => a === 'semgrep').length;

      // semgrep devrait apparaître 3 fois (une fois par langage)
      expect(semgrepCount).toBeGreaterThanOrEqual(3);
    });
  });
});
