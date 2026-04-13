CREATE TYPE "EvaluatorProjectEvaluationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED');

CREATE TABLE "evaluator_project_evaluations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "evaluator_user_id" TEXT NOT NULL,
    "stage" "EvaluationStage" NOT NULL,
    "status" "EvaluatorProjectEvaluationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "last_saved_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluator_project_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluator_project_evaluation_scores" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "student_user_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluator_project_evaluation_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "evaluator_project_evaluations_project_id_evaluator_user_id_stage_key"
ON "evaluator_project_evaluations"("project_id", "evaluator_user_id", "stage");

CREATE INDEX "evaluator_project_evaluations_tenant_id_department_id_stage_idx"
ON "evaluator_project_evaluations"("tenant_id", "department_id", "stage");

CREATE INDEX "evaluator_project_evaluations_evaluator_user_id_stage_idx"
ON "evaluator_project_evaluations"("evaluator_user_id", "stage");

CREATE INDEX "evaluator_project_evaluations_project_id_stage_idx"
ON "evaluator_project_evaluations"("project_id", "stage");

CREATE UNIQUE INDEX "evaluator_project_evaluation_scores_evaluation_id_student_user_id_key"
ON "evaluator_project_evaluation_scores"("evaluation_id", "student_user_id");

CREATE INDEX "evaluator_project_evaluation_scores_student_user_id_idx"
ON "evaluator_project_evaluation_scores"("student_user_id");

ALTER TABLE "evaluator_project_evaluations"
ADD CONSTRAINT "evaluator_project_evaluations_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluator_project_evaluations"
ADD CONSTRAINT "evaluator_project_evaluations_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluator_project_evaluations"
ADD CONSTRAINT "evaluator_project_evaluations_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluator_project_evaluations"
ADD CONSTRAINT "evaluator_project_evaluations_evaluator_user_id_fkey"
FOREIGN KEY ("evaluator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evaluator_project_evaluation_scores"
ADD CONSTRAINT "evaluator_project_evaluation_scores_evaluation_id_fkey"
FOREIGN KEY ("evaluation_id") REFERENCES "evaluator_project_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluator_project_evaluation_scores"
ADD CONSTRAINT "evaluator_project_evaluation_scores_student_user_id_fkey"
FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;