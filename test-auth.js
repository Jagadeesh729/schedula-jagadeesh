async function runTests() {
  const baseUrl = 'http://localhost:3000';
  let doctorToken = '';
  let patientToken = '';

  const docEmail = `doctor_${Date.now()}@test.com`;
  const patEmail = `patient_${Date.now()}@test.com`;

  try {
    // Test 1: Signup Doctor
    console.log('\n--- Test 1: Signup Doctor ---');
    const resSignupDoc = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Lavangi',
        email: docEmail,
        password: 'password123',
        role: 'DOCTOR'
      })
    });
    console.log('Status:', resSignupDoc.status);
    const signupDocJson = await resSignupDoc.json();
    console.log('Response:', signupDocJson);

    // Test 2: Signup Patient
    console.log('\n--- Test 2: Signup Patient ---');
    const resSignupPat = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Meena',
        email: patEmail,
        password: 'password123',
        role: 'PATIENT'
      })
    });
    console.log('Status:', resSignupPat.status);
    const signupPatJson = await resSignupPat.json();
    console.log('Response:', signupPatJson);

    // Test 3: Duplicate Email Check
    console.log('\n--- Test 3: Duplicate Email Signup (Should Fail) ---');
    const resSignupDup = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Duplicate',
        email: docEmail,
        password: 'password123',
        role: 'DOCTOR'
      })
    });
    console.log('Status:', resSignupDup.status);
    console.log('Response:', await resSignupDup.json());

    // Test 4: Login Doctor
    console.log('\n--- Test 4: Login Doctor ---');
    const resLoginDoc = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: docEmail,
        password: 'password123'
      })
    });
    console.log('Status:', resLoginDoc.status);
    const loginDocJson = await resLoginDoc.json();
    console.log('Response:', loginDocJson);
    doctorToken = loginDocJson.access_token;

    // Test 5: Login Patient
    console.log('\n--- Test 5: Login Patient ---');
    const resLoginPat = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: patEmail,
        password: 'password123'
      })
    });
    console.log('Status:', resLoginPat.status);
    const loginPatJson = await resLoginPat.json();
    console.log('Response:', loginPatJson);
    patientToken = loginPatJson.access_token;

    // Test 6: Doctor accesses Doctor Profile (Success)
    console.log('\n--- Test 6: Doctor Accesses Doctor Profile ---');
    const resDocProfile = await fetch(`${baseUrl}/doctor/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${doctorToken}`
      }
    });
    console.log('Status:', resDocProfile.status);
    console.log('Response:', await resDocProfile.json());

    // Test 7: Patient accesses Patient Profile (Success)
    console.log('\n--- Test 7: Patient Accesses Patient Profile ---');
    const resPatProfile = await fetch(`${baseUrl}/patient/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${patientToken}`
      }
    });
    console.log('Status:', resPatProfile.status);
    console.log('Response:', await resPatProfile.json());

    // Test 8: Doctor denied Patient Profile (Forbidden)
    console.log('\n--- Test 8: Doctor Denied Patient Profile ---');
    const resDocDenied = await fetch(`${baseUrl}/patient/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${doctorToken}`
      }
    });
    console.log('Status:', resDocDenied.status);
    console.log('Response:', await resDocDenied.json());

    // Test 9: Patient denied Doctor Profile (Forbidden)
    console.log('\n--- Test 9: Patient Denied Doctor Profile ---');
    const resPatDenied = await fetch(`${baseUrl}/doctor/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${patientToken}`
      }
    });
    console.log('Status:', resPatDenied.status);
    console.log('Response:', await resPatDenied.json());

    // Test 10: Unauthenticated access (Unauthorized)
    console.log('\n--- Test 10: Unauthenticated Access ---');
    const resUnauth = await fetch(`${baseUrl}/doctor/profile`, {
      method: 'GET'
    });
    console.log('Status:', resUnauth.status);
    console.log('Response:', await resUnauth.json());

  } catch (e) {
    console.error('Testing encountered error:', e);
  }
}

runTests();
