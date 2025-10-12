const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
    user: process.env.DB_USER ,
    password: process.env.DB_PASSWORD ,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE ,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function runMigration() {
    try {
        console.log('🔄 Running migration...');
        
        const pool = await sql.connect(config);
        
        // Đọc file SQL
        const sqlFile = path.join(__dirname, 'migrations', 'create-follow-notification.sql');
        const sqlScript = fs.readFileSync(sqlFile, 'utf8');
        
        // Tách SQL thành các batch (phân tách bởi GO)
        const batches = sqlScript
            .split(/\nGO\s*\n/gi)
            .map(b => b.trim())
            .filter(b => b.length > 0);
        
        console.log(`📝 Found ${batches.length} SQL batches`);
        
        // Chạy từng batch
        for (let i = 0; i < batches.length; i++) {
            console.log(`\n⚙️ Executing batch ${i + 1}...`);
            const result = await pool.request().query(batches[i]);
            
            // In ra messages nếu có
            if (result.recordset && result.recordset.length > 0) {
                result.recordset.forEach(row => {
                    console.log(Object.values(row).join(' '));
                });
            }
        }
        
        console.log('\n✅ Migration completed successfully!');
        
        // Kiểm tra lại bảng đã được tạo
        const check = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME IN ('Follow', 'Notification')
            ORDER BY TABLE_NAME
        `);
        
        console.log('\n✅ Verified tables:');
        check.recordset.forEach(row => {
            console.log('  - ' + row.TABLE_NAME);
        });
        
        await pool.close();
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        console.error(err);
        process.exit(1);
    }
}

runMigration();
