/**
 * Test script to verify FieldArea is returned in API responses
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testFieldAreaAPI() {
  try {
    console.log('🧪 Testing FieldArea in API responses...\n');
    
    // Test 1: Get all sport fields
    console.log('📋 Test 1: GET /api/sport-fields');
    console.log('─'.repeat(60));
    
    const allFieldsResponse = await axios.get(`${API_BASE}/sport-fields`);
    
    if (allFieldsResponse.data.success) {
      const fields = allFieldsResponse.data.data;
      console.log(`✅ Found ${fields.length} sport fields\n`);
      
      // Check first 5 fields for FieldArea
      console.log('Checking FieldArea in first 5 fields:');
      fields.slice(0, 5).forEach(field => {
        console.log(`\n  🏟️  ${field.TenSan} (ID: ${field.SanID})`);
        console.log(`     - FieldArea: ${field.FieldArea || 'NULL'}`);
        console.log(`     - KhuVucSan: ${field.KhuVucSan || 'NULL'}`);
        console.log(`     - KhuVuc: ${field.KhuVuc || 'NULL'}`);
        console.log(`     - Status: ${field.TrangThai}`);
      });
      
      // Count how many fields have FieldArea set
      const fieldsWithArea = fields.filter(f => f.FieldArea || f.KhuVucSan);
      console.log(`\n📊 Statistics:`);
      console.log(`   Total fields: ${fields.length}`);
      console.log(`   Fields with FieldArea: ${fieldsWithArea.length}`);
      console.log(`   Coverage: ${((fieldsWithArea.length / fields.length) * 100).toFixed(1)}%`);
      
    } else {
      console.log('❌ Failed to get sport fields');
    }
    
    console.log('\n' + '─'.repeat(60));
    
    // Test 2: Get specific sport field by ID
    console.log('\n📋 Test 2: GET /api/sport-fields/:id');
    console.log('─'.repeat(60));
    
    const fieldId = 99; // Using field 99 from previous tests
    const singleFieldResponse = await axios.get(`${API_BASE}/sport-fields/${fieldId}`);
    
    if (singleFieldResponse.data.success) {
      const field = singleFieldResponse.data.data;
      console.log(`✅ Retrieved field: ${field.TenSan}\n`);
      console.log('Field details:');
      console.log(`  - SanID: ${field.SanID}`);
      console.log(`  - TenSan: ${field.TenSan}`);
      console.log(`  - FieldArea: ${field.FieldArea || 'NULL'}`);
      console.log(`  - KhuVucSan: ${field.KhuVucSan || 'NULL'}`);
      console.log(`  - LoaiSan: ${field.LoaiSan}`);
      console.log(`  - MonTheThao: ${field.MonTheThao}`);
      console.log(`  - KhuVuc: ${field.KhuVuc}`);
      console.log(`  - GiaThue: ${field.GiaThue?.toLocaleString('vi-VN')}đ`);
    } else {
      console.log('❌ Failed to get sport field');
    }
    
    console.log('\n' + '─'.repeat(60));
    
    // Test 3: Group fields by FieldArea
    console.log('\n📋 Test 3: Group fields by FieldArea');
    console.log('─'.repeat(60));
    
    const groupedResponse = await axios.get(`${API_BASE}/sport-fields`);
    if (groupedResponse.data.success) {
      const fields = groupedResponse.data.data;
      const grouped = {};
      
      fields.forEach(field => {
        const area = field.FieldArea || field.KhuVucSan || 'Unassigned';
        if (!grouped[area]) {
          grouped[area] = [];
        }
        grouped[area].push(field.TenSan);
      });
      
      console.log('\nFields grouped by area:\n');
      Object.keys(grouped).sort().forEach(area => {
        console.log(`  📍 ${area}: ${grouped[area].length} field(s)`);
        grouped[area].slice(0, 3).forEach(name => {
          console.log(`     - ${name}`);
        });
        if (grouped[area].length > 3) {
          console.log(`     ... and ${grouped[area].length - 3} more`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
testFieldAreaAPI().then(() => {
  console.log('✨ Testing complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
