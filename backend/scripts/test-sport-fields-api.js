/**
 * Script to test Sport Fields API endpoints
 * Usage: node scripts/test-sport-fields-api.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testGetAllSportFields() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TEST 1: GET /api/sport-fields - Get all sport fields');
  console.log('='.repeat(70));
  
  try {
    const response = await makeRequest('/api/sport-fields');
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Success: ${response.data.success ? '✅' : '❌'}`);
    console.log(`Message: ${response.data.message}`);
    
    if (response.data.data && Array.isArray(response.data.data)) {
      console.log(`\n📊 Total fields: ${response.data.data.length}`);
      
      console.log('\n📋 Fields list:');
      response.data.data.slice(0, 10).forEach((field, index) => {
        console.log(`\n${index + 1}. ${field.FieldName}`);
        console.log(`   ID: ${field.FieldID}`);
        console.log(`   Type: ${field.FieldType}`);
        console.log(`   Price: ${field.RentalPrice?.toLocaleString('vi-VN')}đ/hour`);
        console.log(`   Status: ${field.Status}`);
        console.log(`   Facility: ${field.FacilityName || 'N/A'}`);
        console.log(`   Sport: ${field.SportTypeName || 'N/A'}`);
      });
      
      if (response.data.data.length > 10) {
        console.log(`\n... and ${response.data.data.length - 10} more fields`);
      }
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

async function testGetSportFieldById(fieldId) {
  console.log('\n' + '='.repeat(70));
  console.log(`🧪 TEST 2: GET /api/sport-fields/${fieldId} - Get field by ID`);
  console.log('='.repeat(70));
  
  try {
    const response = await makeRequest(`/api/sport-fields/${fieldId}`);
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Success: ${response.data.success ? '✅' : '❌'}`);
    console.log(`Message: ${response.data.message}`);
    
    if (response.data.data) {
      const field = response.data.data;
      console.log('\n📋 Field details:');
      console.log(`   Name: ${field.FieldName}`);
      console.log(`   Type: ${field.FieldType}`);
      console.log(`   Price: ${field.RentalPrice?.toLocaleString('vi-VN')}đ/hour`);
      console.log(`   Status: ${field.Status}`);
      console.log(`   Facility: ${field.FacilityName || 'N/A'}`);
      console.log(`   Sport: ${field.SportTypeName || 'N/A'}`);
      console.log(`   Address: ${field.Address || 'N/A'}`);
      console.log(`   Contact: ${field.ContactPhone || 'N/A'}`);
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

async function testSearchSportFields(sportTypeId, areaId) {
  console.log('\n' + '='.repeat(70));
  console.log(`🧪 TEST 3: GET /api/sport-fields/search?sportTypeId=${sportTypeId}&areaId=${areaId}`);
  console.log('='.repeat(70));
  
  try {
    const response = await makeRequest(`/api/sport-fields/search?sportTypeId=${sportTypeId}&areaId=${areaId}`);
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Success: ${response.data.success ? '✅' : '❌'}`);
    console.log(`Message: ${response.data.message}`);
    
    if (response.data.data && Array.isArray(response.data.data)) {
      console.log(`\n📊 Found: ${response.data.data.length} fields`);
      
      response.data.data.forEach((field, index) => {
        console.log(`\n${index + 1}. ${field.FieldName}`);
        console.log(`   Type: ${field.FieldType} | Price: ${field.RentalPrice?.toLocaleString('vi-VN')}đ`);
      });
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

async function testGetFieldAvailability(fieldId, date) {
  console.log('\n' + '='.repeat(70));
  console.log(`🧪 TEST 4: GET /api/sport-fields/${fieldId}/availability?date=${date}`);
  console.log('='.repeat(70));
  
  try {
    const response = await makeRequest(`/api/sport-fields/${fieldId}/availability?date=${date}`);
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Success: ${response.data.success ? '✅' : '❌'}`);
    console.log(`Message: ${response.data.message}`);
    
    if (response.data.data) {
      const { field, availability } = response.data.data;
      
      console.log('\n📋 Field info:');
      console.log(`   Name: ${field?.FieldName}`);
      console.log(`   Price: ${field?.RentalPrice?.toLocaleString('vi-VN')}đ/hour`);
      
      if (availability && Array.isArray(availability)) {
        console.log(`\n⏰ Availability for ${date}:`);
        console.log(`   Total slots: ${availability.length}`);
        
        const available = availability.filter(slot => slot.isAvailable);
        const booked = availability.filter(slot => !slot.isAvailable);
        
        console.log(`   ✅ Available: ${available.length} slots`);
        console.log(`   ❌ Booked: ${booked.length} slots`);
        
        if (available.length > 0) {
          console.log('\n   Available time slots:');
          available.slice(0, 5).forEach(slot => {
            console.log(`   - ${slot.startTime} - ${slot.endTime}`);
          });
          if (available.length > 5) {
            console.log(`   ... and ${available.length - 5} more slots`);
          }
        }
      }
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n');
  console.log('🚀 SPORT FIELDS API TESTING');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toLocaleString('vi-VN')}`);
  
  let passedTests = 0;
  let failedTests = 0;
  
  try {
    // Test 1: Get all sport fields
    await testGetAllSportFields();
    passedTests++;
    
    // Test 2: Get specific field by ID
    await testGetSportFieldById(1);
    passedTests++;
    
    // Test 3: Search fields
    await testSearchSportFields(1, 1); // sportTypeId=1 (Soccer), areaId=1
    passedTests++;
    
    // Test 4: Get field availability
    const today = new Date().toISOString().split('T')[0];
    await testGetFieldAvailability(1, today);
    passedTests++;
    
  } catch (error) {
    failedTests++;
    console.error('\n❌ Test suite failed:', error.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${passedTests} tests`);
  console.log(`❌ Failed: ${failedTests} tests`);
  console.log(`📈 Total: ${passedTests + failedTests} tests`);
  console.log('='.repeat(70));
  
  if (failedTests === 0) {
    console.log('\n✅ All tests passed successfully!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above.');
  }
}

// Check if server is running
async function checkServerHealth() {
  try {
    console.log('🔍 Checking if backend server is running...');
    const response = await makeRequest('/api/health');
    console.log('✅ Server is running!\n');
    return true;
  } catch (error) {
    console.error('❌ Cannot connect to server!');
    console.error('Please make sure backend server is running on port 5000');
    console.error('Run: cd backend && npm run dev\n');
    return false;
  }
}

// Main execution
(async () => {
  const isServerRunning = await checkServerHealth();
  
  if (!isServerRunning) {
    process.exit(1);
  }
  
  await runAllTests();
  
  console.log('\n✅ Testing completed\n');
})();
