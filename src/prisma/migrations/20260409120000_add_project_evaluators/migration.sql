CREATE TABLE "project_evaluators" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "evaluator_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_evaluators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_evaluators_project_id_evaluator_user_id_key"
ON "project_evaluators"("project_id", "evaluator_user_id");

CREATE INDEX "project_evaluators_project_id_idx"
ON "project_evaluators"("project_id");

CREATE INDEX "project_evaluators_evaluator_user_id_idx"
ON "project_evaluators"("evaluator_user_id");

CREATE INDEX "project_evaluators_created_at_idx"
ON "project_evaluators"("created_at");

ALTER TABLE "project_evaluators"
ADD CONSTRAINT "project_evaluators_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_evaluators"
ADD CONSTRAINT "project_evaluators_evaluator_user_id_fkey"
FOREIGN KEY ("evaluator_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
