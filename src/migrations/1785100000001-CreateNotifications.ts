import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1785100000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "patient_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "title" varchar(255) NOT NULL,
        "message" text NOT NULL,
        "appointment_id" uuid,
        "event_id" varchar(255),
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_patient" FOREIGN KEY ("patient_id") 
          REFERENCES "patient_profiles"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "idx_notification_patient_created" 
        ON "notifications" ("patient_id", "created_at" DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS "idx_notification_event_unique" 
        ON "notifications" ("event_id") 
        WHERE "event_id" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_notification_event_unique";
      DROP INDEX IF EXISTS "idx_notification_patient_created";
      DROP TABLE IF EXISTS "notifications";
    `);
  }
}
