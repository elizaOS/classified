/**
 * Centralized trust level requirements for all actions across plugins
 * Trust levels range from 0-100:
 * - 0-20: Untrusted
 * - 21-50: Basic trust
 * - 51-80: Trusted
 * - 81-95: Highly trusted
 * - 96-100: Admin level
 */

export const TrustRequirements = new Map<string, number>([
  // Shell plugin - highest risk
  ['SHELL_EXECUTE', 90],
  ['SHELL_COMMAND', 90],

  // GitHub plugin - high risk
  ['AUTO_CODE_ISSUE', 85],
  ['CREATE_GITHUB_PR', 80],
  ['CREATE_PULL_REQUEST', 80],
  ['MERGE_PULL_REQUEST', 90],
  ['DELETE_GITHUB_REPO', 95],
  ['CREATE_GITHUB_REPO', 75],

  // Secrets Manager - very high risk
  ['MANAGE_SECRET', 95],
  ['SET_ENV_VAR', 90],
  ['GENERATE_ENV_VAR', 85],
  ['REQUEST_SECRET_FORM', 70],

  // Plugin Manager - high risk
  ['PUBLISH_PLUGIN', 90],
  ['INSTALL_PLUGIN', 85],
  ['UNLOAD_PLUGIN', 80],
  ['LOAD_PLUGIN', 75],

  // File operations - high risk
  ['DELETE_FILE', 80],
  ['WRITE_FILE', 75],
  ['CREATE_FILE', 70],
  ['READ_FILE', 50],

  // Knowledge plugin - medium risk
  ['UPDATE_KNOWLEDGE', 60],
  ['DELETE_KNOWLEDGE', 70],
  ['CREATE_KNOWLEDGE', 50],
  ['SEARCH_KNOWLEDGE', 30],

  // Todo plugin - low risk
  ['CREATE_TODO', 30],
  ['UPDATE_TODO', 40],
  ['COMPLETE_TODO', 40],
  ['DELETE_TODO', 50],
  ['LIST_TODOS', 20],

  // Rolodex plugin - medium risk
  ['SEND_MESSAGE_TO_ENTITY', 50],
  ['TRACK_ENTITY', 60],
  ['UPDATE_ENTITY', 65],
  ['REMOVE_ENTITY', 70],
  ['SEARCH_ENTITIES', 40],

  // Research plugin - low risk
  ['WEB_SEARCH', 30],
  ['CODE_SEARCH', 35],
  ['RESEARCH_TOPIC', 30],

  // Trust plugin - admin only
  ['GRANT_ROLE', 95],
  ['REVOKE_ROLE', 95],
  ['SET_TRUST_LEVEL', 95],
  ['EVALUATE_TRUST', 50],

  // Solana plugin - financial operations require high trust
  ['TRANSFER_SOL', 80], // High value financial transfers
  ['TRANSFER_TOKEN', 80], // High value financial transfers
  ['SWAP_TOKENS', 75], // Trading operations
  ['STAKE_SOL', 70], // Staking operations (can be recovered)
  ['SOLANA_TRANSFER', 80], // Generic transfer action
  ['SOLANA_SWAP', 75], // Generic swap action
  ['SOLANA_STAKE', 70], // Generic stake action

  // Default for unknown actions
  ['DEFAULT', 50],
]);

/**
 * Get the required trust level for an action
 * @param actionName The name of the action
 * @returns The required trust level (0-100)
 */
export function getTrustRequirement(actionName: string): number {
  return TrustRequirements.get(actionName) || TrustRequirements.get('DEFAULT') || 50;
}

/**
 * Check if an action requires elevated trust (>80)
 * @param actionName The name of the action
 * @returns True if the action requires elevated trust
 */
export function requiresElevatedTrust(actionName: string): boolean {
  return getTrustRequirement(actionName) > 80;
}

/**
 * Get all high-risk actions (trust requirement > 80)
 * @returns Array of high-risk action names
 */
export function getHighRiskActions(): string[] {
  const highRisk: string[] = [];
  TrustRequirements.forEach((level, action) => {
    if (level > 80 && action !== 'DEFAULT') {
      highRisk.push(action);
    }
  });
  return highRisk;
}

/**
 * Update trust requirement for an action (admin only)
 * @param actionName The action to update
 * @param newLevel The new trust level requirement
 */
export function updateTrustRequirement(actionName: string, newLevel: number): void {
  if (newLevel < 0 || newLevel > 100) {
    throw new Error('Trust level must be between 0 and 100');
  }
  TrustRequirements.set(actionName, newLevel);
}
