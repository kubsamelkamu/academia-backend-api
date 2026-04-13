import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AdvisorProjectEvaluationController } from './advisor-project-evaluation.controller';
import { AdvisorProjectEvaluationRepository } from './advisor-project-evaluation.repository';
import { AdvisorProjectEvaluationService } from './advisor-project-evaluation.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdvisorProjectEvaluationController],
  providers: [AdvisorProjectEvaluationRepository, AdvisorProjectEvaluationService],
  exports: [AdvisorProjectEvaluationRepository, AdvisorProjectEvaluationService],
})
export class EvaluationModule {}