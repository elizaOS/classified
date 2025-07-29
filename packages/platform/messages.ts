const DEFAULT_ERROR_MESSAGE =
  'Something went wrong. Please try again or contact support if the issue persists.';
const DEFAULT_RESPONSE_MESSAGE = 'Completed successfully.';

export const errorCodes = {
  email_taken: 'An account with this email already exists.',
  invalid_token: 'Token is invalid or expired.',
  missing_token: 'Token is missing.',
  email_unchanged: 'Email is unchanged.',
  invalid_password: 'Password is invalid.',
  invalid_credentials: 'Invalid credentials.',
  invalid_update_token:
    'Could not update your account. Token is invalid or expired.',
  password_mismatch: 'Passwords do not match',
  missing_password: 'Password is required.',
  missing_new_password: 'New password is required.',
  old_password_invalid: 'Old password is incorrect.',
  password_unchanged: 'New password must be different.',
  new_password_mismatch: 'New passwords do not match.',
  missing_confirm_password: 'Password confirmation is required.',
  internal_server_error:
    'An unexpected error occurred. Please try again or contact support if the issue persists.',
  email_not_provided: 'A valid email address is required.',
  user_not_deleted: 'User is not deleted.',
  user_deleted:
    "You're not authorized to take this action, your account has been deleted.",
  session_expired: 'Your session has expired. Please log in again.',
  default: DEFAULT_ERROR_MESSAGE,
} as const;

export const responseCodes = {
  password_verified: 'Password verified.',
  email_updated: 'Email successfully updated.',
  email_confirmed: 'Email confirmed.',
  password_changed: 'Password changed successfully!',
  password_reset_sent:
    "You'll receive an email if your are registered in our system.",
  user_restored: 'Your account has been restored successfully.',
  default: DEFAULT_RESPONSE_MESSAGE,
} as const;

export type ErrorCode = keyof typeof errorCodes | string;
export type ResponseCode = keyof typeof responseCodes | string;

export function getErrorMessage(code: ErrorCode): string {
  return code in errorCodes
    ? errorCodes[code as keyof typeof errorCodes]
    : errorCodes['default'];
}

export function getResponseMessage(code: ResponseCode): string {
  return code in responseCodes
    ? responseCodes[code as keyof typeof responseCodes]
    : responseCodes['default'];
}
