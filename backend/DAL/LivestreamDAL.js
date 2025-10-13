const { poolPromise, sql } = require('../config/db');

async function createLivestream(payload) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('AccountID', sql.Int, payload.AccountID)
    .input('Title', sql.NVarChar(255), payload.Title || null)
    .input('Description', sql.NVarChar(sql.MAX), payload.Description || null)
    .input('EmbedUrl', sql.NVarChar(1000), payload.EmbedUrl || null)
    .query(
      `INSERT INTO Livestreams (AccountID, Title, Description, EmbedUrl, IsActive, StartedAt)
       OUTPUT INSERTED.*
       VALUES (@AccountID, @Title, @Description, @EmbedUrl, @IsActive, @StartedAt)`
    );

  return result.recordset[0];
}

async function updateLivestream(id, updates) {
  const pool = await poolPromise;
  const q = [];
  const req = pool.request();
  req.input('LivestreamID', sql.Int, id);
  if (updates.Title !== undefined) { req.input('Title', sql.NVarChar(255), updates.Title); q.push('Title = @Title'); }
  if (updates.Description !== undefined) { req.input('Description', sql.NVarChar(sql.MAX), updates.Description); q.push('Description = @Description'); }
  if (updates.EmbedUrl !== undefined) { req.input('EmbedUrl', sql.NVarChar(1000), updates.EmbedUrl); q.push('EmbedUrl = @EmbedUrl'); }
  if (updates.IsActive !== undefined) { req.input('IsActive', sql.Bit, updates.IsActive); q.push('IsActive = @IsActive'); }
  if (updates.StartedAt !== undefined) { req.input('StartedAt', sql.DateTime2, updates.StartedAt); q.push('StartedAt = @StartedAt'); }
  if (updates.EndedAt !== undefined) { req.input('EndedAt', sql.DateTime2, updates.EndedAt); q.push('EndedAt = @EndedAt'); }

  if (q.length === 0) return null;

  const result = await req.query(`UPDATE Livestreams SET ${q.join(', ')} WHERE LivestreamID = @LivestreamID; SELECT * FROM Livestreams WHERE LivestreamID = @LivestreamID;`);
  return result.recordset[0];
}

async function getLivestreamById(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('LivestreamID', sql.Int, id)
    .query('SELECT * FROM Livestreams WHERE LivestreamID = @LivestreamID');
  return result.recordset[0];
}

async function listActiveLivestreams(limit = 20) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('limit', sql.Int, limit)
    .query('SELECT TOP(@limit) * FROM Livestreams WHERE IsActive = 1 ORDER BY StartedAt DESC');
  return result.recordset;
}

module.exports = {
  createLivestream,
  updateLivestream,
  getLivestreamById,
  listActiveLivestreams
};
