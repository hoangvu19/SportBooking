const http = require('http');
const https = require('https');
const { URL } = require('url');

async function postJson(urlStr, body) {
  const url = new URL(urlStr);
  const client = url.protocol === 'https:' ? https : http;

  const payload = JSON.stringify(body);

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  try {
    const base = process.env.BACKEND_URL ? process.env.BACKEND_URL.replace(/\/$/, '') : 'http://localhost:5000';
    const registerUrl = `${base}/api/auth/register`;
    const loginUrl = `${base}/api/auth/login`;
    const bookingUrl = `${base}/api/bookings`;

    const creds = {
      username: process.env.TEST_USERNAME || 'autotestuser',
      password: process.env.TEST_PASSWORD || 'password123',
      fullName: 'Auto Test',
      email: process.env.TEST_EMAIL || 'autotest@example.com'
    };

    console.log('Registering (may fail if exists):', creds.username, creds.email);
    const reg = await postJson(registerUrl, { username: creds.username, password: creds.password, fullName: creds.fullName, email: creds.email });
    console.log('Register status:', reg.status);
    console.log('Register body:', reg.body);

    if (reg.status !== 201 && reg.status !== 200) {
      console.log('Register likely exists or failed, attempting to login anyway...');
    }

    console.log('Logging in...');
    const login = await postJson(loginUrl, { identifier: creds.email, password: creds.password });
    console.log('Login status:', login.status);
    console.log('Login body:', login.body);
    if (login.status !== 200) {
      console.error('Login failed, aborting.');
      process.exit(1);
    }

    const data = JSON.parse(login.body).data;
    const token = data.token;
    console.log('Token acquired (first 20 chars):', token.slice(0,20)+'...');

    console.log('Posting booking to', bookingUrl);
    const bookingPayload = { fieldId: parseInt(process.env.TEST_FIELD_ID || '99', 10), startTime: process.env.TEST_START || '2025-10-16T10:00:00', endTime: process.env.TEST_END || '2025-10-16T10:30:00', deposit: 0 };
    console.log('Booking payload:', bookingPayload);

    const url = new URL(bookingUrl);
    const client = url.protocol === 'https:' ? https : http;
    const payloadStr = JSON.stringify(bookingPayload);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr),
        'Authorization': `Bearer ${token}`
      }
    };

    const bookingResp = await new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(payloadStr);
      req.end();
    });

    console.log('Booking status:', bookingResp.status);
    console.log('Booking body:', bookingResp.body);

  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
})();