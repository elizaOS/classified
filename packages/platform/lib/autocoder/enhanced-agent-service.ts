/**
 * Enhanced Agent Service with Performance Monitoring and Optimization
 *
 * This enhanced version of the AutocoderAgentService includes:
 * - Performance monitoring and optimization
 * - Quality validation and improvement
 * - Error handling and retry logic
 * - Metrics collection for 100% success rate validation
 */

import { AutocoderAgentService } from './agent-service';
import { IAgentRuntime, ModelType } from '@elizaos/core';
import {
  MetricsRecorder,
  DetailedMetrics,
} from '../../cypress/support/metrics-recorder';

interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  apiCalls: number;
  tokensUsed: number;
  retryCount: number;
  errorCount: number;
}

interface QualityValidation {
  meetsMinimumStandards: boolean;
  qualityScore: number;
  issues: string[];
  recommendations: string[];
}

export class EnhancedAutocoderAgentService extends AutocoderAgentService {
  private performanceMetrics!: PerformanceMetrics;
  private qualityThresholds: {
    minQualityScore: number;
    minTestCoverage: number;
    minSecurityScore: number;
    maxRetries: number;
  };

  constructor(
    qualityThresholds = {
      minQualityScore: 85,
      minTestCoverage: 90,
      minSecurityScore: 90,
      maxRetries: 3,
    },
  ) {
    super();
    this.qualityThresholds = qualityThresholds;
    this.resetPerformanceMetrics();
  }

  private resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      startTime: Date.now(),
      apiCalls: 0,
      tokensUsed: 0,
      retryCount: 0,
      errorCount: 0,
    };
  }

  /**
   * Enhanced project analysis with quality validation
   */
  async analyzeProjectRequirementsEnhanced(
    projectId: string,
    userPrompt: string,
    projectType: string,
  ): Promise<{
    analysis: string;
    nextSteps: string[];
    estimatedTime: string;
    complexity: 'simple' | 'moderate' | 'advanced';
    qualityPrediction: QualityValidation;
  }> {
    this.resetPerformanceMetrics();

    let attempt = 0;
    while (attempt < this.qualityThresholds.maxRetries) {
      try {
        const result = await this.analyzeProjectRequirements(
          projectId,
          userPrompt,
          projectType,
        );

        // Validate quality prediction
        const qualityPrediction = await this.predictQuality(
          userPrompt,
          projectType,
        );

        if (qualityPrediction.meetsMinimumStandards) {
          return {
            ...result,
            qualityPrediction,
          };
        }

        // If quality prediction is low, enhance the prompt and retry
        const enhancedPrompt = await this.enhancePrompt(
          userPrompt,
          qualityPrediction.recommendations,
        );
        userPrompt = enhancedPrompt;
        attempt++;
        this.performanceMetrics.retryCount++;
      } catch (error) {
        this.performanceMetrics.errorCount++;
        attempt++;

        if (attempt >= this.qualityThresholds.maxRetries) {
          throw new Error(
            `Analysis failed after ${attempt} attempts: ${error}`,
          );
        }

        // Wait before retry with exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    throw new Error(
      'Failed to achieve quality standards after maximum retries',
    );
  }

  /**
   * Enhanced code generation with quality validation and optimization
   */
  async generateCodeEnhanced(specification: any): Promise<{
    files: Record<string, string>;
    packageJson: any;
    documentation: any;
    qualityMetrics: {
      codeQuality: number;
      testCoverage: number;
      security: number;
      performance: number;
      documentation: number;
    };
    performanceMetrics: PerformanceMetrics;
  }> {
    let attempt = 0;

    while (attempt < this.qualityThresholds.maxRetries) {
      try {
        // Perform research phase
        const researchResults = await this.performResearch({
          projectType: specification.type || 'plugin',
          features: specification.features || [],
          dependencies: specification.dependencies || [],
        });

        // Create implementation plan
        const implementationPlan = await this.createImplementationPlan({
          specification,
          researchResults,
        });

        // Generate code
        const codeResult = await this.generateCode({
          specification,
          plan: implementationPlan,
          researchContext: researchResults,
        });

        // Generate and run tests
        const testSuite = await this.generateTests({
          specification,
          code: codeResult,
          testCases: specification.testCases || [],
        });

        const testResults = await this.runTests({
          code: codeResult,
          tests: testSuite,
        });

        // Quality analysis
        const qualityAnalysis = await this.analyzeQuality({
          code: codeResult,
          tests: testSuite,
          securityRequirements: specification.securityRequirements || [],
        });

        // Validate quality meets requirements
        const qualityValidation = this.validateQualityResults(
          qualityAnalysis,
          testResults,
        );

        if (qualityValidation.meetsMinimumStandards) {
          this.performanceMetrics.endTime = Date.now();
          this.performanceMetrics.duration =
            this.performanceMetrics.endTime - this.performanceMetrics.startTime;

          return {
            files: codeResult.files,
            packageJson: codeResult.packageJson,
            documentation: codeResult.documentation,
            qualityMetrics: {
              codeQuality: qualityAnalysis.codeQuality,
              testCoverage: qualityAnalysis.testCoverage,
              security: qualityAnalysis.security,
              performance: qualityAnalysis.performance,
              documentation: qualityAnalysis.documentation,
            },
            performanceMetrics: { ...this.performanceMetrics },
          };
        }

        // If quality is insufficient, optimize and retry
        specification = await this.optimizeSpecification(
          specification,
          qualityValidation.recommendations,
        );
        attempt++;
        this.performanceMetrics.retryCount++;
      } catch (error) {
        this.performanceMetrics.errorCount++;
        attempt++;

        if (attempt >= this.qualityThresholds.maxRetries) {
          throw new Error(
            `Code generation failed after ${attempt} attempts: ${error}`,
          );
        }

        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    throw new Error('Failed to generate code meeting quality standards');
  }

  /**
   * Predict quality based on project requirements
   */
  private async predictQuality(
    prompt: string,
    projectType: string,
  ): Promise<QualityValidation> {
    const complexityScore = this.assessComplexity(prompt, projectType);
    const claritScore = this.assessClarity(prompt);
    const scopeScore = this.assessScope(prompt);

    const predictedQuality = (complexityScore + claritScore + scopeScore) / 3;
    const meetsMinimumStandards =
      predictedQuality >= this.qualityThresholds.minQualityScore;

    const issues: string[] = [];
    const recommendations: string[] = [];

    if (complexityScore < 80) {
      issues.push('Project complexity may be too high for reliable generation');
      recommendations.push(
        'Break down complex requirements into smaller, manageable components',
      );
    }

    if (claritScore < 80) {
      issues.push('Requirements are not sufficiently clear');
      recommendations.push(
        'Provide more specific technical details and constraints',
      );
    }

    if (scopeScore < 80) {
      issues.push('Project scope may be too broad');
      recommendations.push('Focus on core functionality first, then expand');
    }

    return {
      meetsMinimumStandards,
      qualityScore: predictedQuality,
      issues,
      recommendations,
    };
  }

  /**
   * Enhance prompt based on quality recommendations
   */
  private async enhancePrompt(
    originalPrompt: string,
    recommendations: string[],
  ): Promise<string> {
    const enhancementPrompt = `
    Enhance the following project description to improve code generation quality:
    
    Original: ${originalPrompt}
    
    Recommendations:
    ${recommendations.map((r) => `- ${r}`).join('\n')}
    
    Provide an enhanced version that addresses these recommendations while maintaining the original intent.
    `;

    try {
      const enhanced = await this.runtime!.useModel(ModelType.TEXT_LARGE, {
        prompt: enhancementPrompt,
        temperature: 0.3,
        maxTokens: 1000,
      });

      this.performanceMetrics.apiCalls++;
      this.performanceMetrics.tokensUsed += enhancementPrompt.length + 500; // Estimate

      return enhanced as string;
    } catch (error) {
      console.warn('Failed to enhance prompt, using original:', error);
      return originalPrompt;
    }
  }

  /**
   * Validate quality results against requirements
   */
  private validateQualityResults(
    qualityAnalysis: any,
    testResults: any,
  ): QualityValidation {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check code quality
    if (qualityAnalysis.codeQuality < this.qualityThresholds.minQualityScore) {
      issues.push(
        `Code quality ${qualityAnalysis.codeQuality}% below minimum ${this.qualityThresholds.minQualityScore}%`,
      );
      recommendations.push(
        'Improve code structure, naming conventions, and documentation',
      );
    }

    // Check test coverage
    if (qualityAnalysis.testCoverage < this.qualityThresholds.minTestCoverage) {
      issues.push(
        `Test coverage ${qualityAnalysis.testCoverage}% below minimum ${this.qualityThresholds.minTestCoverage}%`,
      );
      recommendations.push('Add more comprehensive unit and integration tests');
    }

    // Check security
    if (qualityAnalysis.security < this.qualityThresholds.minSecurityScore) {
      issues.push(
        `Security score ${qualityAnalysis.security}% below minimum ${this.qualityThresholds.minSecurityScore}%`,
      );
      recommendations.push(
        'Address security vulnerabilities and add input validation',
      );
    }

    // Check test results
    if (testResults.summary.failed > 0) {
      issues.push(`${testResults.summary.failed} tests failed`);
      recommendations.push(
        'Fix failing tests or improve test generation logic',
      );
    }

    return {
      meetsMinimumStandards: issues.length === 0,
      qualityScore: Math.min(
        qualityAnalysis.codeQuality,
        qualityAnalysis.testCoverage,
        qualityAnalysis.security,
      ),
      issues,
      recommendations,
    };
  }

  /**
   * Optimize specification based on quality recommendations
   */
  private async optimizeSpecification(
    specification: any,
    recommendations: string[],
  ): Promise<any> {
    const optimizationPrompt = `
    Optimize the following project specification to improve code quality:
    
    Current specification: ${JSON.stringify(specification, null, 2)}
    
    Recommendations:
    ${recommendations.map((r) => `- ${r}`).join('\n')}
    
    Provide an optimized specification that addresses these recommendations.
    Return as JSON with the same structure.
    `;

    try {
      const optimized = await this.runtime!.useModel(
        ModelType.TEXT_REASONING_LARGE,
        {
          prompt: optimizationPrompt,
          temperature: 0.2,
          maxTokens: 2000,
        },
      );

      this.performanceMetrics.apiCalls++;
      this.performanceMetrics.tokensUsed += optimizationPrompt.length + 1000; // Estimate

      return JSON.parse(optimized as string);
    } catch (error) {
      console.warn('Failed to optimize specification, using original:', error);
      return specification;
    }
  }

  /**
   * Assess complexity of project requirements
   */
  private assessComplexity(prompt: string, projectType: string): number {
    let score = 100;

    // Check for complex keywords
    const complexKeywords = [
      'enterprise',
      'production',
      'scalable',
      'distributed',
      'microservices',
      'kubernetes',
      'blockchain',
      'defi',
      'machine learning',
      'ai',
      'real-time',
      'high-frequency',
    ];

    const complexCount = complexKeywords.filter((keyword) =>
      prompt.toLowerCase().includes(keyword),
    ).length;

    score -= complexCount * 10; // Reduce score for each complex keyword

    // Check for multiple integrations
    const integrationKeywords = ['api', 'integration', 'connect', 'sync'];
    const integrationCount = integrationKeywords.filter((keyword) =>
      prompt.toLowerCase().includes(keyword),
    ).length;

    score -= integrationCount * 5;

    return Math.max(score, 0);
  }

  /**
   * Assess clarity of requirements
   */
  private assessClarity(prompt: string): number {
    let score = 100;

    // Check for vague terms
    const vagueTerms = ['something', 'somehow', 'maybe', 'possibly', 'might'];
    const vagueCount = vagueTerms.filter((term) =>
      prompt.toLowerCase().includes(term),
    ).length;

    score -= vagueCount * 15;

    // Check for specific technical terms (positive indicator)
    const technicalTerms = [
      'typescript',
      'react',
      'node',
      'api',
      'database',
      'test',
    ];
    const technicalCount = technicalTerms.filter((term) =>
      prompt.toLowerCase().includes(term),
    ).length;

    score += technicalCount * 5;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Assess scope of project
   */
  private assessScope(prompt: string): number {
    let score = 100;

    // Count features/requirements
    const featureIndicators = [
      'feature',
      'functionality',
      'capability',
      'component',
    ];
    const featureCount = featureIndicators.reduce((count, indicator) => {
      const matches = prompt.toLowerCase().match(new RegExp(indicator, 'g'));
      return count + (matches ? matches.length : 0);
    }, 0);

    if (featureCount > 10) {
      score -= 30; // Very large scope
    } else if (featureCount > 5) {
      score -= 15; // Large scope
    }

    return Math.max(score, 0);
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get performance metrics for the current operation
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }
}

export default EnhancedAutocoderAgentService;
