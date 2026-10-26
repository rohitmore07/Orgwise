import config from '@orgwise/eslint-config/nest';

export default [
  ...config,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
