export { TrustMiddleware } from './trustMiddleware';
export {
  TrustRequirements,
  getTrustRequirement,
  requiresElevatedTrust,
  getHighRiskActions,
  updateTrustRequirement,
} from './trustRequirements';

// Re-export for convenience
export type { TrustRequirements as TrustRequirementsType } from '../types/trust';
