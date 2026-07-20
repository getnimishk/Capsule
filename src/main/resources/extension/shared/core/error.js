// shared/core/error.js

/**
 * Base class for all Capsule-specific errors.
 */
class CapsuleError extends Error {
  constructor(message, code) {
    // M-5 FIX: Enforce that all CapsuleError subclasses supply an error code.
    // Failing silently with 'UNKNOWN_ERROR' defeats the purpose of typed errors.
    if (!code) throw new TypeError('CapsuleError: a typed error code string is required as the second argument.');
    super(message);
    this.name = 'CapsuleError';
    this.code = code;
  }
}

/**
 * Thrown when chrome.storage.local limits are exceeded.
 */
class CapsuleQuotaError extends CapsuleError {
  constructor(message = 'Conversation is larger than the local storage safety limit. Export it instead.') {
    super(message, 'QUOTA_EXCEEDED');
    this.name = 'CapsuleQuotaError';
  }
}

/**
 * Thrown when trying to save a malformed or empty conversation.
 */
class CapsuleValidationError extends CapsuleError {
  constructor(message = 'A conversation with at least one message is required.') {
    super(message, 'VALIDATION_FAILED');
    this.name = 'CapsuleValidationError';
  }
}

/**
 * Thrown when there's an issue with the underlying storage mechanism.
 */
class CapsuleStorageError extends CapsuleError {
  constructor(message) {
    super(message, 'STORAGE_ERROR');
    this.name = 'CapsuleStorageError';
  }
}

// Export for module systems (Node/Jest) or expose globally for browser extension environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CapsuleError, CapsuleQuotaError, CapsuleValidationError, CapsuleStorageError };
} else if (typeof window !== 'undefined') {
  window.CapsuleError = CapsuleError;
  window.CapsuleQuotaError = CapsuleQuotaError;
  window.CapsuleValidationError = CapsuleValidationError;
  window.CapsuleStorageError = CapsuleStorageError;
} else if (typeof self !== 'undefined') {
  self.CapsuleError = CapsuleError;
  self.CapsuleQuotaError = CapsuleQuotaError;
  self.CapsuleValidationError = CapsuleValidationError;
  self.CapsuleStorageError = CapsuleStorageError;
}
