import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { AdvisorProjectEvaluationController } from './advisor-project-evaluation.controller';
import { AdvisorProjectEvaluationRepository } from './advisor-project-evaluation.repository';
import { AdvisorProjectEvaluationService } from './advisor-project-evaluation.service';
import { CoordinatorEvaluationWeightController } from './coordinator-evaluation-weight.controller';
import { CoordinatorEvaluationWeightRepository } from './coordinator-evaluation-weight.repository';
import { CoordinatorEvaluationWeightService } from './coordinator-evaluation-weight.service';
import { CoordinatorProjectEvaluationController } from './coordinator-project-evaluation.controller';
import { CoordinatorProjectEvaluationRepository } from './coordinator-project-evaluation.repository';
import { CoordinatorProjectEvaluationService } from './coordinator-project-evaluation.service';
import { DepartmentHeadProjectEvaluationController } from './department-head-project-evaluation.controller';
import { DepartmentHeadProjectEvaluationRepository } from './department-head-project-evaluation.repository';
import { DepartmentHeadProjectEvaluationService } from './department-head-project-evaluation.service';
import { EvaluatorProjectEvaluationController } from './evaluator-project-evaluation.controller';
import { EvaluatorProjectEvaluationRepository } from './evaluator-project-evaluation.repository';
import { EvaluatorProjectEvaluationService } from './evaluator-project-evaluation.service';
import { StudentProjectFinalGradeController } from './student-project-final-grade.controller';
import { StudentProjectFinalGradeRepository } from './student-project-final-grade.repository';
import { StudentProjectFinalGradeService } from './student-project-final-grade.service';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [
    AdvisorProjectEvaluationController,
    CoordinatorEvaluationWeightController,
    CoordinatorProjectEvaluationController,
    DepartmentHeadProjectEvaluationController,
    EvaluatorProjectEvaluationController,
    StudentProjectFinalGradeController,
  ],
  providers: [
    AdvisorProjectEvaluationRepository,
    AdvisorProjectEvaluationService,
    CoordinatorEvaluationWeightRepository,
    CoordinatorEvaluationWeightService,
    CoordinatorProjectEvaluationRepository,
    CoordinatorProjectEvaluationService,
    DepartmentHeadProjectEvaluationRepository,
    DepartmentHeadProjectEvaluationService,
    EvaluatorProjectEvaluationRepository,
    EvaluatorProjectEvaluationService,
    StudentProjectFinalGradeRepository,
    StudentProjectFinalGradeService,
  ],
  exports: [
    AdvisorProjectEvaluationRepository,
    AdvisorProjectEvaluationService,
    CoordinatorEvaluationWeightRepository,
    CoordinatorEvaluationWeightService,
    CoordinatorProjectEvaluationRepository,
    CoordinatorProjectEvaluationService,
    DepartmentHeadProjectEvaluationRepository,
    DepartmentHeadProjectEvaluationService,
    EvaluatorProjectEvaluationRepository,
    EvaluatorProjectEvaluationService,
    StudentProjectFinalGradeRepository,
    StudentProjectFinalGradeService,
  ],
})
export class EvaluationModule {}