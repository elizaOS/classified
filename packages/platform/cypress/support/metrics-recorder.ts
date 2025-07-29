/**
 * Comprehensive Metrics Recording and Validation System
 *
 * Records all test data for validation of 100% success rate requirement
 * and comprehensive analysis of agent performance
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface DetailedMetrics {
  // Test Identification
  testId: string;
  scenarioId: string;
  timestamp: string;
  testSession: string;

  // Environment Validation
  environment: {
    usedRealAgent: boolean;
    usedRealApiKeys: boolean;
    noMocksUsed: boolean;
    agentServerId?: string;
    agentRuntimeType: 'server' | 'local';
  };

  // Performance Metrics
  performance: {
    totalDuration: number;
    agentResponseTime: number;
    codeGenerationTime: number;
    testExecutionTime: number;
    buildTime: number;
    deploymentTime?: number;
  };

  // Quality Metrics
  quality: {
    codeQualityScore: number;
    testCoverageScore: number;
    securityScore: number;
    documentationScore: number;
    overallScore: number;
  };

  // Code Generation Metrics
  codeGeneration: {
    linesOfCode: number;
    filesGenerated: number;
    testsGenerated: number;
    testsPassed: number;
    testsFailed: number;
    compilationSuccessful: boolean;
  };

  // API Usage Metrics
  apiUsage: {
    totalApiCalls: number;
    tokensUsed: number;
    estimatedCost: number;
    errorRate: number;
    averageResponseTime: number;
  };

  // Success Validation
  validation: {
    success: boolean;
    meetsQualityRequirements: boolean;
    meetsPerformanceRequirements: boolean;
    allTestsPass: boolean;
    deploymentSuccessful: boolean;
    errorDetails?: string[];
  };

  // Detailed Results
  results: {
    generatedFiles: Record<string, string>;
    testResults: any;
    qualityAnalysis: any;
    deploymentInfo?: any;
  };
}

export interface BenchmarkSummary {
  testSession: string;
  timestamp: string;

  // Overall Results
  totalScenarios: number;
  successfulScenarios: number;
  failedScenarios: number;
  successRate: number;

  // Aggregate Metrics
  averageQualityScore: number;
  averagePerformance: number;
  totalLinesGenerated: number;
  totalTestsGenerated: number;
  totalApiCalls: number;
  totalTokensUsed: number;
  totalCost: number;

  // Environment Validation
  environmentValid: boolean;
  usedRealAgentRuntime: boolean;
  usedRealApiKeys: boolean;
  noMocksDetected: boolean;

  // Requirement Compliance
  meets100SuccessRequirement: boolean;
  meetsQualityRequirements: boolean;
  meetsPerformanceRequirements: boolean;

  // Detailed Scenarios
  scenarios: DetailedMetrics[];

  // Failure Analysis
  failureReasons: string[];
  improvementRecommendations: string[];
}

export class MetricsRecorder {
  private metricsDir: string;
  private currentSession: string;
  private sessionMetrics: DetailedMetrics[] = [];

  constructor(testSession: string) {
    this.currentSession = testSession;
    this.metricsDir = join(process.cwd(), 'cypress', 'results', 'metrics');
    this.ensureMetricsDirectory();
  }

  private ensureMetricsDirectory(): void {
    if (!existsSync(this.metricsDir)) {
      mkdirSync(this.metricsDir, { recursive: true });
    }
  }

  recordScenarioMetrics(metrics: DetailedMetrics): void {
    // Validate metrics completeness
    this.validateMetricsCompleteness(metrics);

    // Add to session collection
    this.sessionMetrics.push(metrics);

    // Write individual scenario file
    const scenarioFile = join(
      this.metricsDir,
      `${this.currentSession}-${metrics.scenarioId}.json`,
    );
    writeFileSync(scenarioFile, JSON.stringify(metrics, null, 2));

    console.log(`📊 Recorded metrics for scenario: ${metrics.scenarioId}`);
  }

  generateBenchmarkSummary(): BenchmarkSummary {
    const successfulScenarios = this.sessionMetrics.filter(
      (m) => m.validation.success,
    );
    const failedScenarios = this.sessionMetrics.filter(
      (m) => !m.validation.success,
    );

    const summary: BenchmarkSummary = {
      testSession: this.currentSession,
      timestamp: new Date().toISOString(),

      // Overall Results
      totalScenarios: this.sessionMetrics.length,
      successfulScenarios: successfulScenarios.length,
      failedScenarios: failedScenarios.length,
      successRate:
        (successfulScenarios.length / this.sessionMetrics.length) * 100,

      // Aggregate Metrics
      averageQualityScore: this.calculateAverage((m) => m.quality.overallScore),
      averagePerformance: this.calculateAverage(
        (m) => m.performance.totalDuration,
      ),
      totalLinesGenerated: this.calculateSum(
        (m) => m.codeGeneration.linesOfCode,
      ),
      totalTestsGenerated: this.calculateSum(
        (m) => m.codeGeneration.testsGenerated,
      ),
      totalApiCalls: this.calculateSum((m) => m.apiUsage.totalApiCalls),
      totalTokensUsed: this.calculateSum((m) => m.apiUsage.tokensUsed),
      totalCost: this.calculateSum((m) => m.apiUsage.estimatedCost),

      // Environment Validation
      environmentValid: this.validateEnvironment(),
      usedRealAgentRuntime: this.sessionMetrics.every(
        (m) => m.environment.usedRealAgent,
      ),
      usedRealApiKeys: this.sessionMetrics.every(
        (m) => m.environment.usedRealApiKeys,
      ),
      noMocksDetected: this.sessionMetrics.every(
        (m) => m.environment.noMocksUsed,
      ),

      // Requirement Compliance
      meets100SuccessRequirement:
        successfulScenarios.length === this.sessionMetrics.length,
      meetsQualityRequirements: this.sessionMetrics.every(
        (m) => m.validation.meetsQualityRequirements,
      ),
      meetsPerformanceRequirements: this.sessionMetrics.every(
        (m) => m.validation.meetsPerformanceRequirements,
      ),

      // Detailed Data
      scenarios: this.sessionMetrics,

      // Failure Analysis
      failureReasons: this.extractFailureReasons(),
      improvementRecommendations: this.generateRecommendations(),
    };

    // Write summary file
    const summaryFile = join(
      this.metricsDir,
      `${this.currentSession}-summary.json`,
    );
    writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

    console.log('📋 Generated benchmark summary:', summaryFile);
    return summary;
  }

  private validateMetricsCompleteness(metrics: DetailedMetrics): void {
    const requiredFields = [
      'testId',
      'scenarioId',
      'timestamp',
      'testSession',
      'environment.usedRealAgent',
      'environment.usedRealApiKeys',
      'environment.noMocksUsed',
      'performance.totalDuration',
      'quality.overallScore',
      'codeGeneration.linesOfCode',
      'codeGeneration.testsGenerated',
      'validation.success',
    ];

    const missingFields: string[] = [];

    requiredFields.forEach((field) => {
      const value = this.getNestedValue(metrics, field);
      if (value === undefined || value === null) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      throw new Error(
        `Incomplete metrics data. Missing fields: ${missingFields.join(', ')}`,
      );
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private calculateAverage(selector: (m: DetailedMetrics) => number): number {
    const values = this.sessionMetrics.map(selector).filter((v) => !isNaN(v));
    return values.length > 0
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : 0;
  }

  private calculateSum(selector: (m: DetailedMetrics) => number): number {
    return this.sessionMetrics
      .map(selector)
      .filter((v) => !isNaN(v))
      .reduce((sum, v) => sum + v, 0);
  }

  private validateEnvironment(): boolean {
    // Check that all scenarios used real environment
    return this.sessionMetrics.every(
      (m) =>
        m.environment.usedRealAgent &&
        m.environment.usedRealApiKeys &&
        m.environment.noMocksUsed,
    );
  }

  private extractFailureReasons(): string[] {
    const reasons: string[] = [];

    this.sessionMetrics
      .filter((m) => !m.validation.success)
      .forEach((metrics) => {
        if (metrics.validation.errorDetails) {
          reasons.push(...metrics.validation.errorDetails);
        }

        if (!metrics.validation.allTestsPass) {
          reasons.push(`${metrics.scenarioId}: Generated tests failed`);
        }

        if (!metrics.validation.meetsQualityRequirements) {
          reasons.push(`${metrics.scenarioId}: Quality requirements not met`);
        }

        if (!metrics.validation.meetsPerformanceRequirements) {
          reasons.push(
            `${metrics.scenarioId}: Performance requirements not met`,
          );
        }
      });

    return [...new Set(reasons)]; // Remove duplicates
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze performance issues
    const avgDuration = this.calculateAverage(
      (m) => m.performance.totalDuration,
    );
    if (avgDuration > 600000) {
      // > 10 minutes
      recommendations.push(
        'Consider optimizing agent response time or increasing timeout limits',
      );
    }

    // Analyze quality issues
    const avgQuality = this.calculateAverage((m) => m.quality.overallScore);
    if (avgQuality < 85) {
      recommendations.push(
        'Improve agent prompts or validation criteria to achieve higher quality scores',
      );
    }

    // Analyze test failures
    const failedTests = this.sessionMetrics.some(
      (m) => m.codeGeneration.testsFailed > 0,
    );
    if (failedTests) {
      recommendations.push(
        'Review test generation logic to ensure all generated tests pass',
      );
    }

    // Analyze API usage efficiency
    const avgApiCalls = this.calculateAverage((m) => m.apiUsage.totalApiCalls);
    if (avgApiCalls > 100) {
      recommendations.push(
        'Optimize API usage to reduce costs and improve performance',
      );
    }

    return recommendations;
  }

  static loadBenchmarkSummary(testSession: string): BenchmarkSummary | null {
    const metricsDir = join(process.cwd(), 'cypress', 'results', 'metrics');
    const summaryFile = join(metricsDir, `${testSession}-summary.json`);

    if (existsSync(summaryFile)) {
      const content = readFileSync(summaryFile, 'utf-8');
      return JSON.parse(content);
    }

    return null;
  }

  static validateBenchmarkRequirements(summary: BenchmarkSummary): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // 100% success rate requirement
    if (summary.successRate !== 100) {
      violations.push(`Success rate ${summary.successRate}% must be 100%`);
    }

    // Real environment requirement
    if (!summary.usedRealAgentRuntime) {
      violations.push('Must use real agent runtime, not mocks');
    }

    if (!summary.usedRealApiKeys) {
      violations.push('Must use real API keys, not mocks');
    }

    if (!summary.noMocksDetected) {
      violations.push('No mocks should be used in real agent tests');
    }

    // Quality requirements
    if (!summary.meetsQualityRequirements) {
      violations.push('Quality requirements not met across all scenarios');
    }

    // Performance requirements
    if (!summary.meetsPerformanceRequirements) {
      violations.push('Performance requirements not met across all scenarios');
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }
}

export default MetricsRecorder;
