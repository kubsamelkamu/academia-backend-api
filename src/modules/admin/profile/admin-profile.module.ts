import { Module } from '@nestjs/common';
import { AdminProfileController } from './admin-profile.controller';
import { AdminProfileService } from './admin-profile.service';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../../core/storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [AdminProfileController],
  providers: [AdminProfileService],
})
export class AdminProfileModule {}
