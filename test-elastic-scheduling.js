const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : '';

    const headers = {
      'Content-Type': 'application/json',
    };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: headers,
    };

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

function getNextWeekdayDate(targetWeekdayName) {
  const weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const targetDayIndex = weekdays.indexOf(targetWeekdayName);
  const today = new Date();
  const currentDayIndex = today.getUTCDay();

  let daysUntil = targetDayIndex - currentDayIndex;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }

  const result = new Date(today);
  result.setUTCDate(today.getUTCDate() + daysUntil);
  return result.toISOString().split('T')[0];
}

async function runElasticSchedulingSuite() {
  console.log(
    '🚀 Starting Day 13 Elastic Scheduling Integration Test Suite...',
  );
  let passed = 0;
  let total = 0;

  function assert(condition, message, errorPayload = null) {
    total++;
    if (condition) {
      console.log(`  ✅ Scenario ${total}: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ Scenario ${total} FAILED: ${message}`);
      if (errorPayload) {
        console.error(`     Error Details:`, JSON.stringify(errorPayload));
      }
    }
  }

  try {
    const timeSuffix = Date.now().toString().slice(-6);
    const docEmail = `elastic_doc_${timeSuffix}@example.com`;
    const patEmail = `elastic_pat_${timeSuffix}@example.com`;

    // 1. Signup Doctor
    const docSignup = await request('POST', '/auth/signup', {
      email: docEmail,
      password: 'Password123!',
      name: 'Dr. Elastic Shrink',
      role: 'DOCTOR',
    });
    assert(
      docSignup.status === 201,
      'Doctor signup returns 201 Created',
      docSignup.body,
    );

    const docLogin = await request('POST', '/auth/login', {
      email: docEmail,
      password: 'Password123!',
    });
    const docToken = docLogin.body.access_token || docSignup.body.token;

    // 2. Signup Patient
    const patSignup = await request('POST', '/auth/signup', {
      email: patEmail,
      password: 'Password123!',
      name: 'Patient Elastic Test',
      role: 'PATIENT',
    });
    assert(
      patSignup.status === 201,
      'Patient signup returns 201 Created',
      patSignup.body,
    );

    const patLogin = await request('POST', '/auth/login', {
      email: patEmail,
      password: 'Password123!',
    });
    const patToken = patLogin.body.access_token || patSignup.body.token;

    // 3. Doctor Profile
    const docProf = await request(
      'POST',
      '/doctor/profile',
      {
        fullName: 'Dr. Elastic Shrink',
        specialization: 'Elasticity & Concurrency',
        experience: 10,
        qualification: 'MD Gynaecology',
        consultationFee: 500,
        availability: 'Mon-Fri 9AM-5PM',
        profileDetails:
          'Senior Specialist in Elastic Scheduling Engine Architecture',
      },
      docToken,
    );
    assert(docProf.status === 201, 'Doctor profile created', docProf.body);
    const doctorId = docProf.body.id || docProf.body.doctorId;

    // 4. Patient Profile
    const patProf = await request(
      'POST',
      '/patient/profile',
      {
        fullName: 'Patient Elastic Test',
        age: 30,
        gender: 'Female',
        contactDetails: '+15559998888',
      },
      patToken,
    );
    assert(patProf.status === 201, 'Patient profile created', patProf.body);

    // 5. Configure STREAM strategy
    const configStream = await request(
      'POST',
      `/doctors/${doctorId}/scheduling`,
      {
        schedulingType: 'STREAM',
        slotDuration: 15,
        bufferTime: 5,
      },
      docToken,
    );
    assert(
      configStream.status === 201 || configStream.status === 200,
      'STREAM strategy configured (15m slot, 5m buffer)',
      configStream.body,
    );

    // 6. Create Initial Recurring Availability (Monday 09:00 - 17:00)
    const availCreate = await request(
      'POST',
      '/doctor/availability',
      {
        weekday: 'Monday',
        startTime: '09:00',
        endTime: '17:00',
      },
      docToken,
    );
    assert(
      availCreate.status === 201,
      'Created initial Monday availability 09:00-17:00',
      availCreate.body,
    );
    const availId = availCreate.body.id;

    const nextMondayStr = getNextWeekdayDate('Monday');

    // Fetch generated slots first to verify valid slot time
    const availCheckBeforeBook = await request(
      'GET',
      `/doctors/${doctorId}/availability?date=${nextMondayStr}`,
      null,
      patToken,
    );
    const firstFreeSlot = Array.isArray(availCheckBeforeBook.body)
      ? availCheckBeforeBook.body.find((s) => s.available === true)
      : null;
    const targetSlot = firstFreeSlot
      ? { startTime: firstFreeSlot.startTime, endTime: firstFreeSlot.endTime }
      : { startTime: '09:00', endTime: '09:15' };

    // 7. Book appointment on STREAM slot
    const bookApp = await request(
      'POST',
      '/appointment',
      {
        doctorId,
        scheduleType: 'STREAM',
        date: nextMondayStr,
        slot: targetSlot,
      },
      patToken,
    );
    assert(
      bookApp.status === 201,
      `Booked STREAM appointment on ${nextMondayStr} (${targetSlot.startTime}-${targetSlot.endTime})`,
      bookApp.body,
    );
    const appointmentId = bookApp.body.id || bookApp.body.appointmentId;

    // 8. Test Expand Availability (Modify hours to 08:00 - 18:00)
    const expandAvail = await request(
      'PATCH',
      `/doctor/availability/${availId}`,
      {
        weekday: 'Monday',
        startTime: '08:00',
        endTime: '18:00',
      },
      docToken,
    );
    assert(
      expandAvail.status === 200,
      'Expanded Monday availability to 08:00-18:00',
      expandAvail.body,
    );

    // Verify early morning slot (08:00-08:15) is now bookable
    const checkExpandAvail = await request(
      'GET',
      `/doctors/${doctorId}/availability?date=${nextMondayStr}`,
      null,
      patToken,
    );
    const hasEarlySlot =
      Array.isArray(checkExpandAvail.body) &&
      checkExpandAvail.body.some(
        (s) => s.startTime === '08:00' && s.available === true,
      );
    assert(
      hasEarlySlot,
      'Newly expanded morning slot 08:00-08:15 is immediately bookable',
      checkExpandAvail.body,
    );

    // 9. Test Shrink Availability (Shrink hours down to 10:00 - 12:00 so 09:00 slot is cut off)
    const shrinkAvail = await request(
      'PATCH',
      `/doctor/availability/${availId}`,
      {
        weekday: 'Monday',
        startTime: '10:00',
        endTime: '12:00',
      },
      docToken,
    );
    assert(
      shrinkAvail.status === 200,
      'Shrunk Monday availability down to 10:00-12:00',
      shrinkAvail.body,
    );
    assert(
      shrinkAvail.body.autoRescheduledAppointmentsCount >= 1,
      'Detected and auto-rescheduled affected 09:00 appointment',
      shrinkAvail.body,
    );

    // 10. Verify Auto-Rescheduled Appointment Audit Metadata
    const checkApp = await request(
      'GET',
      `/appointment/my-appointments`,
      null,
      patToken,
    );
    const updatedApp =
      Array.isArray(checkApp.body) &&
      checkApp.body.find(
        (a) => a.id === appointmentId || a.appointmentId === appointmentId,
      );
    assert(
      updatedApp !== undefined,
      'Retrieved patient appointments',
      checkApp.body,
    );
    assert(
      updatedApp && updatedApp.date !== undefined,
      'Auto-rescheduled appointment has valid target date',
      updatedApp,
    );

    // 11. Test WAVE Strategy Elastic Shrink & Auto-Reschedule
    const configWave = await request(
      'POST',
      `/doctors/${doctorId}/scheduling`,
      {
        schedulingType: 'WAVE',
        maxCapacity: 2,
      },
      docToken,
    );
    assert(
      configWave.status === 201 || configWave.status === 200,
      'Switched doctor to WAVE strategy (maxCapacity: 2)',
      configWave.body,
    );

    // Create secondary availability slot (Tuesday 14:00 - 16:00)
    const waveAvailCreate = await request(
      'POST',
      '/doctor/availability',
      {
        weekday: 'Tuesday',
        startTime: '14:00',
        endTime: '16:00',
      },
      docToken,
    );
    assert(
      waveAvailCreate.status === 201,
      'Created Tuesday WAVE window 14:00-16:00',
      waveAvailCreate.body,
    );
    const waveAvailId = waveAvailCreate.body.id;

    const nextTuesdayStr = getNextWeekdayDate('Tuesday');

    // Book WAVE token appointment
    const bookWave = await request(
      'POST',
      '/appointment',
      {
        doctorId,
        scheduleType: 'WAVE',
        date: nextTuesdayStr,
        window: '14:00-16:00',
      },
      patToken,
    );
    assert(
      bookWave.status === 201,
      `Booked WAVE token appointment on ${nextTuesdayStr} (window 14:00-16:00)`,
      bookWave.body,
    );

    // Delete Tuesday availability (Shrink to 0 window)
    const deleteWaveAvail = await request(
      'DELETE',
      `/doctor/availability/${waveAvailId}`,
      null,
      docToken,
    );
    assert(
      deleteWaveAvail.status === 200,
      'Deleted Tuesday WAVE availability window',
      deleteWaveAvail.body,
    );
    assert(
      deleteWaveAvail.body.autoRescheduledAppointmentsCount >= 1,
      'Auto-rescheduled affected WAVE token appointment',
      deleteWaveAvail.body,
    );

    console.log(
      `\n🎉 Day 13 Elastic Scheduling Test Suite Complete: ${passed}/${total} Scenarios PASSED!`,
    );
  } catch (err) {
    console.error('❌ Unexpected Error during test execution:', err);
  }
}

runElasticSchedulingSuite();
