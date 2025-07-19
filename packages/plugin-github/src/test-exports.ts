// Separate test exports to avoid bundling test code in production builds
// This file should only be imported by test runners

import { GitHubPluginTestSuite, GitHubIntelligentAnalysisTestSuite } from './tests';

export { GitHubPluginTestSuite, GitHubIntelligentAnalysisTestSuite };

// Combined test suites for comprehensive testing
export const AllGitHubTestSuites = [GitHubPluginTestSuite, GitHubIntelligentAnalysisTestSuite];

// Default export for compatibility
export default GitHubPluginTestSuite;
