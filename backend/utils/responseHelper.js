const DEFAULT_SUCCESS_MESSAGE = 'Thành công';
const DEFAULT_ERROR_MESSAGE = 'Đã xảy ra lỗi server';

function buildSuccessPayload({ message, data, meta }) {
  const payload = { success: true };

  if (message) {
    payload.message = message;
  }

  if (typeof data !== 'undefined') {
    payload.data = data;
  }

  if (meta) {
    payload.meta = meta;
  }

  return payload;
}

function sendSuccess(res, data, message = DEFAULT_SUCCESS_MESSAGE, status = 200, options = {}) {
  const payload = buildSuccessPayload({ message, data, meta: options.meta });
  return res.status(status).json(payload);
}

function sendCreated(res, data, message = 'Tạo thành công', options = {}) {
  return sendSuccess(res, data, message, 201, options);
}

function sendAccepted(res, message = 'Đã tiếp nhận yêu cầu', options = {}) {
  return sendSuccess(res, undefined, message, 202, options);
}

function sendNoContent(res) {
  return res.status(204).send();
}

function sendError(res, message = DEFAULT_ERROR_MESSAGE, status = 500, options = {}) {
  if (options.error) {
    const logMessage = options.logMessage || message || DEFAULT_ERROR_MESSAGE;
    console.error(logMessage, options.error);
  }

  const payload = {
    success: false,
    message: message || DEFAULT_ERROR_MESSAGE
  };

  if (options.details) {
    payload.details = options.details;
  }

  return res.status(status).json(payload);
}

function sendValidationError(res, message = 'Dữ liệu không hợp lệ', details) {
  return sendError(res, message, 400, { details });
}

function sendNotFound(res, message = 'Không tìm thấy dữ liệu') {
  return sendError(res, message, 404);
}

function sendUnauthorized(res, message = 'Bạn không có quyền truy cập') {
  return sendError(res, message, 401);
}

module.exports = {
  sendSuccess,
  sendCreated,
  sendAccepted,
  sendNoContent,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized
};
