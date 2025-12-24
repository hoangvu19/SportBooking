const fs = require('fs');
const path = require('path');
const { poolPromise, sql } = require('../config/db');

// Hard-coded absolute path to fallback file (workspace path)
// Note: some fallback logs may be written outside the backend logs folder (observed under Caps1/logs)
const fallbackFile = 'C:/WhereWeSport/Caps1/logs/reports-fallback.jsonl';
const migratedFile = 'C:/WhereWeSport/SportBooking/backend/logs/reports-fallback-migrated.jsonl';

async function main() {
  if (!fs.existsSync(fallbackFile)) {
    console.error('Fallback file not found (absolute):', fallbackFile);
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
  for (let ln of lines) {
    // Some log files prefix lines with '//' or have extra whitespace; normalize before parsing
    try {
      ln = ln.trim();
      if (ln.startsWith('//')) ln = ln.slice(2).trim();
      // Also remove any BOM
      if (ln.charCodeAt(0) === 0xFEFF) ln = ln.slice(1);
    } catch (preErr) {
      // ignore
    }
    let obj;
    try { obj = JSON.parse(ln); } catch (e) { console.warn('Skipping malformed json line'); continue; }

    // Normalize ReporterID: ensure integer or null
    let ReporterID = obj.ReporterID || null;
    let reporterIdToInsert = null;
    if (ReporterID !== null && ReporterID !== undefined) {
      const parsed = parseInt(ReporterID, 10);
      if (!isNaN(parsed)) reporterIdToInsert = parsed;
    }
    const ReportedContentType = obj.ReportedContentType != null ? String(obj.ReportedContentType) : null;
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
      // If the Reporter account doesn't exist, migrate the report with ReporterID = NULL
      if (reporterIdToInsert !== null) {
        const accRes = await pool.request().input('AccountID', sql.Int, reporterIdToInsert).query('SELECT TOP 1 AccountID FROM dbo.Account WHERE AccountID = @AccountID');
        if (!accRes || !accRes.recordset || accRes.recordset.length === 0) {
          reporterIdToInsert = null;
        }
      }

      // Build existence check depending on whether ReporterID is null
      let existQ, existReq;
      if (reporterIdToInsert === null) {
        existQ = `SELECT COUNT(*) as Cnt FROM Reports WHERE ReporterID IS NULL AND ReportedContentType = @ReportedContentType AND ReportedContentID = @ReportedContentID AND CreatedAt = @CreatedAt`;
        existReq = pool.request()
          .input('ReportedContentType', sql.NVarChar, ReportedContentType)
          .input('ReportedContentID', sql.NVarChar, ReportedContentID)
          .input('CreatedAt', sql.DateTime, CreatedAt);
      } else {
        existQ = `SELECT COUNT(*) as Cnt FROM Reports WHERE ReporterID = @ReporterID AND ReportedContentType = @ReportedContentType AND ReportedContentID = @ReportedContentID AND CreatedAt = @CreatedAt`;
        existReq = pool.request()
          .input('ReporterID', sql.Int, reporterIdToInsert)
          .input('ReportedContentType', sql.NVarChar, ReportedContentType)
          .input('ReportedContentID', sql.NVarChar, ReportedContentID)
          .input('CreatedAt', sql.DateTime, CreatedAt);
      }
      const existRes = await existReq.query(existQ);
      const cnt = existRes && existRes.recordset && existRes.recordset[0] ? existRes.recordset[0].Cnt : 0;
      if (cnt && cnt > 0) { skippedCount++; continue; }

      const insertQ = `INSERT INTO Reports (ReporterID, ReportedContentType, ReportedContentID, ReportReason, ReportDescription, Status, AdminNote, ReviewedBy, ReviewedAt, CreatedAt, UpdatedAt) OUTPUT INSERTED.ReportID VALUES (@ReporterID, @ReportedContentType, @ReportedContentID, @ReportReason, @ReportDescription, @Status, @AdminNote, @ReviewedBy, @ReviewedAt, @CreatedAt, @UpdatedAt)`;
      const insertRes = await pool.request()
        .input('ReporterID', sql.Int, reporterIdToInsert)
        .input('ReportedContentType', sql.NVarChar, ReportedContentType)
        .input('ReportedContentID', sql.NVarChar, ReportedContentID)
        .input('ReportReason', sql.NVarChar, ReportReason)
        .input('ReportDescription', sql.NVarChar, ReportDescription)
        .input('Status', sql.NVarChar, Status)
        .input('AdminNote', sql.NVarChar, AdminNote)
        .input('ReviewedBy', sql.Int, ReviewedBy)
        .input('ReviewedAt', sql.DateTime, ReviewedAt)
        .input('CreatedAt', sql.DateTime, CreatedAt)
        .input('UpdatedAt', sql.DateTime, UpdatedAt)
        .query(insertQ);
      const newId = insertRes && insertRes.recordset && insertRes.recordset[0] ? insertRes.recordset[0].ReportID : null;
      console.log(`Inserted fallback -> Reports id=${newId} (orig ReportID=${obj.ReportID})`);
      migratedCount++;
      try { fs.appendFileSync(migratedFile, ln + '\n'); } catch (aErr) { console.warn('Append migrated failed', aErr); }
    } catch (err) {
      console.error('Failed to migrate line:', err && err.message ? err.message : err);
    }
  }
  console.log(`Migration complete. Migrated: ${migratedCount}, Skipped(existing): ${skippedCount}, Total processed: ${lines.length}`);
}

main().catch(err => { console.error('Migration failed', err); process.exit(2); });
