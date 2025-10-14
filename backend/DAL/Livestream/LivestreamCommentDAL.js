const { sql, poolPromise } = require('../../config/db');

async function createComment(payload) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('LivestreamID', sql.Int, payload.LivestreamID)
    .input('AccountID', sql.Int, payload.AccountID)
    .input('Content', sql.NVarChar, payload.Content)
    .query('INSERT INTO LivestreamComment (LivestreamID, AccountID, Content, CreatedDate) OUTPUT INSERTED.* VALUES (@LivestreamID, @AccountID, @Content, GETDATE())');
  return result.recordset[0];
}

async function listByLivestream(livestreamId, page = 1, limit = 50) {
  const pool = await poolPromise;
  const offset = (page - 1) * limit;
  const result = await pool.request()
    .input('LivestreamID', sql.Int, livestreamId)
    .input('Offset', sql.Int, offset)
    .input('Limit', sql.Int, limit)
    .query(`SELECT lc.*, a.Username, a.FullName, a.AvatarUrl FROM LivestreamComment lc JOIN Account a ON lc.AccountID = a.AccountID WHERE lc.LivestreamID = @LivestreamID ORDER BY lc.CreatedDate ASC OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY`);
  return result.recordset;
}

module.exports = { createComment, listByLivestream };
