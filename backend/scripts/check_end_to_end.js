/*
  check_end_to_end.js
  - Checks if vw_BookingPosts exists in the database the backend connects to.
  - Optionally posts a small test booking-post to the local API to verify creation flow.

  Usage:
    # Check only the view
    node scripts/check_end_to_end.js

    # Check view and POST a test booking post (require a valid BookingID and bearer token)
    API_BASE=http://localhost:5000 DB_CHECK_ONLY=0 TEST_BOOKING_ID=123 TOKEN=Bearer_xxx node scripts/check_end_to_end.js

  The script reads DB connection from backend/config/db.js by requiring it (it will use same poolPromise config).
*/

const path = require('path');
const { poolPromise } = require('../config/db');
const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const DB_CHECK_ONLY = (process.env.DB_CHECK_ONLY || '1') === '1';
const TEST_BOOKING_ID = process.env.TEST_BOOKING_ID || null;
const TOKEN = process.env.TOKEN || null; // bearer token

async function checkView() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT OBJECT_ID('dbo.vw_BookingPosts','V') AS ObjID");
    const id = result.recordset && result.recordset[0] && result.recordset[0].ObjID;
    if (id) {
      console.log('✅ Optional view vw_BookingPosts exists (OBJECT_ID=', id, ')');
      return true;
    }
    console.log('ℹ️ Optional view vw_BookingPosts does NOT exist in the connected database. This is OK — the application uses join-based queries and does not require the view.');
    return false;
  } catch (err) {
    console.error('❌ Error checking view (informational):', err && err.message ? err.message : err);
    return false;
  }
}

async function postTestBooking() {
  if (!TEST_BOOKING_ID) {
    console.log('No TEST_BOOKING_ID provided, skipping test POST.');
    return null;
  }

  if (!TOKEN) {
    console.warn('No TOKEN provided; POST will likely be unauthorized. Provide TOKEN env var.');
  }

  const url = `${API_BASE}/api/booking-posts`;
  const form = new (require('form-data'))();
  form.append('bookingId', TEST_BOOKING_ID);
  form.append('content', 'Test booking post from check_end_to_end script');
  form.append('maxPlayers', '8');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
      body: form
    });

    const data = await res.json().catch(() => null);
    console.log('POST status:', res.status);
    console.log('Response:', data);
    return { status: res.status, data };
  } catch (err) {
    console.error('Error posting test booking:', err && err.message ? err.message : err);
    return null;
  }
}

(async () => {
  console.log('Starting end-to-end checks...');
  const viewOk = await checkView();
  if (!DB_CHECK_ONLY) {
    console.log('\nAttempting test POST to /api/booking-posts (may require valid token and existing booking)');
    const postRes = await postTestBooking();
    if (postRes) {
      if (postRes.status === 201) console.log('✅ Test booking post created');
      else console.log('⚠️ Test booking post did not create (status ' + postRes.status + ')');
    }
  }
  process.exit(0);
})();
