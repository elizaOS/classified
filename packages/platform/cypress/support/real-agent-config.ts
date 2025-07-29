/**
 * Real Agent Runtime Configuration for E2E Tests
 *
 * This configuration ensures real agent runtime integration
 * with proper API keys and validation settings
 */

export interface RealAgentConfig {
  // Agent Runtime Settings
  agentServerUrl?: string;
  useLocalRuntime?: boolean;
  agentTimeout?: number;

  // API Configuration
  openaiApiKey?: string;
  anthropicApiKey?: string;
  githubToken?: string;

  // Quality Requirements
  minQualityScore: number;
  minTestCoverage: number;
  minSecurityScore: number;

  // Performance Requirements
  maxBuildTime: number;
  maxResponseTime: number;

  // Validation Settings
  requireAllTestsPass: boolean;
  recordMetrics: boolean;
  validateDeployment: boolean;
}

export const REAL_AGENT_CONFIG: RealAgentConfig = {
  // Agent Runtime
  agentServerUrl: process.env.AGENT_SERVER_URL || 'http://localhost:3000',
  useLocalRuntime: !process.env.AGENT_SERVER_URL,
  agentTimeout: 600000, // 10 minutes

  // API Keys (from environment)
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,

  // Quality Requirements (100% success rate)
  minQualityScore: 85,
  minTestCoverage: 90,
  minSecurityScore: 90,

  // Performance Requirements
  maxBuildTime: 1800000, // 30 minutes max
  maxResponseTime: 120000, // 2 minutes max for responses

  // Validation (strict requirements)
  requireAllTestsPass: true,
  recordMetrics: true,
  validateDeployment: true,
};

export const SCENARIO_CONFIGS = {
  'simple-plugin': {
    ...REAL_AGENT_CONFIG,
    minQualityScore: 85,
    maxBuildTime: 300000, // 5 minutes
    expectedFiles: ['src/index.ts', 'package.json', 'README.md', 'tests/'],
    minLinesOfCode: 100,
    minTestCount: 5,
  },

  'complex-defi': {
    ...REAL_AGENT_CONFIG,
    minQualityScore: 90,
    maxBuildTime: 900000, // 15 minutes
    expectedFiles: ['contracts/', 'src/', 'tests/', 'scripts/', 'docs/'],
    minLinesOfCode: 1000,
    minTestCount: 25,
  },

  'enterprise-trading': {
    ...REAL_AGENT_CONFIG,
    minQualityScore: 95,
    minSecurityScore: 95,
    maxBuildTime: 1800000, // 30 minutes
    expectedFiles: [
      'src/strategies/',
      'src/risk/',
      'src/compliance/',
      'tests/backtests/',
    ],
    minLinesOfCode: 2000,
    minTestCount: 50,
  },

  'fullstack-app': {
    ...REAL_AGENT_CONFIG,
    minQualityScore: 85,
    maxBuildTime: 1200000, // 20 minutes
    expectedFiles: ['frontend/', 'backend/', 'database/', 'docker-compose.yml'],
    minLinesOfCode: 1500,
    minTestCount: 30,
  },
};

export function validateEnvironment(): {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
} {
  const requiredVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
  const optionalVars = ['GITHUB_TOKEN', 'DATABASE_URL', 'AGENT_SERVER_URL'];

  const missingVars: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  requiredVars.forEach((varName) => {
    if (!process.env[varName] && !Cypress.env(varName)) {
      missingVars.push(varName);
    }
  });

  // Check optional variables
  optionalVars.forEach((varName) => {
    if (!process.env[varName] && !Cypress.env(varName)) {
      warnings.push(`Optional environment variable ${varName} not set`);
    }
  });

  return {
    isValid: missingVars.length === 0,
    missingVars,
    warnings,
  };
}

export function getAgentCharacter() {
  return {
    id: 'autocoder-test-agent',
    name: 'Autocoder Test Agent',
    username: 'autocoder-test',
    bio: [
      'Expert AI agent for testing autocoder functionality with real runtime',
    ],
    system: `You are an expert software development agent specialized in creating high-quality, production-ready code.
    
    Your role in testing is to:
    1. Generate real, working code that compiles and runs
    2. Create comprehensive test suites that actually pass
    3. Ensure all quality metrics meet or exceed requirements
    4. Provide accurate analysis and recommendations
    
    Always prioritize:
    - Code quality and maintainability
    - Comprehensive error handling
    - Security best practices
    - Proper testing coverage
    - Clear documentation
    
    For testing purposes, you must achieve 100% success rates on all generated code.`,
    messageExamples: [],
    knowledge: [],
    plugins: ['@elizaos/plugin-sql', '@elizaos/plugin-openai'],
    settings: {
      OPENAI_API_KEY: REAL_AGENT_CONFIG.openaiApiKey,
      ANTHROPIC_API_KEY: REAL_AGENT_CONFIG.anthropicApiKey,
    },
  };
}

export default REAL_AGENT_CONFIG;
