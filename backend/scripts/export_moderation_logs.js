#!/usr/bin/env node
/**
 * Export ContentModerationLog to CSV for training data
 * Usage: node backend/scripts/export_moderation_logs.js [out.csv]
 */

const { poolPromise } = require('../config/db');
const fs = require('fs');
const path = require('path');

async function main() {
  const outFile = process.argv[2] || path.resolve(process.cwd(), 'moderation_export.csv');
  try {
    const pool = await poolPromise;
    const res = await pool.request().query('SELECT * FROM ContentModerationLog ORDER BY CreatedAt DESC');
    const rows = res.recordset || [];
    if (!rows.length) {
      console.log('No moderation logs found.');
      return;
    }

    // Collect columns
    const cols = Object.keys(rows[0]);

    const stream = fs.createWriteStream(outFile, { encoding: 'utf8' });
    // write header
    stream.write(cols.join(',') + '\n');

    for (const r of rows) {
      const values = cols.map(c => {
        let v = r[c];
        if (v === null || typeof v === 'undefined') return '';
        if (typeof v === 'object') v = JSON.stringify(v);
        // flatten newlines and commas
        let s = String(v).replace(/\r?\n/g, ' ');
        // escape double quotes
        if (s.includes(',') || s.includes('"')) {
          s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      });
      stream.write(values.join(',') + '\n');
    }

    stream.end();
    console.log('Exported', rows.length, 'rows to', outFile);
  } catch (err) {
    console.error('Failed to export moderation logs:', err.message || err);
    process.exit(2);
  }
}

main();
