import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
// Global data-access module. Exposes `PrismaService` to every feature module. Feature modules depend on the…
// service interface, never on a shared client instance, which keeps the data layer swappable (e.g. per-tenant…
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
