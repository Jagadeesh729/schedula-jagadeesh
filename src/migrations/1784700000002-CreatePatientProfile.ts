import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatientProfile1784700000002 implements MigrationInterface {
  name = 'CreatePatientProfile1784700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_profiles" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID UNIQUE NOT NULL,
        "full_name" VARCHAR NOT NULL,
        "age" INTEGER NOT NULL,
        "gender" VARCHAR NOT NULL,
        "contact_details" VARCHAR NOT NULL,
        "basic_health_information" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_patient_profiles_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "patient_profiles"`);
  }
}
