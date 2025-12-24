const fs = require('fs');
const path = require('path');
const { poolPromise, sql } = require('../config/db');

// Script: migrate_fallback_reports_to_db.js
// Reads backend/logs/reports-fallback.jsonl and inserts entries into dbo.Reports
// - Skips entries that appear already migrated (matched by ReporterID, ReportedContentType, ReportedContentID, CreatedAt)
// - Appends migrated lines to reports-fallback-migrated.jsonl
// Usage: node migrate_fallback_reports_to_db.js

async function main() {
  const logsDir = path.resolve(__dirname, '..', 'logs');
  const fallbackFile = path.join(logsDir, 'reports-fallback.jsonl');
  const migratedFile = path.join(logsDir, 'reports-fallback-migrated.jsonl');

  if (!fs.existsSync(fallbackFile)) {
    console.error('Fallback file not found:', fallbackFile);
    process.exit(1);
  }

  const lines = fs.readFileSync(fallbackFile, 'utf8').split('\n').filter(Boolean);
  if (lines.length === 0) {
    console.log('No fallback lines to migrate.');
    return;
  }

  const pool = await poolPromise;
  let migratedCount = 0;
  let skippedCount = 0;
  for (const ln of lines) {
    let obj;
    try {
      obj = JSON.parse(ln);
    } catch (e) {
      console.warn('Skipping malformed json line:', ln);
      continue;
    }

    // Normalize fields
    const ReporterID = obj.ReporterID || null;
    const ReportedContentType = (obj.ReportedContentType || obj.ReportedContentType === 0) ? String(obj.ReportedContentType) : null;
    const ReportedContentID = obj.ReportedContentID != null ? String(obj.ReportedContentID) : null;
    const ReportReason = obj.ReportReason || null;
    const ReportDescription = obj.ReportDescription || null;
    const Status = obj.Status || 'pending';
    const AdminNote = obj.AdminNote || null;
    const ReviewedBy = obj.ReviewedBy || null;
    const ReviewedAt = obj.ReviewedAt ? new Date(obj.ReviewedAt) : null;
    const CreatedAt = obj.CreatedAt ? new Date(obj.CreatedAt) : new Date();
    const UpdatedAt = obj.UpdatedAt ? new Date(obj.UpdatedAt) : new Date();

    try {
      // Check if a matching row already exists in Reports (avoid duplicates)
      const existQ = `
        SELECT COUNT(*) as Cnt FROM Reports
        WHERE ReporterID = @ReporterID
          AND ReportedContentType = @ReportedContentType
          AND ReportedContentID = @ReportedContentID
          AND CreatedAt = @CreatedAt
      `;
      const existRes = await pool.request()
        .input('ReporterID', sql.Int, ReporterID)
        .input('ReportedContentType', sql.NVarChar, ReportedContentType)
        .input('ReportedContentID', sql.NVarChar, ReportedContentID)
        .input('CreatedAt', sql.DateTime, CreatedAt)
        .query(existQ);

      const cnt = existRes && existRes.recordset && existRes.recordset[0] ? existRes.recordset[0].Cnt : 0;
      if (cnt && cnt > 0) {
        skippedCount++;
        continue;
      }

      // Insert into Reports table
      const insertQ = `
        INSERT INTO Reports (ReporterID, ReportedContentType, ReportedContentID, ReportReason, ReportDescription, Status, AdminNote, ReviewedBy, ReviewedAt, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.ReportID
        VALUES (@ReporterID, @ReportedContentType, @ReportedContentID, @ReportReason, @ReportDescription, @Status, @AdminNote, @ReviewedBy, @ReviewedAt, @CreatedAt, @UpdatedAt)
      `;

      const insReq = pool.request()
        .input('ReporterID', sql.Int, ReporterID)
        .input('ReportedContentType', sql.NVarChar, ReportedContentType)
        .input('ReportedContentID', sql.NVarChar, ReportedContentID)
        .input('ReportReason', sql.NVarChar, ReportReason)
        .input('ReportDescription', sql.NVarChar, ReportDescription)
        .input('Status', sql.NVarChar, Status)
        .input('AdminNote', sql.NVarChar, AdminNote)
        .input('ReviewedBy', sql.Int, ReviewedBy)
        .input('ReviewedAt', sql.DateTime, ReviewedAt)
        .input('CreatedAt', sql.DateTime, CreatedAt)
        .input('UpdatedAt', sql.DateTime, UpdatedAt);

      const insertRes = await insReq.query(insertQ);
      const newId = insertRes && insertRes.recordset && insertRes.recordset[0] ? insertRes.recordset[0].ReportID : null;
      console.log(`Inserted fallback -> Reports id=${newId} (orig ReportID=${obj.ReportID})`);
      migratedCount++;

      // Append original fallback line to migrated file for traceability
      try {
        fs.appendFileSync(migratedFile, ln + '\n');
      } catch (aErr) {
        console.warn('Could not append to migrated file:', aErr && aErr.message ? aErr.message : aErr);
      }
    } catch (err) {
      console.error('Failed to migrate line:', ln, '\nError:', err && err.message ? err.message : err);
    }
  }

  console.log(`Migration complete. Migrated: ${migratedCount}, Skipped(existing): ${skippedCount}, Total processed: ${lines.length}`);
}

main().catch(err => {
  console.error('Migration script failed:', err && err.message ? err.message : err);
  process.exit(2);
});
