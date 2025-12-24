const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER.split('\\')[0], 
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || 1433), 
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 60000,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    abortTransactionOnError: true,
    cancelTimeout: 5000
  },
  requestTimeout: 15000, 
  connectionTimeout: 15000
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ Đã kết nối SQL Server');
    
    // Handle pool errors
    pool.on('error', err => {
      console.error('❌ Database pool error:', err);
    });
    
    return pool;
  })
  .catch(err => {
    console.error('❌ Kết nối thất bại', err);
    setTimeout(() => {
      console.log('🔄 Đang thử kết nối lại...');
    }, 5000);
    throw err;
  });

module.exports = { sql, poolPromise };
