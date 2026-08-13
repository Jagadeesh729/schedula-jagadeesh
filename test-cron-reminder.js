/**
 * Comprehensive Forensic Test Suite for Automated Appointment Reminder System
 * Tests Automatic Cron Execution, 50-Way Concurrent Reminder Idempotency,
 * STREAM & WAVE Content Formatting, Exclusions, and Role Authorization.
 */
const http = require('http');

const BASE_URL = 'http://127.0.0.1:3000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

async function runReminderSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING CRON REMINDER & CONCURRENCY FORENSIC SUITE');
  console.log('====================================================\n');

  // 1. Manual Trigger Authorization Security Test
  console.log('1. Testing Manual Trigger Authorization & Privilege Narrowing...');
  const unauthTrigger = await request('POST', '/notifications/trigger-reminders');
  assert(
    unauthTrigger.status === 401,
    'Unauthenticated POST /notifications/trigger-reminders rejected with 401 Unauthorized',
  );

  // 2. Setup Accounts & Profiles
  console.log('\n2. Registering and authenticating test accounts...');
  const ts = Date.now();
  const doc1Email = `doc1_remind_${ts}@test.com`;
  const doc2Email = `doc2_remind_${ts}@test.com`;
  const pat1Email = `pat1_remind_${ts}@test.com`;
  const pat2Email = `pat2_remind_${ts}@test.com`;

  // Doctor 1 (STREAM)
  await request('POST', '/auth/signup', {
    name: 'Dr. Sarah Connor',
    email: doc1Email,
    password: 'password123',
    role: 'DOCTOR',
  });
  const doc1Login = await request('POST', '/auth/login', {
    email: doc1Email,
    password: 'password123',
  });
  const doc1Token = doc1Login.body.access_token;

  await request('POST', '/doctor/profile', {
    fullName: 'Dr. Sarah Connor',
    specialization: 'Cardiology',
    experience: 10,
    qualification: 'MD',
    consultationFee: 150,
    availability: '00:00 - 23:59',
    profileDetails: 'Stream Specialist',
  }, doc1Token);
  const doc1ProfileRes = await request('GET', '/doctor/profile', null, doc1Token);
  const doc1ProfileId = doc1ProfileRes.body.id;

  // Doctor 2 (WAVE)
  await request('POST', '/auth/signup', {
    name: 'Dr. John Doe',
    email: doc2Email,
    password: 'password123',
    role: 'DOCTOR',
  });
  const doc2Login = await request('POST', '/auth/login', {
    email: doc2Email,
    password: 'password123',
  });
  const doc2Token = doc2Login.body.access_token;

  await request('POST', '/doctor/profile', {
    fullName: 'Dr. John Doe',
    specialization: 'Pediatrics',
    experience: 8,
    qualification: 'MD',
    consultationFee: 120,
    availability: '00:00 - 23:59',
    profileDetails: 'Wave Specialist',
  }, doc2Token);
  const doc2ProfileRes = await request('GET', '/doctor/profile', null, doc2Token);
  const doc2ProfileId = doc2ProfileRes.body.id;

  // Tomorrow's date and weekday
  const today = new Date();
  const futureDate = new Date(today.getTime() + 86400000);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  const futureDayName = WEEKDAYS[futureDate.getDay()];

  // Doctor Availability
  await request('POST', '/doctor/availability', {
    weekday: futureDayName,
    startTime: '08:00',
    endTime: '20:00',
  }, doc1Token);

  await request('POST', '/doctor/availability', {
    weekday: futureDayName,
    startTime: '08:00',
    endTime: '20:00',
  }, doc2Token);

  // Patient 1
  await request('POST', '/auth/signup', {
    name: 'Patient One',
    email: pat1Email,
    password: 'password123',
    role: 'PATIENT',
  });
  const pat1Login = await request('POST', '/auth/login', {
    email: pat1Email,
    password: 'password123',
  });
  const pat1Token = pat1Login.body.access_token;

  await request('POST', '/patient/profile', {
    fullName: 'Patient Remindee One',
    age: 30,
    gender: 'Male',
    contactDetails: '555-1234',
  }, pat1Token);

  // Patient 2
  await request('POST', '/auth/signup', {
    name: 'Patient Two',
    email: pat2Email,
    password: 'password123',
    role: 'PATIENT',
  });
  const pat2Login = await request('POST', '/auth/login', {
    email: pat2Email,
    password: 'password123',
  });
  const pat2Token = pat2Login.body.access_token;

  await request('POST', '/patient/profile', {
    fullName: 'Patient Remindee Two',
    age: 28,
    gender: 'Female',
    contactDetails: '555-5678',
  }, pat2Token);

  // Verify Patient Role Rejection on Trigger Endpoint
  const patForbiddenTrigger = await request('POST', '/notifications/trigger-reminders', {}, pat1Token);
  assert(
    patForbiddenTrigger.status === 403,
    'Patient role POST /notifications/trigger-reminders rejected with 403 Forbidden (Privilege Escalation Guarded)',
  );

  // 3. Configure STREAM and WAVE Scheduling Strategies
  console.log('\n3. Configuring STREAM and WAVE scheduling strategies...');
  await request('POST', `/doctors/${doc1ProfileId}/scheduling`, {
    schedulingType: 'STREAM',
    slotDuration: 15,
    bufferTime: 5,
  }, doc1Token);

  await request('POST', `/doctors/${doc2ProfileId}/scheduling`, {
    schedulingType: 'WAVE',
    maxCapacity: 5,
  }, doc2Token);

  // 4. Book Appointments
  console.log('\n4. Booking STREAM and WAVE appointments...');
  const streamBooking = await request('POST', '/appointment/book', {
    doctorId: doc1ProfileId,
    date: futureDateStr,
    scheduleType: 'STREAM',
    startTime: '10:00',
    endTime: '10:15',
  }, pat1Token);
  assert(
    streamBooking.status === 201 && !!streamBooking.body.id,
    `STREAM Appointment booked successfully (ID: ${streamBooking.body?.id})`,
  );

  const waveBooking = await request('POST', '/appointment/book', {
    doctorId: doc2ProfileId,
    date: futureDateStr,
    scheduleType: 'WAVE',
    window: '11:00-12:00',
  }, pat2Token);
  assert(
    waveBooking.status === 201 && !!waveBooking.body.id,
    `WAVE Appointment booked successfully with Token #${waveBooking.body?.token}`,
  );

  // Book and Cancel an Appointment (Exclusion Test)
  const cancelBooking = await request('POST', '/appointment/book', {
    doctorId: doc1ProfileId,
    date: futureDateStr,
    scheduleType: 'STREAM',
    startTime: '10:20',
    endTime: '10:35',
  }, pat1Token);
  await request('PATCH', `/appointment/${cancelBooking.body.id}/cancel`, {}, pat1Token);
  console.log(`Cancelled appointment ${cancelBooking.body.id}`);

  // 5. Automatic Cron & Manual Trigger Verification
  console.log('\n5. Executing reminder trigger via authorized Doctor account...');
  const triggerRes = await request('POST', '/notifications/trigger-reminders', {}, doc1Token);
  assert(
    triggerRes.status === 200 || triggerRes.status === 201,
    `POST /notifications/trigger-reminders returned Success for authorized doctor (Status: ${triggerRes.status})`,
  );
  assert(
    triggerRes.body.created + triggerRes.body.duplicates >= 2,
    `Reminders processed/created for upcoming active appointments (Created: ${triggerRes.body.created}, Duplicates: ${triggerRes.body.duplicates})`,
  );

  // 6. Verify Content & Exact Formatting
  console.log('\n6. Verifying notification listing & clean message formatting...');
  const pat1NotifsRes = await request('GET', '/notifications', null, pat1Token);
  assert(pat1NotifsRes.status === 200, 'Patient 1 GET /notifications returned 200 OK');

  const pat1Reminder = (pat1NotifsRes.body.data || []).find(
    (n) => n.appointmentId === streamBooking.body.id && n.type === 'APPOINTMENT_REMINDER',
  );
  assert(!!pat1Reminder, 'STREAM appointment reminder notification found for Patient 1');
  assert(
    pat1Reminder.message.includes('Dr. Sarah Connor') &&
      !pat1Reminder.message.includes('Dr. Dr.') &&
      pat1Reminder.message.includes('10:00'),
    `STREAM Reminder clean formatting verified: "${pat1Reminder.message}"`,
  );

  const pat2NotifsRes = await request('GET', '/notifications', null, pat2Token);
  assert(pat2NotifsRes.status === 200, 'Patient 2 GET /notifications returned 200 OK');

  const pat2Reminder = (pat2NotifsRes.body.data || []).find(
    (n) => n.appointmentId === waveBooking.body.id && n.type === 'APPOINTMENT_REMINDER',
  );
  assert(!!pat2Reminder, 'WAVE appointment reminder notification found for Patient 2');
  assert(
    pat2Reminder.message.includes('Dr. John Doe') &&
      !pat2Reminder.message.includes('Dr. Dr.') &&
      pat2Reminder.message.includes('Reporting Time: 11:00') &&
      pat2Reminder.message.includes('Token Number: 1'),
    `WAVE Reminder clean formatting verified: "${pat2Reminder.message}"`,
  );

  const cancelledReminder = (pat1NotifsRes.body.data || []).find(
    (n) => n.appointmentId === cancelBooking.body.id && n.type === 'APPOINTMENT_REMINDER',
  );
  assert(!cancelledReminder, 'Cancelled appointment was correctly EXCLUDED from receiving a reminder');

  // 7. 50-Way Parallel Concurrency & Idempotency Stress Test
  console.log('\n7. Executing 50-WAY SIMULTANEOUS CONCURRENT REMINDER TRIGGER STRESS TEST...');
  const concurrentTriggers = Array.from({ length: 50 }, () =>
    request('POST', '/notifications/trigger-reminders', {}, doc1Token),
  );

  const results = await Promise.all(concurrentTriggers);
  const successCount = results.filter((r) => r.status === 200 || r.status === 201).length;
  const errorCount = results.filter((r) => r.status >= 500).length;

  assert(successCount === 50, `All 50 concurrent requests completed cleanly without HTTP failures (${successCount}/50)`);
  assert(errorCount === 0, 'Zero HTTP 5xx server errors during 50-way concurrent execution');

  const pat1NotifsFinal = await request('GET', '/notifications', null, pat1Token);
  assert(
    pat1NotifsFinal.body.totalCount === pat1NotifsRes.body.totalCount,
    `Total notification count preserved (${pat1NotifsFinal.body.totalCount}) - Zero duplicate database rows created!`,
  );

  console.log('\n====================================================');
  console.log('🎉 ALL CRON REMINDER & CONCURRENCY TESTS PASSED!');
  console.log('====================================================\n');
}

runReminderSuite().catch((err) => {
  console.error('❌ REMINDER SUITE FAILED:', err);
  process.exit(1);
});
