const sql = require('mssql');
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

// Helper functions for colored output
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

function section(title) {
    console.log('\n' + '='.repeat(70));
    log(`📋 ${title}`, 'cyan');
    console.log('='.repeat(70) + '\n');
}

async function checkTableSchema(pool, tableName) {
    try {
        log(`\n🔍 Checking schema for table: ${tableName}`, 'blue');
        log('-'.repeat(70), 'blue');
        
        const result = await pool.request().query(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH,
                IS_NULLABLE,
                COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${tableName}'
            ORDER BY ORDINAL_POSITION
        `);
        
        if (result.recordset.length === 0) {
            log(`❌ Table '${tableName}' not found!`, 'red');
            return;
        }
        
        log(`✅ Found ${result.recordset.length} columns:\n`, 'green');
        
        result.recordset.forEach((col, index) => {
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
            const defaultVal = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : '';
            
            console.log(`   ${index + 1}. ${col.COLUMN_NAME}`);
            console.log(`      Type: ${col.DATA_TYPE}${length}`);
            console.log(`      Nullable: ${nullable}`);
            if (defaultVal) console.log(`      Default: ${defaultVal}`);
            console.log();
        });
        
        // Check for specific columns
        log('🔍 Checking for specific columns:', 'yellow');
        
        if (tableName === 'Booking') {
            const hasAmount = result.recordset.some(col => 
                col.COLUMN_NAME === 'TotalAmount' || col.COLUMN_NAME === 'Amount'
            );
            log(`   ${hasAmount ? '✅' : '❌'} TotalAmount/Amount column: ${hasAmount ? 'EXISTS' : 'MISSING'}`, hasAmount ? 'green' : 'red');
            
            const hasStatus = result.recordset.some(col => col.COLUMN_NAME === 'Status');
            log(`   ${hasStatus ? '✅' : '❌'} Status column: ${hasStatus ? 'EXISTS' : 'MISSING'}`, hasStatus ? 'green' : 'red');
        }
        
        if (tableName === 'Invoice') {
            const hasTotalCost = result.recordset.some(col => 
                col.COLUMN_NAME === 'TotalCost' || col.COLUMN_NAME === 'Amount' || col.COLUMN_NAME === 'TotalAmount'
            );
            log(`   ${hasTotalCost ? '✅' : '❌'} TotalCost/Amount column: ${hasTotalCost ? 'EXISTS' : 'MISSING'}`, hasTotalCost ? 'green' : 'red');
            
            const hasPaymentMethod = result.recordset.some(col => col.COLUMN_NAME === 'PaymentMethod');
            log(`   ${hasPaymentMethod ? '✅' : '❌'} PaymentMethod column: ${hasPaymentMethod ? 'EXISTS' : 'MISSING'}`, hasPaymentMethod ? 'green' : 'red');
            
            const hasPaymentStatus = result.recordset.some(col => col.COLUMN_NAME === 'PaymentStatus');
            log(`   ${hasPaymentStatus ? '✅' : '❌'} PaymentStatus column: ${hasPaymentStatus ? 'EXISTS' : 'MISSING'}`, hasPaymentStatus ? 'green' : 'red');
        }
        
    } catch (error) {
        log(`❌ Error checking schema: ${error.message}`, 'red');
    }
}

async function getSampleData(pool, tableName) {
    try {
        log(`\n📊 Sample data from ${tableName}:`, 'blue');
        log('-'.repeat(70), 'blue');
        
        const result = await pool.request().query(`
            SELECT TOP 2 * FROM ${tableName}
        `);
        
        if (result.recordset.length === 0) {
            log(`   ℹ️  No data in ${tableName} table`, 'yellow');
        } else {
            result.recordset.forEach((record, index) => {
                log(`\n   Record ${index + 1}:`, 'cyan');
                console.log('   ' + JSON.stringify(record, null, 2).split('\n').join('\n   '));
            });
        }
        
    } catch (error) {
        log(`❌ Error getting sample data: ${error.message}`, 'red');
    }
}

async function checkForeignKeys(pool, tableName) {
    try {
        log(`\n🔗 Foreign Keys for ${tableName}:`, 'blue');
        log('-'.repeat(70), 'blue');
        
        const result = await pool.request().query(`
            SELECT 
                fk.name AS FK_Name,
                OBJECT_NAME(fk.parent_object_id) AS Table_Name,
                COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Column_Name,
                OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
                COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS Referenced_Column
            FROM sys.foreign_keys AS fk
            INNER JOIN sys.foreign_key_columns AS fkc 
                ON fk.object_id = fkc.constraint_object_id
            WHERE OBJECT_NAME(fk.parent_object_id) = '${tableName}'
            ORDER BY fk.name
        `);
        
        if (result.recordset.length === 0) {
            log(`   ℹ️  No foreign keys found for ${tableName}`, 'yellow');
        } else {
            result.recordset.forEach((fk, index) => {
                log(`   ${index + 1}. ${fk.Column_Name} → ${fk.Referenced_Table}.${fk.Referenced_Column}`, 'green');
                log(`      Constraint: ${fk.FK_Name}`, 'cyan');
            });
        }
        
    } catch (error) {
        log(`❌ Error checking foreign keys: ${error.message}`, 'red');
    }
}

async function runSchemaCheck() {
    let pool;
    
    try {
        section('🔍 DATABASE SCHEMA CHECKER');
        log('Connecting to database...', 'cyan');
        
        pool = await sql.connect(dbConfig);
        log('✅ Connected successfully\n', 'green');
        
        // Check Booking table
        section('TABLE: Booking');
        await checkTableSchema(pool, 'Booking');
        await checkForeignKeys(pool, 'Booking');
        await getSampleData(pool, 'Booking');
        
        // Check Invoice table
        section('TABLE: Invoice');
        await checkTableSchema(pool, 'Invoice');
        await checkForeignKeys(pool, 'Invoice');
        await getSampleData(pool, 'Invoice');
        
        section('✅ SCHEMA CHECK COMPLETED');
        
    } catch (error) {
        log(`\n❌ Fatal error: ${error.message}`, 'red');
        console.error(error);
    } finally {
        if (pool) {
            await pool.close();
            log('\n🔌 Database connection closed', 'cyan');
        }
    }
}

// Run the schema check
runSchemaCheck().catch(console.error);
