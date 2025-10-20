const API_BASE = 'http://localhost:5000/api';

async function testAPI(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}${endpoint}`;
  console.log(`\n📡 Testing: ${method} ${endpoint}`);
  
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ SUCCESS (${response.status})`);
      console.log('Response:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
      return { success: true, data };
    } else {
      console.log(`❌ FAILED (${response.status})`);
      console.log('Error:', data.message || data);
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  console.log('=' .repeat(60));
  
  // Test Facilities API
  console.log('\n📦 FACILITIES API');
  console.log('=' .repeat(60));
  await testAPI('/facilities');
  await testAPI('/facilities/1');
  
  // Test Bookings API (needs auth)
  console.log('\n📅 BOOKINGS API');
  console.log('=' .repeat(60));
  console.log('⚠️  Skipping - Requires authentication');
  
  // Test Livestreams API
  console.log('\n📺 LIVESTREAMS API');
  console.log('=' .repeat(60));
  await testAPI('/livestreams/active');
  
  // Test Sport Fields API
  console.log('\n⚽ SPORT FIELDS API');
  console.log('=' .repeat(60));
  await testAPI('/sport-fields');
  
  // Test Sport Types API
  console.log('\n🏃 SPORT TYPES API');
  console.log('=' .repeat(60));
  await testAPI('/sport-types');
  
  // Test Areas API
  console.log('\n📍 AREAS API');
  console.log('=' .repeat(60));
  await testAPI('/areas');
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ API Tests Completed!');
  console.log('=' .repeat(60) + '\n');
}

// Run tests
runTests().catch(console.error);
