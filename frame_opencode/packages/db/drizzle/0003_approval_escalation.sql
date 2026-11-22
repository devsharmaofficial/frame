ALTER TABLE "approval_tasks" DROP CONSTRAINT "approval_tasks_payment_intent_id_unique";

ALTER TABLE "approval_tasks" ADD COLUMN "escalated_at" timestamp with time zone;
ALTER TABLE "approval_tasks" ADD COLUMN "escalated_to" text;
ALTER TABLE "approval_tasks" ADD COLUMN "sla_minutes" integer DEFAULT 1440;
ALTER TABLE "approval_tasks" ADD COLUMN "source_task_id" uuid REFERENCES "approval_tasks"("id");

CREATE INDEX "approval_tasks_org_status_escalated_idx" ON "approval_tasks" ("organization_id", "status", "escalated_at");
