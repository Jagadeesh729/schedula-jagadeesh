import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1784700000000 implements MigrationInterface {
  name = 'CreateUsers1784700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR NOT NULL,
        "email" VARCHAR UNIQUE NOT NULL,
        "password" VARCHAR NOT NULL,
        "role" VARCHAR NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
  }
}
