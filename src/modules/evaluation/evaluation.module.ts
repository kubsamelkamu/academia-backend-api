import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AdvisorProjectEvaluationController } from './advisor-project-evaluation.controller';
import { AdvisorProjectEvaluationRepository } from './advisor-project-evaluation.repository';
import { AdvisorProjectEvaluationService } from './advisor-project-evaluation.service';
import { EvaluatorProjectEvaluationController } from './evaluator-project-evaluation.controller';
import { EvaluatorProjectEvaluationRepository } from './evaluator-project-evaluation.repository';
import { EvaluatorProjectEvaluationService } from './evaluator-project-evaluation.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdvisorProjectEvaluationController, EvaluatorProjectEvaluationController],
  providers: [
    AdvisorProjectEvaluationRepository,
    AdvisorProjectEvaluationService,
    EvaluatorProjectEvaluationRepository,
    EvaluatorProjectEvaluationService,
  ],
  exports: [
    AdvisorProjectEvaluationRepository,
    AdvisorProjectEvaluationService,
    EvaluatorProjectEvaluationRepository,
    EvaluatorProjectEvaluationService,
  ],
})
export class EvaluationModule {}