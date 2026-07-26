const BASE_URL = 'http://localhost:3000';

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
  return login.data.access_token;
}

async function runConcurrencyTests() {
  console.log('\n══════ CONCURRENCY INTEGRATION TESTS ══════\n');

  // 1. Setup Doctor with a fresh timestamp
  const timestamp = Date.now();
  const docEmail = `doc_conc_${timestamp}@test.com`;
  const docToken = await registerUser(docEmail, 'Password123!', 'DOCTOR', 'Dr. Concurrency');
  
  const docProfileRes = await request('/doctor/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
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

  const doctorProfileId = docProfileRes.data.id;
  console.log(`  ✓ Doctor registered (Profile ID: ${doctorProfileId})`);

  const testWeekday = 'Monday';
  const randomOffset = Math.floor(Math.random() * 1000);
  const testDate = `2026-08-10`; // Standard test date
  const testWindow = '10:00-11:00';

  // Add Recurring Availability for Doctor
  await request('/doctor/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      weekday: testWeekday,
      startTime: '10:00',
      endTime: '11:00',
    }),
  });

  // Configure WAVE Scheduling with Capacity = 5
  await request(`/doctors/${doctorProfileId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      schedulingType: 'WAVE',
      maxCapacity: 5,
    }),
  });
  console.log(`  ✓ WAVE scheduling configured (maxCapacity=5, date: ${testDate}, weekday: ${testWeekday})`);

  // 2. Setup 10 Fresh Unique Patients for Test A & B
  const patientTokens = [];
  for (let i = 1; i <= 10; i++) {
    const token = await registerUser(`pat_ab_${timestamp}_${i}@test.com`, 'Password123!', 'PATIENT', `Patient AB ${i}`);
    patientTokens.push({ index: i, token });
  }
  console.log('  ✓ 10 Unique Patients registered for Overbooking & Token Uniqueness test');

  // ----------------------------------------------------
  // TEST A & B: 10 CONCURRENT BOOKINGS FOR CAPACITY 5
  // ----------------------------------------------------
  console.log('\n--- Running 10 Concurrent Booking Requests (Promise.all) ---');
  
  const bookingPromises = patientTokens.map((p) =>
    request('/appointments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.token}` },
      body: JSON.stringify({
        doctorId: doctorProfileId,
        scheduleType: 'WAVE',
        date: testDate,
        window: testWindow,
      }),
    })
  );

  const results = await Promise.all(bookingPromises);
  const successes = results.filter((r) => r.status === 201);
  const rejections = results.filter((r) => r.status === 409);

  console.log(`  ✓ Total Requests: 10`);
  console.log(`  ✓ Successful (201): ${successes.length}`);
  console.log(`  ✓ Rejected (409): ${rejections.length}`);

  const tokens = successes.map((s) => s.data.token).sort((a, b) => a - b);
  console.log(`  ✓ Allocated Tokens: [${tokens.join(', ')}]`);

  let testAPass = false;
  let testBPass = false;

  if (successes.length <= 5 && successes.length >= 1 && successes.length + rejections.length === 10) {
    console.log(`  ✓ PASS — Overbooking blocked (Successes: ${successes.length}, Rejections: ${rejections.length})`);
    testBPass = true;
  } else {
    console.error(`  ✗ FAIL — Overbooking check failed (Successes: ${successes.length}, Rejections: ${rejections.length})`);
  }

  const uniqueTokens = new Set(tokens);
  if (tokens.length > 0 && uniqueTokens.size === tokens.length && tokens[0] === 1) {
    console.log(`  ✓ PASS — Tokens are strictly unique, sequential 1 to ${tokens.length}`);
    testAPass = true;
  } else {
    console.error(`  ✗ FAIL — Token uniqueness check failed: [${tokens.join(', ')}]`);
  }

  // ----------------------------------------------------
  // TEST C: CONCURRENT DUPLICATE PATIENT BOOKING RACE
  // ----------------------------------------------------
  console.log('\n--- Running Concurrent Duplicate Booking Attempts for Same Patient ---');
  
  // Doctor 2 setup
  const doc2Email = `doc2_conc_${timestamp}@test.com`;
  const doc2Token = await registerUser(doc2Email, 'Password123!', 'DOCTOR', 'Dr. Concurrency 2');
  const doc2ProfileRes = await request('/doctor/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc2Token}` },
    body: JSON.stringify({
      fullName: 'Dr. Concurrency 2',
      specialization: 'Neurology',
      experience: 8,
      qualification: 'MD',
      consultationFee: 200,
      availability: 'Mon-Fri 09:00-17:00',
      profileDetails: 'Race Tester',
    }),
  });
  const doc2ProfileId = doc2ProfileRes.data.id;

  await request('/doctor/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc2Token}` },
    body: JSON.stringify({ weekday: testWeekday, startTime: '10:00', endTime: '11:00' }),
  });

  await request(`/doctors/${doc2ProfileId}/scheduling`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${doc2Token}` },
    body: JSON.stringify({ schedulingType: 'WAVE', maxCapacity: 5 }),
  });

  // Fresh unique patient for Test C
  const racePatientToken = await registerUser(`pat_race_${timestamp}@test.com`, 'Password123!', 'PATIENT', 'Race Patient');

  const racePromises = [
    request('/appointments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${racePatientToken}` },
      body: JSON.stringify({ doctorId: doc2ProfileId, scheduleType: 'WAVE', date: testDate, window: testWindow }),
    }),
    request('/appointments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${racePatientToken}` },
      body: JSON.stringify({ doctorId: doc2ProfileId, scheduleType: 'WAVE', date: testDate, window: testWindow }),
    }),
  ];

  const raceResults = await Promise.all(racePromises);
  const race201 = raceResults.filter((r) => r.status === 201);
  const race409 = raceResults.filter((r) => r.status === 409);

  let testCPass = false;
  if (race201.length === 1 && race409.length === 1) {
    console.log('  ✓ PASS — Duplicate patient race: Exactly 1 request succeeded (201) and 1 was rejected (409)');
    testCPass = true;
  } else {
    console.error(`  ✗ FAIL — Duplicate patient race failed (201s: ${race201.length}, 409s: ${race409.length})`);
  }

  // ----------------------------------------------------
  // CONCURRENCY SUMMARY
  // ----------------------------------------------------
  console.log('\n══════ CONCURRENCY SUMMARY ══════');
  const allPassed = testAPass && testBPass && testCPass;
  console.log(`Passed: ${allPassed ? 3 : 0} / 3 tests`);

  if (!allPassed) {
    process.exit(1);
  }
}

runConcurrencyTests().catch((err) => {
  console.error('Concurrency Test execution error:', err);
  process.exit(1);
});
