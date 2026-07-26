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

let PATIENT3_TOKEN = '';
let PATIENT3_USER_ID = '';

let PATIENT4_TOKEN = '';
let PATIENT4_USER_ID = '';

let streamAppointmentId = '';
let waveAppointmentId = '';

let passed = 0;
let failed = 0;
const results = [];

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextMonday() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  return formatDate(date);
}

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

  // Register Patient 3
  const p3Email = `patient3_${Date.now()}@test.com`;
  const p3Reg = await req('POST', '/auth/signup', { name: 'Patient Three', email: p3Email, password: 'Pass1234!', role: 'PATIENT' });
  PATIENT3_USER_ID = p3Reg.data.id;
  const p3Login = await req('POST', '/auth/login', { email: p3Email, password: 'Pass1234!' });
  PATIENT3_TOKEN = p3Login.data.access_token;
  console.log(`  ✓ Patient 3 registered`);

  // Register Patient 4
  const p4Email = `patient4_${Date.now()}@test.com`;
  const p4Reg = await req('POST', '/auth/signup', { name: 'Patient Four', email: p4Email, password: 'Pass1234!', role: 'PATIENT' });
  PATIENT4_USER_ID = p4Reg.data.id;
  const p4Login = await req('POST', '/auth/login', { email: p4Email, password: 'Pass1234!' });
  PATIENT4_TOKEN = p4Login.data.access_token;
  console.log(`  ✓ Patient 4 registered`);
}

async function runTests() {
  await setup();

  const futureDate = getNextMonday();

  console.log('\n══════ SECURITY ASSERTIONS ══════');

  const unauthCreate = await req('POST', '/appointments', {
    doctorId: DOCTOR1_PROFILE_ID,
    date: futureDate,
    slot: { startTime: '10:00', endTime: '10:15' },
  });
  check('POST /appointments without JWT -> 401', unauthCreate.status === 401, unauthCreate.status);

  const invalidJwtCreate = await req('POST', '/appointments', {
    doctorId: DOCTOR1_PROFILE_ID,
    date: futureDate,
    slot: { startTime: '10:00', endTime: '10:15' },
  }, 'not-a-valid-jwt');
  check('POST /appointments with invalid JWT -> 401', invalidJwtCreate.status === 401, invalidJwtCreate.status);

  const ownDoctorConfig = await req('POST', `/doctors/${DOCTOR1_PROFILE_ID}/scheduling`, {
    schedulingType: 'STREAM',
    slotDuration: 15,
    bufferTime: 5,
  }, DOCTOR1_TOKEN);
  check('Doctor A configures Doctor A -> success', ownDoctorConfig.status === 201 || ownDoctorConfig.status === 200, ownDoctorConfig.status);

  const otherDoctorConfig = await req('POST', `/doctors/${DOCTOR2_PROFILE_ID}/scheduling`, {
    schedulingType: 'STREAM',
    slotDuration: 15,
    bufferTime: 5,
  }, DOCTOR1_TOKEN);
  check('Doctor A configures Doctor B -> 403', otherDoctorConfig.status === 403, otherDoctorConfig.status);

  const patientConfig = await req('POST', `/doctors/${DOCTOR1_PROFILE_ID}/scheduling`, {
    schedulingType: 'STREAM',
    slotDuration: 15,
    bufferTime: 5,
  }, PATIENT1_TOKEN);
  check('PATIENT attempts doctor scheduling configuration -> 403', patientConfig.status === 403, patientConfig.status);

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
  check('Reject non-existent doctor with 403 Forbidden', cfgNotFound.status === 403, cfgNotFound.status);

  console.log('\n══════ 2. STREAM SLOT GENERATION & AVAILABILITY TESTS ══════');

  // Set Doctor 1 Availability on Monday (2026-08-03 is a Monday)
  await req('POST', '/doctor/availability', {
    weekday: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
  }, DOCTOR1_TOKEN);

  const streamAvail = await req('GET', `/doctors/${DOCTOR1_PROFILE_ID}/availability?date=${futureDate}`);
  check('Fetch STREAM availability generates slots (10:00-10:15, 10:20-10:35, 10:40-10:55)',
    streamAvail.status === 200 && Array.isArray(streamAvail.data) && streamAvail.data.length === 3,
    streamAvail.data
  );

  console.log('\n══════ 3. STREAM APPOINTMENT BOOKING TESTS ══════');

  // Book exact Stream slot
  const bookStream = await req('POST', '/appointments', {
    doctorId: DOCTOR1_PROFILE_ID,
    date: futureDate,
    slot: { startTime: '10:00', endTime: '10:15' },
  }, PATIENT1_TOKEN);

  check('Book exact STREAM slot returns 201 with appointment payload',
    bookStream.status === 201 && bookStream.data?.scheduleType === 'STREAM' && bookStream.data?.slot?.startTime === '10:00',
    bookStream.data
  );
  streamAppointmentId = bookStream.data?.appointmentId;

  // Re-fetch availability, 10:00 slot should be unavailable
  const streamAvailAfter = await req('GET', `/doctors/${DOCTOR1_PROFILE_ID}/availability?date=${futureDate}`);
  const slot10 = streamAvailAfter.data?.find(s => s.startTime === '10:00');
  check('Booked STREAM slot is marked unavailable (available: false)', slot10?.available === false, slot10);

  // Overlap Validation (book same slot again)
  const bookStreamOverlap = await req('POST', '/appointments', {
    doctorId: DOCTOR1_PROFILE_ID,
    date: futureDate,
    slot: { startTime: '10:00', endTime: '10:15' },
  }, PATIENT2_TOKEN);
  check('Reject booking booked STREAM slot with 409 Conflict', bookStreamOverlap.status === 409, bookStreamOverlap.status);

  // Past Schedule Validation
  const bookPast = await req('POST', '/appointments', {
    doctorId: DOCTOR1_PROFILE_ID,
    date: '2020-01-01',
    slot: { startTime: '10:00', endTime: '10:15' },
  }, PATIENT1_TOKEN);
  check('Reject booking for past date with 400 Bad Request', bookPast.status === 400, bookPast.status);

  console.log('\n══════ 4. WAVE SCHEDULING & TOKEN ASSIGNMENT TESTS ══════');

  // Set Doctor 2 Availability on Monday 10:00-11:00
  await req('POST', '/doctor/availability', {
    weekday: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
  }, DOCTOR2_TOKEN);

  // Fetch Wave Availability
  const waveAvail = await req('GET', `/doctors/${DOCTOR2_PROFILE_ID}/availability?date=${futureDate}`);
  check('Fetch WAVE availability returns window with capacity',
    waveAvail.status === 200 && Array.isArray(waveAvail.data) && waveAvail.data[0]?.window === '10:00-11:00' && waveAvail.data[0]?.capacity === 3,
    waveAvail.data
  );

  // Patient 1 books Wave token 1
  const waveBook1 = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureDate,
    window: '10:00-11:00',
  }, PATIENT1_TOKEN);
  check('Patient 1 books WAVE window -> Token 1 assigned',
    waveBook1.status === 201 && waveBook1.data?.scheduleType === 'WAVE' && waveBook1.data?.token === 1,
    waveBook1.data
  );
  waveAppointmentId = waveBook1.data?.appointmentId;

  // Duplicate Booking Validation
  const waveBookDup = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureDate,
    window: '10:00-11:00',
  }, PATIENT1_TOKEN);
  check('Reject duplicate WAVE booking for same patient with 409 Conflict', waveBookDup.status === 409, waveBookDup.status);

  // Patient 2 books Wave token 2
  const waveBook2 = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureDate,
    window: '10:00-11:00',
  }, PATIENT2_TOKEN);
  check('Patient 2 books WAVE window -> Token 2 assigned', waveBook2.status === 201 && waveBook2.data?.token === 2, waveBook2.data);

  // Patient 3 books Wave token 3
  const waveBook3 = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureDate,
    window: '10:00-11:00',
  }, PATIENT3_TOKEN);
  check('Patient 3 books WAVE window -> Token 3 assigned', waveBook3.status === 201 && waveBook3.data?.token === 3, waveBook3.data);

  // Patient 4 attempts booking when maxCapacity=3 -> Capacity Exceeded
  const waveBookExceeded = await req('POST', '/appointments', {
    doctorId: DOCTOR2_PROFILE_ID,
    date: futureDate,
    window: '10:00-11:00',
  }, PATIENT4_TOKEN);
  check('Reject booking exceeding maxCapacity with 409 Conflict (Wave Full)', waveBookExceeded.status === 409, waveBookExceeded.status);

  console.log('\n══════ 5. GET APPOINTMENT BY ID TESTS ══════');

  const getAppNoJwt = await req('GET', `/appointments/${streamAppointmentId}`);
  check('GET appointment without JWT -> 401', getAppNoJwt.status === 401, getAppNoJwt.status);

  const getAppOtherPatient = await req('GET', `/appointments/${streamAppointmentId}`, null, PATIENT2_TOKEN);
  check('Different patient GET -> 403', getAppOtherPatient.status === 403, getAppOtherPatient.status);

  // Fetch existing appointment by ID
  const getApp = await req('GET', `/appointments/${streamAppointmentId}`, null, PATIENT1_TOKEN);
  check('Fetch appointment by valid UUID returns appointment details',
    getApp.status === 200 && getApp.data?.appointmentId === streamAppointmentId,
    getApp.data
  );

  const getAppDoctor = await req('GET', `/appointments/${streamAppointmentId}`, null, DOCTOR1_TOKEN);
  check('Assigned doctor GET -> success', getAppDoctor.status === 200 && getAppDoctor.data?.doctorId === DOCTOR1_PROFILE_ID, getAppDoctor.data);

  // Fetch with invalid UUID
  const getAppInvUUID = await req('GET', '/appointments/invalid-uuid-string', null, PATIENT1_TOKEN);
  check('Reject invalid appointment ID UUID with 400 Bad Request via ParseUUIDPipe', getAppInvUUID.status === 400, getAppInvUUID.status);

  // Fetch non-existent appointment
  const getAppNotFound = await req('GET', `/appointments/${fakeDoctorId}`, null, PATIENT1_TOKEN);
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
