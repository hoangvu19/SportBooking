/**
 * Test Frontend API Call
 * Simulates what the frontend does when calling the API
 */

const http = require('http');

console.log('🧪 Testing Frontend API Call Simulation\n');
console.log('================================================\n');

// Test 1: Direct backend call
console.log('📡 Test 1: Direct Backend API (port 5000)');
const backendOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/sport-fields',
  method: 'GET'
};

const backendReq = http.request(backendOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Success: ${jsonData.success ? '✅' : '❌'}`);
      console.log(`   Fields: ${jsonData.data?.length || 0}\n`);
      
      if (jsonData.data && jsonData.data.length > 0) {
        const field = jsonData.data[0];
        console.log('   ✅ Sample field:');
        console.log(`      - SanID: ${field.SanID}`);
        console.log(`      - TenSan: ${field.TenSan}`);
        console.log(`      - MonTheThao: ${field.MonTheThao}`);
        console.log(`      - KhuVuc: ${field.KhuVuc}\n`);
      }
      
      // Test 2: Through Vite proxy (if frontend is running)
      console.log('📡 Test 2: Through Vite Proxy (port 5175)');
      const proxyOptions = {
        hostname: 'localhost',
        port: 5175,
        path: '/api/sport-fields',
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };
      
      const proxyReq = http.request(proxyOptions, (proxyRes) => {
        let proxyData = '';
        proxyRes.on('data', (chunk) => { proxyData += chunk; });
        proxyRes.on('end', () => {
          try {
            const proxyJsonData = JSON.parse(proxyData);
            console.log(`   Status: ${proxyRes.statusCode}`);
            console.log(`   Success: ${proxyJsonData.success ? '✅' : '❌'}`);
            console.log(`   Fields: ${proxyJsonData.data?.length || 0}\n`);
            
            if (proxyJsonData.data && proxyJsonData.data.length > 0) {
              console.log('   ✅ Proxy is working!\n');
            }
            
            console.log('================================================');
            console.log('📊 RESULT:\n');
            
            if (jsonData.data?.length > 0 && proxyJsonData.data?.length > 0) {
              console.log('✅ Backend API: Working');
              console.log('✅ Vite Proxy: Working');
              console.log('✅ Data mapping: Correct');
              console.log('\n💡 Frontend should now display sport fields!');
              console.log('   Go to: http://localhost:5175/sanlist');
              console.log('   If still not showing:');
              console.log('   1. Open browser console (F12)');
              console.log('   2. Check for any JavaScript errors');
              console.log('   3. Check Network tab for failed requests');
            } else if (jsonData.data?.length > 0) {
              console.log('✅ Backend API: Working');
              console.log('❌ Vite Proxy: NOT working');
              console.log('\n💡 Solutions:');
              console.log('   1. Restart Vite dev server');
              console.log('   2. Check vite.config.js proxy settings');
            } else {
              console.log('❌ Backend API: NOT working');
              console.log('❌ No data to display');
            }
            
          } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            console.log('   💡 Vite proxy might not be configured correctly');
          }
        });
      });
      
      proxyReq.on('error', (error) => {
        console.log(`   ❌ Proxy connection failed: ${error.message}`);
        console.log('   💡 Make sure frontend is running on port 5175');
      });
      
      proxyReq.end();
      
    } catch (error) {
      console.error('❌ Backend error:', error.message);
    }
  });
});

backendReq.on('error', (error) => {
  console.error('❌ Backend connection failed:', error.message);
  console.log('💡 Make sure backend server is running on port 5000');
});

backendReq.end();
