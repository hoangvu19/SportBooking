/**
 * Script to run the FieldArea migration
 * Usage: node run-fieldarea-migration.js
 */

const { poolPromise } = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Starting FieldArea migration...\n');
    
    const pool = await poolPromise;
    
    // Step 1: Add FieldArea column
    console.log('▶️  Step 1: Adding FieldArea column...');
    try {
      await pool.request().query(`
        ALTER TABLE SportField
        ADD FieldArea NVARCHAR(10) NULL
      `);
      console.log('✅ FieldArea column added successfully\n');
    } catch (error) {
      if (error.message.includes('already exists') || error.number === 2705) {
        console.log('⚠️  FieldArea column already exists, skipping...\n');
      } else {
        throw error;
      }
    }
    
    // Step 2: Add check constraint
    console.log('▶️  Step 2: Adding check constraint...');
    try {
      await pool.request().query(`
        ALTER TABLE SportField
        ADD CONSTRAINT CHK_FieldArea 
        CHECK (FieldArea IN ('A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3') OR FieldArea IS NULL)
      `);
      console.log('✅ Check constraint added successfully\n');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Check constraint already exists, skipping...\n');
      } else {
        throw error;
      }
    }
    
    // Step 3: Update existing records
    console.log('▶️  Step 3: Updating existing records with FieldArea values...');
    await pool.request().query(`UPDATE SportField SET FieldArea = 'A1' WHERE FieldID % 9 = 1`);
    await pool.request().query(`UPDATE SportField SET FieldArea = 'A2' WHERE FieldID % 9 = 2`);
    await pool.request().query(`UPDATE SportField SET FieldArea = 'A3' WHERE FieldID % 9 = 3`);
    await pool.request().query(`UPDATE SportField SET FieldArea = 'B1' WHERE FieldID % 9 = 4`);
    await pool.request().query(`UPDATE SportField SET FieldArea = 'B2' WHERE FieldID % 9 = 5`);
    await pool.request().query(`UPDATE SportField SET FieldArea = 'B3' WHERE FieldID % 9 = 6`);
    await pool.request().query(`UPDATE SportField SET FieldArea = 'C1' WHERE FieldID % 9 = 7`);
    await pool.request().query(`UPDATE SportField SET FieldArea = 'C2' WHERE FieldID % 9 = 8`);
    await pool.request().query(`UPDATE SportField SET FieldArea = 'C3' WHERE FieldID % 9 = 0`);
    console.log('✅ Records updated successfully\n');
    
    // Verify the migration
    console.log('🔍 Verifying migration results...\n');
    const result = await pool.request().query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'SportField' AND COLUMN_NAME = 'FieldArea'
    `);
    
    if (result.recordset.length > 0) {
      console.log('✅ FieldArea column successfully added:');
      console.log(result.recordset[0]);
    } else {
      console.log('⚠️  Warning: FieldArea column not found in INFORMATION_SCHEMA');
    }
    
    // Show sample data
    console.log('\n📊 Sample SportField data with FieldArea:\n');
    const sampleData = await pool.request().query(`
      SELECT TOP 10
        FieldID,
        FieldName,
        FieldArea,
        FieldType,
        Status
      FROM SportField
      ORDER BY FieldArea, FieldID
    `);
    
    console.table(sampleData.recordset);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
runMigration().then(() => {
  console.log('\n✨ All done! You can now use FieldArea in your application.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
