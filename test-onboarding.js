async function runTests() {
  const baseUrl = 'http://localhost:3000';
  const timestamp = Date.now();
  const docEmail = `doctor_onboard_${timestamp}@test.com`;
  const patEmail = `patient_onboard_${timestamp}@test.com`;

  let doctorToken = '';
  let patientToken = '';

  try {
    console.log('--- Step 1: Sign up and Login Doctor ---');
    await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Lavangi',
        email: docEmail,
        password: 'password123',
        role: 'DOCTOR'
      })
    });
    const loginDoc = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: docEmail, password: 'password123' })
    });
    const loginDocJson = await loginDoc.json();
    doctorToken = loginDocJson.access_token;
    console.log('Doctor token generated.');

    console.log('\n--- Step 2: Sign up and Login Patient ---');
    await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Meena',
        email: patEmail,
        password: 'password123',
        role: 'PATIENT'
      })
    });
    const loginPat = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: patEmail, password: 'password123' })
    });
    const loginPatJson = await loginPat.json();
    patientToken = loginPatJson.access_token;
    console.log('Patient token generated.');

    // Test 1: Retrieve unprofiled Doctor (Expected 404)
    console.log('\n--- Test 1: GET Doctor Profile before creation (Expected 404) ---');
    const resGetUnprofiledDoc = await fetch(`${baseUrl}/doctor/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    console.log('Status:', resGetUnprofiledDoc.status);
    console.log('Response:', await resGetUnprofiledDoc.json());

    // Test 2: Retrieve unprofiled Patient (Expected 404)
    console.log('\n--- Test 2: GET Patient Profile before creation (Expected 404) ---');
    const resGetUnprofiledPat = await fetch(`${baseUrl}/patient/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    console.log('Status:', resGetUnprofiledPat.status);
    console.log('Response:', await resGetUnprofiledPat.json());

    // Test 3: POST Doctor Profile (Expected 201)
    console.log('\n--- Test 3: POST Doctor Profile (Expected 201) ---');
    const resPostDoc = await fetch(`${baseUrl}/doctor/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      },
      body: JSON.stringify({
        fullName: 'Dr. Lavangi Kumar',
        specialization: 'Gynaecologist',
        experience: 15,
        qualification: 'Gold Medalist, MD',
        consultationFee: 500,
        availability: 'Monday to Friday (10 AM to 1 PM)',
        profileDetails: 'Senior gynecological consultant with 15 years experience.'
      })
    });
    console.log('Status:', resPostDoc.status);
    console.log('Response:', await resPostDoc.json());

    // Test 4: POST Patient Profile (Expected 201)
    console.log('\n--- Test 4: POST Patient Profile (Expected 201) ---');
    const resPostPat = await fetch(`${baseUrl}/patient/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${patientToken}`
      },
      body: JSON.stringify({
        fullName: 'Meena Muthukumar',
        age: 28,
        gender: 'Female',
        contactDetails: '+91-9876543210',
        basicHealthInformation: 'No prior clinical allergies.'
      })
    });
    console.log('Status:', resPostPat.status);
    console.log('Response:', await resPostPat.json());

    // Test 5: Duplicate Doctor Profile Creation (Expected 409)
    console.log('\n--- Test 5: Duplicate POST Doctor Profile (Expected 409) ---');
    const resPostDocDup = await fetch(`${baseUrl}/doctor/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      },
      body: JSON.stringify({
        fullName: 'Dr. Lavangi Kumar Duplicate',
        specialization: 'Gynaecologist',
        experience: 15,
        qualification: 'Gold Medalist, MD',
        consultationFee: 500,
        availability: 'Monday to Friday (10 AM to 1 PM)',
        profileDetails: 'Duplicate data payload.'
      })
    });
    console.log('Status:', resPostDocDup.status);
    console.log('Response:', await resPostDocDup.json());

    // Test 6: GET Doctor Profile (Expected 200)
    console.log('\n--- Test 6: GET Doctor Profile (Expected 200) ---');
    const resGetDoc = await fetch(`${baseUrl}/doctor/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    console.log('Status:', resGetDoc.status);
    console.log('Response:', await resGetDoc.json());

    // Test 7: GET Patient Profile (Expected 200)
    console.log('\n--- Test 7: GET Patient Profile (Expected 200) ---');
    const resGetPat = await fetch(`${baseUrl}/patient/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    console.log('Status:', resGetPat.status);
    console.log('Response:', await resGetPat.json());

    // Test 8: PATCH Doctor Profile (Expected 200)
    console.log('\n--- Test 8: PATCH Doctor Profile (Expected 200) ---');
    const resPatchDoc = await fetch(`${baseUrl}/doctor/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      },
      body: JSON.stringify({
        consultationFee: 600,
        availability: 'Mon-Fri 10AM-1PM, Sat 2PM-5PM'
      })
    });
    console.log('Status:', resPatchDoc.status);
    console.log('Response:', await resPatchDoc.json());

    // Test 9: PATCH Patient Profile (Expected 200)
    console.log('\n--- Test 9: PATCH Patient Profile (Expected 200) ---');
    const resPatchPat = await fetch(`${baseUrl}/patient/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${patientToken}`
      },
      body: JSON.stringify({
        age: 29,
        basicHealthInformation: 'Allergy history: Penicillin sensitive.'
      })
    });
    console.log('Status:', resPatchPat.status);
    console.log('Response:', await resPatchPat.json());

    // Test 10: Doctor accessing Patient Profile (Expected 403)
    console.log('\n--- Test 10: Doctor accessing Patient Endpoint (Expected 403) ---');
    const resDocAccessPat = await fetch(`${baseUrl}/patient/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    console.log('Status:', resDocAccessPat.status);
    console.log('Response:', await resDocAccessPat.json());

    // Test 11: Patient accessing Doctor Profile (Expected 403)
    console.log('\n--- Test 11: Patient accessing Doctor Endpoint (Expected 403) ---');
    const resPatAccessDoc = await fetch(`${baseUrl}/doctor/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    console.log('Status:', resPatAccessDoc.status);
    console.log('Response:', await resPatAccessDoc.json());

  } catch (e) {
    console.error('Testing encountered error:', e);
  }
}

runTests();
