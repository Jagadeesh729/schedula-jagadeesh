import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdvancedScheduling1784900000001
  implements MigrationInterface
{
  name = 'CreateAdvancedScheduling1784900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scheduling_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "scheduling_type" character varying NOT NULL,
        "slot_duration" integer,
        "buffer_time" integer DEFAULT '0',
        "max_capacity" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_scheduling_configs_doctor" UNIQUE ("doctor_id"),
        CONSTRAINT "PK_scheduling_configs_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "patient_id" uuid,
        "schedule_type" character varying NOT NULL,
        "date" character varying NOT NULL,
        "slot_start_time" character varying,
        "slot_end_time" character varying,
        "window" character varying,
        "token" integer,
        "status" character varying NOT NULL DEFAULT 'CONFIRMED',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appointments_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduling_configs"
      DROP CONSTRAINT IF EXISTS "FK_scheduling_configs_doctor";
      ALTER TABLE "scheduling_configs"
      ADD CONSTRAINT "FK_scheduling_configs_doctor"
      FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);

    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP CONSTRAINT IF EXISTS "FK_appointments_doctor";
      ALTER TABLE "appointments"
      ADD CONSTRAINT "FK_appointments_doctor"
      FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);

    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP CONSTRAINT IF EXISTS "FK_appointments_patient";
      ALTER TABLE "appointments"
      ADD CONSTRAINT "FK_appointments_patient"
      FOREIGN KEY ("patient_id") REFERENCES "patient_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_wave_window_patient_unique"
      ON "appointments" ("doctor_id", "date", "window", "patient_id")
      WHERE status = 'CONFIRMED' AND window IS NOT NULL AND patient_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_wave_window_token_unique"
      ON "appointments" ("doctor_id", "date", "window", "token")
      WHERE status = 'CONFIRMED' AND window IS NOT NULL AND token IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_wave_window_token_unique";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_wave_window_patient_unique";`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "FK_appointments_patient";`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "FK_appointments_doctor";`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduling_configs" DROP CONSTRAINT IF EXISTS "FK_scheduling_configs_doctor";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "appointments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduling_configs";`);
  }
}
