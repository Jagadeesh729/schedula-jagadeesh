/**
 * Schedula Edge-Case & Boundary Condition Verification Suite
 * Targets hiring-project evaluation scope gaps.
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
    console.log(`  ✓ PASS — ${testName}`);
    passed++;
  } else {
    const details = res ? ` [Status: ${res.status}, Data: ${JSON.stringify(res.data)}]` : '';
    console.error(`  ❌ FAIL — ${testName}${details}`);
    failed++;
  }
}

async function runEdgeCaseSuite() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  EXHAUSTIVE EDGE-CASE & BOUNDARY CONDITION TEST SUITE     ');
  console.log(`  Target: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Setup Doctor & Patient accounts
  const docEmail = `doc.edge.${Date.now()}@example.com`;
  const patEmail = `pat.edge.${Date.now()}@example.com`;

  await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Dr. Edge Case', email: docEmail, password: 'password123', role: 'DOCTOR' }),
  });
  const docLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: docEmail, password: 'password123' }),
  });
  const docToken = docLogin.data?.access_token || docLogin.data?.accessToken;

  await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Patient Edge', email: patEmail, password: 'password123', role: 'PATIENT' }),
  });
  const patLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: patEmail, password: 'password123' }),
  });
  const patToken = patLogin.data?.access_token || patLogin.data?.accessToken;

  // Create Doctor profile
  const docProfileRes = await request('/doctor/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({
      fullName: 'Dr. Edge Case',
      specialization: 'Boundary Diagnostics',
      experience: 12,
      qualification: 'MD',
      consultationFee: 300,
      availability: 'Mon-Fri 9AM-5PM',
      profileDetails: 'Edge Case Specialist',
    }),
  });
  const doctorId = docProfileRes.data?.id;

  // Create Patient profile
  await request('/patient/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${patToken}` },
    body: JSON.stringify({
      fullName: 'Patient Edge',
      age: 30,
      gender: 'Male',
      contactDetails: '1234567890',
      basicHealthInformation: 'None',
    }),
  });

  // Setup Recurring Availability
  await request('/doctor/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ weekday: 'Monday', startTime: '09:00', endTime: '17:00' }),
  });

  // Setup STREAM strategy config
  await request('/scheduling/config', {
    method: 'POST',
    headers: { Authorization: `Bearer ${docToken}` },
    body: JSON.stringify({ schedulingType: 'STREAM', slotDuration: 15, bufferTime: 5 }),
  });

  console.log('─── 1. DATE & TIME BOUNDARY VALIDATION ───');
  
  // Test invalid calendar date format
  const res1 = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${patToken}` },
    body: JSON.stringify({ doctorId, date: '2026-13-45', slot: { startTime: '10:00', endTime: '10:15' } }),
  });
  assert(res1.status === 400, 'Reject invalid calendar date string (400 Bad Request)', res1);

  // Test past date booking
  const res2 = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${patToken}` },
    body: JSON.stringify({ doctorId, date: '2020-01-01', slot: { startTime: '10:00', endTime: '10:15' } }),
  });
  assert(res2.status === 400, 'Reject past date booking attempt (400 Bad Request)', res2);

  console.log('\n─── 2. IDEMPOTENT CANCELLATION & REPEATED TRANSITIONS ───');
  
  // Book valid STREAM appointment for future Monday
  const bookingRes = await request('/appointment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${patToken}` },
    body: JSON.stringify({ doctorId, date: '2026-08-17', slot: { startTime: '10:00', endTime: '10:15' } }),
  });
  assert(bookingRes.status === 201, 'Book valid future STREAM appointment (201 Created)', bookingRes);
  const apptId = bookingRes.data?.id;

  if (apptId) {
    // Cancel appointment
    const cancelRes1 = await request(`/appointment/${apptId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${patToken}` },
    });
    assert(cancelRes1.status === 200, 'Cancel active appointment (200 OK)', cancelRes1);

    // Repeat cancellation on already cancelled appointment
    const cancelRes2 = await request(`/appointment/${apptId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${patToken}` },
    });
    assert(cancelRes2.status === 400 || cancelRes2.status === 409 || cancelRes2.status === 200, 'Handle repeat cancellation gracefully', cancelRes2);

    // Reschedule already cancelled appointment
    const rescheduleCancelledRes = await request(`/appointment/${apptId}/reschedule`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${patToken}` },
      body: JSON.stringify({ date: '2026-08-17', slot: { startTime: '11:00', endTime: '11:15' } }),
    });
    assert(rescheduleCancelledRes.status === 400, 'Reject rescheduling already cancelled appointment (400 Bad Request)', rescheduleCancelledRes);
  }

  console.log('\n─── 3. SHRINK PREVIEW DRY-RUN API ───');

  const availListRes = await request('/doctor/availability', {
    headers: { Authorization: `Bearer ${docToken}` },
  });
  const availId = availListRes.data[0]?.id;

  if (availId) {
    const previewRes = await request(`/doctor/availability/${availId}/shrink-preview?startTime=10:00&endTime=12:00`, {
      headers: { Authorization: `Bearer ${docToken}` },
    });
    assert(previewRes.status === 200 && typeof previewRes.data?.affectedCount === 'number', 'Execute shrink-preview dry-run query (200 OK)', previewRes);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  EDGE-CASE SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEdgeCaseSuite();
