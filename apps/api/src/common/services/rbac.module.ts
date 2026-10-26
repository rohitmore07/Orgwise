import { Global, Module } from '@nestjs/common';
import { RbacService } from './rbac.service';

/** Global RBAC service — injectable from every feature module. */
@Global()
@Module({
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
