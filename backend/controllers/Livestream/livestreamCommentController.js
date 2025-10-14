const LivestreamCommentDAL = require('../../DAL/Livestream/LivestreamCommentDAL');
const UserDAL = require('../../DAL/Auth/userDAL');
const { sendSuccess, sendCreated, sendError, sendValidationError, sendUnauthorized } = require('../../utils/responseHelper');
const { getAccountId, isBlank, ensurePositiveInteger } = require('../../utils/requestUtils');

// Optional emitter to broadcast saved comments via socket.io
let signalingEmitter = null;
try {
  signalingEmitter = require('../../lib/signalingEmitter');
} catch (e) {
  signalingEmitter = null;
}

async function createComment(req, res) {
  try {
    const accountId = getAccountId(req);
    if (!accountId) return sendUnauthorized(res);

    const livestreamId = req.params.id;
    const idCheck = ensurePositiveInteger(livestreamId, 'livestreamId');
    if (!idCheck.ok) return sendValidationError(res, idCheck.message);

    const { content } = req.body || {};
    if (isBlank(content)) return sendValidationError(res, 'Nội dung comment không được để trống');

    const payload = {
      LivestreamID: idCheck.value,
      AccountID: accountId,
      Content: content.trim()
    };

    const createdRaw = await LivestreamCommentDAL.createComment(payload);
    // Enrich with author info
    let author = null;
    try {
      author = await UserDAL.getUserById(createdRaw.AccountID);
    } catch (e) { author = null; }

    const formatted = {
      CommentID: createdRaw.CommentID,
      LivestreamID: createdRaw.LivestreamID,
      Content: createdRaw.Content,
      CreatedDate: createdRaw.CreatedDate,
      Author: author ? {
        AccountID: author.AccountID,
        Username: author.Username,
        FullName: author.FullName,
        AvatarUrl: author.AvatarUrl
      } : {
        AccountID: createdRaw.AccountID,
        Username: null,
        FullName: null,
        AvatarUrl: null
      }
    };

    // Broadcast saved comment to room via signaling emitter if available
    try {
      if (signalingEmitter && typeof signalingEmitter.emitToRoom === 'function') {
        // Use the same room id that clients join (plain id string)
        signalingEmitter.emitToRoom(String(idCheck.value), { comment: formatted });
      }
    } catch (e) { /* ignore emitter errors */ }

    return sendCreated(res, formatted, 'Comment saved');
  } catch (err) {
    return sendError(res, 'Error creating livestream comment', 500, { err });
  }
}

async function listComments(req, res) {
  try {
    const livestreamId = req.params.id;
    const idCheck = ensurePositiveInteger(livestreamId, 'livestreamId');
    if (!idCheck.ok) return sendValidationError(res, idCheck.message);
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);

    const list = await LivestreamCommentDAL.listByLivestream(idCheck.value, page, limit);
    // Each item already includes Username/FullName via DAL join; map to Author shape
    const mapped = list.map(item => ({
      CommentID: item.CommentID,
      LivestreamID: item.LivestreamID,
      Content: item.Content,
      CreatedDate: item.CreatedDate,
      Author: {
        AccountID: item.AccountID,
        Username: item.Username || null,
        FullName: item.FullName || null,
        AvatarUrl: item.AvatarUrl || null
      }
    }));
    return sendSuccess(res, { comments: mapped });
  } catch (err) {
    return sendError(res, 'Error listing livestream comments', 500, { err });
  }
}

module.exports = { createComment, listComments };
