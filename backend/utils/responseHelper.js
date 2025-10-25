const DEFAULT_SUCCESS_MESSAGE = 'Success';
const DEFAULT_ERROR_MESSAGE = 'An internal server error occurred';

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

function sendCreated(res, data, message = 'Created successfully', options = {}) {
  return sendSuccess(res, data, message, 201, options);
}

function sendAccepted(res, message = 'Request accepted', options = {}) {
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

function sendValidationError(res, message = 'Invalid data', details) {
  return sendError(res, message, 400, { details });
}

function sendNotFound(res, message = 'Data not found') {
  return sendError(res, message, 404);
}

function sendUnauthorized(res, message = 'Unauthorized') {
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
