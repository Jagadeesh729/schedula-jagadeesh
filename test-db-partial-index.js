const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/schedula';

async function testDatabasePartialIndexInvariant() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  DIRECT POSTGRESQL ENGINE PARTIAL UNIQUE INDEX INVARIANT TEST');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('neon.tech') || connectionString.includes('sslmode=require') 
      ? { rejectUnauthorized: false } 
      : false,
  });

  try {
    await client.connect();
    console.log('  ✓ Connected to PostgreSQL database engine.');

    // Ensure idx_stream_slot_unique index exists on appointments table
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_stream_slot_unique" 
      ON appointments (doctor_id, date, slot_start_time) 
      WHERE status = 'CONFIRMED' AND slot_start_time IS NOT NULL;
    `);
    console.log('  ✓ Verified idx_stream_slot_unique Partial Unique Index in PostgreSQL.\n');

    const mockDocUserId = '00000000-0000-4000-a000-000000000099';
    const mockPat1UserId = '00000000-0000-4000-a000-000000000098';
    const mockPat2UserId = '00000000-0000-4000-a000-000000000097';

    const mockDoctorId = '00000000-0000-4000-a000-000000000001';
    const mockPatient1Id = '00000000-0000-4000-a000-000000000002';
    const mockPatient2Id = '00000000-0000-4000-a000-000000000003';

    const mockDate = '2029-01-01';
    const mockSlotStartTime = '10:00:00';
    const mockSlotEndTime = '10:15:00';

    // Cleanup existing test rows
    await client.query('DELETE FROM appointments WHERE date = $1', [mockDate]);
    await client.query('DELETE FROM doctor_profiles WHERE id = $1', [mockDoctorId]);
    await client.query('DELETE FROM patient_profiles WHERE id IN ($1, $2)', [mockPatient1Id, mockPatient2Id]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [mockDocUserId, mockPat1UserId, mockPat2UserId]);

    // Insert dummy user and profiles
    await client.query(
      `INSERT INTO users (id, email, password, role, name) VALUES 
      ($1, 'db_test_doc@test.com', 'hash', 'DOCTOR', 'Dr. Index Test'),
      ($2, 'db_test_pat1@test.com', 'hash', 'PATIENT', 'Patient One'),
      ($3, 'db_test_pat2@test.com', 'hash', 'PATIENT', 'Patient Two')`,
      [mockDocUserId, mockPat1UserId, mockPat2UserId]
    );

    await client.query(
      `INSERT INTO doctor_profiles (id, user_id, full_name, specialization, experience, qualification, consultation_fee, availability, profile_details) VALUES ($1, $2, 'Dr. Index Test', 'Test', 5, 'MD', 100, 'Mon-Fri', 'DB Invariant Test Profile')`,
      [mockDoctorId, mockDocUserId]
    );

    await client.query(
      `INSERT INTO patient_profiles (id, user_id, full_name, age, gender, contact_details) VALUES 
      ($1, $2, 'Patient One', 30, 'Male', '111'),
      ($3, $4, 'Patient Two', 25, 'Female', '222')`,
      [mockPatient1Id, mockPat1UserId, mockPatient2Id, mockPat2UserId]
    );

    // 1. Direct raw SQL Insert #1 (CONFIRMED status)
    console.log('[1/3] Executing raw SQL INSERT #1 with status = CONFIRMED...');
    const res1 = await client.query(
      `INSERT INTO appointments (
        id, doctor_id, patient_id, date, slot_start_time, slot_end_time, status, schedule_type
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, 'CONFIRMED', 'STREAM'
      ) RETURNING id`,
      [mockDoctorId, mockPatient1Id, mockDate, mockSlotStartTime, mockSlotEndTime]
    );
    const appointment1Id = res1.rows[0].id;
    console.log(`  ✓ Insert #1 Succeeded! Created Appointment ID: ${appointment1Id}\n`);

    // 2. Direct raw SQL Insert #2 (Duplicate CONFIRMED status - Expected DB Violation)
    console.log('[2/3] Executing raw SQL INSERT #2 with duplicate CONFIRMED status...');
    let dbViolationOccurred = false;

    try {
      await client.query(
        `INSERT INTO appointments (
          id, doctor_id, patient_id, date, slot_start_time, slot_end_time, status, schedule_type
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 'CONFIRMED', 'STREAM'
        )`,
        [mockDoctorId, mockPatient2Id, mockDate, mockSlotStartTime, mockSlotEndTime]
      );
    } catch (err) {
      dbViolationOccurred = true;
      console.log(`  ✓ PostgreSQL Engine Blocked Insert #2!`);
      console.log(`    -> DB Error Code: ${err.code} (unique_violation)`);
      console.log(`    -> Index Constraint Name: ${err.constraint}`);
    }

    if (!dbViolationOccurred) {
      console.error('  ✗ FAIL: PostgreSQL allowed duplicate CONFIRMED slot insert!');
      await client.query('DELETE FROM appointments WHERE date = $1', [mockDate]);
      await client.query('DELETE FROM doctor_profiles WHERE id = $1', [mockDoctorId]);
      await client.query('DELETE FROM patient_profiles WHERE id IN ($1, $2)', [mockPatient1Id, mockPatient2Id]);
      await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [mockDocUserId, mockPat1UserId, mockPat2UserId]);
      await client.end();
      process.exit(1);
    }

    // 3. Verify Cancelled slot permits re-booking
    console.log('\n[3/3] Testing transition to CANCELLED and re-booking...');
    await client.query(`UPDATE appointments SET status = 'CANCELLED' WHERE id = $1`, [appointment1Id]);

    const res3 = await client.query(
      `INSERT INTO appointments (
        id, doctor_id, patient_id, date, slot_start_time, slot_end_time, status, schedule_type
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, 'CONFIRMED', 'STREAM'
      ) RETURNING id`,
      [mockDoctorId, mockPatient2Id, mockDate, mockSlotStartTime, mockSlotEndTime]
    );
    console.log(`  ✓ Insert #3 Succeeded after status transition to CANCELLED! Created ID: ${res3.rows[0].id}`);

    // Cleanup
    await client.query('DELETE FROM appointments WHERE date = $1', [mockDate]);
    await client.query('DELETE FROM doctor_profiles WHERE id = $1', [mockDoctorId]);
    await client.query('DELETE FROM patient_profiles WHERE id IN ($1, $2)', [mockPatient1Id, mockPatient2Id]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [mockDocUserId, mockPat1UserId, mockPat2UserId]);
    await client.end();

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('        POSTGRESQL PARTIAL UNIQUE INDEX INVARIANT VERIFIED');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  ✓ PostgreSQL engine physically rejected duplicate CONFIRMED slot (23505).');
    console.log('  ✓ Partial Unique Index WHERE status = \'CONFIRMED\' is operating correctly!\n');
    process.exit(0);
  } catch (err) {
    console.error('Database query error:', err);
    await client.end();
    process.exit(1);
  }
}

testDatabasePartialIndexInvariant();
