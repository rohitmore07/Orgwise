import nodeConfig from '@orgwise/eslint-config/node';
import nestConfig from '@orgwise/eslint-config/nest';
import nextConfig from '@orgwise/eslint-config/next';

/** Root-level config: handles root files and scopes workspace-specific rules when linting from repo root. */
export default [
  ...nodeConfig,
  ...nestConfig.map((c) =>
    c.rules || c.plugins || c.languageOptions || c.settings
      ? { ...c, files: ['apps/api/**/*'] }
      : c,
  ),
  ...nextConfig.map((c) =>
    c.rules || c.plugins || c.languageOptions || c.settings
      ? { ...c, files: ['apps/web/**/*', 'packages/ui/**/*'] }
      : c,
  ),
];
