#!/usr/bin/env node

/**
 * Test suite for backup/restore and other utility scripts
 */

const { AsyncLocalStorage } = require('async_hooks');
const { execSync, spawn } = require('child_process');
const { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } = require('fs');
const { join } = require('path');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${colors.blue}▶ ${name}${colors.reset}`);
}

function logPass(message) {
  console.log(`  ${colors.green}✓ ${message}${colors.reset}`);
}

function logFail(message) {
  console.log(`  ${colors.red}✗ ${message}${colors.reset}`);
}

function logSkip(message) {
  console.log(`  ${colors.yellow}⊘ ${message}${colors.reset}`);
}

class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  pass(message) {
    this.passed++;
    logPass(message);
  }

  fail(message) {
    this.failed++;
    logFail(message);
  }

  skip(message) {
    this.skipped++;
    logSkip(message);
  }

  assert(condition, message) {
    if (condition) {
      this.pass(message);
    } else {
      this.fail(message);
    }
  }

  summary() {
    const total = this.passed + this.failed + this.skipped;
    console.log('\n' + colors.cyan + colors.bright + '═'.repeat(60) + colors.reset);
    console.log(colors.cyan + colors.bright + '  TEST SUMMARY' + colors.reset);
    console.log(colors.cyan + colors.bright + '═'.repeat(60) + colors.reset + '\n');

    log(`Total: ${total}`, 'blue');
    log(`Passed: ${this.passed}`, 'green');
    log(`Failed: ${this.failed}`, this.failed > 0 ? 'red' : 'green');
    log(`Skipped: ${this.skipped}`, 'yellow');

    return this.failed === 0;
  }
}

// Tests

function testBackupScriptExists(runner) {
  logTest('Test: Backup script exists');

  const scriptPath = join(__dirname, 'backup.sh');
  runner.assert(existsSync(scriptPath), 'backup.sh exists');

  if (existsSync(scriptPath)) {
    try {
      const stats = require('fs').statSync(scriptPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      runner.assert(isExecutable, 'backup.sh is executable');
    } catch (error) {
      runner.fail('Failed to check executable permissions');
    }
  }
}

function testRestoreScriptExists(runner) {
  logTest('Test: Restore script exists');

  const scriptPath = join(__dirname, 'restore.sh');
  runner.assert(existsSync(scriptPath), 'restore.sh exists');

  if (existsSync(scriptPath)) {
    try {
      const stats = require('fs').statSync(scriptPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      runner.assert(isExecutable, 'restore.sh is executable');
    } catch (error) {
      runner.fail('Failed to check executable permissions');
    }
  }
}

function testBackupScriptHelp(runner) {
  logTest('Test: Backup script shows help on missing dependencies');

  try {
    const scriptPath = join(__dirname, 'backup.sh');
    const result = execSync(`bash ${scriptPath}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Script should detect missing dependencies and exit
    runner.fail('Script should exit with error on missing deps');
  } catch (error) {
    // Expected to fail due to missing dependencies
    const output = error.stdout + error.stderr;

    if (output.includes('pg_dump') || output.includes('mc') || output.includes('Dépendances manquantes')) {
      runner.pass('Script correctly detects missing dependencies');
    } else {
      runner.fail('Script does not properly check dependencies');
    }
  }
}

function testRestoreScriptUsage(runner) {
  logTest('Test: Restore script shows usage');

  try {
    const scriptPath = join(__dirname, 'restore.sh');
    const result = execSync(`bash ${scriptPath}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    runner.fail('Script should exit with error when no args provided');
  } catch (error) {
    const output = error.stdout + error.stderr;

    if (output.includes('Usage:') || output.includes('backup_path')) {
      runner.pass('Script shows usage when no arguments provided');
    } else {
      runner.fail('Script does not show proper usage');
    }
  }
}

function testBackupScriptEnvironmentVariables(runner) {
  logTest('Test: Backup script respects environment variables');

  const scriptPath = join(__dirname, 'backup.sh');
  const scriptContent = readFileSync(scriptPath, 'utf-8');

  const envVars = [
    'BACKUP_DIR',
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'MINIO_ENDPOINT',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
  ];

  let found = 0;
  envVars.forEach((envVar) => {
    if (scriptContent.includes(envVar)) {
      found++;
    }
  });

  runner.assert(found >= envVars.length - 1, `Script uses environment variables (${found}/${envVars.length})`);
}

function testRestoreScriptEnvironmentVariables(runner) {
  logTest('Test: Restore script respects environment variables');

  const scriptPath = join(__dirname, 'restore.sh');
  const scriptContent = readFileSync(scriptPath, 'utf-8');

  const envVars = [
    'RESTORE_POSTGRES',
    'RESTORE_MINIO',
    'FORCE',
    'POSTGRES_HOST',
    'MINIO_ENDPOINT',
  ];

  let found = 0;
  envVars.forEach((envVar) => {
    if (scriptContent.includes(envVar)) {
      found++;
    }
  });

  runner.assert(found >= envVars.length - 1, `Script uses environment variables (${found}/${envVars.length})`);
}

function testBackupDocumentationExists(runner) {
  logTest('Test: Backup/Restore documentation exists');

  const docPath = join(__dirname, '..', 'docs', 'backup-restore.md');
  runner.assert(existsSync(docPath), 'backup-restore.md exists');

  if (existsSync(docPath)) {
    const content = readFileSync(docPath, 'utf-8');
    runner.assert(content.includes('Backup'), 'Documentation contains Backup section');
    runner.assert(content.includes('Restore'), 'Documentation contains Restore section');
    runner.assert(content.includes('PostgreSQL'), 'Documentation mentions PostgreSQL');
    runner.assert(content.includes('MinIO'), 'Documentation mentions MinIO');
  }
}

function testAllTestScriptsRunnable(runner) {
  logTest('Test: All test scripts are defined');

  const rootPackageJson = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
  );

  const expectedScripts = [
    'test',
    'test:unit',
    'test:e2e',
    'test:e2e:quick',
    'test:api:auth',
  ];

  expectedScripts.forEach((script) => {
    if (rootPackageJson.scripts[script]) {
      runner.pass(`Script '${script}' is defined`);
    } else {
      runner.fail(`Script '${script}' is missing`);
    }
  });
}

function testE2ETestStructure(runner) {
  logTest('Test: E2E test structure is valid');

  const e2eDir = join(__dirname, '..', 'tests', 'e2e');
  runner.assert(existsSync(e2eDir), 'E2E test directory exists');

  if (existsSync(e2eDir)) {
    const indexPath = join(e2eDir, 'index.js');
    const packagePath = join(e2eDir, 'package.json');
    const utilsPath = join(e2eDir, 'utils.js');

    runner.assert(existsSync(indexPath), 'E2E index.js exists');
    runner.assert(existsSync(packagePath), 'E2E package.json exists');
    runner.assert(existsSync(utilsPath), 'E2E utils.js exists');
  }
}

function testRunAllTestsScript(runner) {
  logTest('Test: run-all-tests.js exists and is valid');

  const scriptPath = join(__dirname, 'run-all-tests.js');
  runner.assert(existsSync(scriptPath), 'run-all-tests.js exists');

  if (existsSync(scriptPath)) {
    const content = readFileSync(scriptPath, 'utf-8');
    runner.assert(content.includes('runCommand'), 'Script defines runCommand function');
    runner.assert(content.includes('Unit Tests'), 'Script includes unit tests');
    runner.assert(content.includes('E2E Tests'), 'Script includes E2E tests');
    runner.assert(content.includes('Integration Tests'), 'Script includes integration tests');
  }
}



// Main
async function runAllTests() {
  const startTime = Date.now();

  console.log(colors.magenta + colors.bright);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           SCRIPT TESTS                                     ║');
  console.log('║           Testing utility scripts and test infrastructure  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  const runner = new TestRunner();

  // Run tests
  testBackupScriptExists(runner);
  testRestoreScriptExists(runner);
  testBackupScriptHelp(runner);
  testRestoreScriptUsage(runner);
  testBackupScriptEnvironmentVariables(runner);
  testRestoreScriptEnvironmentVariables(runner);
  testBackupDocumentationExists(runner);
  testAllTestScriptsRunnable(runner);
  testE2ETestStructure(runner);
  testRunAllTestsScript(runner);

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const success = runner.summary();
  log(`\nDuration: ${duration}s`, 'cyan');

  if (success) {
    console.log(colors.green + colors.bright + '\n✓ All script tests passed!\n' + colors.reset);
    process.exit(0);
  } else {
    console.log(colors.red + colors.bright + '\n✗ Some script tests failed\n' + colors.reset);
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error(colors.red + '\nUnexpected error:' + colors.reset, error);
  process.exit(1);
});
