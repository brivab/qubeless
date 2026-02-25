import chalk from 'chalk';

export class TestLogger {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.startTime = Date.now();
  }

  section(title) {
    console.log('\n' + chalk.bold.blue('='.repeat(60)));
    console.log(chalk.bold.blue(`  ${title}`));
    console.log(chalk.bold.blue('='.repeat(60)));
  }

  subsection(title) {
    console.log('\n' + chalk.cyan(`▶ ${title}`));
  }

  success(message) {
    console.log(chalk.green('  ✓ ') + message);
    this.passed++;
  }

  error(message, error) {
    console.log(chalk.red('  ✗ ') + message);
    if (error) {
      console.log(chalk.red('    Error: ') + error.message);
      if (error.response?.data) {
        console.log(chalk.gray('    Response: ') + JSON.stringify(error.response.data, null, 2));
      }
    }
    this.failed++;
  }

  skip(message) {
    console.log(chalk.yellow('  ⊘ ') + chalk.gray(message));
    this.skipped++;
  }

  info(message) {
    console.log(chalk.gray('    ℹ ') + chalk.gray(message));
  }

  data(label, value) {
    console.log(chalk.gray(`    ${label}: `) + chalk.white(value));
  }

  summary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.log('\n' + chalk.bold('='.repeat(60)));
    console.log(chalk.bold('  Test Summary'));
    console.log(chalk.bold('='.repeat(60)));
    console.log(chalk.green(`  Passed:  ${this.passed}`));
    console.log(chalk.red(`  Failed:  ${this.failed}`));
    console.log(chalk.yellow(`  Skipped: ${this.skipped}`));
    console.log(chalk.gray(`  Duration: ${duration}s`));
    console.log(chalk.bold('='.repeat(60)) + '\n');

    const total = this.passed + this.failed + this.skipped;
    const passRate = total > 0 ? ((this.passed / (this.passed + this.failed)) * 100).toFixed(1) : 0;

    if (this.failed === 0) {
      console.log(chalk.bold.green(`✓ All tests passed! (${passRate}%)\n`));
    } else {
      console.log(chalk.bold.red(`✗ Some tests failed (${passRate}% pass rate)\n`));
    }

    return this.failed === 0;
  }
}

export function randomString(length = 8) {
  return Math.random().toString(36).substring(2, 2 + length);
}

export function generateTestData() {
  const id = randomString(6);
  return {
    projectKey: `test-project-${id}`,
    projectName: `Test Project ${id}`,
    email: `test-${id}@example.com`,
    password: 'Test123!',
    commitSha: Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
    branch: 'main',
    analyzerKey: 'eslint',
    analyzerName: 'ESLint',
    dockerImage: 'qubeless/analyzer-eslint:latest',
    tokenName: `test-token-${id}`,
    ruleName: `test-rule-${id}`,
    ruleKey: `test:rule-${id}`,
  };
}

export async function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function parseArgs() {
  const args = process.argv.slice(2);
  return {
    only: args.find(arg => arg.startsWith('--only='))?.split('=')[1],
    quick: args.includes('--quick'),
    verbose: args.includes('--verbose'),
  };
}
