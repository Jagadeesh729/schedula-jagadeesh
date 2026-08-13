/**
 * Automated Appointment Reminder System Integration Test Suite
 * Tests STREAM & WAVE reminders, deduplication, state exclusions, and authorization.
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
  console.log('🧪 RUNNING AUTOMATED APPOINTMENT REMINDER SUITE');
  console.log('====================================================\n');

  // 1. Unauthorized Manual Trigger Test
  console.log('1. Testing Unauthorized Manual Trigger Prevention...');
  const unauthTrigger = await request('POST', '/notifications/trigger-reminders');
  assert(
    unauthTrigger.status === 401,
    'Unauthenticated POST /notifications/trigger-reminders rejected with 401 Unauthorized',
  );

  // 2. Setup Accounts (Doctor 1 STREAM, Doctor 2 WAVE, Patient 1, Patient 2)
  console.log('\n2. Registering and authenticating test accounts...');
  const ts = Date.now();
  const doc1Email = `doc1_remind_${ts}@test.com`;
  const doc2Email = `doc2_remind_${ts}@test.com`;
  const pat1Email = `pat1_remind_${ts}@test.com`;
  const pat2Email = `pat2_remind_${ts}@test.com`;

  // --- Doctor 1 (STREAM) ---
  await request('POST', '/auth/signup', {
    name: 'Dr. Stream Specialist',
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
    fullName: 'Dr. Stream Specialist',
    specialization: 'Cardiology',
    experience: 10,
    qualification: 'MD',
    consultationFee: 150,
    availability: '00:00 - 23:59',
    profileDetails: 'Stream Specialist',
  }, doc1Token);
  const doc1ProfileRes = await request('GET', '/doctor/profile', null, doc1Token);
  const doc1ProfileId = doc1ProfileRes.body.id;

  // --- Doctor 2 (WAVE) ---
  await request('POST', '/auth/signup', {
    name: 'Dr. Wave Specialist',
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
    fullName: 'Dr. Wave Specialist',
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

  // Doctor 1 & 2 Availability
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

  // 4. Book STREAM Appointment
  console.log('\n4. Booking STREAM appointment...');
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

  // 5. Book WAVE Appointment
  console.log('\n5. Booking WAVE appointment...');
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

  // 6. Book and Cancel an Appointment (Exclusion Test)
  console.log('\n6. Booking and cancelling an appointment to test exclusion logic...');
  const cancelBooking = await request('POST', '/appointment/book', {
    doctorId: doc1ProfileId,
    date: futureDateStr,
    scheduleType: 'STREAM',
    startTime: '10:20',
    endTime: '10:35',
  }, pat1Token);
  assert(
    cancelBooking.status === 201 && !!cancelBooking.body.id,
    `Appointment to cancel booked (ID: ${cancelBooking.body.id})`,
  );
  await request('PATCH', `/appointment/${cancelBooking.body.id}/cancel`, {}, pat1Token);
  console.log(`Cancelled appointment ${cancelBooking.body.id}`);

  // 7. Execute Reminder Processing (Manual Trigger Endpoint with Doctor Authorization)
  console.log('\n7. Triggering appointment reminder processing...');
  const triggerRes = await request('POST', '/notifications/trigger-reminders', {}, doc1Token);
  assert(
    triggerRes.status === 200 || triggerRes.status === 201,
    `POST /notifications/trigger-reminders returned 200/201 Success for authorized doctor (Status: ${triggerRes.status})`,
  );
  assert(
    triggerRes.body.created + triggerRes.body.duplicates >= 2,
    `Reminders processed/created for upcoming active appointments (Created: ${triggerRes.body.created}, Duplicates: ${triggerRes.body.duplicates})`,
  );

  // 8. Retrieve Patient Notifications & Verify Content
  console.log('\n8. Verifying notification listing and content for STREAM & WAVE reminders...');
  const pat1NotifsRes = await request('GET', '/notifications', null, pat1Token);
  assert(pat1NotifsRes.status === 200, 'Patient 1 GET /notifications returned 200 OK');

  const pat1Reminder = (pat1NotifsRes.body.data || []).find(
    (n) => n.appointmentId === streamBooking.body.id && n.type === 'APPOINTMENT_REMINDER',
  );
  assert(!!pat1Reminder, 'STREAM appointment reminder notification found for Patient 1');
  assert(
    pat1Reminder.message.includes('Dr. Stream Specialist') &&
      pat1Reminder.message.includes('10:00'),
    `STREAM Reminder message valid: "${pat1Reminder.message}"`,
  );

  const pat2NotifsRes = await request('GET', '/notifications', null, pat2Token);
  assert(pat2NotifsRes.status === 200, 'Patient 2 GET /notifications returned 200 OK');

  const pat2Reminder = (pat2NotifsRes.body.data || []).find(
    (n) => n.appointmentId === waveBooking.body.id && n.type === 'APPOINTMENT_REMINDER',
  );
  assert(!!pat2Reminder, 'WAVE appointment reminder notification found for Patient 2');
  assert(
    pat2Reminder.message.includes('Reporting Time: 11:00') &&
      pat2Reminder.message.includes('Token Number: 1'),
    `WAVE Reminder message valid: "${pat2Reminder.message}"`,
  );

  const cancelledReminder = (pat1NotifsRes.body.data || []).find(
    (n) => n.appointmentId === cancelBooking.body.id && n.type === 'APPOINTMENT_REMINDER',
  );
  assert(!cancelledReminder, 'Cancelled appointment was correctly EXCLUDED from receiving a reminder');

  // 9. Execute Duplicate Trigger Test (Verify Deduplication)
  console.log('\n9. Executing second trigger pass to verify DEDUPLICATION invariant...');
  const secondTrigger = await request('POST', '/notifications/trigger-reminders', {}, doc1Token);
  assert(secondTrigger.status === 200 || secondTrigger.status === 201, 'Second trigger returned 200/201 Success');
  assert(
    secondTrigger.body.created === 0,
    `Zero duplicate notifications created on second trigger pass (Created: ${secondTrigger.body.created})`,
  );
  assert(
    secondTrigger.body.duplicates >= 2,
    `Idempotent duplicate attempts safely handled (Duplicates: ${secondTrigger.body.duplicates})`,
  );

  const pat1NotifsAfter = await request('GET', '/notifications', null, pat1Token);
  assert(
    pat1NotifsAfter.body.totalCount === pat1NotifsRes.body.totalCount,
    `Total notification count remains identical (${pat1NotifsAfter.body.totalCount}) - Zero duplicate entries!`,
  );

  console.log('\n====================================================');
  console.log('🎉 ALL AUTOMATED APPOINTMENT REMINDER TESTS PASSED!');
  console.log('====================================================\n');
}

runReminderSuite().catch((err) => {
  console.error('❌ REMINDER SUITE FAILED:', err);
  process.exit(1);
});
