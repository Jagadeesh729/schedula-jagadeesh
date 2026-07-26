import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdvancedScheduling1784900000001 implements MigrationInterface {
  name = 'CreateAdvancedScheduling1784900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scheduling_configs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "doctor_id" UUID NOT NULL,
        "scheduling_type" VARCHAR NOT NULL,
        "slot_duration" INTEGER,
        "buffer_time" INTEGER,
        "max_capacity" INTEGER,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_scheduling_configs_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_scheduling_configs_doctor" UNIQUE ("doctor_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "doctor_id" UUID NOT NULL,
        "patient_id" UUID,
        "schedule_type" VARCHAR NOT NULL,
        "date" DATE NOT NULL,
        "slot_start_time" TIME,
        "slot_end_time" TIME,
        "window" VARCHAR,
        "token" INTEGER,
        "status" VARCHAR NOT NULL DEFAULT 'CONFIRMED',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_appointments_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_appointments_patient" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_doctor_date" ON "appointments" ("doctor_id", "date");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_appointments_doctor_date";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "appointments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduling_configs";`);
  }
}
