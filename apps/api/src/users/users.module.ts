import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** Users — profile and admin role management. */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
