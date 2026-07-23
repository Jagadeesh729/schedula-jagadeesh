import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDoctorAvailability1784800000001 implements MigrationInterface {
  name = 'CreateDoctorAvailability1784800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recurring_availabilities" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "doctor_id" UUID NOT NULL,
        "weekday" VARCHAR NOT NULL,
        "start_time" TIME NOT NULL,
        "end_time" TIME NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_recurring_availabilities_doctor_profiles"
          FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_recurring_availabilities_slot"
          UNIQUE ("doctor_id", "weekday", "start_time", "end_time")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_recurring_availabilities_doctor_weekday"
        ON "recurring_availabilities" ("doctor_id", "weekday")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_availabilities" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "doctor_id" UUID NOT NULL,
        "date" DATE NOT NULL,
        "start_time" TIME NOT NULL,
        "end_time" TIME NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_custom_availabilities_doctor_profiles"
          FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_custom_availabilities_slot"
          UNIQUE ("doctor_id", "date", "start_time", "end_time")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_custom_availabilities_doctor_date"
        ON "custom_availabilities" ("doctor_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_custom_availabilities_doctor_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_availabilities"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_recurring_availabilities_doctor_weekday"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recurring_availabilities"`);
  }
}
