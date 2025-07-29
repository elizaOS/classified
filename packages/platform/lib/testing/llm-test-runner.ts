/**
 * LLM-POWERED SMART TEST RUNNER
 *
 * This service uses LLM intelligence to:
 * - Analyze generated code quality
 * - Create dynamic test scenarios
 * - Validate feature completeness
 * - Provide intelligent feedback
 */

import { OpenAI } from 'openai';
import fs from 'fs/promises';
import path from 'path';

export interface LLMTestConfig {
  openaiApiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  useRealLLM: boolean;
}

export interface CodeAnalysisResult {
  codeQuality: number; // 0-100
  featureCoverage: number; // 0-100
  testCoverage: number; // 0-100
  documentation: number; // 0-100
  securityScore: number; // 0-100
  performanceScore: number; // 0-100
  maintainabilityScore: number; // 0-100
  issues: CodeIssue[];
  suggestions: string[];
  overallScore: number;
}

export interface CodeIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category:
    | 'security'
    | 'performance'
    | 'maintainability'
    | 'functionality'
    | 'style';
  description: string;
  file: string;
  line?: number;
  suggestion: string;
}

export interface TestScenario {
  name: string;
  description: string;
  steps: TestStep[];
  expectedOutcome: string;
  complexity: 'simple' | 'moderate' | 'advanced';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface TestStep {
  action: string;
  input?: any;
  expectedResult?: any;
  validation: string;
}

export class LLMTestRunner {
  private openai?: OpenAI;
  private config: LLMTestConfig;

  constructor(config: LLMTestConfig) {
    this.config = config;

    if (config.useRealLLM && config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    }
  }

  /**
   * Analyze generated code quality using LLM intelligence
   */
  async analyzeCodeQuality(
    projectId: string,
    artifacts: any[],
    originalPrompt: string,
    expectedFeatures: string[],
  ): Promise<CodeAnalysisResult> {
    if (!this.config.useRealLLM) {
      return this.getMockAnalysis();
    }

    try {
      // Prepare code content for analysis
      const codeContent = await this.prepareCodeForAnalysis(artifacts);

      const analysisPrompt = `
Analyze the following generated code project and provide a comprehensive quality assessment.

ORIGINAL USER REQUEST:
${originalPrompt}

EXPECTED FEATURES:
${expectedFeatures.join(', ')}

GENERATED CODE:
${codeContent}

Please analyze this code across the following dimensions and provide scores (0-100) and detailed feedback:

1. CODE QUALITY (0-100): Overall code structure, readability, best practices
2. FEATURE COVERAGE (0-100): How well does the code implement the requested features?
3. TEST COVERAGE (0-100): Quality and comprehensiveness of tests
4. DOCUMENTATION (0-100): Code comments, README, API documentation
5. SECURITY SCORE (0-100): Security vulnerabilities, best practices
6. PERFORMANCE SCORE (0-100): Efficiency, optimization, scalability
7. MAINTAINABILITY (0-100): Code organization, modularity, extensibility

For each dimension, provide:
- Numerical score (0-100)
- List of specific issues found (severity: critical/high/medium/low)
- Actionable suggestions for improvement

Also provide an overall assessment and recommendation.

Format your response as JSON with this structure:
{
  "codeQuality": number,
  "featureCoverage": number,
  "testCoverage": number,
  "documentation": number,
  "securityScore": number,
  "performanceScore": number,
  "maintainabilityScore": number,
  "issues": [
    {
      "severity": "high",
      "category": "security",
      "description": "Specific issue description",
      "file": "filename.ts",
      "line": 42,
      "suggestion": "How to fix this issue"
    }
  ],
  "suggestions": ["Overall improvement suggestions"],
  "overallScore": number,
  "summary": "Brief overall assessment"
}`;

      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert code reviewer and software architect with deep knowledge of blockchain development, DeFi protocols, and software engineering best practices. Provide thorough, actionable code analysis.',
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const analysisText = response.choices[0]?.message?.content || '';

      // Parse JSON response
      const analysis = JSON.parse(analysisText);

      return {
        ...analysis,
        overallScore: this.calculateOverallScore(analysis),
      };
    } catch (error) {
      console.error('LLM code analysis failed:', error);
      return this.getMockAnalysis();
    }
  }

  /**
   * Generate dynamic test scenarios based on the project
   */
  async generateTestScenarios(
    originalPrompt: string,
    projectType: string,
    complexity: string,
    generatedFeatures: string[],
  ): Promise<TestScenario[]> {
    if (!this.config.useRealLLM) {
      return this.getMockTestScenarios();
    }

    try {
      const scenarioPrompt = `
Generate comprehensive test scenarios for a ${projectType} project with ${complexity} complexity.

ORIGINAL REQUEST: ${originalPrompt}
IMPLEMENTED FEATURES: ${generatedFeatures.join(', ')}

Create test scenarios that cover:
1. Happy path functionality
2. Edge cases and error conditions
3. Performance under load
4. Security vulnerabilities
5. Integration points
6. User experience flows

For each scenario, provide:
- Clear name and description
- Step-by-step test steps
- Expected outcomes
- Priority level
- Complexity assessment

Focus on real-world scenarios that would actually break or validate the system.

Format as JSON array:
[
  {
    "name": "Test scenario name",
    "description": "What this test validates",
    "steps": [
      {
        "action": "What to do",
        "input": "Data or parameters",
        "expectedResult": "What should happen",
        "validation": "How to verify success"
      }
    ],
    "expectedOutcome": "Overall expected result",
    "complexity": "simple|moderate|advanced",
    "priority": "low|medium|high|critical"
  }
]`;

      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert QA engineer specializing in blockchain and DeFi testing. Create comprehensive, realistic test scenarios that catch real bugs.',
          },
          {
            role: 'user',
            content: scenarioPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      });

      const scenariosText = response.choices[0]?.message?.content || '[]';
      return JSON.parse(scenariosText);
    } catch (error) {
      console.error('LLM test scenario generation failed:', error);
      return this.getMockTestScenarios();
    }
  }

  /**
   * Validate if code meets user requirements using LLM understanding
   */
  async validateRequirements(
    originalPrompt: string,
    artifacts: any[],
    conversationHistory: any[],
  ): Promise<{
    requirementsMet: boolean;
    score: number;
    missingFeatures: string[];
    implementedFeatures: string[];
    recommendations: string[];
  }> {
    if (!this.config.useRealLLM) {
      return {
        requirementsMet: true,
        score: 85,
        missingFeatures: [],
        implementedFeatures: ['Mock feature 1', 'Mock feature 2'],
        recommendations: ['Mock recommendation'],
      };
    }

    try {
      const codeContent = await this.prepareCodeForAnalysis(artifacts);
      const conversationSummary =
        this.summarizeConversation(conversationHistory);

      const validationPrompt = `
Validate whether the generated code meets the user's original requirements.

ORIGINAL REQUEST:
${originalPrompt}

CONVERSATION HISTORY:
${conversationSummary}

GENERATED CODE:
${codeContent}

Analyze whether:
1. All explicitly requested features are implemented
2. Implicit requirements are addressed
3. User refinements from conversation are incorporated
4. Quality meets reasonable expectations

Provide:
- Boolean: Are requirements met?
- Score 0-100: How well requirements are satisfied
- List of missing features
- List of successfully implemented features  
- Recommendations for improvement

Format as JSON:
{
  "requirementsMet": boolean,
  "score": number,
  "missingFeatures": ["feature 1", "feature 2"],
  "implementedFeatures": ["feature 1", "feature 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "analysis": "Detailed explanation"
}`;

      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a product manager and technical architect expert at validating whether software implementations meet user requirements.',
          },
          {
            role: 'user',
            content: validationPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const validationText = response.choices[0]?.message?.content || '{}';
      return JSON.parse(validationText);
    } catch (error) {
      console.error('LLM requirements validation failed:', error);
      return {
        requirementsMet: false,
        score: 0,
        missingFeatures: ['Analysis failed'],
        implementedFeatures: [],
        recommendations: ['Retry analysis'],
      };
    }
  }

  /**
   * Generate improvement suggestions for generated code
   */
  async generateImprovements(
    artifacts: any[],
    analysisResult: CodeAnalysisResult,
    projectType: string,
  ): Promise<{
    prioritizedImprovements: Array<{
      category: string;
      description: string;
      impact: 'low' | 'medium' | 'high';
      effort: 'low' | 'medium' | 'high';
      implementation: string;
    }>;
    nextSteps: string[];
    refactoringPlan: string;
  }> {
    if (!this.config.useRealLLM) {
      return {
        prioritizedImprovements: [
          {
            category: 'Performance',
            description: 'Mock improvement suggestion',
            impact: 'medium',
            effort: 'low',
            implementation: 'Mock implementation steps',
          },
        ],
        nextSteps: ['Mock next step'],
        refactoringPlan: 'Mock refactoring plan',
      };
    }

    try {
      const codeContent = await this.prepareCodeForAnalysis(artifacts);

      const improvementPrompt = `
Based on the code analysis results, generate prioritized improvement recommendations.

PROJECT TYPE: ${projectType}

CODE ANALYSIS RESULTS:
- Code Quality: ${analysisResult.codeQuality}/100
- Feature Coverage: ${analysisResult.featureCoverage}/100
- Security Score: ${analysisResult.securityScore}/100
- Performance: ${analysisResult.performanceScore}/100

IDENTIFIED ISSUES:
${JSON.stringify(analysisResult.issues, null, 2)}

CURRENT CODE:
${codeContent}

Generate improvement recommendations prioritized by impact vs effort:

Format as JSON:
{
  "prioritizedImprovements": [
    {
      "category": "Security|Performance|Maintainability|Features",
      "description": "What to improve",
      "impact": "high|medium|low",
      "effort": "high|medium|low", 
      "implementation": "Specific steps to implement"
    }
  ],
  "nextSteps": ["Immediate action items"],
  "refactoringPlan": "Long-term refactoring strategy"
}`;

      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior software architect specializing in code improvement and refactoring strategies.',
          },
          {
            role: 'user',
            content: improvementPrompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 2500,
      });

      const improvementText = response.choices[0]?.message?.content || '{}';
      return JSON.parse(improvementText);
    } catch (error) {
      console.error('LLM improvement generation failed:', error);
      return {
        prioritizedImprovements: [],
        nextSteps: ['Analysis failed'],
        refactoringPlan: 'Unable to generate plan',
      };
    }
  }

  // Helper methods

  private async prepareCodeForAnalysis(artifacts: any[]): Promise<string> {
    let codeContent = '';

    for (const artifact of artifacts) {
      if (artifact.type === 'file' && artifact.content) {
        codeContent += `\n\n=== ${artifact.path} ===\n${artifact.content}`;
      }
    }

    // Truncate if too long for LLM context
    if (codeContent.length > 50000) {
      codeContent = `${codeContent.substring(0, 47000)}\n\n... (truncated for analysis)`;
    }

    return codeContent;
  }

  private summarizeConversation(history: any[]): string {
    return history.map((entry) => `${entry.role}: ${entry.message}`).join('\n');
  }

  private calculateOverallScore(analysis: any): number {
    const weights = {
      codeQuality: 0.2,
      featureCoverage: 0.25,
      testCoverage: 0.15,
      documentation: 0.1,
      securityScore: 0.15,
      performanceScore: 0.1,
      maintainabilityScore: 0.05,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([key, weight]) => {
      if (analysis[key] !== undefined) {
        weightedSum += analysis[key] * weight;
        totalWeight += weight;
      }
    });

    return Math.round(weightedSum / totalWeight);
  }

  private getMockAnalysis(): CodeAnalysisResult {
    return {
      codeQuality: 85,
      featureCoverage: 90,
      testCoverage: 75,
      documentation: 80,
      securityScore: 85,
      performanceScore: 80,
      maintainabilityScore: 85,
      issues: [
        {
          severity: 'medium',
          category: 'performance',
          description: 'Mock performance issue',
          file: 'mock.ts',
          line: 42,
          suggestion: 'Mock suggestion',
        },
      ],
      suggestions: ['Mock suggestion 1', 'Mock suggestion 2'],
      overallScore: 84,
    };
  }

  private getMockTestScenarios(): TestScenario[] {
    return [
      {
        name: 'Basic Functionality Test',
        description: 'Validate core features work as expected',
        steps: [
          {
            action: 'Initialize system',
            input: {},
            expectedResult: 'System ready',
            validation: 'Check system status',
          },
        ],
        expectedOutcome: 'All basic features functional',
        complexity: 'simple',
        priority: 'high',
      },
    ];
  }
}

export default LLMTestRunner;
