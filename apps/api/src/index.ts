import 'reflect-metadata';
import { register } from 'tsconfig-paths';
// Register the TypeScript path aliases (@app/*) BEFORE the application modules load. `main` is imported…
// dynamically so its `require()` calls run after this registration — otherwise the first `@app/*` import would…
register();

void import('./main');
