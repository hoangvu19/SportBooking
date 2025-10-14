const http = require('http');
const https = require('https');
const { URL } = require('url');

const urlStr = process.env.BACKEND_URL || 'http://localhost:5000/api/bookings';
const token = process.env.TEST_TOKEN || '';

const payload = JSON.stringify({
  fieldId: parseInt(process.env.TEST_FIELD_ID || '99', 10),
  startTime: process.env.TEST_START || '2025-10-16T10:00:00',
  endTime: process.env.TEST_END || '2025-10-16T10:30:00',
  deposit: 0
});

console.log('Posting to', urlStr);
console.log('Payload:', payload);

const url = new URL(urlStr);
const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
};

const client = url.protocol === 'https:' ? https : http;

const req = client.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response body:', data);
  });
});

req.on('error', (err) => {
  console.error('Request failed:', err);
  process.exit(1);
});

req.write(payload);
req.end();