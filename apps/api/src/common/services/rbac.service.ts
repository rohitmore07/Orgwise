import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database/prisma.service';
import { Role } from '../enums/role.enum';
import type { RequestUser } from '../interfaces/request-user.interface';

/** The set of roles that may mutate data (create/update/delete). */
const WRITE_ROLES = new Set<Role>([Role.ADMIN, Role.MANAGER]);

/** Roles that can manage organization structure (departments/teams). */
const ORG_ADMIN_ROLES = new Set<Role>([Role.ADMIN]);
// Central RBAC decisions. - **admin** → full access, no data scoping. - **manager** → write access, but only…
// within the departments they manage (`Department.managerUserId = user.id`). - **viewer** → read-only…
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: RequestUser): boolean {
    return user.roles.includes(Role.ADMIN);
  }

  isManager(user: RequestUser): boolean {
    return user.roles.includes(Role.MANAGER);
  }

  canWrite(user: RequestUser): boolean {
    return user.roles.some((role) => WRITE_ROLES.has(role));
  }

  /** Throws Forbidden for viewers and for managers acting outside their scope. */
  async assertCanWrite(user: RequestUser, departmentId?: string): Promise<void> {
    if (!this.canWrite(user)) {
      throw new ForbiddenException('Read-only access — your role cannot modify records');
    }
    if (
      this.isManager(user) &&
      departmentId &&
      !(await this.isDepartmentInScope(user, departmentId))
    ) {
      throw new ForbiddenException('You can only modify records in your assigned departments');
    }
  }

  /** Org structure (departments/teams) is admin-managed; managers read only. */
  assertCanManageOrg(user: RequestUser): void {
    if (!user.roles.some((role) => ORG_ADMIN_ROLES.has(role))) {
      throw new ForbiddenException('Only admins can manage organization structure');
    }
  }
  // Department ids a manager is allowed to see/modify. Returns `null` for admins and viewers (no scoping — they…
  // see everything).
  async departmentScope(user: RequestUser): Promise<string[] | null> {
    if (!this.isManager(user)) return null;
    const departments = await this.prisma.department.findMany({
      where: { managerUserId: user.sub, deletedAt: null },
      select: { id: true },
    });
    return departments.map((d) => d.id);
  }

  /** True when the user (admin or scoped manager) may access the department. */
  async isDepartmentInScope(user: RequestUser, departmentId: string): Promise<boolean> {
    if (this.isAdmin(user)) return true;
    if (!this.isManager(user)) return false;
    const count = await this.prisma.department.count({
      where: { id: departmentId, managerUserId: user.sub, deletedAt: null },
    });
    return count > 0;
  }
}
