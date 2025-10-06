const { sql, poolPromise } = require('../config/db');

/**
 * Lightweight DB helper to centralize common patterns when using mssql
 * - query(sqlText, inputs): run a parametrized query where inputs is [{name, type, value}]
 * - transaction(fn): run a callback with a Transaction instance; commits or rolls back
 */
async function query(sqlText, inputs = []) {
  const pool = await poolPromise;
  const req = pool.request();
  for (const inp of inputs) {
    // each inp = { name, type, value }
    req.input(inp.name, inp.type, inp.value);
  }
  return req.query(sqlText);
}

async function transaction(callback) {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await callback(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try { await tx.rollback(); } catch (rbErr) { /* ignore rollback errors */ }
    throw err;
  }
}

module.exports = { sql, poolPromise, query, transaction };
