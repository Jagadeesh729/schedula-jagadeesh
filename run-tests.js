/**
 * Runtime verification script for Day 4 Doctor Availability System.
 * Executes all test scenarios and records actual HTTP results.
 * Run AFTER server is up: node run-tests.js
 */

const BASE_URL = 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// Tokens — filled in by setup phase
// ─────────────────────────────────────────────────────────────────────────────
let DOCTOR_TOKEN = '';
let DOCTOR2_TOKEN = '';
let PATIENT_TOKEN = '';
let createdSlotId = '';
let createdOverrideId = '';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

async function req(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

function check(label, condition, actual) {
  const pass = condition;
  const marker = pass ? '✓ PASS' : '✗ FAIL';
  const line = `  ${marker} — ${label} | actual: ${JSON.stringify(actual)}`;
  console.log(line);
  results.push({ label, pass, actual });
  if (pass) passed++; else failed++;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup — register users, login, get tokens
// ─────────────────────────────────────────────────────────────────────────────
async function setup() {
  console.log('\n══════ SETUP ══════');

  // Register Doctor 1
  const d1Email = `doc1_${Date.now()}@test.com`;
  const d1Reg = await req('POST', '/auth/signup', { name: 'Dr Test One', email: d1Email, password: 'Pass1234!', role: 'DOCTOR' });
  console.log(`  Doctor 1 register: ${d1Reg.status}`);
  const d1Login = await req('POST', '/auth/login', { email: d1Email, password: 'Pass1234!' });
  if (d1Login.data?.access_token) {
    DOCTOR_TOKEN = d1Login.data.access_token;
    console.log('  ✓ Doctor 1 registered and logged in');
  } else {
    console.log('  ✗ Doctor 1 login failed:', JSON.stringify(d1Login.data));
    return false;
  }

  // Create Doctor 1 profile
  const profRes = await req('POST', '/doctor/profile', {
    fullName: 'Dr Test One', specialization: 'Cardiology', experience: 5,
    qualification: 'MBBS', consultationFee: 500, availability: 'Weekdays',
    profileDetails: 'Experienced cardiologist'
  }, DOCTOR_TOKEN);
  if (profRes.status === 201 || profRes.status === 200) {
    console.log('  ✓ Doctor 1 profile created');
  } else {
    console.log('  ✗ Doctor 1 profile failed:', JSON.stringify(profRes.data));
    return false;
  }

  // Register Doctor 2
  const d2Email = `doc2_${Date.now()}@test.com`;
  const d2Reg = await req('POST', '/auth/signup', { name: 'Dr Test Two', email: d2Email, password: 'Pass1234!', role: 'DOCTOR' });
  console.log(`  Doctor 2 register: ${d2Reg.status}`);
  const d2Login = await req('POST', '/auth/login', { email: d2Email, password: 'Pass1234!' });
  if (d2Login.data?.access_token) {
    DOCTOR2_TOKEN = d2Login.data.access_token;
    console.log('  ✓ Doctor 2 registered and logged in');
  } else {
    console.log('  ⚠ Doctor 2 login failed — ownership tests will skip');
  }

  // Create Doctor 2 profile
  await req('POST', '/doctor/profile', {
    fullName: 'Dr Test Two', specialization: 'Neurology', experience: 3,
    qualification: 'MD', consultationFee: 600, availability: 'Weekends',
    profileDetails: 'Neurologist'
  }, DOCTOR2_TOKEN);

  // Register Patient
  const pEmail = `patient_${Date.now()}@test.com`;
  const pReg = await req('POST', '/auth/signup', { name: 'Patient One', email: pEmail, password: 'Pass1234!', role: 'PATIENT' });
  console.log(`  Patient register: ${pReg.status}`);
  const pLogin = await req('POST', '/auth/login', { email: pEmail, password: 'Pass1234!' });
  if (pLogin.data?.access_token) {
    PATIENT_TOKEN = pLogin.data.access_token;
    console.log('  ✓ Patient registered and logged in');
  } else {
    console.log('  ⚠ Patient login failed — forbidden tests will skip');
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
async function runTests() {
  // ── Authorization ─────────────────────────────────────────────────────────
  console.log('\n══════ AUTHORIZATION ══════');

  let r = await req('GET', '/doctor/availability', null, null);
  check('T01 — No token → 401', r.status === 401, r.status);

  r = await req('GET', '/doctor/availability', null, PATIENT_TOKEN);
  check('T02 — Patient token → 403', r.status === 403, r.status);

  // ── Create Recurring Slots ─────────────────────────────────────────────────
  console.log('\n══════ RECURRING AVAILABILITY ══════');

  r = await req('POST', '/doctor/availability', { weekday: 'Monday', startTime: '09:00', endTime: '11:00' }, DOCTOR_TOKEN);
  check('T03 — Create valid recurring slot → 201', r.status === 201, r.status);
  if (r.data?.id) { createdSlotId = r.data.id; console.log(`       Slot ID: ${createdSlotId}`); }

  r = await req('POST', '/doctor/availability', { weekday: 'Monday', startTime: '14:00', endTime: '17:00' }, DOCTOR_TOKEN);
  check('T04 — Create second non-overlapping slot → 201', r.status === 201, r.status);

  r = await req('POST', '/doctor/availability', { weekday: 'Monday', startTime: '11:00', endTime: '12:00' }, DOCTOR_TOKEN);
  check('T05 — Adjacent slot (11:00 after 09:00–11:00) → 201 (allowed)', r.status === 201, r.status);

  r = await req('POST', '/doctor/availability', { weekday: 'Monday', startTime: '10:00', endTime: '13:00' }, DOCTOR_TOKEN);
  check('T06 — Overlapping slot → 409', r.status === 409, r.status);

  r = await req('POST', '/doctor/availability', { weekday: 'Monday', startTime: '09:00', endTime: '11:00' }, DOCTOR_TOKEN);
  check('T07 — Exact duplicate slot → 409', r.status === 409, r.status);

  // ── DTO Validation ─────────────────────────────────────────────────────────
  console.log('\n══════ DTO VALIDATION ══════');

  r = await req('POST', '/doctor/availability', { weekday: 'Funday', startTime: '09:00', endTime: '10:00' }, DOCTOR_TOKEN);
  check('T08 — Invalid weekday → 400', r.status === 400, r.status);

  r = await req('POST', '/doctor/availability', { weekday: 'Tuesday', startTime: '11:00', endTime: '09:00' }, DOCTOR_TOKEN);
  check('T09 — startTime >= endTime → 400', r.status === 400, r.status);

  r = await req('POST', '/doctor/availability', { weekday: 'Tuesday', startTime: '9:00', endTime: '10:00' }, DOCTOR_TOKEN);
  check('T10 — Invalid time format (9:00 not HH:MM) → 400', r.status === 400, r.status);

  // ── GET Recurring ──────────────────────────────────────────────────────────
  console.log('\n══════ GET RECURRING ══════');

  r = await req('GET', '/doctor/availability', null, DOCTOR_TOKEN);
  check('T11 — GET recurring → 200', r.status === 200, r.status);
  check('T12 — Returns array', Array.isArray(r.data), typeof r.data);

  // ── Update ─────────────────────────────────────────────────────────────────
  console.log('\n══════ UPDATE ══════');

  if (createdSlotId) {
    r = await req('PATCH', `/doctor/availability/${createdSlotId}`, { startTime: '08:00', endTime: '10:00' }, DOCTOR_TOKEN);
    check('T13 — Update own slot → 200', r.status === 200, r.status);
    check('T14 — Updated startTime reflects change', r.data?.startTime?.startsWith('08'), r.data?.startTime);

    r = await req('PATCH', `/doctor/availability/${createdSlotId}`, { startTime: '08:00', endTime: '10:00' }, DOCTOR2_TOKEN);
    check('T15 — Update another doctor slot → 403', r.status === 403, r.status);
  } else {
    console.log('  ⚠ T13–T15 skipped — no slot ID from T03');
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  console.log('\n══════ DELETE ══════');

  if (createdSlotId) {
    r = await req('DELETE', `/doctor/availability/${createdSlotId}`, null, DOCTOR_TOKEN);
    check('T16 — Delete own slot → 200', r.status === 200, r.status);
  } else {
    console.log('  ⚠ T16 skipped — no slot ID');
  }

  // ── Custom Override ────────────────────────────────────────────────────────
  console.log('\n══════ CUSTOM OVERRIDE ══════');

  r = await req('POST', '/doctor/availability/override', { date: '2026-08-04', startTime: '10:00', endTime: '12:00' }, DOCTOR_TOKEN);
  check('T17 — Create valid custom override → 201', r.status === 201, r.status);
  if (r.data?.id) { createdOverrideId = r.data.id; }

  r = await req('POST', '/doctor/availability/override', { date: '2026-02-30', startTime: '09:00', endTime: '10:00' }, DOCTOR_TOKEN);
  check('T18 — Invalid calendar date (2026-02-30) → 400', r.status === 400, r.status);

  r = await req('POST', '/doctor/availability/override', { date: '2026-13-01', startTime: '09:00', endTime: '10:00' }, DOCTOR_TOKEN);
  check('T19 — Invalid calendar date (month 13) → 400', r.status === 400, r.status);

  // ── GET by Date ────────────────────────────────────────────────────────────
  console.log('\n══════ GET BY DATE ══════');

  // 2026-08-04 is a Tuesday — no recurring slot for Tuesday in our setup
  // But we created a custom override for 2026-08-04
  r = await req('GET', '/doctor/availability/date?date=2026-08-04', null, DOCTOR_TOKEN);
  check('T20 — GET by date with override → 200', r.status === 200, r.status);
  check('T21 — Returns source: custom', r.data?.source === 'custom', r.data?.source);
  check('T22 — Does not return recurring', r.data?.source !== 'recurring', r.data?.source);

  // 2026-08-10 is a Monday — we have recurring slots for Monday
  r = await req('GET', '/doctor/availability/date?date=2026-08-10', null, DOCTOR_TOKEN);
  check('T23 — GET by date (Monday) with no override → 200', r.status === 200, r.status);
  check('T24 — Returns source: recurring', r.data?.source === 'recurring', r.data?.source);

  r = await req('GET', '/doctor/availability/date', null, DOCTOR_TOKEN);
  check('T25 — GET /date with no query param → 400', r.status === 400, r.status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Regression — Day 1–3 APIs
// ─────────────────────────────────────────────────────────────────────────────
async function regression() {
  console.log('\n══════ REGRESSION — DAY 1-3 APIs ══════');

  let r = await req('GET', '/doctor/profile', null, DOCTOR_TOKEN);
  check('R01 — GET /doctor/profile still works → 200', r.status === 200, r.status);

  r = await req('PATCH', '/doctor/profile', { specialization: 'Updated' }, DOCTOR_TOKEN);
  check('R02 — PATCH /doctor/profile still works → 200', r.status === 200, r.status);

  // Auth regression
  r = await req('POST', '/auth/login', { email: 'nonexistent@test.com', password: 'wrongpass' });
  check('R03 — Login with wrong creds still returns 401', r.status === 401, r.status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Day 4 — Runtime Verification');
  console.log(`  Target: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════════');

  const ok = await setup();
  if (!ok) {
    console.log('\n✗ Setup failed — cannot proceed with tests');
    process.exit(1);
  }

  await runTests();
  await regression();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // JSON summary for audit report
  const summary = { passed, failed, results };
  const fs = await import('fs');
  fs.writeFileSync('test-results.json', JSON.stringify(summary, null, 2));
  console.log('  Results saved to test-results.json');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Runner error:', err.message);
  process.exit(1);
});
