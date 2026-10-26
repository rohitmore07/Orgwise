import { describe, expect, it } from 'vitest';
import { hasMinRole } from '@/lib/auth-context';

describe('hasMinRole (frontend role gating)', () => {
  it('grants admin everything', () => {
    expect(hasMinRole('admin', 'admin')).toBe(true);
    expect(hasMinRole('admin', 'manager')).toBe(true);
    expect(hasMinRole('admin', 'viewer')).toBe(true);
  });

  it('grants manager manager + viewer levels, never admin', () => {
    expect(hasMinRole('manager', 'manager')).toBe(true);
    expect(hasMinRole('manager', 'viewer')).toBe(true);
    expect(hasMinRole('manager', 'admin')).toBe(false);
  });

  it('grants viewer only the viewer level', () => {
    expect(hasMinRole('viewer', 'viewer')).toBe(true);
    expect(hasMinRole('viewer', 'manager')).toBe(false);
    expect(hasMinRole('viewer', 'admin')).toBe(false);
  });

  it('returns false when no role is known yet (initializing)', () => {
    expect(hasMinRole(null, 'viewer')).toBe(false);
  });
});
