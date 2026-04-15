CREATE TYPE "ProjectStageFinalResultStatus" AS ENUM (
    'FINALIZED_PENDING_DEPARTMENT_HEAD',
    'APPROVED',
    'REJECTED'
);

CREATE TABLE "department_stage_evaluation_weights" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "stage" "EvaluationStage" NOT NULL,
    "advisor_percentage" INTEGER NOT NULL,
    "evaluator_percentage" INTEGER NOT NULL,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_stage_evaluation_weights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_stage_final_results" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "stage" "EvaluationStage" NOT NULL,
    "status" "ProjectStageFinalResultStatus" NOT NULL DEFAULT 'FINALIZED_PENDING_DEPARTMENT_HEAD',
    "advisor_percentage" INTEGER NOT NULL,
    "evaluator_percentage" INTEGER NOT NULL,
    "finalized_by_user_id" TEXT NOT NULL,
    "finalized_at" TIMESTAMP(3) NOT NULL,
    "finalization_note" VARCHAR(1000),
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_note" VARCHAR(1000),
    "rejected_by_user_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_stage_final_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_stage_final_result_scores" (
    "id" TEXT NOT NULL,
    "final_result_id" TEXT NOT NULL,
    "student_user_id" TEXT NOT NULL,
    "advisor_score" DOUBLE PRECISION NOT NULL,
    "advisor_comment" VARCHAR(1000),
    "evaluator_average_score" DOUBLE PRECISION NOT NULL,
    "evaluator_scores" JSONB NOT NULL,
    "final_grade" DOUBLE PRECISION NOT NULL,
    "letter_grade" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_stage_final_result_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "department_stage_evaluation_weights_department_id_stage_key"
ON "department_stage_evaluation_weights"("department_id", "stage");

CREATE INDEX "department_stage_evaluation_weights_tenant_id_department_id_stage_idx"
ON "department_stage_evaluation_weights"("tenant_id", "department_id", "stage");

CREATE INDEX "department_stage_evaluation_weights_updated_by_user_id_idx"
ON "department_stage_evaluation_weights"("updated_by_user_id");

CREATE UNIQUE INDEX "project_stage_final_results_project_id_stage_key"
ON "project_stage_final_results"("project_id", "stage");

CREATE INDEX "project_stage_final_results_tenant_id_department_id_stage_status_idx"
ON "project_stage_final_results"("tenant_id", "department_id", "stage", "status");

CREATE INDEX "project_stage_final_results_finalized_by_user_id_idx"
ON "project_stage_final_results"("finalized_by_user_id");

CREATE INDEX "project_stage_final_results_approved_by_user_id_idx"
ON "project_stage_final_results"("approved_by_user_id");

CREATE INDEX "project_stage_final_results_rejected_by_user_id_idx"
ON "project_stage_final_results"("rejected_by_user_id");

CREATE UNIQUE INDEX "project_stage_final_result_scores_final_result_id_student_user_id_key"
ON "project_stage_final_result_scores"("final_result_id", "student_user_id");

CREATE INDEX "project_stage_final_result_scores_student_user_id_idx"
ON "project_stage_final_result_scores"("student_user_id");

ALTER TABLE "department_stage_evaluation_weights"
ADD CONSTRAINT "department_stage_evaluation_weights_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_stage_evaluation_weights"
ADD CONSTRAINT "department_stage_evaluation_weights_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_stage_evaluation_weights"
ADD CONSTRAINT "department_stage_evaluation_weights_updated_by_user_id_fkey"
FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_stage_final_results"
ADD CONSTRAINT "project_stage_final_results_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_stage_final_results"
ADD CONSTRAINT "project_stage_final_results_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_stage_final_results"
ADD CONSTRAINT "project_stage_final_results_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_stage_final_results"
ADD CONSTRAINT "project_stage_final_results_finalized_by_user_id_fkey"
FOREIGN KEY ("finalized_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_stage_final_results"
ADD CONSTRAINT "project_stage_final_results_approved_by_user_id_fkey"
FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_stage_final_results"
ADD CONSTRAINT "project_stage_final_results_rejected_by_user_id_fkey"
FOREIGN KEY ("rejected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_stage_final_result_scores"
ADD CONSTRAINT "project_stage_final_result_scores_final_result_id_fkey"
FOREIGN KEY ("final_result_id") REFERENCES "project_stage_final_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_stage_final_result_scores"
ADD CONSTRAINT "project_stage_final_result_scores_student_user_id_fkey"
FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;