const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const duration = Date.now() - start;
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, duration };
  } catch (err) {
    const duration = Date.now() - start;
    return { status: 500, data: { error: err.message }, duration };
  }
}

async function runConcurrencyStressTest() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  50-WAY PARALLEL HIGH-CONTENTION CONCURRENCY STRESS SUITE');
  console.log(`  Target: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const timestamp = Date.now();
  const docEmail = `stress_doc_${timestamp}@test.com`;

  // 1. REGISTER DOCTOR
  console.log('[1/4] Registering test Doctor profile...');
  const docSignup = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: docEmail,
      password: 'Password123!',
      role: 'DOCTOR',
      name: 'Dr. Concurrency Stress',
    }),
  });

  if (docSignup.status !== 201) {
    console.error(`Failed doctor signup (${docSignup.status}):`, docSignup.data);
    process.exit(1);
  }

  const docLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: docEmail, password: 'Password123!' }),
  });
  const docToken = docLogin.data.access_token;

  // Create Doctor Profile with all required DTO properties
  const docProfileRes = await request('/doctor/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      fullName: 'Dr. Concurrency Stress',
      specialization: 'Database Reliability',
      experience: 10,
      qualification: 'MD',
      consultationFee: 150,
      availability: 'Mon-Fri 09:00-17:00',
      profileDetails: 'Concurrency Stress Specialist',
    }),
  });

  if (docProfileRes.status !== 201) {
    console.error(`Failed doctor profile creation (${docProfileRes.status}):`, docProfileRes.data);
    process.exit(1);
  }

  const doctorId = docProfileRes.data.id;

  // 2. SET RECURRING AVAILABILITY (10:00 - 11:00 on Monday)
  console.log('[2/4] Setting STREAM availability (Monday 10:00 - 11:00)...');
  await request('/doctor/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ weekday: 'Monday', startTime: '10:00', endTime: '11:00' }),
  });

  // Target next Monday date (YYYY-MM-DD)
  const today = new Date();
  const daysUntilMonday = ((1 + 7 - today.getDay()) % 7) || 7;
  const targetDateObj = new Date(today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
  const targetDateStr = targetDateObj.toISOString().split('T')[0];
  const targetSlotStartTime = '10:00';

  console.log(`  ✓ Doctor Profile ID: ${doctorId}`);
  console.log(`  ✓ Target Contest Date: ${targetDateStr}`);
  console.log(`  ✓ Target Contest Slot: ${targetSlotStartTime}\n`);

  // 3. REGISTER 50 DISTINCT PATIENTS IN PARALLEL
  console.log('[3/4] Registering 50 distinct Patient accounts...');
  const CONCURRENT_COUNT = 50;
  const patientTokens = [];

  for (let i = 1; i <= CONCURRENT_COUNT; i++) {
    const patEmail = `stress_pat_${i}_${timestamp}@test.com`;
    await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: patEmail,
        password: 'Password123!',
        role: 'PATIENT',
        name: `Patient ${i}`,
      }),
    });
    const patLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: patEmail, password: 'Password123!' }),
    });
    const token = patLogin.data.access_token;
    await request('/patient/profile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        fullName: `Patient ${i}`,
        age: 25,
        gender: 'Female',
        contactDetails: '1112223334',
        basicHealthInformation: 'None',
      }),
    });
    patientTokens.push(token);
  }
  console.log(`  ✓ 50 Patient accounts successfully prepared.\n`);

  // 4. FIRE 50 SIMULTANEOUS PARALLEL BOOKING REQUESTS AT THE EXACT SAME SLOT
  console.log(`[4/4] FIRING 50 SIMULTANEOUS PARALLEL BOOKING REQUESTS AT ${targetSlotStartTime}...`);

  const bookingPromises = patientTokens.map((token) =>
    request('/appointments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        doctorId: doctorId,
        date: targetDateStr,
        startTime: targetSlotStartTime,
        endTime: '10:30',
      }),
    }),
  );

  const results = await Promise.all(bookingPromises);

  // ANALYZE RESULTS
  let successCount = 0;
  let conflictCount = 0;
  let errorCount = 0;
  const durations = [];

  results.forEach((res) => {
    durations.push(res.duration);
    if (res.status === 201) {
      successCount++;
    } else if (res.status === 409 || res.status === 400) {
      conflictCount++;
    } else {
      errorCount++;
    }
  });

  durations.sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];
  const maxLat = durations[durations.length - 1];

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                 CONCURRENCY STRESS TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Total Parallel Requests Sent:    ${CONCURRENT_COUNT}`);
  console.log(`Successful Bookings (HTTP 201):  ${successCount}  (Expected: EXACTLY 1)`);
  console.log(`Conflict Rejections (HTTP 409/400): ${conflictCount}  (Expected: EXACTLY 49)`);
  console.log(`Unexpected Failures (HTTP 5xx):  ${errorCount}  (Expected: EXACTLY 0)`);
  console.log('-------------------------------------------------------------------');
  console.log(`Latency P50:                    ${p50} ms`);
  console.log(`Latency P95:                    ${p95} ms`);
  console.log(`Latency P99:                    ${p99} ms`);
  console.log(`Latency Max:                    ${maxLat} ms`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // INVARIANT ASSERTIONS
  const isInvariantPassed = successCount === 1 && conflictCount === (CONCURRENT_COUNT - 1) && errorCount === 0;

  if (isInvariantPassed) {
    console.log('  ✓ INVARIANT PASSED: Exactly 1 booking confirmed, 49 rejected with 409/400 Conflict.');
    console.log('  ✓ PostgreSQL Row Locks & Partial Unique Index physically prevented double-booking!\n');
    process.exit(0);
  } else {
    console.error('  ✗ INVARIANT FAILED: Double-booking or unexpected failure detected!');
    process.exit(1);
  }
}

runConcurrencyStressTest();
