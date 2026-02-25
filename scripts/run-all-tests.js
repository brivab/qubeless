#!/usr/bin/env node

/**
 * Run all tests in the Qubeless monorepo
 * - Unit tests (Jest/Vitest)
 * - E2E tests (custom test runner)
 * - Integration tests (Node test runner)
 */

const { spawn } = require('child_process');

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + colors.cyan + colors.bright + '═'.repeat(60) + colors.reset);
  console.log(colors.cyan + colors.bright + `  ${title}` + colors.reset);
  console.log(colors.cyan + colors.bright + '═'.repeat(60) + colors.reset + '\n');
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

async function runTests() {
  const startTime = Date.now();
  const results = {
    passed: [],
    failed: [],
    skipped: [],
  };

  // Parse command line arguments
  const args = process.argv.slice(2);
  const onlyUnit = args.includes('--unit');
  const onlyE2e = args.includes('--e2e');
  const onlyIntegration = args.includes('--integration');
  const skipUnit = args.includes('--skip-unit');
  const skipE2e = args.includes('--skip-e2e');
  const skipIntegration = args.includes('--skip-integration');
  const quick = args.includes('--quick');

  console.log(colors.magenta + colors.bright);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║           QUBELESS TEST SUITE                              ║');
  console.log('║           Running All Tests                                ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  if (args.length > 0) {
    log(`Options: ${args.join(', ')}`, 'yellow');
  }

  // 1. Unit Tests
  if (!skipUnit && (!onlyE2e && !onlyIntegration)) {
    logSection('1. Unit Tests (API Module)');
    try {
      await runCommand('pnpm', ['--filter', '@qubeless/api', 'run', 'test:unit']);
      results.passed.push('Unit Tests');
      log('✓ Unit tests passed', 'green');
    } catch (error) {
      results.failed.push('Unit Tests');
      log('✗ Unit tests failed', 'red');
      if (!quick) {
        console.error(error);
      }
    }
  } else if (skipUnit) {
    results.skipped.push('Unit Tests');
    log('⊘ Unit tests skipped', 'yellow');
  }

  // 2. Integration Tests (API SSO tests)
  if (!skipIntegration && (!onlyUnit && !onlyE2e)) {
    logSection('2. Integration Tests (API)');

    const integrationTests = [
      { name: 'Auth (Local)', script: 'test:auth-local' },
      { name: 'OIDC Mapping', script: 'test:oidc-mapping' },
      { name: 'SAML Mapping', script: 'test:saml-mapping' },
      { name: 'SSO Optional', script: 'test:sso-optional' },
      { name: 'Logout Flow', script: 'test:logout' },
    ];

    for (const test of integrationTests) {
      try {
        log(`Running ${test.name}...`, 'blue');
        await runCommand('pnpm', ['--filter', '@qubeless/api', 'run', test.script]);
        results.passed.push(`Integration: ${test.name}`);
        log(`✓ ${test.name} passed`, 'green');
      } catch (error) {
        results.failed.push(`Integration: ${test.name}`);
        log(`✗ ${test.name} failed`, 'red');
        if (!quick) {
          console.error(error);
        }
      }
    }
  } else if (skipIntegration) {
    results.skipped.push('Integration Tests');
    log('⊘ Integration tests skipped', 'yellow');
  }

  // 3. E2E Tests
  if (!skipE2e && (!onlyUnit && !onlyIntegration)) {
    logSection('3. End-to-End Tests');

    // Check if API is running before running E2E tests
    log('Checking API availability...', 'blue');
    let apiAvailable = false;
    try {
      const { execSync } = require('child_process');
      const apiCheck = execSync('curl -s http://localhost:3001/api/health', { timeout: 5000 }).toString();
      if (apiCheck.includes('ok')) {
        log('✓ API is running and healthy', 'green');
        apiAvailable = true;
      } else {
        throw new Error('API not healthy');
      }
    } catch (error) {
      log('✗ API is not running or not accessible', 'red');
      log('', 'reset');
      log('E2E tests require the API to be running.', 'yellow');
      log('Quick setup: docker-compose -f docker-compose.dev.yml up -d', 'yellow');
      log('See docs/e2e-setup.md for details', 'yellow');
      log('', 'reset');
      results.skipped.push('E2E Tests (API not running)');
      log('⊘ E2E tests skipped (API not available)', 'yellow');
    }

    // Only run if API check passed
    if (apiAvailable) {
      try {
        const testScript = quick ? 'test:e2e:quick' : 'test:e2e';
        await runCommand('pnpm', ['run', testScript]);
        results.passed.push('E2E Tests');
        log('✓ E2E tests passed', 'green');
      } catch (error) {
        results.failed.push('E2E Tests');
        log('✗ E2E tests failed', 'red');
        if (!quick) {
          console.error(error);
        }
      }
    }
  } else if (skipE2e) {
    results.skipped.push('E2E Tests');
    log('⊘ E2E tests skipped', 'yellow');
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + colors.magenta + colors.bright + '═'.repeat(60) + colors.reset);
  console.log(colors.magenta + colors.bright + '  TEST SUMMARY' + colors.reset);
  console.log(colors.magenta + colors.bright + '═'.repeat(60) + colors.reset + '\n');

  if (results.passed.length > 0) {
    log(`✓ Passed (${results.passed.length}):`, 'green');
    results.passed.forEach((name) => log(`  - ${name}`, 'green'));
    console.log();
  }

  if (results.failed.length > 0) {
    log(`✗ Failed (${results.failed.length}):`, 'red');
    results.failed.forEach((name) => log(`  - ${name}`, 'red'));
    console.log();
  }

  if (results.skipped.length > 0) {
    log(`⊘ Skipped (${results.skipped.length}):`, 'yellow');
    results.skipped.forEach((name) => log(`  - ${name}`, 'yellow'));
    console.log();
  }

  log(`Duration: ${duration}s`, 'cyan');

  const total = results.passed.length + results.failed.length + results.skipped.length;
  const testsRun = results.passed.length + results.failed.length;
  const passRate = testsRun > 0 ? ((results.passed.length / testsRun) * 100).toFixed(1) : 100;

  if (results.failed.length === 0) {
    console.log(colors.green + colors.bright);
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  ✓ ALL TESTS PASSED (${passRate}%)${' '.repeat(35 - passRate.toString().length)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(colors.reset);
    process.exit(0);
  } else {
    console.log(colors.red + colors.bright);
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  ✗ SOME TESTS FAILED (${passRate}% passed)${' '.repeat(31 - passRate.toString().length)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(colors.reset);
    process.exit(1);
  }
}

// Usage
if (require.main === module) {
  runTests().catch((error) => {
    console.error(colors.red + '\nUnexpected error:' + colors.reset, error);
    process.exit(1);
  });
}

module.exports = { runTests };
