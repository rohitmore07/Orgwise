// Re-exported runtime constants from @orgwise/types.
// These are duplicated here so that tsc does not need to compile the
// workspace-linked types package (which lives outside rootDir and breaks
// the NestJS build).  Keep them in sync with packages/types/src/index.ts.

import type { AgeGroup, AuditAction, AuditEntityType, TenureGroup } from '@orgwise/types';

/** Label + order for the age-bucket axis. */
export const AGE_GROUPS: AgeGroup[] = ['<25', '25-34', '35-44', '45-54', '55+'];

/** Label + order for the tenure-bucket axis. */
export const TENURE_GROUPS: TenureGroup[] = ['<1', '1-2', '3-5', '6-10', '10+'];

/** Stable list of audited actions. */
export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'restore',
  'role_change',
  'import',
] as const satisfies readonly AuditAction[];

/** Stable list of audited entity types. */
export const AUDIT_ENTITY_TYPES = [
  'user',
  'department',
  'team',
  'employee',
  'import',
] as const satisfies readonly AuditEntityType[];
