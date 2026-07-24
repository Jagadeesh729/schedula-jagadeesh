/**
 * Integration Test Suite for Advanced Doctor Scheduling System (STREAM & WAVE).
 * Run against a live running server: node test-advanced-scheduling.js
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

let DOCTOR1_TOKEN = '';
let DOCTOR1_USER_ID = '';
let DOCTOR1_PROFILE_ID = '';

let DOCTOR2_TOKEN = '';
let DOCTOR2_USER_ID = '';
let DOCTOR2_PROFILE_ID = '';

let PATIENT1_TOKEN = '';
let PATIENT1_USER_ID = '';

let PATIENT2_TOKEN = '';
let PATIENT2_USER_ID = '';

let streamAppointmentId = '';
let waveAppointmentId = '';

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
  const pass = !!condition;
  const marker = pass ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${marker} — ${label} | actual status/data: ${JSON.stringify(actual)}`);
  results.push({ label, pass, actual });
  if (pass) passed++; else failed++;
}

async function setup() {
  console.log('\n══════ ADVANCED SCHEDULING SETUP ══════');

  // Register Doctor 1
  const d1Email = `stream_doc_${Date.now()}@test.com`;
  await req('POST', '/auth/signup', { name: 'Dr Stream', email: d1Email, password: 'Pass1234!', role: 'DOCTOR' });
  const d1Login = await req('POST', '/auth/login', { email: d1Email, password: 'Pass1234!' });
  DOCTOR1_TOKEN = d1Login.data.access_token;
  DOCTOR1_USER_ID = d1Login.data.user.id;

  const prof1 = await req('POST', '/doctor/profile', {
    fullName: 'Dr Stream', specialization: 'General', experience: 10,
    qualification: 'MBBS', consultationFee: 500, availability: 'Weekdays',
    profileDetails: 'Stream specialist'
  }, DOCTOR1_TOKEN);
  DOCTOR1_PROFILE_ID = prof1.data.id;
  console.log(`  ✓ Doctor 1 registered (Profile ID: ${DOCTOR1_PROFILE_ID})`);

  // Register Doctor 2
  const d2Email = `wave_doc_${Date.now()}@test.com`;
  await req('POST', '/auth/signup', { name: 'Dr Wave', email: d2Email, password: 'Pass1234!', role: 'DOCTOR' });
  const d2Login = await req('POST', '/auth/login', { email: d2Email, password: 'Pass1234!' });
  DOCTOR2_TOKEN = d2Login.data.access_token;
  DOCTOR2_USER_ID = d2Login.data.user.id;

  const prof2 = await req('POST', '/doctor/profile', {
    fullName: 'Dr Wave', specialization: 'Pediatrics', experience: 8,
    qualification: 'MD', consultationFee: 600, availability: 'Weekdays',
    profileDetails: 'Wave specialist'
  }, DOCTOR2_TOKEN);
  DOCTOR2_PROFILE_ID = prof2.data.id;
  console.log(`  ✓ Doctor 2 registered (Profile ID: ${DOCTOR2_PROFILE_ID})`);

  // Register Patient 1
  const p1Email = `patient1_${Date.now()}@test.com`;
  const p1Reg = await req('POST', '/auth/signup', { name: 'Patient One', email: p1Email, password: 'Pass1234!', role: 'PATIENT' });
  PATIENT1_USER_ID = p1Reg.data.id;
  const p1Login = await req('POST', '/auth/login', { email: p1Email, password: 'Pass1234!' });
  PATIENT1_TOKEN = p1Login.data.access_token;
  console.log(`  ✓ Patient 1 registered`);

  // Register Patient 2
  const p2Email = `patient2_${Date.now()}@test.com`;
  const p2Reg = await req('POST', '/auth/signup', { name: 'Patient Two', email: p2Email, password: 'Pass1234!', role: 'PATIENT' });
  PATIENT2_USER_ID = p2Reg.data.id;
  const p2Login = await req('POST', '/auth/login', { email: p2Email, password: 'Pass1234!' });
  PATIENT2_TOKEN = p2Login.data.access_token;
  console.log(`  ✓ Patient 2 registered`);
}

async function runTests() {
  await setup();

  console.log('\n══════ 1. SCHEDULING CONFIGURATION TESTS ══════');

  // Stream Configuration
  const cfgStream = await req('POST', `/doctors/${DOCTOR1_PROFILE_ID}/scheduling`, {
    schedulingType: 'STREAM',
    slotDuration: 15,
    bufferTime: 5,
  }, DOCTOR1_TOKEN);
  check('Configure STREAM scheduling (15m duration, 5m buffer)', cfgStream.status === 201 || cfgStream.status === 200, cfgStream.status);

  // Invalid Stream duration
  const cfgInvDur = await req('POST', `/doctors/${DOCTOR1_PROFILE_ID}/scheduling`, {
    schedulingType: 'STREAM',
    slotDuration: 0,
    bufferTime: 5,
  }, DOCTOR1_TOKEN);
  check('Reject STREAM configuration with invalid duration <= 0', cfgInvDur.status === 400, cfgInvDur.status);

  // Negative buffer
  const cfgNegBuf = await req('POST', `/doctors/${DOCTOR1_PROFILE_ID}/scheduling`, {
    schedulingType: 'STREAM',
    slotDuration: 15,
    bufferTime: -5,
  }, DOCTOR1_TOKEN);
  check('Reject STREAM configuration with negative bufferTime', cfgNegBuf.status === 400, cfgNegBuf.status);

  // Wave Configuration
  const cfgWave = await req('POST', `/doctors/${DOCTOR2_PROFILE_ID}/scheduling`, {
    schedulingType: 'WAVE',
    maxCapacity: 3,
  }, DOCTOR2_TOKEN);
  check('Configure WAVE scheduling (maxCapacity=3)', cfgWave.status === 201 || cfgWave.status === 200, cfgWave.status);

  // Invalid Wave capacity
  const cfgInvCap = await req('POST', `/doctors/${DOCTOR2_PROFILE_ID}/scheduling`, {
    schedulingType: 'WAVE',
    maxCapacity: 0,
  }, DOCTOR2_TOKEN);
  check('Reject WAVE configuration with capacity <= 0', cfgInvCap.status === 400, cfgInvCap.status);

  // Invalid Doctor UUID parameter
  const cfgInvUUID = await req('POST', `/doctors/not-a-valid-uuid/scheduling`, {
    schedulingType: 'STREAM',
    slotDuration: 15,
  }, DOCTOR1_TOKEN);
  check('Reject invalid doctorId UUID with 400 Bad Request via ParseUUIDPipe', cfgInvUUID.status === 400, cfgInvUUID.status);

  // Doctor Not Found
  const fakeDoctorId = '00000000-0000-0000-0000-000000000000';
  const cfgNotFound = await req('POST', `/doctors/${fakeDoctorId}/scheduling`, {
    schedulingType: 'STREAM',
    slotDuration: 15,
  }, DOCTOR1_TOKEN);
  check('Reject non-existent doctor with 404 Not Found', cfgNotFound.status === 404, cfgNotFound.status);

  console.log('\n══════ 2. STREAM SLOT GENERATION & AVAILABILITY TESTS ══════');

  // Set Doctor 1 Availability on Monday (2026-08-03 is a Monday)
  await req('POST', '/doctor/availability', {
    weekday: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
  }, DOCTOR1_TOKEN);

  const futureMonday = '2026-08-03';
  const streamAvail = await req('GET', `/doctors/${DOCTOR1_PROFILE_ID}/availability?date=${futureMonday}`);
  check('Fetch STREAM availability generates slots (10:00-10:15, 10:20-10:35, 10:40-10:55)',
    streamAvail.status === 200 && Array.isArray(streamAvail.data) && streamAvail.data.length === 3,
    streamAvail.data
  );

  console.log('\n══════ 3. STREAM APPOINTMENT BOOKING TESTS ══════');

  // Book exact Stream slot
  const bookStream = await req('POST', '/appointments', {
    doctorId: DOCTOR1_PROFILE_ID,
    date: futureMonday,
    slot: { startTime: '10:00', endTime: '10:15' },
    patientId: PATIENT1_USER_ID,
  }, PATIENT1_TOKEN);

  check('Book exact STREAM slot returns 201 with appointment payload',
    bookStream.status === 201 && bookStream.data?.scheduleType === 'STREAM' && bookStream.data?.slot?.startTime === '10:00',
    bookStream.data
  );
  streamAppointmentId = bookStream.data?.appointmentId;

  // Re-fetch availability, 10:00 slot should be unavailable
  const streamAvailAfter = await req('GET', `/doctors/${DOCTOR1_PROFILE_ID}/availability?date=${futureMonday}`);
  const slot10 = streamAvailAfter.data?.find(s => s.startTime === '10:00');
  check('Booked STREAM slot is marked unavailable (available: false)', slot10?.available === false, slot10);

  // Overlap Validation (book same slot again)
  const bookStreamOverlap = await req('POST', '/appointments', {
    doctorId: DOCTOR1_PROFILE_ID,
    date: futureMonday,
    slot: { startTime: '10:00', endTime: '10:15' },
    patientId: PATIENT2_USER_ID,
  }, PATIENT2_TOKEN);
  check('Reject booking booked STREAM slot with 409 Conflict', bookStreamOverlap.status === 409, bookStreamOverlap.status);

  // Past Schedule Validation
  const bookPast = await req('POST', '/appointments', {
    doctorId: DOCTOR1_PROFILE_ID,
    date: '2020-01-01',
    slot: { startTime: '10:00', endTime: '10:15' },
  });
  check('Reject booking for past date with 400 Bad Request', bookPast.status === 400, bookPast.status);

  console.log('\n══════ 4. WAVE SCHEDULING & TOKEN ASSIGNMENT TESTS ══════');

  // Set Doctor 2 Availability on Monday 10:00-11:00
  await req('POST', '/doctor/availability', {
    weekday: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
  }, DOCTOR2_TOKEN);

  // Fetch Wave Availability
  const waveAvail = await req('GET', `/doctors/${DOCTOR2_PROFILE_ID}/availability?date=${futureMonday}`);
  check('Fetch WAVE availability returns window with capacity',
    waveAvail.status === 200 && Array.isArray(waveAvail.data) && waveAvail.data[0]?.window === '10:00-11:00' && waveAvail.data[0]?.capacity === 3,
    waveAvail.data
  );

  // Patient 1 books Wave token 1
  const waveBook1 = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureMonday,
    window: '10:00-11:00',
    patientId: PATIENT1_USER_ID,
  }, PATIENT1_TOKEN);
  check('Patient 1 books WAVE window -> Token 1 assigned',
    waveBook1.status === 201 && waveBook1.data?.scheduleType === 'WAVE' && waveBook1.data?.token === 1,
    waveBook1.data
  );
  waveAppointmentId = waveBook1.data?.appointmentId;

  // Duplicate Booking Validation
  const waveBookDup = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureMonday,
    window: '10:00-11:00',
    patientId: PATIENT1_USER_ID,
  }, PATIENT1_TOKEN);
  check('Reject duplicate WAVE booking for same patient with 409 Conflict', waveBookDup.status === 409, waveBookDup.status);

  // Patient 2 books Wave token 2
  const waveBook2 = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureMonday,
    window: '10:00-11:00',
    patientId: PATIENT2_USER_ID,
  }, PATIENT2_TOKEN);
  check('Patient 2 books WAVE window -> Token 2 assigned', waveBook2.status === 201 && waveBook2.data?.token === 2, waveBook2.data);

  // Patient 3 (anonymous) books Wave token 3
  const waveBook3 = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureMonday,
    window: '10:00-11:00',
  });
  check('Patient 3 books WAVE window -> Token 3 assigned (Capacity reached)', waveBook3.status === 201 && waveBook3.data?.token === 3, waveBook3.data);

  // Patient 4 attempts booking when maxCapacity=3 -> Capacity Exceeded
  const waveBookExceeded = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureMonday,
    window: '10:00-11:00',
  });
  check('Reject booking exceeding maxCapacity with 409 Conflict (Wave Full)', waveBookExceeded.status === 409, waveBookExceeded.status);

  console.log('\n══════ 5. GET APPOINTMENT BY ID TESTS ══════');

  // Fetch existing appointment by ID
  const getApp = await req('GET', `/appointments/${streamAppointmentId}`);
  check('Fetch appointment by valid UUID returns appointment details',
    getApp.status === 200 && getApp.data?.appointmentId === streamAppointmentId,
    getApp.data
  );

  // Fetch with invalid UUID
  const getAppInvUUID = await req('GET', '/appointments/invalid-uuid-string');
  check('Reject invalid appointment ID UUID with 400 Bad Request via ParseUUIDPipe', getAppInvUUID.status === 400, getAppInvUUID.status);

  // Fetch non-existent appointment
  const getAppNotFound = await req('GET', `/appointments/${fakeDoctorId}`);
  check('Reject non-existent appointment ID with 404 Not Found', getAppNotFound.status === 404, getAppNotFound.status);

  console.log('\n══════ ADVANCED SCHEDULING SUMMARY ══════');
  console.log(`Passed: ${passed} | Failed: ${failed} | Total: ${results.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
