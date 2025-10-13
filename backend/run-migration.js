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
        
        // Read all SQL files in migrations directory and run them in alphabetical order
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.toLowerCase().endsWith('.sql'))
            .sort();

        console.log(`📝 Found ${files.length} migration files`);

        for (let i = 0; i < files.length; i++) {
            const filePath = path.join(migrationsDir, files[i]);
            console.log(`\n⚙️ Executing migration ${files[i]}...`);
            const sqlScript = fs.readFileSync(filePath, 'utf8');

            // Split by GO batches (if present)
            const batches = sqlScript
                .split(/\nGO\s*\n/gi)
                .map(b => b.trim())
                .filter(b => b.length > 0);

            for (let j = 0; j < batches.length; j++) {
                try {
                    const result = await pool.request().query(batches[j]);
                    if (result.recordset && result.recordset.length > 0) {
                        result.recordset.forEach(row => console.log(Object.values(row).join(' ')));
                    }
                } catch (e) {
                    console.error(`Error executing batch ${j + 1} of ${files[i]}:`, e.message);
                    throw e;
                }
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
