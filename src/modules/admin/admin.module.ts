import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminProfileModule } from './profile/admin-profile.module';

@Module({
  imports: [AuthModule, AdminProfileModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService],
})
export class AdminModule {}
