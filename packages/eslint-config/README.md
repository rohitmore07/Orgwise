# @orgwise/eslint-config

Shared ESLint flat configs for the orgwise monorepo.

## Usage

Each workspace imports the variant matching its framework:

```js
// apps/web/eslint.config.mjs
import config from '@orgwise/eslint-config/next';

export default [...config, { ignores: ['...'] }];
```

```js
// apps/api/eslint.config.mjs
import config from '@orgwise/eslint-config/nest';

export default [...config];
```

## Variants

| Export | Purpose                             |
| ------ | ----------------------------------- |
| `base` | Framework-agnostic TypeScript       |
| `node` | Node.js / plain TS workspaces, root |
| `next` | Next.js (App Router) applications   |
| `nest` | NestJS applications                 |

Rules live in exactly one place — this package — so lint behavior never drifts
between workspaces. ESLint 9 flat config and TypeScript ESLint 8 underpin it.

## Upgrading `eslint-config-next`

The `next` variant FlatCompats legacy `eslint-config-next` into ESLint 9, so
this package declares its plugins as devDependencies to keep them resolvable:
`eslint-plugin-react`, `eslint-plugin-react-hooks`, and `@next/eslint-plugin-next`.
The versions are pinned to `eslint-config-next@15`'s expectations
(`react-hooks ^5`, `@next/eslint-plugin-next 15.5.x`). When upgrading
`eslint-config-next`, bump these in lockstep — newer plugin majors ship
flat-style configs (with top-level `name`) that the FlatCompat legacy loader
rejects.
