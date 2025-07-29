/**
 * Generation API Routes
 * HTTP endpoints for the generation domain
 */

export { generateHandler } from './handlers/generate';
export { batchGenerateHandler } from './handlers/batch';
export { analyticsHandler } from './handlers/analytics';
export { listHandler } from './handlers/list';

// Export validation schemas
export {
  generationRequestSchema,
  batchGenerationSchema,
  validateGenerationRequest,
  validateBatchRequest,
} from './validation';

// Export middleware
export {
  authMiddleware,
  rateLimitMiddleware,
  billingMiddleware,
  validationMiddleware,
} from './middleware';
