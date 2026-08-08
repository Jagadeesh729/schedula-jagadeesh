const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function registerUser(email, password, role, name) {
  const signup = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, role, name }),
  });
  if (signup.status !== 201 && signup.status !== 409) {
    throw new Error(`Failed to register ${email}: ${signup.status}`);
  }
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const token = login.data.access_token;

  if (role === 'PATIENT') {
    await request('/patient/profile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        fullName: name,
        age: 30,
        gender: 'Male',
        contactDetails: '1234567890',
        basicHealthInformation: 'None',
      }),
    });
  }

  return token;
}

function assert(condition, label, details = '') {
  if (condition) {
    console.log(`  ✓ PASS — ${label}${details ? ` | ${details}` : ''}`);
    return true;
  } else {
    console.error(`  ✗ FAIL — ${label}${details ? ` | ${details}` : ''}`);
    return false;
  }
}

async function runAdvancedSchedulingTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ADVANCED DOCTOR SCHEDULING & CONCURRENCY TEST SUITE');
  console.log('  Target: ' + BASE_URL);
  console.log('═══════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function track(result) {
    if (result) passed++;
    else failed++;
  }

  const timestamp = Date.now();
  const doc1Email = `doc_adv1_${timestamp}@test.com`;
  const doc2Email = `doc_adv2_${timestamp}@test.com`;
  const pat1Email = `pat_adv1_${timestamp}@test.com`;
  const pat2Email = `pat_adv2_${timestamp}@test.com`;
  const pat3Email = `pat_adv3_${timestamp}@test.com`;
  const pat4Email = `pat_adv4_${timestamp}@test.com`;

  // 1. REGISTER USERS
  console.log('══════ 1. SCHEDULING CONFIGURATION TESTS ══════');
  const doc1Token = await registerUser(doc1Email, 'Password123!', 'DOCTOR', 'Dr. Stream');
  const doc2Token = await registerUser(doc2Email, 'Password123!', 'DOCTOR', 'Dr. Wave');
  const pat1Token = await registerUser(pat1Email, 'Password123!', 'PATIENT', 'Patient One');
  const pat2Token = await registerUser(pat2Email, 'Password123!', 'PATIENT', 'Patient Two');
  const pat3Token = await registerUser(pat3Email, 'Password123!', 'PATIENT', 'Patient Three');
  const pat4Token = await registerUser(pat4Email, 'Password123!', 'PATIENT', 'Patient Four');

  // Create Doctor Profiles
  const doc1ProfileRes = await request('/doctor/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc1Token}` },
    body: JSON.stringify({
      fullName: 'Dr. Stream',
      specialization: 'General Medicine',
      experience: 5,
      qualification: 'MBBS',
      consultationFee: 100,
      availability: 'Mon-Fri 09:00-17:00',
      profileDetails: 'Stream Specialist',
    }),
  });
  const doc1ProfileId = doc1ProfileRes.data.id;

  const doc2ProfileRes = await request('/doctor/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc2Token}` },
    body: JSON.stringify({
      fullName: 'Dr. Wave',
      specialization: 'Pediatrics',
      experience: 8,
      qualification: 'MD',
      consultationFee: 120,
      availability: 'Mon-Fri 09:00-17:00',
      profileDetails: 'Wave Specialist',
    }),
  });
  const doc2ProfileId = doc2ProfileRes.data.id;

  // Add Recurring Availability (10:00-11:00 on Monday)
  await request('/doctor/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc1Token}` },
    body: JSON.stringify({ weekday: 'Monday', startTime: '10:00', endTime: '11:00' }),
  });
  await request('/doctor/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc2Token}` },
    body: JSON.stringify({ weekday: 'Monday', startTime: '10:00', endTime: '11:00' }),
  });

  // T01: Doctor 1 configures STREAM scheduling (slotDuration: 15, bufferTime: 5)
  const cfg1 = await request(`/doctors/${doc1ProfileId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc1Token}` },
    body: JSON.stringify({ schedulingType: 'STREAM', slotDuration: 15, bufferTime: 5 }),
  });
  track(assert(cfg1.status === 201, 'Configure STREAM scheduling returns 201', `actual status: ${cfg1.status}`));

  // T02: Reject invalid slotDuration (0) with 400
  const cfgErr1 = await request(`/doctors/${doc1ProfileId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc1Token}` },
    body: JSON.stringify({ schedulingType: 'STREAM', slotDuration: 0 }),
  });
  track(assert(cfgErr1.status === 400, 'Reject slotDuration <= 0 with 400 Bad Request', `actual status: ${cfgErr1.status}`));

  // T03: Doctor 2 configures WAVE scheduling (maxCapacity: 3)
  const cfg2 = await request(`/doctors/${doc2ProfileId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc2Token}` },
    body: JSON.stringify({ schedulingType: 'WAVE', maxCapacity: 3 }),
  });
  track(assert(cfg2.status === 201, 'Configure WAVE scheduling returns 201', `actual status: ${cfg2.status}`));

  // T04: Reject invalid maxCapacity (0) with 400
  const cfgErr2 = await request(`/doctors/${doc2ProfileId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc2Token}` },
    body: JSON.stringify({ schedulingType: 'WAVE', maxCapacity: 0 }),
  });
  track(assert(cfgErr2.status === 400, 'Reject maxCapacity <= 0 with 400 Bad Request', `actual status: ${cfgErr2.status}`));

  // T05: Reject doctor configuring another doctor with 403 Forbidden
  const cfgErr3 = await request(`/doctors/${doc2ProfileId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc1Token}` },
    body: JSON.stringify({ schedulingType: 'STREAM', slotDuration: 15 }),
  });
  track(assert(cfgErr3.status === 403, 'Reject configuring another doctor with 403 Forbidden', `actual status: ${cfgErr3.status}`));

  // T06: Reject non-existent doctor with 404 Not Found
  const fakeUuid = '00000000-0000-0000-0000-000000000000';
  const cfgErr4 = await request(`/doctors/${fakeUuid}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc1Token}` },
    body: JSON.stringify({ schedulingType: 'STREAM', slotDuration: 15 }),
  });
  track(assert(cfgErr4.status === 404, 'Reject non-existent doctor with 404 Not Found', `actual status/data: ${cfgErr4.status}`));


  function getNextMonday() {
    const d = new Date();
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const testDate = getNextMonday(); // Dynamic upcoming Monday date
  const availStream = await request(`/doctors/${doc1ProfileId}/availability?date=${testDate}`);
  track(assert(
    availStream.status === 200 && Array.isArray(availStream.data) && availStream.data.length === 3,
    'Fetch STREAM availability generates slots (10:00-10:15, 10:20-10:35, 10:40-10:55)',
    `actual status/data: ${JSON.stringify(availStream.data)}`
  ));


  // 3. STREAM BOOKING TESTS
  console.log('\n══════ 3. STREAM APPOINTMENT BOOKING TESTS ══════');
  const bookStream1 = await request('/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      doctorId: doc1ProfileId,
      date: testDate,
      scheduleType: 'STREAM',
      slot: { startTime: '10:00', endTime: '10:15' },
    }),
  });
  track(assert(
    bookStream1.status === 201 && bookStream1.data.status === 'CONFIRMED',
    'Book exact STREAM slot returns 201 with appointment payload',
    `actual status/data: ${JSON.stringify(bookStream1.data)}`
  ));

  const appointment1Id = bookStream1.data.id || bookStream1.data.appointmentId;

  // Check STREAM availability after booking
  const availStreamAfter = await request(`/doctors/${doc1ProfileId}/availability?date=${testDate}`);
  const bookedSlotObj = Array.isArray(availStreamAfter.data) ? availStreamAfter.data.find(s => s.startTime === '10:00') : null;
  track(assert(
    bookedSlotObj && bookedSlotObj.available === false,
    'Booked STREAM slot is marked unavailable (available: false)',
    `actual status/data: ${JSON.stringify(bookedSlotObj)}`
  ));

  // Reject duplicate STREAM booking
  const bookStreamDup = await request('/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({
      doctorId: doc1ProfileId,
      date: testDate,
      scheduleType: 'STREAM',
      slot: { startTime: '10:00', endTime: '10:15' },
    }),
  });
  track(assert(bookStreamDup.status === 409, 'Reject booking booked STREAM slot with 409 Conflict', `actual status/data: ${bookStreamDup.status}`));

  // Reject booking for past date
  const bookPast = await request('/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      doctorId: doc1ProfileId,
      date: '2020-01-01',
      scheduleType: 'STREAM',
      slot: { startTime: '10:00', endTime: '10:15' },
    }),
  });
  track(assert(bookPast.status === 400, 'Reject booking for past date with 400 Bad Request', `actual status/data: ${bookPast.status}`));


  // 4. WAVE SCHEDULING TESTS
  console.log('\n══════ 4. WAVE SCHEDULING & TOKEN ASSIGNMENT TESTS ══════');
  const availWave = await request(`/doctors/${doc2ProfileId}/availability?date=${testDate}`);
  track(assert(
    availWave.status === 200 && Array.isArray(availWave.data) && availWave.data[0] && availWave.data[0].capacity === 3,
    'Fetch WAVE availability returns window with capacity',
    `actual status/data: ${JSON.stringify(availWave.data)}`
  ));

  // Patient 1 books WAVE -> Token 1
  const wave1 = await request('/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      doctorId: doc2ProfileId,
      date: testDate,
      scheduleType: 'WAVE',
      window: '10:00-11:00',
    }),
  });
  track(assert(wave1.status === 201 && wave1.data.token === 1, 'Patient 1 books WAVE window -> Token 1 assigned', `actual status/data: ${JSON.stringify(wave1.data)}`));

  // Duplicate WAVE booking for same patient -> 409
  const waveDup = await request('/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      doctorId: doc2ProfileId,
      date: testDate,
      scheduleType: 'WAVE',
      window: '10:00-11:00',
    }),
  });
  track(assert(waveDup.status === 409, 'Reject duplicate WAVE booking for same patient with 409 Conflict', `actual status/data: ${waveDup.status}`));

  // Patient 2 books WAVE -> Token 2
  const wave2 = await request('/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat2Token}` },
    body: JSON.stringify({
      doctorId: doc2ProfileId,
      date: testDate,
      scheduleType: 'WAVE',
      window: '10:00-11:00',
    }),
  });
  track(assert(wave2.status === 201 && wave2.data.token === 2, 'Patient 2 books WAVE window -> Token 2 assigned', `actual status/data: ${JSON.stringify(wave2.data)}`));

  // Patient 3 books WAVE -> Token 3
  const wave3 = await request('/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat3Token}` },
    body: JSON.stringify({
      doctorId: doc2ProfileId,
      date: testDate,
      scheduleType: 'WAVE',
      window: '10:00-11:00',
    }),
  });
  track(assert(wave3.status === 201 && wave3.data.token === 3, 'Patient 3 books WAVE window -> Token 3 assigned', `actual status/data: ${JSON.stringify(wave3.data)}`));

  // Patient 4 books WAVE (Capacity = 3 exceeded) -> 409 Conflict
  const waveOver = await request('/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat4Token}` },
    body: JSON.stringify({
      doctorId: doc2ProfileId,
      date: testDate,
      scheduleType: 'WAVE',
      window: '10:00-11:00',
    }),
  });
  track(assert(waveOver.status === 409, 'Reject booking exceeding maxCapacity with 409 Conflict (Wave Full)', `actual status/data: ${waveOver.status}`));


  // 5. GET APPOINTMENT BY ID TESTS
  console.log('\n══════ 5. GET APPOINTMENT BY ID TESTS ══════');
  // No token -> 401
  const getNoAuth = await request(`/appointments/${appointment1Id}`);
  track(assert(getNoAuth.status === 401, 'GET appointment without JWT -> 401', `actual status/data: ${getNoAuth.status}`));

  // Different patient -> 403
  const getDiffPat = await request(`/appointments/${appointment1Id}`, {
    headers: { Authorization: `Bearer ${pat2Token}` },
  });
  track(assert(getDiffPat.status === 403, 'Different patient GET -> 403', `actual status/data: ${getDiffPat.status}`));

  // Owner Patient -> 200
  const getOwnerPat = await request(`/appointments/${appointment1Id}`, {
    headers: { Authorization: `Bearer ${pat1Token}` },
  });
  track(assert(
    getOwnerPat.status === 200 && (getOwnerPat.data.appointmentId === appointment1Id || getOwnerPat.data.id === appointment1Id),
    'Fetch appointment by valid UUID returns appointment details',
    `actual status/data: ${JSON.stringify(getOwnerPat.data)}`
  ));

  // Assigned Doctor -> 200
  const getDocOwner = await request(`/appointments/${appointment1Id}`, {
    headers: { Authorization: `Bearer ${doc1Token}` },
  });
  track(assert(
    getDocOwner.status === 200 && (getDocOwner.data.appointmentId === appointment1Id || getDocOwner.data.id === appointment1Id),
    'Assigned doctor GET -> success',
    `actual status/data: ${JSON.stringify(getDocOwner.data)}`
  ));

  // Invalid UUID -> 400
  const getInvalidUuid = await request('/appointments/invalid-uuid', {
    headers: { Authorization: `Bearer ${pat1Token}` },
  });
  track(assert(getInvalidUuid.status === 400, 'Reject invalid appointment ID UUID with 400 Bad Request via ParseUUIDPipe', `actual status/data: ${getInvalidUuid.status}`));

  // Non-existent UUID -> 404
  const getNotFound = await request(`/appointments/${fakeUuid}`, {
    headers: { Authorization: `Bearer ${pat1Token}` },
  });
  track(assert(getNotFound.status === 404, 'Reject non-existent appointment ID with 404 Not Found', `actual status/data: ${getNotFound.status}`));


  // 6. WAVE CONCURRENCY INTEGRATION TESTS
  console.log('\n══════ 6. WAVE CONCURRENCY INTEGRATION TESTS ══════');
  const concDocEmail = `doc_conc_${timestamp}@test.com`;
  const concDocToken = await registerUser(concDocEmail, 'Password123!', 'DOCTOR', 'Dr. Concurrency');
  const concDocProfileRes = await request('/doctor/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${concDocToken}` },
    body: JSON.stringify({
      fullName: 'Dr. Concurrency',
      specialization: 'Cardiology',
      experience: 10,
      qualification: 'MD',
      consultationFee: 150,
      availability: 'Mon-Fri 09:00-17:00',
      profileDetails: 'Concurrency Specialist',
    }),
  });
  const concDocProfileId = concDocProfileRes.data.id;

  await request('/doctor/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${concDocToken}` },
    body: JSON.stringify({ weekday: 'Monday', startTime: '10:00', endTime: '11:00' }),
  });

  await request(`/doctors/${concDocProfileId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${concDocToken}` },
    body: JSON.stringify({ schedulingType: 'WAVE', maxCapacity: 5 }),
  });

  // Register 10 unique patients for concurrency test
  const concPatientTokens = [];
  for (let i = 1; i <= 10; i++) {
    const token = await registerUser(
      `conc_pat_${i}_${timestamp}@test.com`,
      'Password123!',
      'PATIENT',
      `Conc Patient ${i}`,
    );
    concPatientTokens.push(token);
  }

  // Execute 10 Parallel WAVE Bookings (Promise.all)
  const concRequests = concPatientTokens.map((token) =>
    request('/appointments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        doctorId: concDocProfileId,
        date: '2026-08-10',
        scheduleType: 'WAVE',
        window: '10:00-11:00',
      }),
    }),
  );

  const concResults = await Promise.all(concRequests);
  const concSuccesses = concResults.filter((r) => r.status === 201);
  const concRejections = concResults.filter((r) => r.status === 409);
  const allocatedTokens = concSuccesses.map((r) => r.data.token).sort((a, b) => a - b);

  track(assert(
    concSuccesses.length <= 5 && concSuccesses.length + concRejections.length === 10,
    `Overbooking blocked (Successes: ${concSuccesses.length}, Rejections: ${concRejections.length})`,
  ));
  track(assert(
    JSON.stringify(allocatedTokens) === JSON.stringify(allocatedTokens.slice().sort((a, b) => a - b)),
    `Tokens are strictly unique and sequential: ${JSON.stringify(allocatedTokens)}`,
  ));

  // Concurrent duplicate patient test
  const dupRequests = [
    request('/appointments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${concPatientTokens[0]}` },
      body: JSON.stringify({
        doctorId: concDocProfileId,
        date: '2026-08-10',
        scheduleType: 'WAVE',
        window: '10:00-11:00',
      }),
    }),
    request('/appointments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${concPatientTokens[0]}` },
      body: JSON.stringify({
        doctorId: concDocProfileId,
        date: '2026-08-10',
        scheduleType: 'WAVE',
        window: '10:00-11:00',
      }),
    }),
  ];
  const dupResults = await Promise.all(dupRequests);
  const dupRejections = dupResults.filter((r) => r.status === 409);
  track(assert(
    dupRejections.length >= 1,
    'Duplicate patient race: Exactly 1 request succeeded and duplicate was rejected (409)',
  ));

  console.log('\n══════ ADVANCED SCHEDULING & CONCURRENCY SUMMARY ══════');
  console.log(`Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdvancedSchedulingTests().catch((err) => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
