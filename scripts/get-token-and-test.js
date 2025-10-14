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
    const loginUrl = process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/$/,'')}/api/auth/login` : 'http://localhost:5000/api/auth/login';
    console.log('Logging in to', loginUrl);
    const loginResp = await postJson(loginUrl, { identifier: 'user@example.com', password: 'password123' });
    console.log('Login status:', loginResp.status);
    console.log('Login body:', loginResp.body);

    if (loginResp.status !== 200) {
      console.error('Login failed, aborting booking test.');
      process.exit(1);
    }

    const token = JSON.parse(loginResp.body).data.token;
    console.log('Got token:', token.slice(0,20) + '...');

    // Run booking test
    const bookingUrl = process.env.BACKEND_URL || 'http://localhost:5000/api/bookings';
    console.log('Posting booking to', bookingUrl);
    const bookingResp = await (async () => {
      const url = new URL(bookingUrl);
      const client = url.protocol === 'https:' ? https : http;
      const payload = JSON.stringify({ fieldId: 99, startTime: '2025-10-16T10:00:00', endTime: '2025-10-16T10:30:00', deposit: 0 });
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${token}`
        }
      };
      return new Promise((resolve, reject) => {
        const req = client.request(options, (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    })();

    console.log('Booking status:', bookingResp.status);
    console.log('Booking body:', bookingResp.body);

  } catch (err) {
    console.error('Error during test:', err);
    process.exit(1);
  }
})();