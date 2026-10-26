import 'reflect-metadata';
import { AuditController } from '@app/audit/audit.controller';
import { QueryAuditLogsDto } from '@app/audit/dto/query-audit-logs.dto';
import { DashboardController } from '@app/dashboard/dashboard.controller';
import { QueryDashboardDto } from '@app/dashboard/dto/query-dashboard.dto';
import { DepartmentsController } from '@app/departments/departments.controller';
import { CreateDepartmentDto } from '@app/departments/dto/create-department.dto';
import { UpdateDepartmentDto } from '@app/departments/dto/update-department.dto';
import { EmployeesController } from '@app/employees/employees.controller';
import { CreateEmployeeDto } from '@app/employees/dto/create-employee.dto';
import { QueryEmployeesDto } from '@app/employees/dto/query-employees.dto';
import { UpdateEmployeeDto } from '@app/employees/dto/update-employee.dto';
import { ImportsController } from '@app/imports/imports.controller';
import { TeamsController } from '@app/teams/teams.controller';
import { CreateTeamDto } from '@app/teams/dto/create-team.dto';
import { UpdateTeamDto } from '@app/teams/dto/update-team.dto';
import { UsersController } from '@app/users/users.controller';
import { UpdateUserRoleDto } from '@app/users/dto/update-user-role.dto';
import { PaginationDto } from '@app/common/dto/pagination.dto';
// Regression guard for DTO validation metadata. The global ValidationPipe resolves the class to validate for…
// `@Query()` / `@Body()` from `design:paramtypes` emitted by TypeScript. If a DTO is imported as `import { X }`…
function paramtypes(controller: object, method: string): unknown[] {
  return Reflect.getMetadata('design:paramtypes', controller, method) ?? [];
}

describe('Controller DTO metadata (design:paramtypes)', () => {
  it('employees: findAll uses QueryEmployeesDto, create/update use their DTOs', () => {
    expect(paramtypes(EmployeesController.prototype, 'findAll')[1]).toBe(QueryEmployeesDto);
    expect(paramtypes(EmployeesController.prototype, 'create')[1]).toBe(CreateEmployeeDto);
    expect(paramtypes(EmployeesController.prototype, 'update')[2]).toBe(UpdateEmployeeDto);
  });

  it('departments: create/update use their DTOs', () => {
    expect(paramtypes(DepartmentsController.prototype, 'create')[1]).toBe(CreateDepartmentDto);
    expect(paramtypes(DepartmentsController.prototype, 'update')[2]).toBe(UpdateDepartmentDto);
  });

  it('teams: create/update use their DTOs', () => {
    expect(paramtypes(TeamsController.prototype, 'create')[1]).toBe(CreateTeamDto);
    expect(paramtypes(TeamsController.prototype, 'update')[2]).toBe(UpdateTeamDto);
  });

  it('users: updateRole uses UpdateUserRoleDto', () => {
    expect(paramtypes(UsersController.prototype, 'updateRole')[2]).toBe(UpdateUserRoleDto);
  });

  it('audit + dashboard: findAll use their query DTOs', () => {
    expect(paramtypes(AuditController.prototype, 'findAll')[0]).toBe(QueryAuditLogsDto);
    expect(paramtypes(DashboardController.prototype, 'getOverview')[1]).toBe(QueryDashboardDto);
  });

  it('imports: findAll uses PaginationDto', () => {
    expect(paramtypes(ImportsController.prototype, 'findAll')[1]).toBe(PaginationDto);
  });
});
