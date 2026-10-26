// Enterprise role model for orgwise. Coarse-grained by design — fine-grained permission decisions belong in…
// the service layer's scope rules (e.g. managers only see their assigned departments), not in the enum. Role…
export enum Role {
  /** Platform administrators — full system access. */
  ADMIN = 'admin',
  /** People managers — write access within their assigned departments. */
  MANAGER = 'manager',
  /** Read-only users — governed visibility across the organization. */
  VIEWER = 'viewer',
}
