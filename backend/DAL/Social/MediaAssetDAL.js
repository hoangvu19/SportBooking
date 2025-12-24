const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class MediaAssetDAL {
  static async createMedia({ targetType, targetId, url = null, data = null, mediaType = 'Image', accountId = null }, tx = null) {
    const params = {
      TargetType: targetType,
      TargetID: targetId != null ? String(targetId) : null,
      URL: url,
      Data: data,
      MediaType: mediaType,
      AccountID: accountId
    };

    const insertSql = 'INSERT INTO MediaAsset (TargetType, TargetID, URL, Data, MediaType, UploadedDate, AccountID) OUTPUT INSERTED.* VALUES (@TargetType, @TargetID, @URL, @Data, @MediaType, GETDATE(), @AccountID)';
    const normalizeAccountParam = (val) => {
      if (!val) return null;
      if (typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)) return val;
      return null;
    };

    const accountParamValue = normalizeAccountParam(params.AccountID);

    if (tx) {
      const req = tx.request()
        .input('TargetType', sql.NVarChar(50), params.TargetType)
        .input('TargetID', sql.NVarChar(100), params.TargetID)
        .input('URL', sql.NVarChar(255), params.URL)
        .input('Data', sql.NVarChar(sql.MAX), params.Data)
        .input('MediaType', sql.NVarChar(50), params.MediaType)
        .input('AccountID', sql.UniqueIdentifier, accountParamValue);

      const result = await req.query(insertSql);
      return result.recordset && result.recordset[0] ? result.recordset[0] : null;
    }

    const pool = await poolPromise;
    const req = pool.request()
      .input('TargetType', sql.NVarChar(50), params.TargetType)
      .input('TargetID', sql.NVarChar(100), params.TargetID)
      .input('URL', sql.NVarChar(255), params.URL)
      .input('Data', sql.NVarChar(sql.MAX), params.Data)
      .input('MediaType', sql.NVarChar(50), params.MediaType)
      .input('AccountID', sql.UniqueIdentifier, accountParamValue);

    const result = await req.query(insertSql);
    return result.recordset && result.recordset[0] ? result.recordset[0] : null;
  }
  static async createMediaBulk(items = []) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
      const inserted = [];
      for (const it of items) {
        const row = await MediaAssetDAL.createMedia(it, transaction);
        if (row) inserted.push(row);
      }
      await transaction.commit();
      return inserted;
    } catch (err) {
      try { await transaction.rollback(); } catch (e) { /* ignore */ }
      throw err;
    }
  }
  static async createFromFiles(files = [], { targetType, targetId, accountId = null, maxImages = 5, maxVideoBytes = 50 * 1024 * 1024 } = {}) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const sharp = require('sharp');
    const fs = require('fs');
    const created = [];
    const toProcess = files.slice(0, maxImages);
    for (const f of toProcess) {
      if (!f || !f.mimetype) continue;
      try {
        if (f.mimetype.startsWith('image/')) {
          const buffer = await sharp(f.path).resize({ width: 1600, height: 1600, fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
          const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
          const row = await MediaAssetDAL.createMedia({ targetType, targetId, data: base64, mediaType: 'Image', accountId });
          created.push(row);
        } else if (f.mimetype.startsWith('video/')) {
          if (typeof f.size === 'number' && f.size > maxVideoBytes) {
            throw new Error('Video too large to store in DB; please upload to an external storage and store URL instead');
          }
          const buff = fs.readFileSync(f.path);
          const base64 = `data:${f.mimetype};base64,${buff.toString('base64')}`;
          const row = await MediaAssetDAL.createMedia({ targetType, targetId, data: base64, mediaType: 'Video', accountId });
          created.push(row);
        } else {
          continue;
        }
      } finally {
        try { require('fs').unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
    }
    return created;
  }
  static async createFromFilesTx(files = [], { targetType, targetId, accountId = null, maxImages = 5, maxVideoBytes = 50 * 1024 * 1024 } = {}, tx) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const sharp = require('sharp');
    const fs = require('fs');
    const created = [];
    const toProcess = files.slice(0, maxImages);
    for (const f of toProcess) {
      if (!f || !f.mimetype) continue;
      try {
        if (f.mimetype.startsWith('image/')) {
          const buffer = await sharp(f.path).resize({ width: 1600, height: 1600, fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
          const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
          const row = await MediaAssetDAL.createMedia({ targetType, targetId, data: base64, mediaType: 'Image', accountId }, tx);
          created.push(row);
        } else if (f.mimetype.startsWith('video/')) {
          if (typeof f.size === 'number' && f.size > maxVideoBytes) {
            throw new Error('Video too large to store in DB; please upload to an external storage and store URL instead');
          }
          const buff = fs.readFileSync(f.path);
          const base64 = `data:${f.mimetype};base64,${buff.toString('base64')}`;
          const row = await MediaAssetDAL.createMedia({ targetType, targetId, data: base64, mediaType: 'Video', accountId }, tx);
          created.push(row);
        } else {
          continue;
        }
      } finally {
        try { require('fs').unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
    }
    return created;
  }

  static async getByTarget(targetType, targetId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('TargetType', sql.NVarChar(50), targetType)
      .input('TargetID', sql.NVarChar(100), targetId != null ? String(targetId) : null)
      .query('SELECT * FROM MediaAsset WHERE TargetType = @TargetType AND TargetID = @TargetID ORDER BY UploadedDate ASC');

    return result.recordset || [];
  }

  static async getByTargets(targetType, targetIdArray) {
    const pool = await poolPromise;
    if (!Array.isArray(targetIdArray) || targetIdArray.length === 0) return [];
    const req = pool.request().input('TargetType', sql.NVarChar(50), targetType);
    const paramNames = targetIdArray.map((v, i) => `@id${i}`);
    targetIdArray.forEach((v, i) => req.input(`id${i}`, sql.NVarChar(100), v != null ? String(v) : null));
    const inClause = paramNames.join(',');
    const q = `SELECT * FROM MediaAsset WHERE TargetType = @TargetType AND TargetID IN (${inClause}) ORDER BY UploadedDate ASC`;
    const res = await req.query(q);
    return res.recordset || [];
  }

  static async deleteById(mediaId) {
    const pool = await poolPromise;
    const result = await pool.request().input('MediaID', sql.Int, mediaId).query('DELETE FROM MediaAsset WHERE MediaID = @MediaID');
    return result.rowsAffected[0] > 0;
  }

  static async deleteByTarget(targetType, targetId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('TargetType', sql.NVarChar(50), targetType)
      .input('TargetID', sql.NVarChar(100), targetId != null ? String(targetId) : null)
      .query('DELETE FROM MediaAsset WHERE TargetType = @TargetType AND TargetID = @TargetID');

    return result.rowsAffected[0];
  }
}

module.exports = MediaAssetDAL;
