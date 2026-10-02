import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const headless = (pkg) => ({
  files: [`libs/${pkg}/src/**/*.ts`],
  rules: {
    'no-restricted-globals': [
      'error',
      ...['window', 'document', 'navigator'].map((name) => ({
        name,
        message: `@fieldia/${pkg} is headless — keep the DOM in a rendering package.`,
      })),
    ],
  },
});

export default tseslint.config(
  { ignores: ['**/dist/**', '**/tmp/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  headless('core'),
  {
    files: ['**/*.cjs', '**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { require: 'readonly', module: 'writable', __dirname: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly' } },
  }
);
