import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  fileCount: number;
  suggestedAnalyzers: string[];
  frameworks?: string[];
}

interface FilePattern {
  extensions: string[];
  configFiles: string[];
  frameworks?: {
    name: string;
    indicators: string[];
  }[];
}

@Injectable()
export class LanguageDetectionService {
  private readonly languagePatterns: Record<string, FilePattern> = {
    'JavaScript/TypeScript': {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
      configFiles: ['package.json', 'tsconfig.json', 'jsconfig.json', '.eslintrc.js', '.eslintrc.json'],
      frameworks: [
        {
          name: 'React',
          indicators: ['.jsx', '.tsx', 'react', 'next.config'],
        },
        {
          name: 'Vue',
          indicators: ['.vue', 'vue.config', 'nuxt.config'],
        },
        {
          name: 'Angular',
          indicators: ['angular.json', '@angular/core'],
        },
        {
          name: 'Node.js',
          indicators: ['package.json'],
        },
      ],
    },
    Python: {
      extensions: ['.py', '.pyw', '.pyx'],
      configFiles: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'poetry.lock'],
      frameworks: [
        {
          name: 'Django',
          indicators: ['django', 'manage.py'],
        },
        {
          name: 'Flask',
          indicators: ['flask', 'app.py'],
        },
        {
          name: 'FastAPI',
          indicators: ['fastapi', 'main.py'],
        },
      ],
    },
    Java: {
      extensions: ['.java'],
      configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'],
      frameworks: [
        {
          name: 'Spring',
          indicators: ['@SpringBootApplication', 'spring-boot', 'application.properties', 'application.yml'],
        },
        {
          name: 'Maven',
          indicators: ['pom.xml'],
        },
        {
          name: 'Gradle',
          indicators: ['build.gradle', 'build.gradle.kts'],
        },
      ],
    },
    Go: {
      extensions: ['.go'],
      configFiles: ['go.mod', 'go.sum'],
      frameworks: [],
    },
    PHP: {
      extensions: ['.php'],
      configFiles: ['composer.json', 'composer.lock'],
      frameworks: [
        {
          name: 'Laravel',
          indicators: ['artisan', 'laravel'],
        },
        {
          name: 'Symfony',
          indicators: ['symfony', 'bin/console'],
        },
      ],
    },
    Rust: {
      extensions: ['.rs'],
      configFiles: ['Cargo.toml', 'Cargo.lock'],
      frameworks: [],
    },
    'C#': {
      extensions: ['.cs', '.csx'],
      configFiles: ['.csproj', '.sln', '.vbproj'],
      frameworks: [
        {
          name: '.NET',
          indicators: ['.csproj', '.sln'],
        },
      ],
    },
    Ruby: {
      extensions: ['.rb', '.rake'],
      configFiles: ['Gemfile', 'Gemfile.lock', 'Rakefile'],
      frameworks: [
        {
          name: 'Rails',
          indicators: ['rails', 'config/routes.rb'],
        },
      ],
    },
    Swift: {
      extensions: ['.swift'],
      configFiles: ['Package.swift', '.xcodeproj'],
      frameworks: [],
    },
    Kotlin: {
      extensions: ['.kt', '.kts'],
      configFiles: ['build.gradle.kts'],
      frameworks: [],
    },
  };

  private readonly analyzerMapping: Record<string, string[]> = {
    'JavaScript/TypeScript': ['eslint', 'semgrep'],
    Python: ['pylint', 'bandit', 'semgrep'],
    Java: ['spotbugs', 'pmd', 'semgrep'],
    Go: ['golangci-lint', 'semgrep'],
    PHP: ['phpstan', 'psalm', 'semgrep'],
    Rust: ['clippy', 'semgrep'],
    'C#': ['roslyn-analyzers', 'semgrep'],
    Ruby: ['rubocop', 'brakeman', 'semgrep'],
    Swift: ['swiftlint'],
    Kotlin: ['detekt'],
  };

  // Analyseurs transversaux (pertinents pour tous les langages)
  private readonly universalAnalyzers = ['complexity', 'jscpd', 'trivy'];

  /**
   * Détecte les langages utilisés dans un projet en scannant les fichiers
   */
  async detectLanguages(projectPath: string): Promise<LanguageDetectionResult[]> {
    const results: Map<string, { fileCount: number; frameworks: Set<string> }> = new Map();

    try {
      // Scanner récursivement le répertoire
      await this.scanDirectory(projectPath, results);

      // Convertir les résultats en format final
      const totalFiles = Array.from(results.values()).reduce((sum, r) => sum + r.fileCount, 0);
      const detectionResults: LanguageDetectionResult[] = [];

      for (const [language, data] of results.entries()) {
        const confidence = totalFiles > 0 ? (data.fileCount / totalFiles) * 100 : 0;
        const languageSpecific = this.analyzerMapping[language] || [];
        // Combiner les analyseurs spécifiques et universels (sans doublons)
        const suggestedAnalyzers = [...new Set([...languageSpecific, ...this.universalAnalyzers])];
        const frameworks = Array.from(data.frameworks);

        detectionResults.push({
          language,
          confidence: Math.round(confidence * 100) / 100,
          fileCount: data.fileCount,
          suggestedAnalyzers,
          frameworks: frameworks.length > 0 ? frameworks : undefined,
        });
      }

      // Trier par nombre de fichiers (décroissant)
      detectionResults.sort((a, b) => b.fileCount - a.fileCount);

      return detectionResults;
    } catch (error) {
      console.error('Error detecting languages:', error);
      return [];
    }
  }

  /**
   * Scanne un répertoire de manière récursive
   */
  private async scanDirectory(
    dirPath: string,
    results: Map<string, { fileCount: number; frameworks: Set<string> }>,
    depth = 0,
  ): Promise<void> {
    // Limiter la profondeur pour éviter les scans trop longs
    if (depth > 10) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Ignorer les répertoires communs à exclure
        if (entry.isDirectory()) {
          if (this.shouldIgnoreDirectory(entry.name)) {
            continue;
          }
          await this.scanDirectory(fullPath, results, depth + 1);
        } else if (entry.isFile()) {
          await this.analyzeFile(fullPath, entry.name, results);
        }
      }
    } catch (error) {
      // Ignorer les erreurs de lecture (permissions, etc.)
      console.warn(`Warning: Could not scan directory ${dirPath}:`, error);
    }
  }

  /**
   * Vérifie si un répertoire doit être ignoré
   */
  private shouldIgnoreDirectory(name: string): boolean {
    const ignoredDirs = [
      'node_modules',
      '.git',
      '.svn',
      'dist',
      'build',
      'target',
      'bin',
      'obj',
      '.next',
      '.nuxt',
      'coverage',
      '__pycache__',
      '.pytest_cache',
      'vendor',
      '.idea',
      '.vscode',
    ];
    return ignoredDirs.includes(name) || name.startsWith('.');
  }

  /**
   * Analyse un fichier pour détecter le langage
   */
  private async analyzeFile(
    filePath: string,
    fileName: string,
    results: Map<string, { fileCount: number; frameworks: Set<string> }>,
  ): Promise<void> {
    const ext = path.extname(fileName).toLowerCase();

    // Vérifier les extensions de fichiers
    for (const [language, patterns] of Object.entries(this.languagePatterns)) {
      if (patterns.extensions.includes(ext)) {
        this.incrementLanguage(results, language);

        // Détecter les frameworks si applicable
        if (patterns.frameworks) {
          await this.detectFrameworks(filePath, fileName, language, patterns.frameworks, results);
        }
      }

      // Vérifier les fichiers de configuration
      if (patterns.configFiles.includes(fileName)) {
        this.incrementLanguage(results, language);

        // Détecter les frameworks basés sur le contenu des fichiers de config
        if (patterns.frameworks) {
          await this.detectFrameworks(filePath, fileName, language, patterns.frameworks, results);
        }
      }
    }
  }

  /**
   * Incrémente le compteur de fichiers pour un langage
   */
  private incrementLanguage(
    results: Map<string, { fileCount: number; frameworks: Set<string> }>,
    language: string,
  ): void {
    const existing = results.get(language);
    if (existing) {
      existing.fileCount++;
    } else {
      results.set(language, { fileCount: 1, frameworks: new Set() });
    }
  }

  /**
   * Détecte les frameworks en analysant le contenu des fichiers
   */
  private async detectFrameworks(
    filePath: string,
    fileName: string,
    language: string,
    frameworks: { name: string; indicators: string[] }[],
    results: Map<string, { fileCount: number; frameworks: Set<string> }>,
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const languageData = results.get(language);

      if (!languageData) return;

      for (const framework of frameworks) {
        for (const indicator of framework.indicators) {
          if (content.includes(indicator)) {
            languageData.frameworks.add(framework.name);
            break;
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs de lecture
    }
  }

  /**
   * Détecte le langage d'un fichier unique à partir de son chemin
   * @param filePath Chemin complet ou relatif du fichier
   * @returns Le nom du langage détecté ou null si non détecté
   */
  detectLanguageFromFilePath(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    // Chercher par extension
    for (const [language, patterns] of Object.entries(this.languagePatterns)) {
      if (patterns.extensions.includes(ext)) {
        return language;
      }
      // Vérifier aussi les fichiers de configuration
      if (patterns.configFiles.includes(fileName)) {
        return language;
      }
    }

    return null;
  }

  /**
   * Détecte les langages depuis un répertoire distant (Git)
   * Cette méthode peut être utilisée pour cloner temporairement un repo et détecter les langages
   */
  async detectLanguagesFromGitUrl(gitUrl: string, tempDir: string): Promise<LanguageDetectionResult[]> {
    // Pour l'instant, on assume que le code est déjà cloné dans tempDir
    // Dans une version future, on pourrait ajouter la logique de clonage ici
    return this.detectLanguages(tempDir);
  }
}
