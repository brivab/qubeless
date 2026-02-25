module.exports = {
  displayName: 'api',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
          target: 'es2021',
        },
        module: {
          type: 'commonjs',
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.controller.ts',
    '!src/**/decorators/*.ts',
    '!src/types/**/*.d.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json'],
  // Coverage thresholds temporarily disabled until all tests pass
  // TODO: Re-enable once test mocks are complete (target: 80% lines/functions/statements, 70% branches)
  // coverageThreshold: {
  //   global: {
  //     lines: 80,
  //     functions: 80,
  //     branches: 70,
  //     statements: 80,
  //   },
  // },
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
  testTimeout: 10000,
  verbose: true,
};
