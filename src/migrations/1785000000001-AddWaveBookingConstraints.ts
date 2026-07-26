import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWaveBookingConstraints1785000000001 implements MigrationInterface {
  name = 'AddWaveBookingConstraints1785000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_appointments_wave_unique_booking"
      ON "appointments" ("doctor_id", "date", "window", "token");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_appointments_wave_unique_booking";`,
    );
  }
}
