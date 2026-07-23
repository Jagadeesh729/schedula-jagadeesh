import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDoctorProfile1784700000001 implements MigrationInterface {
  name = 'CreateDoctorProfile1784700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_profiles" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID UNIQUE NOT NULL,
        "full_name" VARCHAR NOT NULL,
        "specialization" VARCHAR NOT NULL,
        "experience" INTEGER NOT NULL,
        "qualification" VARCHAR NOT NULL,
        "consultation_fee" DECIMAL(10, 2) NOT NULL,
        "availability" VARCHAR NOT NULL,
        "profile_details" TEXT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_doctor_profiles_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "doctor_profiles"`);
  }
}
