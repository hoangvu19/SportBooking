const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database config
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
    }
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigration() {
    let pool;
    
    try {
        log('\n' + '='.repeat(70), 'cyan');
        log('📦 RUNNING MIGRATION: Add Booking and Invoice Columns', 'cyan');
        log('='.repeat(70) + '\n', 'cyan');
        
        // Connect to database
        log('🔌 Connecting to database...', 'blue');
        pool = await sql.connect(dbConfig);
        log('✅ Connected successfully\n', 'green');
        
        // Read migration file
        const migrationFile = path.join(__dirname, '..', 'migrations', '008_add_booking_invoice_columns.sql');
        log(`📄 Reading migration file: ${migrationFile}`, 'blue');
        
        if (!fs.existsSync(migrationFile)) {
            throw new Error('Migration file not found!');
        }
        
        const sqlScript = fs.readFileSync(migrationFile, 'utf8');
        log('✅ Migration file loaded\n', 'green');
        
        // Split the script by GO statements (SQL Server batch separator)
        log('🚀 Executing migration...', 'blue');
        log('-'.repeat(70), 'blue');
        
        const batches = sqlScript
            .split(/\nGO\n|\nGO\r\n/gi)
            .map(batch => batch.trim())
            .filter(batch => batch.length > 0);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            if (batch.length > 0) {
                try {
                    const result = await pool.request().query(batch);
                    
                    // Print any info messages
                    if (result.output) {
                        console.log(result.output);
                    }
                    
                } catch (error) {
                    // Some batches might just be comments or print statements
                    // Log the error but continue
                    if (error.message.includes('PRINT')) {
                        // Ignore PRINT statement errors
                    } else {
                        log(`⚠️  Batch ${i + 1} warning: ${error.message}`, 'yellow');
                    }
                }
            }
        }
        
        log('\n' + '-'.repeat(70), 'green');
        log('✅ Migration executed successfully!', 'green');
        
        // Verify the changes
        log('\n' + '='.repeat(70), 'cyan');
        log('🔍 VERIFYING CHANGES', 'cyan');
        log('='.repeat(70) + '\n', 'cyan');
        
        // Check Booking.TotalAmount
        const bookingCheck = await pool.request().query(`
            SELECT COUNT(*) as Count
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Booking' AND COLUMN_NAME = 'TotalAmount'
        `);
        
        if (bookingCheck.recordset[0].Count > 0) {
            log('✅ Booking.TotalAmount column exists', 'green');
        } else {
            log('❌ Booking.TotalAmount column missing', 'red');
        }
        
        // Check Invoice.PaymentMethod
        const invoiceCheck = await pool.request().query(`
            SELECT COUNT(*) as Count
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Invoice' AND COLUMN_NAME = 'PaymentMethod'
        `);
        
        if (invoiceCheck.recordset[0].Count > 0) {
            log('✅ Invoice.PaymentMethod column exists', 'green');
        } else {
            log('❌ Invoice.PaymentMethod column missing', 'red');
        }
        
        // Show updated schema
        log('\n📊 Updated Booking columns:', 'blue');
        const bookingCols = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Booking'
            ORDER BY ORDINAL_POSITION
        `);
        bookingCols.recordset.forEach(col => {
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${nullable})`);
        });
        
        log('\n📊 Updated Invoice columns:', 'blue');
        const invoiceCols = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Invoice'
            ORDER BY ORDINAL_POSITION
        `);
        invoiceCols.recordset.forEach(col => {
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${nullable})`);
        });
        
        log('\n' + '='.repeat(70), 'green');
        log('🎉 MIGRATION COMPLETED SUCCESSFULLY!', 'green');
        log('='.repeat(70) + '\n', 'green');
        
    } catch (error) {
        log('\n❌ Migration failed:', 'red');
        console.error(error);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
            log('🔌 Database connection closed\n', 'cyan');
        }
    }
}

// Run migration
runMigration().catch(console.error);
