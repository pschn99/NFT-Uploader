module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  overrides: [
    {
      files: ['src/simulation/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '**/render/**',
                  '**/audio/**',
                  '**/creator/**',
                  '**/levels/**',
                  '**/online/**',
                  '../render/**',
                  '../audio/**',
                  '../creator/**',
                  '../levels/**',
                  '../online/**',
                  '@/render/**',
                  '@/audio/**',
                  '@/creator/**',
                  '@/levels/**',
                  '@/online/**'
                ],
                message: 'Simulation layer must remain isolated and cannot import from render, audio, creator, levels, or online layers.'
              }
            ]
          }
        ]
      }
    }
  ]
};
