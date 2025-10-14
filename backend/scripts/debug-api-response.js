const axios = require('axios');

async function debugAPI() {
  const response = await axios.get('http://localhost:5000/api/sport-fields/99');
  const field = response.data.data;
  
  console.log('Raw API Response:');
  console.log(JSON.stringify(field, null, 2));
  
  console.log('\n\nChecking specific properties:');
  console.log('field.FieldArea:', field.FieldArea);
  console.log('field.KhuVucSan:', field.KhuVucSan);
  console.log('Has FieldArea property:', 'FieldArea' in field);
  console.log('Has KhuVucSan property:', 'KhuVucSan' in field);
  
  // List ALL properties
  console.log('\n--- ALL FIELD PROPERTIES ---');
  const allKeys = Object.keys(field);
  console.log('Total properties:', allKeys.length);
  console.log('Properties:', allKeys);
  
  // Check if KhuVucSan appears anywhere
  const hasKhuVuc = allKeys.includes('KhuVucSan');
  console.log('\nKhuVucSan in keys?', hasKhuVuc);
}

debugAPI().catch(console.error);

