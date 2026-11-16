import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard, AdminGuard, CsrfGuard } from './guards';
@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, AdminGuard, CsrfGuard],
  exports: [AuthService, SessionGuard, AdminGuard, CsrfGuard],
})
export class AuthModule {}
