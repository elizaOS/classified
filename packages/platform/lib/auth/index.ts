/**
 * Platform Authentication
 * Simplified authentication system for ElizaOS
 */

export * from './session';
export * from './permissions';
export * from './workos';
export * from './context';

// Re-export simple JWT functions from api/auth
export {
  createJWT,
  verifyJWT,
  hashPassword,
  verifyPassword,
} from '../api/auth';
