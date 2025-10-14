// Quick test để kiểm tra API response
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/sport-fields',
  method: 'GET'
};

console.log('🧪 Testing API: GET http://localhost:5000/api/sport-fields\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      console.log('✅ Status:', res.statusCode);
      console.log('✅ Success:', jsonData.success);
      console.log('📊 Total fields:', jsonData.data?.length || 0);
      
      if (jsonData.data && jsonData.data.length > 0) {
        console.log('\n📋 First field data:');
        const firstField = jsonData.data[0];
        console.log(JSON.stringify(firstField, null, 2));
        
        // Check if mapping worked
        console.log('\n🔍 Checking field mapping:');
        console.log('  SanID:', firstField.SanID ? '✅' : '❌');
        console.log('  TenSan:', firstField.TenSan ? '✅' : '❌');
        console.log('  MonTheThao:', firstField.MonTheThao ? '✅' : '❌');
        console.log('  KhuVuc:', firstField.KhuVuc ? '✅' : '❌');
        console.log('  TrangThai:', firstField.TrangThai ? '✅' : '❌');
        console.log('  GiaThue:', firstField.GiaThue ? '✅' : '❌');
        
        if (firstField.SanID && firstField.MonTheThao) {
          console.log('\n✅ Mapping is working! Frontend should display data now.');
        } else {
          console.log('\n❌ Mapping NOT working. Server needs restart.');
          console.log('💡 Run: cd backend && node server.js');
        }
      }
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.log('💡 Make sure backend server is running on port 5000');
});

req.end();
