import { Logger } from './Logger';

export type ErrorCategory =
  | 'AUTHENTICATION'
  | 'PERMISSION'
  | 'VALIDATION'
  | 'NETWORK'
  | 'FIRESTORE'
  | 'UNKNOWN';

export interface AppError {
  code: string;
  message: string;
  category: ErrorCategory;
  originalError?: any;
  correlationId?: string;
}

class CentralizedErrorService {
  private lastToastMessage: string | null = null;
  private lastToastTime = 0;

  // Parses raw errors into structured AppError object
  public parse(err: any, category: ErrorCategory = 'UNKNOWN'): AppError {
    const correlationId = Logger.generateCorrelationId();
    let code = 'UNKNOWN_ERROR';
    let message = 'An unexpected error occurred. Please try again.';
    let parsedCategory = category;

    if (err && typeof err === 'object') {
      const errCode = err.code || err.errorCode || '';
      const errMsg = err.message || '';

      // 1. Firebase Auth parser
      if (errCode.startsWith('auth/') || errMsg.includes('auth/')) {
        parsedCategory = 'AUTHENTICATION';
        if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
          code = 'AUTH_INVALID_CREDENTIALS';
          message = 'Invalid email or password.';
        } else if (errCode === 'auth/user-not-found') {
          code = 'AUTH_USER_NOT_FOUND';
          message = 'No account found with this email address.';
        } else if (errCode === 'auth/too-many-requests') {
          code = 'AUTH_TOO_MANY_REQUESTS';
          message = 'Too many failed attempts. Access temporarily locked.';
        } else {
          code = 'AUTH_FAILED';
          message = 'Authentication failed. Please verify your credentials.';
        }
      }
      // 2. Firestore/Permission check
      else if (errCode === 'permission-denied' || errMsg.includes('permission-denied') || errMsg.includes('denied')) {
        parsedCategory = 'PERMISSION';
        code = 'PERMISSION_FORBIDDEN';
        message = 'Your account does not have permission to perform this action.';
      }
      // 3. Firestore transaction/offline
      else if (errCode === 'unavailable' || errMsg.includes('unavailable') || errMsg.includes('offline')) {
        parsedCategory = 'NETWORK';
        code = 'NETWORK_OFFLINE';
        message = 'Network connection lost. Please check your internet connection.';
      } else if (errCode === 'resource-exhausted') {
        parsedCategory = 'FIRESTORE';
        code = 'FIRESTORE_QUOTA_EXCEEDED';
        message = 'Database quota limits exceeded. Please retry in a few seconds.';
      }
      // 4. Custom validation checks
      else if (err.isValidationError || errMsg.includes('validation') || errMsg.includes('invalid') || errMsg.includes('required')) {
        parsedCategory = 'VALIDATION';
        code = err.errorCode || 'VALIDATION_FAILED';
        message = errMsg || 'Input validation failed. Please check your inputs.';
      }
    } else if (typeof err === 'string') {
      if (err.includes('forbidden') || err.includes('permission')) {
        parsedCategory = 'PERMISSION';
        code = 'PERMISSION_FORBIDDEN';
        message = 'Access denied. Permission required.';
      } else {
        message = err;
      }
    }

    return {
      code,
      message,
      category: parsedCategory,
      originalError: err,
      correlationId
    };
  }

  // Returns true if the error is transient and can be retried
  public isTransient(error: AppError): boolean {
    return (
      error.category === 'NETWORK' ||
      error.code === 'FIRESTORE_QUOTA_EXCEEDED' ||
      error.originalError?.code === 'unavailable'
    );
  }

  // Executes a service operation with retry policy (exponential backoff) for transient errors
  public async retryable<T>(
    operation: () => Promise<T>,
    category: ErrorCategory = 'UNKNOWN',
    maxRetries = 3,
    delayMs = 1000
  ): Promise<T> {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        return await operation();
      } catch (err: any) {
        attempts++;
        const parsed = this.parse(err, category);
        
        if (attempts >= maxRetries || !this.isTransient(parsed)) {
          throw parsed;
        }

        const backoffDelay = delayMs * Math.pow(2, attempts - 1);
        Logger.warn(`Transient error encountered on attempt ${attempts}. Retrying in ${backoffDelay}ms...`, {
          error: parsed.message,
          code: parsed.code,
          correlationId: parsed.correlationId
        });
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
    throw this.parse(new Error('Max retries exceeded'));
  }

  // Centrally handles error logging and displays custom Toast notification (deduplicated)
  public handle(err: any, toast: any, category: ErrorCategory = 'UNKNOWN', context?: any) {
    const parsed = this.parse(err, category);
    
    // Log the error using the structured logger
    Logger.error(parsed.message, {
      errorCode: parsed.code,
      category: parsed.category,
      correlationId: parsed.correlationId,
      stack: parsed.originalError?.stack,
      ...context
    });

    // Deduplicate toast messages if they occur within 3 seconds of each other
    const now = Date.now();
    if (this.lastToastMessage === parsed.message && (now - this.lastToastTime) < 3000) {
      return; // Skip duplicate toast
    }

    this.lastToastMessage = parsed.message;
    this.lastToastTime = now;

    // Trigger toast notification
    if (toast && typeof toast.error === 'function') {
      toast.error(`${parsed.message} (Reference: ${parsed.correlationId?.slice(0, 8)})`);
    }
  }
}

export const ErrorService = new CentralizedErrorService();
