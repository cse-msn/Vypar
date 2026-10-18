/** Operational error carrying an HTTP status + optional machine code + details. */
export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;
  isOperational = true;

  constructor(statusCode: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code;
    this.details = options?.details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(msg: string, details?: unknown) {
    return new ApiError(400, msg, { code: 'BAD_REQUEST', details });
  }
  static unauthorized(msg = 'Authentication required') {
    return new ApiError(401, msg, { code: 'UNAUTHORIZED' });
  }
  static forbidden(msg = 'You do not have permission to perform this action') {
    return new ApiError(403, msg, { code: 'FORBIDDEN' });
  }
  static notFound(msg = 'Resource not found') {
    return new ApiError(404, msg, { code: 'NOT_FOUND' });
  }
  static conflict(msg: string, details?: unknown) {
    return new ApiError(409, msg, { code: 'CONFLICT', details });
  }
  static unprocessable(msg: string, details?: unknown) {
    return new ApiError(422, msg, { code: 'UNPROCESSABLE', details });
  }
}
