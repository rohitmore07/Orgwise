import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

/** Employee records — the workforce core domain. */
@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
  // Exported so the AI Copilot can search employees as a trusted, RBAC-scoped tool.
  exports: [EmployeesService],
})
export class EmployeesModule {}
