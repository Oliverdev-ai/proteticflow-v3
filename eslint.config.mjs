import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import dsPlugin from './apps/web/eslint-plugin-ds.mjs';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Proibe window.location.pathname em componentes React (nao-reativo; use useLocation())
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='window'][object.property.name='location'][property.name='pathname']",
          message:
            "Use const { pathname } = useLocation() do react-router-dom em vez de window.location.pathname (nao-reativo).",
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.ts', 'apps/web/src/**/*.tsx'],
    plugins: {
      ds: dsPlugin,
    },
    rules: {
      'ds/guardrails': 'error',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.js', '**/*.cjs', '**/*.mjs'],
  },
];
