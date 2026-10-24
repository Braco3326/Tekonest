module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist/', 'node_modules/'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    // `let x; const refresh = () => x?.go(); x = new X({ refresh })`: the closure reads x before
    // its single assignment, so it cannot be const.
    'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
    // A leading underscore marks a parameter kept for the call signature.
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
}
