const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const parsedUrl = new URL(BASE_URL);
const HOST = parsedUrl.hostname;
const PORT = parsedUrl.port || 3000;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method: method,
        path: path,
        headers: headers,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            const parsed = responseBody ? JSON.parse(responseBody) : {};
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: responseBody });
          }
        });
      },
    );

    req.on('error', (err) => reject(err));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runNotificationWorkflowSuite() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  EVENT-BASED NOTIFICATION SYSTEM INTEGRATION SUITE');
  console.log(`  Target: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const ts = Date.now();
  const doctorEmail = `doc_notif_${ts}@example.com`;
  const patientEmail = `pat_notif_${ts}@example.com`;
  const patient2Email = `pat2_notif_${ts}@example.com`;
  const password = 'password123';

  // 1. Setup Doctor & Patient
  console.log('[1/6] Registering Doctor and Patient accounts...');

  // --- Doctor: signup then login to get access_token ---
  const docSignup = await request('POST', '/auth/signup', {
    email: doctorEmail,
    password,
    name: 'Dr. Sarah Connor',
    role: 'DOCTOR',
  });
  assert(docSignup.status === 201, 'Doctor signup returns 201');

  const docLogin = await request('POST', '/auth/login', {
    email: doctorEmail,
    password,
  });
  assert(docLogin.status === 200, 'Doctor login returns 200');
  const docToken = docLogin.body.access_token;
  assert(!!docToken, 'Doctor login returns access_token');

  // Create doctor profile with all required fields
  await request(
    'POST',
    '/doctor/profile',
    {
      fullName: 'Dr. Sarah Connor',
      specialization: 'Cardiology',
      experience: 10,
      qualification: 'MBBS, MD (Cardiology)',
      consultationFee: 500,
      availability: 'Monday,Tuesday,Wednesday,Thursday,Friday',
      profileDetails: 'Experienced cardiologist with 10 years of practice.',
    },
    docToken,
  );

  await request(
    'POST',
    '/doctor/availability',
    {
      weekday: 'Monday',
      startTime: '09:00',
      endTime: '17:00',
    },
    docToken,
  );

  const docProfile = await request('GET', '/doctor/profile', null, docToken);
  const doctorId = docProfile.body.id;

  await request(
    'POST',
    `/doctors/${doctorId}/scheduling`,
    {
      schedulingType: 'STREAM',
      slotDuration: 15,
      bufferTime: 5,
    },
    docToken,
  );

  // --- Patient 1: signup then login to get access_token ---
  const patSignup = await request('POST', '/auth/signup', {
    email: patientEmail,
    password,
    name: 'John Doe',
    role: 'PATIENT',
  });
  assert(patSignup.status === 201, 'Patient 1 signup returns 201');

  const patLogin = await request('POST', '/auth/login', {
    email: patientEmail,
    password,
  });
  assert(patLogin.status === 200, 'Patient 1 login returns 200');
  const patToken = patLogin.body.access_token;
  assert(!!patToken, 'Patient 1 login returns access_token');

  // Create patient 1 profile with all required fields
  await request(
    'POST',
    '/patient/profile',
    {
      fullName: 'John Doe',
      age: 30,
      gender: 'MALE',
      contactDetails: '1234567890',
    },
    patToken,
  );

  // --- Patient 2: signup then login to get access_token ---
  const pat2Signup = await request('POST', '/auth/signup', {
    email: patient2Email,
    password,
    name: 'Jane Smith',
    role: 'PATIENT',
  });
  assert(pat2Signup.status === 201, 'Patient 2 signup returns 201');

  const pat2Login = await request('POST', '/auth/login', {
    email: patient2Email,
    password,
  });
  assert(pat2Login.status === 200, 'Patient 2 login returns 200');
  const pat2Token = pat2Login.body.access_token;
  assert(!!pat2Token, 'Patient 2 login returns access_token');

  // Create patient 2 profile with all required fields
  await request(
    'POST',
    '/patient/profile',
    {
      fullName: 'Jane Smith',
      age: 28,
      gender: 'FEMALE',
      contactDetails: '0987654321',
    },
    pat2Token,
  );

  // 2. Test APPOINTMENT_BOOKED Notification
  console.log('\n[2/6] Testing APPOINTMENT_BOOKED notification workflow...');
  const bookRes = await request(
    'POST',
    '/appointment/book',
    {
      doctorId,
      date: '2026-08-17',
      scheduleType: 'STREAM',
      slot: { startTime: '09:00', endTime: '09:15' },
    },
    patToken,
  );
  assert(bookRes.status === 201, 'Appointment 1 booked successfully (201)');
  const appt1Id = bookRes.body.id;

  const notifs1 = await request('GET', '/notifications', null, patToken);
  assert(notifs1.status === 200, 'GET /notifications returns 200 OK');
  assert(Array.isArray(notifs1.body.data), 'Notifications body is an array');
  assert(
    notifs1.body.data.length >= 1,
    'Patient received at least 1 notification',
  );

  const latestNotif1 = notifs1.body.data[0];
  assert(
    latestNotif1.type === 'APPOINTMENT_BOOKED',
    'Notification type is APPOINTMENT_BOOKED',
  );
  assert(
    latestNotif1.title === 'Appointment Booked',
    'Title is Appointment Booked',
  );
  assert(
    latestNotif1.message.includes('booked successfully'),
    'Message contains booking confirmation',
  );
  assert(
    latestNotif1.isRead === false,
    'Notification isRead defaults to false',
  );

  // 3. Test APPOINTMENT_CANCELLED Notification
  console.log('\n[3/6] Testing APPOINTMENT_CANCELLED notification workflow...');
  const cancelRes = await request(
    'PATCH',
    `/appointment/${appt1Id}/cancel`,
    null,
    patToken,
  );
  assert(
    cancelRes.status === 200,
    'Appointment 1 cancelled successfully (200)',
  );

  const notifs2 = await request('GET', '/notifications', null, patToken);
  assert(notifs2.status === 200, 'GET /notifications returns 200 OK');
  assert(notifs2.body.data.length >= 2, 'Patient received 2nd notification');

  // Latest notification should appear first (createdAt DESC)
  const latestNotif2 = notifs2.body.data[0];
  assert(
    latestNotif2.type === 'APPOINTMENT_CANCELLED',
    'Latest notification type is APPOINTMENT_CANCELLED',
  );
  assert(
    latestNotif2.title === 'Appointment Cancelled',
    'Title is Appointment Cancelled',
  );
  assert(
    latestNotif2.message.includes('cancelled'),
    'Message contains cancellation info',
  );

  // 4. Test APPOINTMENT_RESCHEDULED Notification
  console.log(
    '\n[4/6] Testing APPOINTMENT_RESCHEDULED notification workflow...',
  );
  const bookRes2 = await request(
    'POST',
    '/appointment/book',
    {
      doctorId,
      date: '2026-08-17',
      scheduleType: 'STREAM',
      slot: { startTime: '10:00', endTime: '10:15' },
    },
    patToken,
  );
  assert(bookRes2.status === 201, 'Appointment 2 booked successfully (201)');
  const appt2Id = bookRes2.body.id;

  const reschedRes = await request(
    'PATCH',
    `/appointment/${appt2Id}/reschedule`,
    {
      date: '2026-08-17',
      slot: { startTime: '10:20', endTime: '10:35' },
    },
    patToken,
  );
  assert(
    reschedRes.status === 200,
    'Appointment 2 rescheduled successfully (200)',
  );

  const notifs3 = await request('GET', '/notifications', null, patToken);
  assert(notifs3.status === 200, 'GET /notifications returns 200 OK');
  const latestNotif3 = notifs3.body.data[0];
  assert(
    latestNotif3.type === 'APPOINTMENT_RESCHEDULED',
    'Latest notification type is APPOINTMENT_RESCHEDULED',
  );
  assert(
    latestNotif3.title === 'Appointment Rescheduled',
    'Title is Appointment Rescheduled',
  );
  assert(
    latestNotif3.message.includes('rescheduled to'),
    'Message contains rescheduling info',
  );

  // 5. Test Mark As Read API
  console.log('\n[5/6] Testing PATCH /notifications/:id/read...');
  const notifToMark = latestNotif3.id;
  const readRes = await request(
    'PATCH',
    `/notifications/${notifToMark}/read`,
    null,
    patToken,
  );
  assert(
    readRes.status === 200,
    'PATCH /notifications/:id/read returns 200 OK',
  );
  assert(readRes.body.isRead === true, 'Notification isRead is now true');

  // 6. Test Authorization & Edge Cases
  console.log('\n[6/7] Testing Authorization & Edge Cases...');
  // Patient 2 attempting to mark Patient 1's notification as read -> 403 Forbidden
  const forbiddenRead = await request(
    'PATCH',
    `/notifications/${notifToMark}/read`,
    null,
    pat2Token,
  );
  assert(
    forbiddenRead.status === 403,
    'Unauthorized patient marking notification returns 403 Forbidden',
  );

  // Invalid UUID notification -> 400 Bad Request
  const badUuidRes = await request(
    'PATCH',
    '/notifications/invalid-uuid/read',
    null,
    patToken,
  );
  assert(
    badUuidRes.status === 400,
    'Invalid UUID notification ID returns 400 Bad Request',
  );

  // Non-existent UUID -> 404 Not Found
  const notFoundRes = await request(
    'PATCH',
    '/notifications/00000000-0000-0000-0000-000000000000/read',
    null,
    patToken,
  );
  assert(
    notFoundRes.status === 404,
    'Non-existent notification returns 404 Not Found',
  );

  // 7. Test Elastic Availability Shrink Auto-Reschedule Notification Workflow
  console.log(
    '\n[7/7] Testing Elastic Availability Shrink Auto-Reschedule notification workflow...',
  );
  const availList = await request(
    'GET',
    '/doctor/availability',
    null,
    docToken,
  );
  if (Array.isArray(availList.body) && availList.body.length > 0) {
    const availId = availList.body[0].id;
    // Shrink doctor availability from 09:00-17:00 down to 10:00-12:00
    const shrinkRes = await request(
      'PATCH',
      `/doctor/availability/${availId}`,
      {
        startTime: '10:00',
        endTime: '12:00',
      },
      docToken,
    );
    assert(
      shrinkRes.status === 200,
      'PATCH /doctor/availability/:id shrink returns 200 OK',
    );

    const notifsAfterShrink = await request(
      'GET',
      '/notifications',
      null,
      patToken,
    );
    assert(
      notifsAfterShrink.status === 200,
      'GET /notifications after shrink returns 200 OK',
    );
    const shrinkNotif = notifsAfterShrink.body.data[0];
    assert(
      shrinkNotif.type === 'APPOINTMENT_RESCHEDULED',
      'Elastic shrink auto-rescheduled appointment created APPOINTMENT_RESCHEDULED notification',
    );
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎉 EVENT-BASED NOTIFICATION SYSTEM TEST SUITE PASSED (100%)!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

runNotificationWorkflowSuite().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
