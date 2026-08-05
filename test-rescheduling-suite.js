/**
 * Comprehensive Integration & Concurrency Test Runner
 * Appointment Rescheduling & Cutoff Engine (Mentor Aman Task)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

let passed = 0;
let failed = 0;

function assert(condition, testName, res = null) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    const details = res
      ? ` [Status: ${res.status}, Data: ${JSON.stringify(res.data)}]`
      : '';
    console.error(`  ❌ FAIL: ${testName}${details}`);
    failed++;
  }
}

async function registerUser(email, password, role, name) {
  await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, role, name }),
  });
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return loginRes.data?.access_token || loginRes.data?.accessToken;
}

function getNextMonday(addWeeks = 1) {
  const d = new Date();
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7) + (addWeeks - 1) * 7);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runReschedulingTests() {
  console.log('\n===========================================================');
  console.log('  APPOINTMENT RESCHEDULING & CUTOFF INTEGRATION TEST SUITE ');
  console.log('===========================================================\n');

  const timestamp = Date.now();
  const docEmail = `doc_resched_${timestamp}@test.com`;
  const pat1Email = `pat1_resched_${timestamp}@test.com`;
  const pat2Email = `pat2_resched_${timestamp}@test.com`;
  const password = 'Password123!';

  // 1. Register Auth & Profiles
  const docToken = await registerUser(docEmail, password, 'DOCTOR', 'Dr. Reschedule');
  const docProfRes = await request('/doctor/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      fullName: 'Dr. Reschedule',
      specialization: 'Cardiology',
      experience: 10,
      qualification: 'MD',
      consultationFee: 150,
      availability: 'Mon-Fri 09:00-17:00',
      profileDetails: 'Reschedule Specialist',
    }),
  });
  const doctorId = docProfRes.data?.id;

  const pat1Token = await registerUser(pat1Email, password, 'PATIENT', 'Patient Alpha');
  await request('/patient/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      fullName: 'Patient Alpha',
      age: 28,
      gender: 'Male',
      contactDetails: '1112223333',
      basicHealthInformation: 'None',
    }),
  });

  const pat2Token = await registerUser(pat2Email, password, 'PATIENT', 'Patient Beta');
  await request('/patient/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({
      fullName: 'Patient Beta',
      age: 32,
      gender: 'Female',
      contactDetails: '4445556666',
      basicHealthInformation: 'None',
    }),
  });

  // Doctor Recurring Availability (Monday 10:00-11:00)
  await request('/doctor/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ weekday: 'Monday', startTime: '10:00', endTime: '11:00' }),
  });

  const testDate1 = getNextMonday(1); // Future Monday week 1
  const testDate2 = getNextMonday(2); // Future Monday week 2

  console.log('─── 1. STREAM APPOINTMENT RESCHEDULING TESTS ───');
  // Configure STREAM (slotDuration: 15, bufferTime: 5 -> slots: 10:00-10:15, 10:20-10:35, 10:40-10:55)
  await request(`/doctors/${doctorId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ schedulingType: 'STREAM', slotDuration: 15, bufferTime: 5 }),
  });

  // Book STREAM Slot 1 (10:00-10:15) for Patient 1
  const bookStreamRes = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({ doctorId, date: testDate1, startTime: '10:00', endTime: '10:15' }),
  });
  assert(bookStreamRes.status === 201, 'Patient 1 books STREAM slot 10:00-10:15 (201)', bookStreamRes);
  const streamAppId = bookStreamRes.data?.id || bookStreamRes.data?.appointmentId;

  // Book STREAM Slot 2 (10:20-10:35) for Patient 2 (Occupied slot)
  const bookStream2Res = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({ doctorId, date: testDate1, startTime: '10:20', endTime: '10:35' }),
  });
  assert(bookStream2Res.status === 201, 'Patient 2 books STREAM slot 10:20-10:35 (201)', bookStream2Res);

  // Test 1: Reject Unauthorized Reschedule (Patient 2 tries to reschedule Patient 1's appointment -> 403)
  const unauthResched = await request(`/appointment/${streamAppId}/reschedule`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({ date: testDate1, slot: { startTime: '10:40', endTime: '10:55' } }),
  });
  assert(unauthResched.status === 403, 'PATCH /appointment/:id/reschedule blocks unauthorized patient (403)', unauthResched);

  // Test 2: Reject Rescheduling to Same Slot/Time (400)
  const sameSlotResched = await request(`/appointment/${streamAppId}/reschedule`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({ date: testDate1, slot: { startTime: '10:00', endTime: '10:15' } }),
  });
  assert(sameSlotResched.status === 400, 'PATCH /appointment/:id/reschedule rejects same slot/time (400)', sameSlotResched);

  // Test 3: Reject Rescheduling to Already Booked Slot & Suggest Next Available (409 Conflict with suggestedNextAvailable)
  const bookedSlotResched = await request(`/appointment/${streamAppId}/reschedule`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({ date: testDate1, slot: { startTime: '10:20', endTime: '10:35' } }),
  });
  assert(
    bookedSlotResched.status === 409 && Boolean(bookedSlotResched.data?.suggestedNextAvailable),
    'PATCH /appointment/:id/reschedule rejects booked slot and returns suggestedNextAvailable (409)',
    bookedSlotResched,
  );

  // Test 4: Successful STREAM Reschedule (Patient 1 reschedules 10:00-10:15 -> 10:40-10:55)
  const validStreamResched = await request(`/appointment/${streamAppId}/reschedule`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({ date: testDate1, slot: { startTime: '10:40', endTime: '10:55' } }),
  });
  assert(
    validStreamResched.status === 200 && validStreamResched.data?.slotStartTime === '10:40',
    'PATCH /appointment/:id/reschedule moves STREAM appointment to new slot (200 OK)',
    validStreamResched,
  );

  console.log('\n─── 2. WAVE APPOINTMENT RESCHEDULING & TOKEN TESTS ───');
  // Doctor configures WAVE (maxCapacity: 2)
  await request(`/doctors/${doctorId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ schedulingType: 'WAVE', maxCapacity: 2 }),
  });

  // Patient 1 books WAVE Window on testDate1 (Token 1 assigned)
  const bookWaveRes1 = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({ doctorId, date: testDate1, window: '10:00-11:00' }),
  });
  assert(bookWaveRes1.status === 201 && bookWaveRes1.data?.token === 1, 'Patient 1 books WAVE window (Token 1)', bookWaveRes1);
  const waveAppId1 = bookWaveRes1.data?.id || bookWaveRes1.data?.appointmentId;

  // Patient 2 books WAVE Window on testDate1 (Token 2 assigned -> Window Full)
  const bookWaveRes2 = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({ doctorId, date: testDate1, window: '10:00-11:00' }),
  });
  assert(bookWaveRes2.status === 201 && bookWaveRes2.data?.token === 2, 'Patient 2 books WAVE window (Token 2 -> Wave Full)', bookWaveRes2);

  // Test 5: Reschedule WAVE to future date testDate2 (Releases token on testDate1, assigns Token 1 on testDate2)
  const waveResched = await request(`/appointment/${waveAppId1}/reschedule`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({ date: testDate2, window: '10:00-11:00' }),
  });
  assert(
    waveResched.status === 200 && waveResched.data?.date === testDate2 && waveResched.data?.token === 1,
    'PATCH /appointment/:id/reschedule moves WAVE appointment to new date & assigns token 1 (200 OK)',
    waveResched,
  );

  console.log('\n─── 3. EDGE CASES, CUTOFF & CANCELLED APPOINTMENTS ───');
  // Test 6: Cancel appointment, then attempt reschedule -> 400 Bad Request
  await request(`/appointment/${streamAppId}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
  });
  const reschedCancelled = await request(`/appointment/${streamAppId}/reschedule`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({ date: testDate2, slot: { startTime: '10:00', endTime: '10:15' } }),
  });
  assert(reschedCancelled.status === 400, 'PATCH /appointment/:id/reschedule rejects cancelled appointment (400)', reschedCancelled);

  // Test 7: Reject invalid appointment UUID -> 400 Bad Request
  const invalidUuidResched = await request('/appointment/invalid-uuid/reschedule', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({ date: testDate1, window: '10:00-11:00' }),
  });
  assert(invalidUuidResched.status === 400, 'PATCH /appointment/:id/reschedule rejects invalid UUID via ParseUUIDPipe (400)', invalidUuidResched);

  // Test 8: Reject non-existent appointment -> 404 Not Found
  const fakeUuid = '00000000-0000-0000-0000-000000000000';
  const nonExistentResched = await request(`/appointment/${fakeUuid}/reschedule`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({ date: testDate1, window: '10:00-11:00' }),
  });
  assert(nonExistentResched.status === 404, 'PATCH /appointment/:id/reschedule rejects non-existent appointment (404)', nonExistentResched);

  console.log('\n===========================================================');
  console.log(`  RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('===========================================================\n');
}

runReschedulingTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
});
