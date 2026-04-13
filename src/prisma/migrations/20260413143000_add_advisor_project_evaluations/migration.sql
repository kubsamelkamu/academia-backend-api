CREATE TYPE "EvaluationStage" AS ENUM ('CAPSTONE_I', 'CAPSTONE_II');

CREATE TYPE "AdvisorProjectEvaluationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED');

CREATE TABLE "advisor_project_evaluations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "advisor_user_id" TEXT NOT NULL,
    "stage" "EvaluationStage" NOT NULL,
    "status" "AdvisorProjectEvaluationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "last_saved_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_project_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "advisor_project_evaluation_scores" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "student_user_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_project_evaluation_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "advisor_project_evaluations_project_id_advisor_user_id_stage_key"
ON "advisor_project_evaluations"("project_id", "advisor_user_id", "stage");

CREATE INDEX "advisor_project_evaluations_tenant_id_department_id_stage_idx"
ON "advisor_project_evaluations"("tenant_id", "department_id", "stage");

CREATE INDEX "advisor_project_evaluations_advisor_user_id_stage_idx"
ON "advisor_project_evaluations"("advisor_user_id", "stage");

CREATE INDEX "advisor_project_evaluations_project_id_stage_idx"
ON "advisor_project_evaluations"("project_id", "stage");

CREATE UNIQUE INDEX "advisor_project_evaluation_scores_evaluation_id_student_user_id_key"
ON "advisor_project_evaluation_scores"("evaluation_id", "student_user_id");

CREATE INDEX "advisor_project_evaluation_scores_student_user_id_idx"
ON "advisor_project_evaluation_scores"("student_user_id");

ALTER TABLE "advisor_project_evaluations"
ADD CONSTRAINT "advisor_project_evaluations_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "advisor_project_evaluations"
ADD CONSTRAINT "advisor_project_evaluations_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "advisor_project_evaluations"
ADD CONSTRAINT "advisor_project_evaluations_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "advisor_project_evaluations"
ADD CONSTRAINT "advisor_project_evaluations_advisor_user_id_fkey"
FOREIGN KEY ("advisor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "advisor_project_evaluation_scores"
ADD CONSTRAINT "advisor_project_evaluation_scores_evaluation_id_fkey"
FOREIGN KEY ("evaluation_id") REFERENCES "advisor_project_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "advisor_project_evaluation_scores"
ADD CONSTRAINT "advisor_project_evaluation_scores_student_user_id_fkey"
FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;