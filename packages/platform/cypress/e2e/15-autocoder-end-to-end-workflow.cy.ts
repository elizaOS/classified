/// <reference types="cypress" />

describe('Autocoder End-to-End Workflow', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearAuthState();

    // Mock comprehensive authentication
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: {
            id: 'workflow-user-123',
            email: 'workflow@elizaos.ai',
            firstName: 'Workflow',
            lastName: 'User',
            organizationId: 'workflow-org-123',
            role: 'owner',
            emailVerified: true,
          },
          organization: {
            id: 'workflow-org-123',
            name: 'ElizaOS Workflow Test',
            slug: 'elizaos-workflow',
            creditBalance: '5000.0',
            subscriptionTier: 'premium',
          },
        },
      },
    }).as('identity');

    // Mock Eliza session creation (chat initiation)
    cy.intercept('POST', '/api/autocoder/eliza', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          sessionId: 'eliza-session-123',
          message:
            "Hello! I'm ready to help you build something amazing. What would you like to create?",
          conversationId: 'conv-123',
        },
      },
    }).as('createElizaSession');

    // Mock conversation message processing
    cy.intercept('POST', '/api/autocoder/eliza/message', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          messageId: 'msg-123',
          processed: true,
        },
      },
    }).as('sendMessage');

    // Mock workflow bridge analysis and transition
    cy.intercept('POST', '/api/autocoder/eliza/analyze', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          intent: 'project_request',
          confidence: 0.85,
          projectType: 'trading',
          complexity: 'advanced',
          suggestedActions: [
            'Research Powell hedging strategies',
            'Design algorithm architecture',
            'Implement risk management',
          ],
          extractedRequirements: [
            'Federal Reserve interest rate tracking',
            'Automated hedging positions',
            'Real-time market data integration',
          ],
          shouldTransition: true,
          transitionReason: 'High confidence project request detected',
        },
      },
    }).as('analyzeConversation');

    // Mock project creation from workflow bridge
    cy.intercept('POST', '/api/autocoder/projects', {
      statusCode: 201,
      body: {
        success: true,
        data: {
          id: 'powell-project-123',
          name: 'Powell Hedging Strategy',
          description:
            'An algorithmic trading system for hedging against Federal Reserve interest rate changes',
          type: 'trading',
          status: 'planning',
          specification: {
            description: 'Powell hedging strategy implementation',
            features: [
              'Federal Reserve interest rate tracking',
              'Automated hedging positions',
              'Real-time market data integration',
            ],
            complexity: 'advanced',
            conversationContext: {
              originalPrompt: 'I want to build a Powell hedging strategy',
              extractedFromChat: true,
              analysisConfidence: 0.85,
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    }).as('createProject');

    // Mock project messages (chat within autocoder)
    cy.intercept('GET', '/api/autocoder/projects/powell-project-123/messages', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          messages: [
            {
              id: 'msg-1',
              type: 'system',
              message:
                'Welcome to your dedicated project workspace! 🚀\n\nI\'ve analyzed your request: "I want to build a Powell hedging strategy"\n\n**Project Analysis:**\n• **Type**: TRADING project\n• **Complexity**: ADVANCED\n• **Confidence**: 85%',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      },
    }).as('getProjectMessages');

    // Mock project build process
    cy.intercept('POST', '/api/autocoder/projects/powell-project-123/build', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          buildId: 'build-123',
          status: 'started',
          estimatedDuration: 300000, // 5 minutes
        },
      },
    }).as('buildProject');

    // Mock build status updates
    cy.intercept(
      'GET',
      '/api/autocoder/projects/powell-project-123/build/build-123/status',
      {
        statusCode: 200,
        body: {
          success: true,
          data: {
            buildId: 'build-123',
            status: 'completed',
            progress: 100,
            artifacts: [
              'src/strategies/PowellHedgingStrategy.ts',
              'src/data/FedDataService.ts',
              'src/risk/RiskManager.ts',
              'tests/PowellStrategy.test.ts',
            ],
            quality: {
              codeQuality: 92,
              testCoverage: 88,
              security: 95,
              documentation: 90,
            },
          },
        },
      },
    ).as('getBuildStatus');

    // Mock GitHub integration
    cy.intercept('POST', '/api/autocoder/github/deploy', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          repositoryUrl:
            'https://github.com/workflow-user/powell-hedging-strategy',
          deploymentId: 'deploy-123',
          status: 'deployed',
        },
      },
    }).as('deployToGitHub');

    // Mock test execution
    cy.intercept('POST', '/api/autocoder/projects/powell-project-123/test', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          testId: 'test-123',
          status: 'completed',
          results: {
            passed: 12,
            failed: 0,
            total: 12,
            coverage: 88.5,
            duration: 2500,
          },
          details: [
            {
              suite: 'PowellHedgingStrategy',
              tests: [
                { name: 'should track Fed rate changes', status: 'passed' },
                { name: 'should calculate hedge positions', status: 'passed' },
                { name: 'should manage risk limits', status: 'passed' },
              ],
            },
          ],
        },
      },
    }).as('runTests');

    // Mock live testing
    cy.intercept(
      'POST',
      '/api/autocoder/projects/powell-project-123/live-test',
      {
        statusCode: 200,
        body: {
          success: true,
          data: {
            sessionId: 'live-test-123',
            status: 'active',
            endpoint:
              'ws://localhost:3333/api/autocoder/live-test/live-test-123',
          },
        },
      },
    ).as('startLiveTest');

    // Mock project analytics
    cy.intercept(
      'GET',
      '/api/autocoder/projects/powell-project-123/analytics',
      {
        statusCode: 200,
        body: {
          success: true,
          data: {
            buildTime: 285000, // 4.75 minutes
            codeLines: 1250,
            testCount: 12,
            deploymentCount: 1,
            performanceMetrics: {
              buildSpeed: 'fast',
              codeQuality: 'excellent',
              testCoverage: 'good',
            },
          },
        },
      },
    ).as('getProjectAnalytics');
  });

  describe('Complete Workflow: Chat to Production', () => {
    it('should execute complete end-to-end workflow from chat initiation to deployment', () => {
      cy.devLogin();

      // Step 1: Start with chat interface (autocoder lander)
      cy.visit('/autocoder-lander', { failOnStatusCode: false });
      cy.contains('AI-Powered Development').should('be.visible');

      // Step 2: Initiate Eliza conversation
      cy.get('[data-cy="start-chat-btn"]', { timeout: 10000 }).should(
        'be.visible',
      );
      cy.get('[data-cy="start-chat-btn"]').click();
      cy.wait('@createElizaSession');

      // Step 3: Send project request message
      const projectRequest =
        'I want to build a Powell hedging strategy that automatically adjusts positions based on Federal Reserve interest rate signals';

      cy.get('[data-cy="chat-input"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-cy="chat-input"]').type(projectRequest);
      cy.get('[data-cy="send-message-btn"]').click();
      cy.wait('@sendMessage');

      // Step 4: Wait for analysis and automatic transition
      cy.wait('@analyzeConversation');
      cy.wait('@createProject');

      // Step 5: Verify transition to autocoder workspace
      cy.url().should('include', '/dashboard/autocoder');
      cy.contains('Powell Hedging Strategy').should('be.visible');
      cy.contains('TRADING project').should('be.visible');
      cy.contains('ADVANCED').should('be.visible');

      // Step 6: Verify project workspace initialization
      cy.wait('@getProjectMessages');
      cy.contains('Welcome to your dedicated project workspace!').should(
        'be.visible',
      );
      cy.contains('Federal Reserve interest rate tracking').should(
        'be.visible',
      );

      // Step 7: Initiate project build
      cy.get('[data-cy="build-project-btn"]').should('be.visible');
      cy.get('[data-cy="build-project-btn"]').click();
      cy.wait('@buildProject');

      // Step 8: Monitor build progress
      cy.contains('Build started').should('be.visible');
      cy.wait('@getBuildStatus');
      cy.contains('Build completed').should('be.visible');

      // Step 9: Verify generated artifacts
      cy.contains('PowellHedgingStrategy.ts').should('be.visible');
      cy.contains('FedDataService.ts').should('be.visible');
      cy.contains('RiskManager.ts').should('be.visible');

      // Step 10: Review quality metrics
      cy.contains('Code Quality: 92%').should('be.visible');
      cy.contains('Test Coverage: 88%').should('be.visible');
      cy.contains('Security Score: 95%').should('be.visible');

      // Step 11: Run comprehensive tests
      cy.get('[data-cy="run-tests-btn"]').should('be.visible');
      cy.get('[data-cy="run-tests-btn"]').click();
      cy.wait('@runTests');

      // Step 12: Verify test results
      cy.contains('12 tests passed').should('be.visible');
      cy.contains('0 tests failed').should('be.visible');
      cy.contains('should track Fed rate changes').should('be.visible');

      // Step 13: Deploy to GitHub
      cy.get('[data-cy="deploy-github-btn"]').should('be.visible');
      cy.get('[data-cy="deploy-github-btn"]').click();
      cy.wait('@deployToGitHub');

      // Step 14: Verify deployment success
      cy.contains('Deployed successfully').should('be.visible');
      cy.contains('github.com/workflow-user/powell-hedging-strategy').should(
        'be.visible',
      );

      // Step 15: Verify project analytics
      cy.wait('@getProjectAnalytics');
      cy.contains('Build Time: 4.75 minutes').should('be.visible');
      cy.contains('1,250 lines of code').should('be.visible');
    });

    it('should handle Powell hedging strategy specific features', () => {
      cy.devLogin();
      cy.visit('/dashboard/autocoder/projects/powell-project-123', {
        failOnStatusCode: false,
      });

      // Verify Powell-specific components
      cy.contains('Federal Reserve Data Integration').should('be.visible');
      cy.contains('Interest Rate Signal Processing').should('be.visible');
      cy.contains('Automated Hedging Algorithm').should('be.visible');

      // Test live strategy simulation
      cy.get('[data-cy="start-live-test-btn"]').click();
      cy.wait('@startLiveTest');

      cy.contains('Live test session active').should('be.visible');
      cy.contains('Simulating market conditions').should('be.visible');
    });

    it('should provide real-time feedback during build process', () => {
      cy.devLogin();
      cy.visit('/dashboard/autocoder/projects/powell-project-123', {
        failOnStatusCode: false,
      });

      // Mock progressive build updates
      cy.intercept(
        'GET',
        '/api/autocoder/projects/powell-project-123/build/*/status',
        (req) => {
          req.reply({
            statusCode: 200,
            body: {
              success: true,
              data: {
                buildId: 'build-123',
                status: 'building',
                progress: 65,
                currentStep: 'Implementing risk management algorithms',
                artifacts: [
                  'src/strategies/PowellHedgingStrategy.ts',
                  'src/data/FedDataService.ts',
                ],
              },
            },
          });
        },
      ).as('getBuildProgress');

      cy.get('[data-cy="build-project-btn"]').click();
      cy.wait('@buildProject');

      // Verify real-time updates
      cy.wait('@getBuildProgress');
      cy.contains('65%').should('be.visible');
      cy.contains('Implementing risk management algorithms').should(
        'be.visible',
      );
    });

    it('should handle error scenarios gracefully', () => {
      cy.devLogin();

      // Mock build failure
      cy.intercept('POST', '/api/autocoder/projects/*/build', {
        statusCode: 500,
        body: {
          success: false,
          error: 'Build failed due to dependency conflicts',
          details: {
            step: 'dependency_resolution',
            conflictingPackages: ['@types/node', 'typescript'],
          },
        },
      }).as('buildFailure');

      cy.visit('/dashboard/autocoder/projects/powell-project-123', {
        failOnStatusCode: false,
      });

      cy.get('[data-cy="build-project-btn"]').click();
      cy.wait('@buildFailure');

      // Verify error handling
      cy.contains('Build failed').should('be.visible');
      cy.contains('dependency conflicts').should('be.visible');
      cy.get('[data-cy="retry-build-btn"]').should('be.visible');
      cy.get('[data-cy="view-error-details-btn"]').should('be.visible');
    });

    it('should support collaborative workflow features', () => {
      cy.devLogin();
      cy.visit('/dashboard/autocoder/projects/powell-project-123', {
        failOnStatusCode: false,
      });

      // Mock collaboration features
      cy.intercept(
        'GET',
        '/api/autocoder/projects/powell-project-123/collaborators',
        {
          statusCode: 200,
          body: {
            success: true,
            data: {
              collaborators: [
                {
                  id: 'user-1',
                  name: 'Alice Johnson',
                  role: 'developer',
                  lastActive: new Date().toISOString(),
                },
                {
                  id: 'user-2',
                  name: 'Bob Smith',
                  role: 'reviewer',
                  lastActive: new Date().toISOString(),
                },
              ],
            },
          },
        },
      ).as('getCollaborators');

      // Verify collaboration UI
      cy.get('[data-cy="collaboration-panel"]').should('be.visible');
      cy.wait('@getCollaborators');
      cy.contains('Alice Johnson').should('be.visible');
      cy.contains('Bob Smith').should('be.visible');
    });
  });

  describe('Workflow Bridge Integration', () => {
    it('should analyze conversation context and trigger transition', () => {
      cy.devLogin();
      cy.visit('/autocoder-lander', { failOnStatusCode: false });

      // Mock workflow bridge service
      cy.intercept('POST', '/api/autocoder/workflow-bridge/analyze', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            analysis: {
              intent: 'project_request',
              confidence: 0.92,
              projectType: 'trading',
              complexity: 'advanced',
              urgency: 'high',
              extractedRequirements: [
                'Federal Reserve interest rate tracking',
                'Automated hedging positions',
                'Real-time market data integration',
                'Risk management algorithms',
              ],
              suggestedActions: [
                'Research Powell hedging strategies',
                'Design algorithm architecture',
                'Implement risk management',
                'Set up market data feeds',
              ],
            },
            transitionDecision: {
              shouldTransition: true,
              reason: 'Strong indicators for project implementation detected',
              recommendedWorkflow: 'autocoder_session',
              confidence: 0.92,
            },
          },
        },
      }).as('analyzeWorkflowBridge');

      // Start conversation
      cy.get('[data-cy="start-chat-btn"]').click();
      cy.wait('@createElizaSession');

      // Send complex project request
      const complexRequest = `I need to create an advanced trading algorithm that implements a Powell hedging strategy. 
        The system should:
        1. Monitor Federal Reserve speeches and FOMC minutes
        2. Analyze interest rate sentiment and probability of changes
        3. Automatically adjust hedging positions in treasury futures
        4. Implement sophisticated risk management with position sizing
        5. Provide real-time performance analytics and reporting
        
        This needs to be production-ready with comprehensive testing and deployment automation.`;

      cy.get('[data-cy="chat-input"]').type(complexRequest);
      cy.get('[data-cy="send-message-btn"]').click();
      cy.wait('@sendMessage');

      // Verify workflow bridge analysis
      cy.wait('@analyzeWorkflowBridge');

      // Should show transition preview
      cy.contains(
        "I've analyzed your request and I'm ready to help you build this",
      ).should('be.visible');
      cy.contains('TRADING project').should('be.visible');
      cy.contains('ADVANCED complexity').should('be.visible');
      cy.contains('Federal Reserve interest rate tracking').should(
        'be.visible',
      );

      // Verify automatic transition
      cy.wait('@createProject');
      cy.url().should('include', '/dashboard/autocoder');
    });

    it('should handle conversational refinement before transition', () => {
      cy.devLogin();
      cy.visit('/autocoder-lander', { failOnStatusCode: false });

      // Mock lower confidence analysis requiring clarification
      cy.intercept('POST', '/api/autocoder/workflow-bridge/analyze', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            analysis: {
              intent: 'project_request',
              confidence: 0.65,
              projectType: 'general',
              complexity: 'moderate',
              extractedRequirements: [
                'Some kind of trading system',
                'Uses economic data',
              ],
              suggestedActions: [
                'Clarify specific requirements',
                'Define scope and complexity',
              ],
            },
            transitionDecision: {
              shouldTransition: false,
              reason: 'Need more specific requirements before proceeding',
              recommendedWorkflow: 'continue_chat',
            },
          },
        },
      }).as('analyzeAmbiguous');

      cy.get('[data-cy="start-chat-btn"]').click();
      cy.wait('@createElizaSession');

      // Send ambiguous request
      cy.get('[data-cy="chat-input"]').type(
        'I want to build something that trades based on Powell',
      );
      cy.get('[data-cy="send-message-btn"]').click();
      cy.wait('@sendMessage');
      cy.wait('@analyzeAmbiguous');

      // Should ask for clarification instead of transitioning
      cy.contains('Could you provide more details').should('be.visible');
      cy.contains('What specific aspects').should('be.visible');

      // Should not transition yet
      cy.url().should('not.include', '/dashboard/autocoder');
    });
  });

  describe('Performance and Scale Testing', () => {
    it('should handle large project builds efficiently', () => {
      cy.devLogin();
      cy.visit('/dashboard/autocoder/projects/powell-project-123', {
        failOnStatusCode: false,
      });

      // Mock large project build
      cy.intercept('POST', '/api/autocoder/projects/*/build', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            buildId: 'large-build-123',
            status: 'started',
            estimatedDuration: 900000, // 15 minutes
            complexity: 'enterprise',
          },
        },
      }).as('buildLargeProject');

      cy.intercept('GET', '/api/autocoder/projects/*/build/*/status', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            buildId: 'large-build-123',
            status: 'completed',
            progress: 100,
            duration: 875000, // 14.6 minutes
            artifacts: Array.from(
              { length: 50 },
              (_, i) => `src/module${i}.ts`,
            ),
            quality: {
              codeQuality: 88,
              testCoverage: 92,
              security: 94,
              documentation: 85,
            },
          },
        },
      }).as('getLargeBuildStatus');

      cy.get('[data-cy="build-project-btn"]').click();
      cy.wait('@buildLargeProject');

      // Should show appropriate messaging for large builds
      cy.contains('Large project detected').should('be.visible');
      cy.contains('Estimated time: 15 minutes').should('be.visible');

      cy.wait('@getLargeBuildStatus');
      cy.contains('50 files generated').should('be.visible');
      cy.contains('14.6 minutes').should('be.visible');
    });

    it('should handle concurrent workflow sessions', () => {
      cy.devLogin();

      // Mock multiple concurrent sessions
      cy.intercept('GET', '/api/autocoder/sessions/active', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            sessions: [
              {
                id: 'session-1',
                projectId: 'project-1',
                name: 'Powell Strategy',
                status: 'building',
              },
              {
                id: 'session-2',
                projectId: 'project-2',
                name: 'DeFi Protocol',
                status: 'testing',
              },
            ],
          },
        },
      }).as('getActiveSessions');

      cy.visit('/dashboard/autocoder', { failOnStatusCode: false });
      cy.wait('@getActiveSessions');

      // Should show session management UI
      cy.contains('Active Sessions (2)').should('be.visible');
      cy.contains('Powell Strategy').should('be.visible');
      cy.contains('DeFi Protocol').should('be.visible');
    });
  });

  describe('Quality Assurance Integration', () => {
    it('should perform comprehensive code quality analysis', () => {
      cy.devLogin();
      cy.visit('/dashboard/autocoder/projects/powell-project-123', {
        failOnStatusCode: false,
      });

      // Mock detailed quality analysis
      cy.intercept('GET', '/api/autocoder/projects/*/quality-analysis', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            overallScore: 89,
            metrics: {
              codeQuality: {
                score: 92,
                issues: [
                  { type: 'complexity', severity: 'medium', count: 3 },
                  { type: 'duplication', severity: 'low', count: 1 },
                ],
              },
              security: {
                score: 95,
                vulnerabilities: [],
                recommendations: [
                  'Use environment variables for API keys',
                  'Implement rate limiting',
                ],
              },
              performance: {
                score: 87,
                benchmarks: {
                  executionTime: '45ms avg',
                  memoryUsage: '128MB peak',
                  throughput: '1000 req/sec',
                },
              },
              documentation: {
                score: 90,
                coverage: '88%',
                missing: ['API documentation', 'deployment guide'],
              },
            },
          },
        },
      }).as('getQualityAnalysis');

      cy.get('[data-cy="quality-analysis-btn"]').click();
      cy.wait('@getQualityAnalysis');

      // Verify quality dashboard
      cy.contains('Overall Score: 89%').should('be.visible');
      cy.contains('Security: 95%').should('be.visible');
      cy.contains('Performance: 87%').should('be.visible');
      cy.contains('Use environment variables').should('be.visible');
    });
  });
});
