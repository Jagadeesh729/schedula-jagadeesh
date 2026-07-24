/**
 * Integration test script for Day 4 - Doctor Availability System
 *
 * Prerequisites:
 *   - Application running on http://localhost:3000
 *   - Two registered doctor accounts with valid JWT tokens
 *   - Both doctors must have completed profile setup
 *
 * Usage:
 *   node test-availability.js
 */

const BASE_URL = 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION — fill in before running
// ─────────────────────────────────────────────────────────────────────────────

const DOCTOR_TOKEN = 'REPLACE_WITH_DOCTOR_JWT_TOKEN';
const DOCTOR2_TOKEN = 'REPLACE_WITH_SECOND_DOCTOR_JWT_TOKEN';
const PATIENT_TOKEN = 'REPLACE_WITH_PATIENT_JWT_TOKEN';

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let createdSlotId = null;

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {}

  return { status: res.status, data };
}

function assert(label, condition, actual) {
  if (condition) {
    console.log(`  ✓ PASS — ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL — ${label} | Got: ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────────────────────────────────────

async function test_01_createValidRecurringSlot() {
  console.log('\n[1] Create recurring slot — valid data');
  const { status, data } = await request(
    'POST', '/doctor/availability',
    { weekday: 'Monday', startTime: '09:00', endTime: '11:00' },
    DOCTOR_TOKEN,
  );
  assert('Returns 201 Created', status === 201, status);
  assert('Returns slot with id', data && data.id, data);
  if (data && data.id) createdSlotId = data.id;
}

async function test_02_createSecondNonOverlappingSlot() {
  console.log('\n[2] Create second non-overlapping slot — same weekday');
  const { status, data } = await request(
    'POST', '/doctor/availability',
    { weekday: 'Monday', startTime: '14:00', endTime: '17:00' },
    DOCTOR_TOKEN,
  );
  assert('Returns 201 Created', status === 201, status);
  assert('Returns slot with id', data && data.id, data);
}

async function test_03_adjacentSlotAllowed() {
  console.log('\n[3] Create adjacent slot — 11:00 immediately after 09:00–11:00');
  const { status, data } = await request(
    'POST', '/doctor/availability',
    { weekday: 'Monday', startTime: '11:00', endTime: '12:00' },
    DOCTOR_TOKEN,
  );
  assert('Returns 201 Created (adjacent is valid)', status === 201, status);
  assert('Returns slot with id', data && data.id, data);
}

async function test_04_overlappingSlotRejected() {
  console.log('\n[4] Create overlapping slot — should be rejected');
  const { status } = await request(
    'POST', '/doctor/availability',
    { weekday: 'Monday', startTime: '10:00', endTime: '12:30' },
    DOCTOR_TOKEN,
  );
  assert('Returns 409 Conflict', status === 409, status);
}

async function test_05_duplicateSlotRejected() {
  console.log('\n[5] Create exact duplicate slot — should be rejected');
  const { status } = await request(
    'POST', '/doctor/availability',
    { weekday: 'Monday', startTime: '09:00', endTime: '11:00' },
    DOCTOR_TOKEN,
  );
  assert('Returns 409 Conflict', status === 409, status);
}

async function test_06_invalidTimeRange() {
  console.log('\n[6] Create slot with startTime >= endTime');
  const { status } = await request(
    'POST', '/doctor/availability',
    { weekday: 'Tuesday', startTime: '11:00', endTime: '09:00' },
    DOCTOR_TOKEN,
  );
  assert('Returns 400 Bad Request', status === 400, status);
}

async function test_07_invalidWeekday() {
  console.log('\n[7] Create slot with invalid weekday');
  const { status } = await request(
    'POST', '/doctor/availability',
    { weekday: 'Funday', startTime: '09:00', endTime: '10:00' },
    DOCTOR_TOKEN,
  );
  assert('Returns 400 Bad Request', status === 400, status);
}

async function test_08_unauthenticated() {
  console.log('\n[8] Request without token — unauthenticated');
  const { status } = await request('GET', '/doctor/availability', null, null);
  assert('Returns 401 Unauthorized', status === 401, status);
}

async function test_09_forbiddenRole() {
  console.log('\n[9] Request with PATIENT token — forbidden role');
  const { status } = await request('GET', '/doctor/availability', null, PATIENT_TOKEN);
  assert('Returns 403 Forbidden', status === 403, status);
}

async function test_10_missingDoctorProfile() {
  console.log('\n[10] Create slot when doctor profile does not exist');
  // This test requires a DOCTOR-role token for a user who has NOT set up a profile.
  // If not available, skip with a note.
  console.log('  ⚠ SKIP — Requires a doctor account with no profile. Verify manually.');
}

async function test_11_updateOwnSlot() {
  console.log('\n[11] Update own recurring slot — valid');
  if (!createdSlotId) {
    console.log('  ⚠ SKIP — No slot id from test 1. Re-run after test 1 succeeds.');
    return;
  }
  const { status, data } = await request(
    'PATCH', `/doctor/availability/${createdSlotId}`,
    { startTime: '08:00', endTime: '10:00' },
    DOCTOR_TOKEN,
  );
  assert('Returns 200 OK', status === 200, status);
  assert('Returns updated slot', data && data.id === createdSlotId, data);
}

async function test_12_updateAnotherDoctorSlot() {
  console.log('\n[12] Update slot belonging to different doctor — ownership check');
  if (!createdSlotId) {
    console.log('  ⚠ SKIP — No slot id from test 1.');
    return;
  }
  const { status } = await request(
    'PATCH', `/doctor/availability/${createdSlotId}`,
    { startTime: '08:00', endTime: '10:00' },
    DOCTOR2_TOKEN,
  );
  assert('Returns 403 Forbidden', status === 403, status);
}

async function test_13_deleteOwnSlot() {
  console.log('\n[13] Delete own recurring slot');
  if (!createdSlotId) {
    console.log('  ⚠ SKIP — No slot id from test 1.');
    return;
  }
  const { status } = await request('DELETE', `/doctor/availability/${createdSlotId}`, null, DOCTOR_TOKEN);
  assert('Returns 200 OK', status === 200, status);
}

async function test_14_createValidOverride() {
  console.log('\n[14] Create custom override — valid date and non-overlapping time');
  const { status, data } = await request(
    'POST', '/doctor/availability/override',
    { date: '2026-08-04', startTime: '10:00', endTime: '12:00' },
    DOCTOR_TOKEN,
  );
  assert('Returns 201 Created', status === 201, status);
  assert('Returns override with id', data && data.id, data);
}

async function test_15_invalidCalendarDate() {
  console.log('\n[15] Create override with invalid calendar date (2026-02-30)');
  const { status } = await request(
    'POST', '/doctor/availability/override',
    { date: '2026-02-30', startTime: '09:00', endTime: '10:00' },
    DOCTOR_TOKEN,
  );
  assert('Returns 400 Bad Request', status === 400, status);
}

async function test_16_getByDateRecurring() {
  console.log('\n[16] GET /doctor/availability/date — returns recurring when no override exists');
  const { status, data } = await request(
    'GET', '/doctor/availability/date?date=2026-08-10',
    null,
    DOCTOR_TOKEN,
  );
  assert('Returns 200 OK', status === 200, status);
  assert('Returns source: recurring', data && data.source === 'recurring', data);
}

async function test_17_getByDateOverride() {
  console.log('\n[17] GET /doctor/availability/date — returns override only when override exists');
  const { status, data } = await request(
    'GET', '/doctor/availability/date?date=2026-08-04',
    null,
    DOCTOR_TOKEN,
  );
  assert('Returns 200 OK', status === 200, status);
  assert('Returns source: custom', data && data.source === 'custom', data);
  assert('Does not return recurring data', data && data.source !== 'recurring', data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Day 4 — Doctor Availability Integration Tests');
  console.log('═══════════════════════════════════════════════════════════');

  await test_01_createValidRecurringSlot();
  await test_02_createSecondNonOverlappingSlot();
  await test_03_adjacentSlotAllowed();
  await test_04_overlappingSlotRejected();
  await test_05_duplicateSlotRejected();
  await test_06_invalidTimeRange();
  await test_07_invalidWeekday();
  await test_08_unauthenticated();
  await test_09_forbiddenRole();
  await test_10_missingDoctorProfile();
  await test_11_updateOwnSlot();
  await test_12_updateAnotherDoctorSlot();
  await test_13_deleteOwnSlot();
  await test_14_createValidOverride();
  await test_15_invalidCalendarDate();
  await test_16_getByDateRecurring();
  await test_17_getByDateOverride();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
