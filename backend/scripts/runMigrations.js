const fs = require('fs');
const path = require('path');
const { poolPromise } = require('../config/db');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'db_migrations');

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

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`\n-- Running migration: ${file}`);
      const sqlText = fs.readFileSync(filePath, 'utf8');

      if (!sqlText || sqlText.trim().length === 0) {
        console.log('Skipping empty file:', file);
        continue;
      }

      try {
        // Use batch so multi-statement scripts execute correctly
        await pool.request().batch(sqlText);
        console.log('-- OK');
      } catch (err) {
        console.error(`Error running migration ${file}:`, err.message || err);
        throw err;
      }
    }

    console.log('\nAll migrations executed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('\nMigration runner failed:', err.message || err);
    process.exit(1);
  }
}

runMigrations();
const fs = require('fs');
const path = require('path');
const { poolPromise } = require('../config/db');

async function run() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found:', migrationsDir);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL migration files found.');
    return;
  }

  const pool = await poolPromise;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log('Running migration:', filePath);
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      if (!sql.trim()) {
        console.log('Skipping empty file', file);
        continue;
      }
      // Execute as a batch
      await pool.request().batch(sql);
      console.log('\u2705 Migration applied:', file);
    } catch (err) {
      console.error('\u274c Migration failed for', file, err.message || err);
      // stop on failure
      process.exitCode = 1;
      return;
    }
  }

  console.log('\u2705 All migrations applied');
}

run().catch(err => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
