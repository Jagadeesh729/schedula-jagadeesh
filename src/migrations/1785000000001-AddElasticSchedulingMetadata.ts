import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddElasticSchedulingMetadata1785000000001
  implements MigrationInterface
{
  name = 'AddElasticSchedulingMetadata1785000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "previous_date" character varying,
      ADD COLUMN IF NOT EXISTS "previous_slot_start_time" character varying,
      ADD COLUMN IF NOT EXISTS "previous_slot_end_time" character varying,
      ADD COLUMN IF NOT EXISTS "previous_window" character varying,
      ADD COLUMN IF NOT EXISTS "previous_token" integer,
      ADD COLUMN IF NOT EXISTS "is_auto_rescheduled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "rescheduled_reason" character varying;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN IF EXISTS "rescheduled_reason",
      DROP COLUMN IF EXISTS "is_auto_rescheduled",
      DROP COLUMN IF EXISTS "previous_token",
      DROP COLUMN IF EXISTS "previous_window",
      DROP COLUMN IF EXISTS "previous_slot_end_time",
      DROP COLUMN IF EXISTS "previous_slot_start_time",
      DROP COLUMN IF EXISTS "previous_date";
    `);
  }
}
