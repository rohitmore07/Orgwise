import globals from 'globals';
import base from './base.js';

/** Flat config for Node.js/TypeScript workspaces (scripts, tools, root files). */
export default [
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
