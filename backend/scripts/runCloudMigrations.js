const fs = require('fs');
const path = require('path');
const { poolPromise } = require('../config/db');

async function runCloudMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error('No migrations directory found at', migrationsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.toLowerCase().endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No .sql migration files found in', migrationsDir);
    process.exit(0);
  }

  try {
    const pool = await poolPromise;
    console.log('🚀 Starting database migrations for cloud deployment...');

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`\n📄 Running migration: ${file}`);
      const sqlText = fs.readFileSync(filePath, 'utf8');

      if (!sqlText || sqlText.trim().length === 0) {
        console.log('⏭️  Skipping empty file:', file);
        continue;
      }

      try {
        // Split SQL by GO statements and execute each batch
        const batches = sqlText.split(/^\s*GO\s*$/im);
        for (const batch of batches) {
          if (batch.trim()) {
            await pool.request().batch(batch.trim());
          }
        }
        console.log('✅ Migration completed successfully');
      } catch (err) {
        console.error(`❌ Error running migration ${file}:`, err.message || err);
        throw err;
      }
    }

    console.log('\n🎉 All migrations executed successfully!');
    console.log('📊 Database is ready for production use.');
    process.exit(0);
  } catch (err) {
    console.error('\n💥 Migration runner failed:', err.message || err);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your database connection variables');
    console.log('2. Ensure database server allows remote connections');
    console.log('3. Verify database user has CREATE/ALTER permissions');
    process.exit(1);
  }
}

runCloudMigrations();