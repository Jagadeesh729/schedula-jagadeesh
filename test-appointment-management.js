/**
 * Comprehensive Integration & Concurrency Test Runner
 * Appointment Booking & Management APIs
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

async function runAppointmentManagementTests() {
  console.log('\n===========================================================');
  console.log('  APPOINTMENT BOOKING & MANAGEMENT INTEGRATION TEST SUITE  ');
  console.log('===========================================================\n');

  const timestamp = Date.now();

  // 1. Setup Doctor & Patient Users
  const docEmail = `doc_mgmt_${timestamp}@test.com`;
  const pat1Email = `pat1_mgmt_${timestamp}@test.com`;
  const pat2Email = `pat2_mgmt_${timestamp}@test.com`;
  const password = 'Password123!';

  // Doctor Auth & Profile
  const docToken = await registerUser(docEmail, password, 'DOCTOR', 'Dr. Mgmt');
  const docProfRes = await request('/doctor/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      fullName: 'Dr. Mgmt',
      specialization: 'General',
      experience: 5,
      qualification: 'MBBS',
      consultationFee: 100,
      availability: 'Mon-Fri 09:00-17:00',
      profileDetails: 'Test Bio',
    }),
  });
  const doctorId = docProfRes.data?.id;

  // Patient 1 Auth & Profile
  const pat1Token = await registerUser(
    pat1Email,
    password,
    'PATIENT',
    'Patient One',
  );
  await request('/patient/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      fullName: 'Patient One',
      age: 30,
      gender: 'Male',
      contactDetails: '1234567890',
      basicHealthInformation: 'None',
    }),
  });

  // Patient 2 Auth & Profile
  const pat2Token = await registerUser(
    pat2Email,
    password,
    'PATIENT',
    'Patient Two',
  );
  await request('/patient/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({
      fullName: 'Patient Two',
      age: 25,
      gender: 'Female',
      contactDetails: '0987654321',
      basicHealthInformation: 'None',
    }),
  });

  // Doctor Availability (Monday 10:00-11:00)
  await request('/doctor/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      weekday: 'Monday',
      startTime: '10:00',
      endTime: '11:00',
    }),
  });

  console.log('─── 1. STREAM SCHEDULING & BOOKING TESTS ───');
  // Configure STREAM (slotDuration: 15, bufferTime: 5 -> slots: 10:00-10:15, 10:20-10:35, 10:40-10:55)
  await request(`/doctors/${doctorId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      schedulingType: 'STREAM',
      slotDuration: 15,
      bufferTime: 5,
    }),
  });

  // Test 1: Empty Patient Appointments
  const emptyPatRes = await request('/appointment/my', {
    headers: { Authorization: `Bearer ${pat1Token}` },
  });
  assert(
    emptyPatRes.status === 200 &&
      Array.isArray(emptyPatRes.data) &&
      emptyPatRes.data.length === 0,
    'GET /appointment/my returns 200 OK [] when empty',
    emptyPatRes,
  );

  // Test 2: Empty Doctor Appointments
  const emptyDocRes = await request('/doctor/appointments', {
    headers: { Authorization: `Bearer ${docToken}` },
  });
  assert(
    emptyDocRes.status === 200 &&
      Array.isArray(emptyDocRes.data) &&
      emptyDocRes.data.length === 0,
    'GET /doctor/appointments returns 200 OK [] when empty',
    emptyDocRes,
  );

  // Test 3: Reject booking for past date
  const pastDateRes = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      doctorId,
      date: '2020-01-01',
      startTime: '10:00',
      endTime: '10:15',
    }),
  });
  assert(
    pastDateRes.status === 400,
    'POST /appointment rejects past date (400)',
    pastDateRes,
  );

  // Test 4: Reject booking for invalid/non-generated STREAM slot
  const invalidSlotRes = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      doctorId,
      date: '2028-10-09',
      startTime: '10:10',
      endTime: '10:25',
    }),
  });
  assert(
    invalidSlotRes.status === 400,
    'POST /appointment rejects invalid/non-generated STREAM slot (400)',
    invalidSlotRes,
  );

  // Test 5: Successful STREAM Booking via POST /appointment
  const book1Res = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      doctorId,
      date: '2028-10-09',
      startTime: '10:00',
      endTime: '10:15',
    }),
  });
  assert(
    book1Res.status === 201 && book1Res.data?.status === 'CONFIRMED',
    'POST /appointment creates STREAM booking with CONFIRMED status (201)',
    book1Res,
  );
  const app1Id = book1Res.data?.id || book1Res.data?.appointmentId;

  // Test 6: Duplicate STREAM Slot Booking Prevention
  const dupBookRes = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({
      doctorId,
      date: '2028-10-09',
      startTime: '10:00',
      endTime: '10:15',
    }),
  });
  assert(
    dupBookRes.status === 409,
    'POST /appointment prevents duplicate STREAM slot booking (409 Conflict)',
    dupBookRes,
  );

  // Test 7: Non-patient booking attempt
  const docBookRes = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      doctorId,
      date: '2028-10-09',
      startTime: '10:20',
      endTime: '10:35',
    }),
  });
  assert(
    docBookRes.status === 403,
    'POST /appointment blocks non-patient booking attempt (403)',
    docBookRes,
  );

  console.log('\n─── 2. LISTING & IDOR ISOLATION TESTS ───');
  // Test 8: Patient 1 GET /appointment/my
  const pat1List = await request('/appointment/my', {
    headers: { Authorization: `Bearer ${pat1Token}` },
  });
  assert(
    pat1List.status === 200 &&
      pat1List.data.length === 1 &&
      pat1List.data[0].doctor?.name === 'Dr. Mgmt',
    'GET /appointment/my returns patient appointments with doctor profile',
    pat1List,
  );

  // Test 9: Patient 2 GET /appointment/my (Isolation)
  const pat2List = await request('/appointment/my', {
    headers: { Authorization: `Bearer ${pat2Token}` },
  });
  assert(
    pat2List.status === 200 && pat2List.data.length === 0,
    'GET /appointment/my enforces patient isolation (Patient 2 sees 0 appointments)',
    pat2List,
  );

  // Test 10: Doctor GET /doctor/appointments
  const docList = await request('/doctor/appointments', {
    headers: { Authorization: `Bearer ${docToken}` },
  });
  assert(
    docList.status === 200 &&
      docList.data.length === 1 &&
      docList.data[0].patient?.name === 'Patient One',
    'GET /doctor/appointments returns doctor assigned appointments with patient profile',
    docList,
  );

  console.log('\n─── 3. CANCELLATION & RE-AVAILABILITY TESTS ───');
  // Test 11: Non-owner cancellation attempt (IDOR)
  const idorCancelRes = await request(`/appointment/${app1Id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat2Token}` },
  });
  assert(
    idorCancelRes.status === 403,
    'PATCH /appointment/:id/cancel blocks non-owner cancellation (403 Forbidden IDOR)',
    idorCancelRes,
  );

  // Test 12: Successful Cancellation by Owner Patient
  const cancelRes = await request(`/appointment/${app1Id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
  });
  assert(
    cancelRes.status === 200 && cancelRes.data?.status === 'CANCELLED',
    'PATCH /appointment/:id/cancel updates status to CANCELLED (200 OK)',
    cancelRes,
  );

  // Test 13: Already-cancelled appointment cancellation attempt
  const reCancelRes = await request(`/appointment/${app1Id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
  });
  assert(
    reCancelRes.status === 400,
    'PATCH /appointment/:id/cancel rejects already-cancelled appointment (400)',
    reCancelRes,
  );

  // Test 14: Cancelled STREAM slot becomes available again
  const reBookRes = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({
      doctorId,
      date: '2028-10-09',
      startTime: '10:00',
      endTime: '10:15',
    }),
  });
  assert(
    reBookRes.status === 201 && reBookRes.data?.status === 'CONFIRMED',
    'Cancelled STREAM slot becomes available again for new booking (201 Created)',
    reBookRes,
  );

  console.log(
    '\n─── 4. WAVE SCHEDULING, TOKEN ALLOCATION & CONCURRENCY TESTS ───',
  );
  // Configure WAVE strategy with capacity = 2
  await request(`/doctors/${doctorId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ schedulingType: 'WAVE', maxCapacity: 2 }),
  });

  // Patient 1 books WAVE window 10:00-11:00 -> Token 1
  const wave1Res = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      doctorId,
      date: '2028-10-16',
      scheduleType: 'WAVE',
      window: '10:00-11:00',
    }),
  });
  assert(
    wave1Res.status === 201 && wave1Res.data?.token === 1,
    'WAVE Booking 1 assigns Token 1 (201)',
    wave1Res,
  );
  const wave1Id = wave1Res.data?.id || wave1Res.data?.appointmentId;

  // Patient 2 books WAVE window 10:00-11:00 -> Token 2
  const wave2Res = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({
      doctorId,
      date: '2028-10-16',
      scheduleType: 'WAVE',
      window: '10:00-11:00',
    }),
  });
  assert(
    wave2Res.status === 201 && wave2Res.data?.token === 2,
    'WAVE Booking 2 assigns Token 2 (201)',
    wave2Res,
  );

  // Cancel Patient 1 booking (Token 1 cancelled)
  await request(`/appointment/${wave1Id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat1Token}` },
  });

  // Patient 1 re-books WAVE window -> Lowest missing positive integer token = Token 1!
  const waveRebookRes = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      doctorId,
      date: '2028-10-16',
      scheduleType: 'WAVE',
      window: '10:00-11:00',
    }),
  });
  assert(
    waveRebookRes.status === 201 && waveRebookRes.data?.token === 1,
    'WAVE Re-booking after cancellation reopens capacity & assigns collision-free Token 1 (201)',
    waveRebookRes,
  );

  // Test Concurrent STREAM Double Booking Race Condition
  console.log('\n─── 5. CONCURRENCY RACE CONDITION TESTS ───');
  await request(`/doctors/${doctorId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      schedulingType: 'STREAM',
      slotDuration: 15,
      bufferTime: 5,
    }),
  });

  const [race1, race2] = await Promise.all([
    request('/appointment', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat1Token}` },
      body: JSON.stringify({
        doctorId,
        date: '2028-10-23',
        startTime: '10:20',
        endTime: '10:35',
      }),
    }),
    request('/appointment', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat2Token}` },
      body: JSON.stringify({
        doctorId,
        date: '2028-10-23',
        startTime: '10:20',
        endTime: '10:35',
      }),
    }),
  ]);

  const raceSuccessCount = [race1, race2].filter(
    (r) => r.status === 201,
  ).length;
  const raceConflictCount = [race1, race2].filter(
    (r) => r.status === 409,
  ).length;
  assert(
    raceSuccessCount === 1 && raceConflictCount === 1,
    'Concurrent STREAM booking race yields exactly 1 success (201) and 1 conflict (409)',
  );

  // Test Concurrent WAVE Capacity-Boundary Race
  await request(`/doctors/${doctorId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ schedulingType: 'WAVE', maxCapacity: 1 }),
  });

  const [waveRace1, waveRace2] = await Promise.all([
    request('/appointment', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat1Token}` },
      body: JSON.stringify({
        doctorId,
        date: '2028-10-30',
        scheduleType: 'WAVE',
        window: '10:00-11:00',
      }),
    }),
    request('/appointment', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat2Token}` },
      body: JSON.stringify({
        doctorId,
        date: '2028-10-30',
        scheduleType: 'WAVE',
        window: '10:00-11:00',
      }),
    }),
  ]);

  const waveRaceSuccess = [waveRace1, waveRace2].filter(
    (r) => r.status === 201,
  ).length;
  const waveRaceConflict = [waveRace1, waveRace2].filter(
    (r) => r.status === 409,
  ).length;
  assert(
    waveRaceSuccess === 1 && waveRaceConflict === 1,
    'Concurrent WAVE capacity boundary enforces maxCapacity=1 with 1 success and 1 conflict',
  );

  console.log('\n===========================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAppointmentManagementTests().catch((err) => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
