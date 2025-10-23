(async () => {
  const base = 'http://localhost:5000';
  const ts = Date.now();
  const username = `smoke_test_user_${ts}`;
  const password = 'TestPass123!';
  const email = `${username}@example.com`;
  const fullName = 'Smoke Test User';
  try {
    // Wait until server responds on /api/auth/test (timeout 10s)
    const pingUrl = `${base}/api/auth/test`;
    const start = Date.now();
    let ok = false;
    while (Date.now() - start < 10000) {
      try {
        const r = await fetch(pingUrl).catch(() => null);
        if (r && r.ok) { ok = true; break; }
      } catch (e) { /* ignore */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ok) {
      console.warn('Server did not respond to ping; proceeding anyway (may fail)');
    }
    console.log('Registering user...', username);
    let res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, fullName, email })
    });
    let data = await res.json().catch(() => null);
    console.log('Register response:', res.status, data);

    console.log('Logging in...');
    res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, password })
    });
    data = await res.json();
    console.log('Login response:', res.status, data);
    if (!data || !data.data || !data.data.token) {
      console.error('Login failed, cannot continue');
      process.exit(1);
    }
    const token = data.data.token;

    // Post a field comment
    const targetType = 'Field';
    const targetId = 100; // existing field used in logs earlier
    console.log('Posting a field comment...');
    res = await fetch(`${base}/api/field-comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ targetType, targetId, content: `Smoke test comment at ${ts}` })
    });
    const commentRes = await res.json().catch(() => null);
    console.log('Field comment response:', res.status, commentRes);

    // Set a rating
    console.log('Posting a rating...');
    res = await fetch(`${base}/api/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ targetType, targetId, rating: 4 })
    });
    const ratingRes = await res.json().catch(() => null);
    console.log('Rating response:', res.status, ratingRes);

    // Fetch comments for target
    console.log('Fetching comments for target...');
    res = await fetch(`${base}/api/field-comments/${targetType}/${targetId}`);
    const commentsList = await res.json().catch(() => null);
    console.log('Comments list response:', res.status, commentsList);

    // Fetch my rating
    console.log('Fetching my rating...');
    res = await fetch(`${base}/api/ratings/my-rating/${targetType}/${targetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const myRating = await res.json().catch(() => null);
    console.log('My rating response:', res.status, myRating);

    console.log('Smoke test completed.');
  } catch (e) {
    console.error('Smoke test error', e);
    process.exit(1);
  }
})();
