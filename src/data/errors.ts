/**
 * Typed data-layer errors. Every Firestore interaction surfaces a `DataError`
 * with a machine-readable `code` so UI layers can branch, and a stable `path`
 * for diagnostics. Raw Firestore codes are never leaked to users.
 */

export type DataErrorCode =
  | 'unauthenticated'
  | 'demo-session'
  | 'permission-denied'
  | 'invalid-data'
  | 'not-found'
  | 'conflict'
  | 'network'
  | 'unknown';

export type DataOperation = 'create' | 'read' | 'update' | 'delete' | 'list' | 'subscribe';

export interface DataErrorOptions {
  code: DataErrorCode;
  operation: DataOperation;
  path?: string;
  cause?: unknown;
}

export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly operation: DataOperation;
  readonly path?: string;
  readonly cause?: unknown;

  constructor(options: DataErrorOptions, message?: string) {
    super(message ?? defaultMessage(options.code, options.operation));
    this.name = 'DataError';
    this.code = options.code;
    this.operation = options.operation;
    this.path = options.path;
    this.cause = options.cause;
  }
}

function defaultMessage(code: DataErrorCode, operation: DataOperation): string {
  switch (code) {
    case 'unauthenticated':
      return 'You need to sign in to do that.';
    case 'demo-session':
      return 'Demo sessions are local-only and cannot write to the cloud data layer. Sign in with Google to persist.';
    case 'permission-denied':
      return 'This change was denied for your account.';
    case 'invalid-data':
      return `The ${operation} was rejected because the data did not pass validation.`;
    case 'not-found':
      return 'That item could not be found.';
    case 'conflict':
      return 'The item changed while you were editing it. Please refresh and try again.';
    case 'network':
      return 'A network problem interrupted the operation. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/** Map any thrown value (Firestore `FirestoreError` included) to a `DataError`. */
export function toDataError(
  err: unknown,
  operation: DataOperation,
  path?: string,
  codeOverride?: DataErrorCode,
): DataError {
  if (err instanceof DataError) return err;

  const anyErr = err as { code?: unknown } | null;
  const code = typeof anyErr?.code === 'string' ? anyErr.code : null;

  let mapped: DataErrorCode = 'unknown';
  switch (code) {
    case 'unauthenticated':
      mapped = 'unauthenticated';
      break;
    case 'permission-denied':
      mapped = 'permission-denied';
      break;
    case 'not-found':
      mapped = 'not-found';
      break;
    case 'invalid-argument':
    case 'invalid-document-id':
      mapped = 'invalid-data';
      break;
    case 'aborted':
    case 'already-exists':
    case 'resource-exhausted':
      mapped = 'conflict';
      break;
    case 'unavailable':
    case 'deadline-exceeded':
    case 'internal':
      mapped = 'network';
      break;
    default:
      break;
  }

  if (codeOverride) mapped = codeOverride;
  return new DataError({ code: mapped, operation, path, cause: err });
}

export function isDataError(err: unknown): err is DataError {
  return err instanceof DataError;
}