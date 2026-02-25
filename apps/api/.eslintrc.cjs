module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.spec.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:prettier/recommended'
  ],
  env: {
    node: true,
    es2021: true
  },
  ignorePatterns: ['dist', 'node_modules', '*.config.ts', '*.config.js'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off'
  }
};
