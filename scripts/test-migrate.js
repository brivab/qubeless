#!/usr/bin/env node

/**
 * Test Script for migrate.sh
 * Valide la logique du script de migration sans dépendances PostgreSQL
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, prefix, message) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

function logInfo(message) {
  log(colors.blue, 'INFO', message);
}

function logSuccess(message) {
  log(colors.green, 'SUCCESS', message);
}

function logError(message) {
  log(colors.red, 'ERROR', message);
}

function logWarning(message) {
  log(colors.yellow, 'WARNING', message);
}

// Tests
const tests = [
  {
    name: 'Script migrate.sh existe et est exécutable',
    run: () => {
      const scriptPath = path.join(__dirname, 'migrate.sh');
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script non trouvé: ${scriptPath}`);
      }
      const stats = fs.statSync(scriptPath);
      if (!(stats.mode & 0o111)) {
        throw new Error('Script non exécutable');
      }
      return 'Script trouvé et exécutable';
    },
  },
  {
    name: 'Help affiche les informations correctes',
    run: () => {
      try {
        const output = execSync('./scripts/migrate.sh --help', {
          encoding: 'utf-8',
          cwd: path.join(__dirname, '..'),
        });

        const requiredSections = [
          'Usage:',
          'OPTIONS:',
          'VARIABLES D\'ENVIRONNEMENT:',
          'EXEMPLES:',
          'PRÉREQUIS:',
        ];

        for (const section of requiredSections) {
          if (!output.includes(section)) {
            throw new Error(`Section manquante: ${section}`);
          }
        }

        return 'Toutes les sections présentes';
      } catch (error) {
        if (error.status === 0) {
          const output = error.stdout.toString();
          const requiredSections = [
            'Usage:',
            'OPTIONS:',
            'VARIABLES D\'ENVIRONNEMENT:',
          ];

          for (const section of requiredSections) {
            if (!output.includes(section)) {
              throw new Error(`Section manquante: ${section}`);
            }
          }
          return 'Toutes les sections présentes';
        }
        throw error;
      }
    },
  },
  {
    name: 'Options de ligne de commande sont reconnues',
    run: () => {
      const options = ['--help', '--force', '--skip-backup', '--dry-run'];

      for (const option of options) {
        try {
          execSync(`./scripts/migrate.sh ${option}`, {
            encoding: 'utf-8',
            cwd: path.join(__dirname, '..'),
            stdio: 'pipe',
          });
        } catch (error) {
          // L'option --help sort avec code 0, les autres peuvent échouer pour manque de dépendances
          // On vérifie juste que l'option est reconnue (pas d'erreur "Option inconnue")
          if (error.stderr && error.stderr.includes('Option inconnue')) {
            throw new Error(`Option non reconnue: ${option}`);
          }
        }
      }

      return 'Toutes les options reconnues';
    },
  },
  {
    name: 'Script détecte les dépendances manquantes',
    run: () => {
      // Ce test devrait échouer car psql n'est probablement pas installé
      try {
        execSync(
          'DRY_RUN=true SKIP_BACKUP_CHECK=true ./scripts/migrate.sh',
          {
            encoding: 'utf-8',
            cwd: path.join(__dirname, '..'),
            stdio: 'pipe',
          }
        );
        // Si ça passe, c'est que psql est installé
        return 'Dépendances trouvées (psql installé)';
      } catch (error) {
        // On s'attend à une erreur de dépendances manquantes
        const output = error.stderr || error.stdout || '';
        if (output.includes('Dépendances manquantes') || output.includes('psql')) {
          return 'Détection des dépendances manquantes fonctionne';
        }
        throw new Error('Le script ne détecte pas les dépendances manquantes correctement');
      }
    },
  },
  {
    name: 'Variables d\'environnement sont documentées',
    run: () => {
      const output = execSync('./scripts/migrate.sh --help', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
      }).toString();

      const requiredVars = [
        'DATABASE_URL',
        'POSTGRES_HOST',
        'POSTGRES_PORT',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB',
        'FORCE_MODE',
        'SKIP_BACKUP_CHECK',
        'DRY_RUN',
      ];

      for (const varName of requiredVars) {
        if (!output.includes(varName)) {
          throw new Error(`Variable manquante dans la doc: ${varName}`);
        }
      }

      return 'Toutes les variables documentées';
    },
  },
  {
    name: 'Exemples sont fournis dans l\'aide',
    run: () => {
      const output = execSync('./scripts/migrate.sh --help', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
      }).toString();

      const requiredExamples = [
        'Migration normale',
        'Migration automatique',
        'Simulation',
      ];

      for (const example of requiredExamples) {
        if (!output.includes(example)) {
          throw new Error(`Exemple manquant: ${example}`);
        }
      }

      return 'Tous les exemples présents';
    },
  },
  {
    name: 'Documentation upgrade.md existe',
    run: () => {
      const docPath = path.join(__dirname, '..', 'docs', 'upgrade.md');
      if (!fs.existsSync(docPath)) {
        throw new Error(`Documentation non trouvée: ${docPath}`);
      }

      const content = fs.readFileSync(docPath, 'utf-8');
      const requiredSections = [
        'Prérequis',
        'Procédure de Mise à Jour',
        'Stratégie de Rollback',
        'Dépannage',
      ];

      for (const section of requiredSections) {
        if (!content.includes(section)) {
          throw new Error(`Section manquante dans la doc: ${section}`);
        }
      }

      return 'Documentation complète trouvée';
    },
  },
  {
    name: 'Documentation mentionne le script de migration',
    run: () => {
      const docPath = path.join(__dirname, '..', 'docs', 'upgrade.md');
      const content = fs.readFileSync(docPath, 'utf-8');

      if (!content.includes('./scripts/migrate.sh')) {
        throw new Error('Le script migrate.sh n\'est pas mentionné dans la doc');
      }

      if (!content.includes('prisma migrate deploy')) {
        throw new Error('La commande prisma migrate deploy n\'est pas mentionnée');
      }

      return 'Script correctement documenté';
    },
  },
  {
    name: 'Documentation inclut des procédures de rollback',
    run: () => {
      const docPath = path.join(__dirname, '..', 'docs', 'upgrade.md');
      const content = fs.readFileSync(docPath, 'utf-8');

      const requiredTopics = [
        'Restauration Complète',
        'best-effort',
        './scripts/restore.sh',
        'rollback',
      ];

      for (const topic of requiredTopics) {
        if (!content.includes(topic)) {
          throw new Error(`Sujet manquant dans rollback: ${topic}`);
        }
      }

      return 'Procédures de rollback documentées';
    },
  },
  {
    name: 'Documentation inclut des exemples pratiques',
    run: () => {
      const docPath = path.join(__dirname, '..', 'docs', 'upgrade.md');
      const content = fs.readFileSync(docPath, 'utf-8');

      // Compter les blocs de code bash
      const bashBlocks = (content.match(/```bash/g) || []).length;

      if (bashBlocks < 10) {
        throw new Error(`Pas assez d'exemples de code (${bashBlocks} trouvés, 10+ attendus)`);
      }

      return `${bashBlocks} exemples de code trouvés`;
    },
  },
];

// Exécution des tests
async function runTests() {
  logInfo('=== Test du Script de Migration ===');
  console.log();

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`Testing: ${test.name}... `);

    try {
      const result = test.run();
      logSuccess(`✓ ${result}`);
      passed++;
    } catch (error) {
      logError(`✗ ${error.message}`);
      failed++;
    }
  }

  console.log();
  logInfo('=== Résultats ===');
  logSuccess(`Tests réussis: ${passed}/${tests.length}`);

  if (failed > 0) {
    logError(`Tests échoués: ${failed}/${tests.length}`);
    process.exit(1);
  } else {
    logSuccess('Tous les tests sont passés!');
  }
}

// Exécution
runTests().catch((error) => {
  logError(`Erreur fatale: ${error.message}`);
  process.exit(1);
});
