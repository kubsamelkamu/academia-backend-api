import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../core/database/database.module';
import { EmailModule } from '../../../core/email/email.module';
import { InvitationsModule } from '../../invitations/invitations.module';
import { AdminDepartmentsController } from './admin-departments.controller';
import { AdminDepartmentsService } from './admin-departments.service';

@Module({
  imports: [DatabaseModule, InvitationsModule, EmailModule],
  controllers: [AdminDepartmentsController],
  providers: [AdminDepartmentsService],
})
export class AdminDepartmentsModule {}
