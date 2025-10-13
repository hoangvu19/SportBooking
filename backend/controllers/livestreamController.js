const LivestreamDAL = require('../DAL/LivestreamDAL');
const { sendSuccess, sendCreated, sendError, sendValidationError, sendUnauthorized } = require('../utils/responseHelper');
const { getAccountId, isBlank } = require('../utils/requestUtils');

async function createLivestream(req, res) {
  try {
    const accountId = getAccountId(req);
    if (!accountId) return sendUnauthorized(res);

    const { title, description, embedUrl } = req.body || {};
    if (isBlank(title) && isBlank(embedUrl)) {
      return sendValidationError(res, 'Cần cung cấp title hoặc embedUrl');
    }

    const payload = {
      AccountID: accountId,
      Title: title || null,
      Description: description || null,
      EmbedUrl: embedUrl || null,
      IsActive: true,
      StartedAt: new Date()
    };

    const created = await LivestreamDAL.createLivestream(payload);
    return sendCreated(res, created, 'Livestream created');
  } catch (err) {
    return sendError(res, 'Error creating livestream', 500, { err });
  }
}

async function listActive(req, res) {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const list = await LivestreamDAL.listActiveLivestreams(limit);
    return sendSuccess(res, list);
  } catch (err) {
    return sendError(res, 'Error listing livestreams', 500, { err });
  }
}

async function getById(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const item = await LivestreamDAL.getLivestreamById(id);
    if (!item) return sendValidationError(res, 'Livestream not found');
    return sendSuccess(res, item);
  } catch (err) {
    return sendError(res, 'Error fetching livestream', 500, { err });
  }
}

async function endLivestream(req, res) {
  try {
    const accountId = getAccountId(req);
    if (!accountId) return sendUnauthorized(res);

    const id = parseInt(req.params.id, 10);
    const existing = await LivestreamDAL.getLivestreamById(id);
    if (!existing) return sendValidationError(res, 'Livestream not found');
    if (parseInt(existing.AccountID, 10) !== parseInt(accountId, 10)) return sendUnauthorized(res, 'Không có quyền');

    const updated = await LivestreamDAL.updateLivestream(id, { IsActive: false, EndedAt: new Date() });
    return sendSuccess(res, updated, 'Livestream ended');
  } catch (err) {
    return sendError(res, 'Error ending livestream', 500, { err });
  }
}

module.exports = {
  createLivestream,
  listActive,
  getById,
  endLivestream
};
