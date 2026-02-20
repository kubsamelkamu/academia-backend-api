import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminProfileModule } from './profile/admin-profile.module';
import { AdminTenantsModule } from './tenants/admin-tenants.module';
import { AdminDepartmentsModule } from './departments/admin-departments.module';

@Module({
  imports: [AuthModule, AdminProfileModule, AdminTenantsModule, AdminDepartmentsModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService],
})
export class AdminModule {}
