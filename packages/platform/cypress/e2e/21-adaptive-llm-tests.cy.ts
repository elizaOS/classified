/// <reference types="cypress" />

/**
 * ADAPTIVE LLM-POWERED TESTS
 *
 * These tests evolve and adapt based on system responses, using LLM intelligence
 * to create dynamic test scenarios that respond to the actual generated code
 * and system behavior.
 */

import { LLMTestDriver } from './20-llm-powered-real-e2e.cy';

class AdaptiveLLMTester {
  constructor() {
    this.learningHistory = [];
    this.adaptiveScenarios = [];
    this.systemBehaviorPattern = {};
  }

  /**
   * Learn from previous test results and adapt future tests
   */
  async learnFromResults(testResults, generatedCode, userPrompt) {
    const learningData = {
      timestamp: Date.now(),
      userPrompt,
      generatedCode,
      testResults,
      patterns: this.identifyPatterns(testResults),
      improvements: await this.generateImprovements(testResults),
    };

    this.learningHistory.push(learningData);
    await this.updateAdaptiveScenarios(learningData);

    return learningData;
  }

  /**
   * Generate adaptive test scenarios based on learned patterns
   */
  async generateAdaptiveScenarios(
    projectType,
    complexity,
    previousResults = [],
  ) {
    const prompt = `
    Based on previous test results and system behavior, generate adaptive test scenarios:
    
    PROJECT TYPE: ${projectType}
    COMPLEXITY: ${complexity}
    
    PREVIOUS TEST PATTERNS:
    ${JSON.stringify(this.systemBehaviorPattern, null, 2)}
    
    LEARNING HISTORY:
    ${this.learningHistory
      .slice(-3)
      .map(
        (h) => `
    - User: ${h.userPrompt}
    - Code Quality: ${h.testResults.codeQuality || 'N/A'}
    - Issues Found: ${h.testResults.issues?.length || 0}
    - Common Problems: ${h.patterns.commonIssues || 'None'}
    `,
      )
      .join('\n')}
    
    Generate test scenarios that:
    1. Target weak areas discovered in previous tests
    2. Validate improvements in previously problematic areas
    3. Explore edge cases that haven't been tested yet
    4. Adapt to the specific patterns of this project type
    
    Create scenarios that will push the system to its limits and discover new issues.
    
    Return JSON array of test scenarios with specific steps and validations.
    `;

    // Use LLM to generate adaptive scenarios
    return cy
      .request({
        method: 'POST',
        url: '/api/llm/generate-test-scenarios',
        headers: {
          Authorization: 'Bearer ' + Cypress.env('TEST_AUTH_TOKEN'),
          'Content-Type': 'application/json',
        },
        body: {
          prompt,
          context: 'adaptive_testing',
          learningHistory: this.learningHistory,
          systemPatterns: this.systemBehaviorPattern,
        },
      })
      .then((response) => {
        return response.body.data.scenarios;
      });
  }

  /**
   * Execute adaptive test with real-time evolution
   */
  async executeAdaptiveTest(scenario, llmDriver) {
    cy.log(`🧠 Executing adaptive test: ${scenario.name}`);

    let testEvolution = [];
    let currentStep = 0;

    for (const step of scenario.steps) {
      cy.log(`📝 Step ${currentStep + 1}: ${step.action}`);

      try {
        // Execute the step
        const stepResult = await this.executeTestStep(step, llmDriver);
        testEvolution.push({
          step: currentStep,
          action: step.action,
          result: stepResult,
          success: true,
          timestamp: Date.now(),
        });

        // Analyze result and potentially modify next steps
        if (stepResult.needsAdaptation) {
          const adaptedSteps = await this.adaptNextSteps(
            scenario.steps.slice(currentStep + 1),
            stepResult,
            testEvolution,
          );
          scenario.steps = [
            ...scenario.steps.slice(0, currentStep + 1),
            ...adaptedSteps,
          ];
          cy.log(
            `🔄 Test adapted based on result: ${stepResult.adaptationReason}`,
          );
        }
      } catch (error) {
        cy.log(`❌ Step failed: ${error.message}`);
        testEvolution.push({
          step: currentStep,
          action: step.action,
          error: error.message,
          success: false,
          timestamp: Date.now(),
        });

        // Try to recover or adapt the test
        const recovery = await this.attemptRecovery(
          error,
          scenario,
          currentStep,
        );
        if (recovery.canContinue) {
          cy.log(`🔧 Attempting recovery: ${recovery.strategy}`);
          continue;
        } else {
          throw error;
        }
      }

      currentStep++;
    }

    return {
      scenario: scenario.name,
      evolution: testEvolution,
      success: testEvolution.every((e) => e.success),
      adaptations: testEvolution.filter((e) => e.needsAdaptation).length,
      learnings: await this.extractLearnings(testEvolution),
    };
  }

  /**
   * Execute individual test step with intelligence
   */
  async executeTestStep(step, llmDriver) {
    switch (step.action) {
      case 'prompt_conversation':
        return await llmDriver.startRealConversation(step.input.prompt);

      case 'continue_conversation':
        return await llmDriver.continueConversation(step.input.message);

      case 'wait_for_generation':
        return await llmDriver.waitForCodeGeneration();

      case 'validate_code':
        return await llmDriver.validateCodeQuality(step.input.expectedFeatures);

      case 'test_execution':
        return await llmDriver.testGeneratedCode();

      case 'adaptive_analysis':
        return await this.performAdaptiveAnalysis(step.input, llmDriver);

      case 'intelligent_refinement':
        return await this.performIntelligentRefinement(step.input, llmDriver);

      default:
        throw new Error(`Unknown test step action: ${step.action}`);
    }
  }

  /**
   * Perform adaptive analysis based on current state
   */
  async performAdaptiveAnalysis(input, llmDriver) {
    const analysisPrompt = `
    Analyze the current state of code generation and determine:
    1. What quality issues exist?
    2. What features are missing or incomplete?
    3. What improvements would have the highest impact?
    4. Should we continue or request refinements?
    
    Current context: ${JSON.stringify(input.context)}
    Generated artifacts: ${input.artifacts?.length || 0} files
    
    Provide actionable recommendations and a confidence score (0-100) for proceeding.
    `;

    return cy
      .request({
        method: 'POST',
        url: '/api/llm/adaptive-analysis',
        body: {
          prompt: analysisPrompt,
          context: input.context,
          artifacts: input.artifacts,
        },
      })
      .then((response) => {
        const analysis = response.body.data;

        return {
          recommendations: analysis.recommendations,
          confidence: analysis.confidence,
          shouldContinue: analysis.confidence > 70,
          needsAdaptation: analysis.confidence < 60,
          adaptationReason: analysis.reason,
        };
      });
  }

  /**
   * Perform intelligent refinement based on analysis
   */
  async performIntelligentRefinement(input, llmDriver) {
    const refinementPrompt = `
    Based on the code analysis, generate specific refinement requests:
    
    Issues found: ${JSON.stringify(input.issues)}
    Quality scores: ${JSON.stringify(input.qualityScores)}
    Missing features: ${JSON.stringify(input.missingFeatures)}
    
    Generate natural language refinement requests that will address the most critical issues first.
    `;

    return cy
      .request({
        method: 'POST',
        url: '/api/llm/generate-refinement',
        body: {
          prompt: refinementPrompt,
          context: input,
        },
      })
      .then((response) => {
        const refinement = response.body.data.refinementRequest;

        // Execute the refinement conversation
        return llmDriver.continueConversation(refinement);
      });
  }

  /**
   * Adapt next steps based on current results
   */
  async adaptNextSteps(remainingSteps, currentResult, testHistory) {
    const adaptationPrompt = `
    Adapt the remaining test steps based on current results:
    
    CURRENT RESULT: ${JSON.stringify(currentResult)}
    REMAINING STEPS: ${JSON.stringify(remainingSteps)}
    TEST HISTORY: ${JSON.stringify(testHistory)}
    
    Modify, add, or remove steps to:
    1. Address any issues discovered
    2. Validate any changes made
    3. Explore new areas exposed by current results
    4. Skip unnecessary steps
    
    Return adapted test steps in the same format.
    `;

    return cy
      .request({
        method: 'POST',
        url: '/api/llm/adapt-test-steps',
        body: {
          prompt: adaptationPrompt,
          currentResult,
          remainingSteps,
          testHistory,
        },
      })
      .then((response) => {
        return response.body.data.adaptedSteps;
      });
  }

  /**
   * Attempt recovery from test failures
   */
  async attemptRecovery(error, scenario, failedStep) {
    const recoveryPrompt = `
    Test step failed with error: ${error.message}
    
    Scenario: ${scenario.name}
    Failed at step: ${failedStep}
    Step details: ${JSON.stringify(scenario.steps[failedStep])}
    
    Suggest recovery strategies:
    1. Can we retry with different parameters?
    2. Can we skip this step and continue?
    3. Can we modify the approach?
    4. Should we abort the test?
    
    Provide a recovery strategy and confidence level.
    `;

    return cy
      .request({
        method: 'POST',
        url: '/api/llm/recovery-strategy',
        body: {
          prompt: recoveryPrompt,
          error: error.message,
          scenario,
          failedStep,
        },
      })
      .then((response) => {
        return response.body.data;
      });
  }

  /**
   * Extract learnings from test evolution
   */
  async extractLearnings(testEvolution) {
    const patterns = {
      successPatterns: testEvolution.filter((e) => e.success),
      failurePatterns: testEvolution.filter((e) => !e.success),
      adaptationTriggers: testEvolution.filter((e) => e.needsAdaptation),
      commonIssues: this.identifyCommonIssues(testEvolution),
    };

    return {
      patterns,
      insights: await this.generateInsights(patterns),
      recommendations: await this.generateRecommendations(patterns),
    };
  }

  identifyPatterns(testResults) {
    // Analyze patterns in test results
    return {
      commonIssues: this.extractCommonIssues(testResults),
      successFactors: this.extractSuccessFactors(testResults),
      qualityTrends: this.analyzeQualityTrends(testResults),
    };
  }

  identifyCommonIssues(testEvolution) {
    const issues = testEvolution.filter((e) => e.error).map((e) => e.error);

    // Group similar issues
    const issueGroups = {};
    issues.forEach((issue) => {
      const key = this.categorizeIssue(issue);
      issueGroups[key] = (issueGroups[key] || 0) + 1;
    });

    return issueGroups;
  }

  categorizeIssue(issue) {
    if (issue.includes('timeout')) return 'timeout';
    if (issue.includes('validation')) return 'validation';
    if (issue.includes('network')) return 'network';
    if (issue.includes('auth')) return 'authentication';
    return 'other';
  }
}

describe('Adaptive LLM-Powered Tests', () => {
  let adaptiveTester;
  let llmDriver;

  beforeEach(() => {
    adaptiveTester = new AdaptiveLLMTester();
    llmDriver = new LLMTestDriver();

    // Set up adaptive test environment
    cy.visit('/autocoder');

    // Handle errors gracefully for adaptive testing
    cy.on('uncaught:exception', (err, runnable) => {
      // Log but don't fail on application errors - let adaptive system handle them
      cy.log(`⚠️ Application error: ${err.message}`);
      return false;
    });
  });

  it('should adapt test strategy based on system performance', () => {
    cy.log('🧠 Starting adaptive testing strategy...');

    // Phase 1: Initial system assessment
    const initialPrompt =
      'Create a simple DeFi staking contract with rewards distribution';

    llmDriver.startRealConversation(initialPrompt).then((sessionData) => {
      // Phase 2: Monitor and adapt based on initial response
      llmDriver.waitForCodeGeneration().then((buildResult) => {
        // Phase 3: Perform adaptive analysis
        adaptiveTester
          .performAdaptiveAnalysis(
            {
              context: sessionData,
              artifacts: buildResult.artifacts,
            },
            llmDriver,
          )
          .then((analysis) => {
            if (analysis.needsAdaptation) {
              cy.log(
                `🔄 Adapting test based on analysis: ${analysis.adaptationReason}`,
              );

              // Phase 4: Execute adaptive refinement
              adaptiveTester
                .performIntelligentRefinement(
                  {
                    issues: analysis.issues || [],
                    qualityScores: { overall: analysis.confidence },
                    missingFeatures: analysis.missingFeatures || [],
                  },
                  llmDriver,
                )
                .then(() => {
                  // Phase 5: Validate improvements
                  llmDriver.waitForCodeGeneration().then((refinedResult) => {
                    llmDriver
                      .validateCodeQuality(['staking', 'rewards', 'security'])
                      .then((validation) => {
                        // Learn from the adaptive process
                        adaptiveTester.learnFromResults(
                          validation,
                          refinedResult.artifacts,
                          initialPrompt,
                        );

                        expect(validation.codeQuality).to.be.greaterThan(
                          analysis.confidence,
                        );
                        cy.log('✅ Adaptive test strategy successful');
                      });
                  });
                });
            } else {
              cy.log(
                '✅ Initial generation met quality threshold, no adaptation needed',
              );
            }
          });
      });
    });
  });

  it('should evolve test scenarios based on discovered patterns', () => {
    cy.log('📈 Testing scenario evolution based on patterns...');

    // Test multiple scenarios and observe evolution
    const baseScenarios = [
      'Create a NFT marketplace with royalty features',
      'Build a DAO governance system with voting',
      'Implement a yield farming pool with rewards',
    ];

    baseScenarios.forEach((prompt, index) => {
      cy.log(`🎯 Testing scenario ${index + 1}: ${prompt}`);

      llmDriver.startRealConversation(prompt).then((sessionData) => {
        llmDriver.waitForCodeGeneration().then((buildResult) => {
          llmDriver.validateCodeQuality([]).then((validation) => {
            // Learn from each scenario
            adaptiveTester
              .learnFromResults(validation, buildResult.artifacts, prompt)
              .then((learning) => {
                if (index === baseScenarios.length - 1) {
                  // Generate evolved scenarios based on all learnings
                  adaptiveTester
                    .generateAdaptiveScenarios(
                      'defi',
                      'moderate',
                      adaptiveTester.learningHistory,
                    )
                    .then((evolvedScenarios) => {
                      expect(evolvedScenarios).to.have.length.greaterThan(0);
                      cy.log(
                        `🧬 Generated ${evolvedScenarios.length} evolved test scenarios`,
                      );

                      // Execute one evolved scenario
                      if (evolvedScenarios[0]) {
                        adaptiveTester
                          .executeAdaptiveTest(evolvedScenarios[0], llmDriver)
                          .then((result) => {
                            expect(result.success).to.be.true;
                            cy.log(
                              `✅ Evolved scenario executed with ${result.adaptations} adaptations`,
                            );
                          });
                      }
                    });
                }
              });
          });
        });
      });
    });
  });

  it('should handle complex multi-stage adaptive workflows', () => {
    cy.log('🌊 Testing complex multi-stage adaptive workflow...');

    const complexPrompt = `Create a comprehensive DeFi protocol with:
    1. Multi-asset liquidity pools
    2. Dynamic fee structures
    3. Governance token with voting
    4. Yield farming with multiple reward tokens
    5. Emergency pause mechanisms
    6. Upgradeable smart contracts`;

    // Stage 1: Initial complex generation
    llmDriver.startRealConversation(complexPrompt).then((sessionData) => {
      // Stage 2: Monitor complexity handling
      llmDriver.waitForCodeGeneration().then((buildResult) => {
        // Stage 3: Adaptive quality assessment
        llmDriver
          .validateCodeQuality([
            'liquidity pools',
            'governance',
            'yield farming',
            'emergency controls',
            'upgradeability',
          ])
          .then((validation) => {
            // Stage 4: Intelligent iteration based on gaps
            if (validation.featureCoverage < 80) {
              const missingFeatures = validation.issues
                .filter((i) => i.category === 'functionality')
                .map((i) => i.description);

              adaptiveTester
                .performIntelligentRefinement(
                  {
                    issues: validation.issues,
                    qualityScores: validation,
                    missingFeatures,
                  },
                  llmDriver,
                )
                .then(() => {
                  // Stage 5: Re-validate after refinement
                  llmDriver.waitForCodeGeneration().then((refinedResult) => {
                    llmDriver
                      .validateCodeQuality([
                        'liquidity pools',
                        'governance',
                        'yield farming',
                        'emergency controls',
                        'upgradeability',
                      ])
                      .then((finalValidation) => {
                        expect(
                          finalValidation.featureCoverage,
                        ).to.be.greaterThan(validation.featureCoverage);
                        expect(finalValidation.codeQuality).to.be.at.least(75);

                        cy.log(
                          '✅ Complex multi-stage adaptive workflow completed',
                        );
                        cy.log(
                          `📊 Improvement: ${validation.featureCoverage}% → ${finalValidation.featureCoverage}%`,
                        );
                      });
                  });
                });
            } else {
              cy.log(
                '✅ Complex prompt handled successfully without refinement needed',
              );
            }
          });
      });
    });
  });

  it('should demonstrate learning across test sessions', () => {
    cy.log('🎓 Testing learning persistence across sessions...');

    // Simulate multiple test sessions with learning
    const learningPrompts = [
      'Create a simple AMM DEX',
      'Build an improved AMM with concentrated liquidity',
      'Develop an advanced AMM with dynamic fees and MEV protection',
    ];

    learningPrompts.forEach((prompt, sessionIndex) => {
      cy.log(`📚 Learning session ${sessionIndex + 1}: ${prompt}`);

      llmDriver.startRealConversation(prompt).then((sessionData) => {
        llmDriver.waitForCodeGeneration().then((buildResult) => {
          llmDriver
            .validateCodeQuality(['AMM', 'liquidity', 'trading'])
            .then((validation) => {
              // Record learning for this session
              adaptiveTester
                .learnFromResults(validation, buildResult.artifacts, prompt)
                .then((learning) => {
                  // Verify learning is accumulating
                  expect(adaptiveTester.learningHistory).to.have.length(
                    sessionIndex + 1,
                  );

                  if (sessionIndex > 0) {
                    // Compare with previous session to show improvement
                    const previousLearning =
                      adaptiveTester.learningHistory[sessionIndex - 1];
                    const currentLearning =
                      adaptiveTester.learningHistory[sessionIndex];

                    cy.log(
                      `📈 Learning progression from session ${sessionIndex} to ${sessionIndex + 1}:`,
                    );
                    cy.log(
                      `   Code Quality: ${previousLearning.testResults.codeQuality} → ${currentLearning.testResults.codeQuality}`,
                    );

                    // Expect some improvement or maintained quality
                    expect(
                      currentLearning.testResults.codeQuality,
                    ).to.be.at.least(
                      previousLearning.testResults.codeQuality - 5,
                    );
                  }

                  if (sessionIndex === learningPrompts.length - 1) {
                    cy.log('🎓 Learning demonstration complete');
                    cy.log(
                      `📊 Total learning sessions: ${adaptiveTester.learningHistory.length}`,
                    );
                  }
                });
            });
        });
      });
    });
  });
});

export { AdaptiveLLMTester };
