/** Runtime environment names used across the platform. */
export type NodeEnv = 'development' | 'test' | 'production';

export function isProduction(env: string | undefined): env is 'production' {
  return env === 'production';
}

/** Anything that is not explicitly production or test is treated as development. */
export function isDevelopment(env: string | undefined): boolean {
  return env !== 'production' && env !== 'test';
}

export function isTest(env: string | undefined): env is 'test' {
  return env === 'test';
}
