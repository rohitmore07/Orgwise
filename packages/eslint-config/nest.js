import config from './node.js';
// Flat config for NestJS workspaces. `consistent-type-imports` is disabled: NestJS dependency injection relies…
// on emitted decorator metadata (`design:paramtypes`), which breaks when an injectable class is imported with…
export default [
  ...config,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
