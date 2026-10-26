import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@orgwise/types';
import { AuditService } from '@app/audit/audit.service';
import { Role } from '@app/common/enums/role.enum';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { PrismaService } from '@app/database/prisma.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
// User management — profile, admin-only listing and role assignment. `me` is available to every authenticated…
// user; list/role changes are restricted to admins (enforced in the controller with `@Roles`).
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async me(actor: RequestUser): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      include: { employee: { select: { id: true, employeeCode: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toDto(user);
  }

  async findAll(actor: RequestUser, search?: string, role?: string): Promise<User[]> {
    const roleFilter = this.parseRoleFilter(role);
    const users = await this.prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(roleFilter ? { role: { in: roleFilter } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { employee: { select: { id: true, employeeCode: true } } },
    });
    return users.map((u) => this.toDto(u));
  }

  /** Parses a comma-separated role filter (`manager,admin`) into valid role values. */
  private parseRoleFilter(role?: string): Role[] | undefined {
    if (!role) return undefined;
    const valid = Object.values(Role) as string[];
    const parsed = role
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter((r) => valid.includes(r)) as Role[];
    if (parsed.length === 0) {
      throw new BadRequestException(`Invalid role filter "${role}"`);
    }
    return [...new Set(parsed)];
  }

  async updateRole(
    actor: RequestUser,
    userId: string,
    dto: UpdateUserRoleDto,
    ip?: string,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    // Never allow an admin to demote themselves mid-session (immediate lockout) or to demote the last active admin…
    // (org-wide lockout). Handover path (intentional, do not remove the self-guard to "fix" this): a lone admin…
    if (userId === actor.sub) {
      throw new BadRequestException('You cannot change your own role');
    }
    if (user.role === 'admin' && dto.role !== 'admin') {
      // NOTE: the count+update is not atomic — two concurrent demotions of the last two admins could both pass.…
      // Acceptable for an MVP; wrap in a serializable transaction if this ever needs tightening.
      const activeAdminCount = await this.prisma.user.count({
        where: { role: 'admin', isActive: true },
      });
      if (activeAdminCount <= 1) {
        throw new ConflictException('Cannot demote the last active admin');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      include: { employee: { select: { id: true, employeeCode: true } } },
    });

    await this.audit.record(
      actor.sub,
      'role_change',
      'user',
      userId,
      { from: user.role, to: dto.role },
      ip,
    );
    return this.toDto(updated);
  }

  private toDto(u: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    employee?: { id: string; employeeCode: string } | null;
  }): User {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as User['role'],
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      employeeId: u.employee?.id ?? null,
    };
  }
}
