import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getSql } from '@/lib/database';
import { randomUUID } from 'crypto';
import { authService } from '@/lib/auth/session';
import { AutocoderAgentService } from '@/lib/autocoder/agent-service';
import { webSocketIntegration, notifyProjectUpdate } from '@/lib/websocket';

interface ElizaSessionRequest {
  prompt: string;
  conversationHistory?: Array<{
    type: 'user' | 'agent';
    message: string;
    timestamp: Date;
  }>;
  projectType?: 'defi' | 'trading' | 'dao' | 'nft' | 'general';
}

// Create a new autocoder session with Eliza
async function handlePOST(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ElizaSessionRequest;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 },
    );
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const sql = getSql();
  const projectId = randomUUID();

  try {
    // Analyze the prompt to determine project type and complexity
    const projectAnalysis = await analyzeUserPrompt(body.prompt);

    // Create a new autocoder project for the Eliza session
    await sql.query(
      `
      INSERT INTO autocoder_projects (
        id, user_id, name, type, description, status, specification, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `,
      [
        projectId,
        user.id,
        projectAnalysis.name,
        projectAnalysis.type,
        body.prompt,
        'planning',
        JSON.stringify(projectAnalysis.specification),
      ],
    );

    // Store the initial user message
    await sql.query(
      `
      INSERT INTO autocoder_messages (
        id, project_id, user_id, type, message, timestamp
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [randomUUID(), projectId, user.id, 'user', body.prompt],
    );

    // Initialize the conversation with enhanced system message
    await initializeElizaConversation(
      projectId,
      user.id,
      body.prompt,
      projectAnalysis,
    );

    // Send initial project creation notification
    notifyProjectUpdate(projectId, 'analysis', 'Project created, starting analysis...', {
      step: 'initialization',
      projectType: projectAnalysis.type,
    });

    // Start the agent processing in the background
    setTimeout(async () => {
      try {
        await processElizaSession(
          projectId,
          user.id,
          body.prompt,
          projectAnalysis,
        );
      } catch (error) {
        console.error('Background Eliza processing failed:', error);
        // Notify about the error
        notifyProjectUpdate(projectId, 'completion', 'Analysis failed', {
          error: true,
          message: 'Failed to process project analysis',
        });
      }
    }, 100);

    return NextResponse.json({
      success: true,
      projectId,
      project: {
        id: projectId,
        name: projectAnalysis.name,
        description: body.prompt,
        type: projectAnalysis.type,
        status: 'planning',
      },
      analysis: projectAnalysis,
    });
  } catch (error) {
    console.error('Failed to create Eliza session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 },
    );
  }
}

// Get Eliza session details
async function handleGET(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  const sql = getSql();

  try {
    // Get project details
    const projects = await sql.query(
      `
      SELECT * FROM autocoder_projects 
      WHERE id = $1 AND user_id = $2
      `,
      [projectId, user.id],
    );

    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get messages
    const messages = await sql.query(
      `
      SELECT * FROM autocoder_messages 
      WHERE project_id = $1 
      ORDER BY timestamp ASC
      `,
      [projectId],
    );

    return NextResponse.json({
      project: projects[0],
      messages,
    });
  } catch (error) {
    console.error('Failed to get Eliza session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 },
    );
  }
}

/**
 * Analyze user prompt to extract project requirements
 */
async function analyzeUserPrompt(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  // Determine project type based on keywords
  let type: 'defi' | 'trading' | 'dao' | 'nft' | 'general' = 'general';
  let complexity: 'simple' | 'moderate' | 'advanced' = 'moderate';
  let deploymentTarget = 'ethereum';

  if (
    lowerPrompt.includes('interest rate') ||
    lowerPrompt.includes('powell') ||
    lowerPrompt.includes('hedge')
  ) {
    type = 'trading';
    complexity = 'advanced';
    deploymentTarget = 'multi-chain';
  } else if (
    lowerPrompt.includes('defi') ||
    lowerPrompt.includes('yield') ||
    lowerPrompt.includes('liquidity')
  ) {
    type = 'defi';
    complexity = 'moderate';
  } else if (
    lowerPrompt.includes('bot') ||
    lowerPrompt.includes('trading') ||
    lowerPrompt.includes('monitor')
  ) {
    type = 'trading';
    complexity = 'moderate';
  } else if (
    lowerPrompt.includes('dao') ||
    lowerPrompt.includes('governance') ||
    lowerPrompt.includes('voting')
  ) {
    type = 'dao';
    complexity = 'advanced';
  } else if (
    lowerPrompt.includes('nft') ||
    lowerPrompt.includes('marketplace') ||
    lowerPrompt.includes('royalty')
  ) {
    type = 'nft';
    complexity = 'moderate';
  }

  // Generate project name
  const name = generateProjectName(prompt, type);

  // Create specification based on analysis
  const specification = {
    name,
    description: prompt,
    type,
    complexity,
    deploymentTarget,
    features: extractFeatures(prompt, type),
    requirements: extractRequirements(prompt, type),
    timeline: estimateTimeline(complexity),
    risksAndMitigations: identifyRisks(prompt, type),
  };

  return {
    name,
    type,
    complexity,
    deploymentTarget,
    specification,
  };
}

/**
 * Generate a project name based on prompt and type
 */
function generateProjectName(prompt: string, type: string): string {
  const promptWords = prompt.toLowerCase().split(' ').slice(0, 3);

  const typeWords = {
    defi: ['DeFi', 'Protocol'],
    trading: ['Trading', 'Strategy'],
    dao: ['DAO', 'Governance'],
    nft: ['NFT', 'Collection'],
    general: ['Project', 'System'],
  };

  if (
    prompt.toLowerCase().includes('powell') ||
    prompt.toLowerCase().includes('interest rate')
  ) {
    return 'Powell Hedging Strategy';
  }

  const words = typeWords[type as keyof typeof typeWords] || typeWords.general;
  const capitalizedFirst =
    promptWords[0]?.charAt(0).toUpperCase() + promptWords[0]?.slice(1) ||
    'Custom';

  return `${capitalizedFirst} ${words[0]}`;
}

/**
 * Extract features from user prompt
 */
function extractFeatures(prompt: string, type: string): string[] {
  const features = [];
  const lowerPrompt = prompt.toLowerCase();

  if (type === 'trading') {
    if (lowerPrompt.includes('polymarket')) {
      features.push('Polymarket prediction market integration');
    }
    if (lowerPrompt.includes('aave') || lowerPrompt.includes('yield')) {
      features.push('Aave yield looping');
    }
    if (lowerPrompt.includes('bitcoin') || lowerPrompt.includes('btc')) {
      features.push('Bitcoin shorting mechanism');
    }
    if (lowerPrompt.includes('usdc') || lowerPrompt.includes('convert')) {
      features.push('USDC conversion');
    }
    if (lowerPrompt.includes('solana')) {
      features.push('Solana bridge integration');
    }
    if (lowerPrompt.includes('monitor') || lowerPrompt.includes('bot')) {
      features.push('Price monitoring');
    }
  }

  if (type === 'defi') {
    if (lowerPrompt.includes('yield')) {
      features.push('Yield farming optimization');
    }
    if (lowerPrompt.includes('liquidity')) {
      features.push('Liquidity provision');
    }
    if (lowerPrompt.includes('swap')) {
      features.push('Token swapping');
    }
  }

  if (type === 'dao') {
    if (lowerPrompt.includes('voting')) {
      features.push('Voting mechanisms');
    }
    if (lowerPrompt.includes('treasury')) {
      features.push('Treasury management');
    }
    if (lowerPrompt.includes('governance')) {
      features.push('Governance token system');
    }
  }

  // Default features if none detected
  if (features.length === 0) {
    features.push('Core functionality', 'User interface', 'Security features');
  }

  return features;
}

/**
 * Extract requirements from prompt
 */
function extractRequirements(prompt: string, type: string): string[] {
  const requirements = [
    'Smart contract development',
    'Frontend interface',
    'Testing suite',
    'Security audit',
    'Documentation',
  ];

  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes('wallet')) {
    requirements.push('Wallet integration');
  }
  if (lowerPrompt.includes('api')) {
    requirements.push('API integration');
  }
  if (lowerPrompt.includes('monitor')) {
    requirements.push('Real-time monitoring');
  }
  if (lowerPrompt.includes('automatic')) {
    requirements.push('Automation features');
  }

  return requirements;
}

/**
 * Estimate project timeline based on complexity
 */
function estimateTimeline(complexity: string): string {
  switch (complexity) {
    case 'simple':
      return '1-2 days';
    case 'moderate':
      return '3-5 days';
    case 'advanced':
      return '1-2 weeks';
    default:
      return '3-5 days';
  }
}

/**
 * Identify risks for the project type
 */
function identifyRisks(
  prompt: string,
  type: string,
): Array<{
  risk: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}> {
  const risks: Array<{
    risk: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }> = [];

  if (type === 'trading') {
    risks.push({
      risk: 'Smart contract vulnerabilities',
      likelihood: 'medium',
      impact: 'high',
      mitigation: 'Comprehensive testing and security audits',
    });
    risks.push({
      risk: 'Market volatility impact',
      likelihood: 'high',
      impact: 'medium',
      mitigation: 'Implement risk management and stop-loss mechanisms',
    });
  }

  if (type === 'defi') {
    risks.push({
      risk: 'Protocol risks and composability',
      likelihood: 'medium',
      impact: 'high',
      mitigation: 'Careful protocol selection and risk assessment',
    });
  }

  // Default risk
  risks.push({
    risk: 'Implementation complexity',
    likelihood: 'medium',
    impact: 'medium',
    mitigation: 'Iterative development and thorough testing',
  });

  return risks;
}

/**
 * Initialize the Eliza conversation with enhanced context
 */
async function initializeElizaConversation(
  projectId: string,
  userId: string,
  prompt: string,
  analysis: any,
) {
  const systemMessage = {
    id: randomUUID(),
    projectId,
    userId,
    type: 'system',
    message: `Welcome! I'm Eliza, your AI assistant for building DeFi and trading systems. 

I understand you want to work on: "${prompt}"

Based on your request, I've identified this as a **${analysis.type}** project with **${analysis.complexity}** complexity. Here's what I can help you build:

${analysis.specification.features.map((f: string) => `• ${f}`).join('\n')}

**Estimated Timeline:** ${analysis.specification.timeline}

I'm ready to:
🔍 **Research** existing solutions and best practices
📋 **Plan** detailed implementation architecture  
⚡ **Build** production-ready code with comprehensive testing
🚀 **Deploy** and help you execute your strategy

Let's start by discussing your specific requirements and any preferences you have for the implementation. What aspects are most important to you?`,
    timestamp: new Date(),
    metadata: {
      step: 'initialization',
      projectType: analysis.type,
      complexity: analysis.complexity,
      capabilities: [
        'research',
        'planning',
        'code_generation',
        'testing',
        'deployment',
        'defi_expertise',
        'trading_strategies',
      ],
    },
  };

  const sql = getSql();
  await sql.query(
    `
    INSERT INTO autocoder_messages (
      id, project_id, user_id, type, message, timestamp, metadata
    ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
    `,
    [
      systemMessage.id,
      systemMessage.projectId,
      systemMessage.userId,
      systemMessage.type,
      systemMessage.message,
      JSON.stringify(systemMessage.metadata),
    ],
  );

  console.log(`Initialized Eliza conversation for project ${projectId}`);
}

/**
 * Process the Eliza session with enhanced agent capabilities
 */
async function processElizaSession(
  projectId: string,
  userId: string,
  prompt: string,
  analysis: any,
) {
  try {
    // Notify about analysis start
    notifyProjectUpdate(projectId, 'analysis', 'Initializing AI agent...', {
      step: 'agent_initialization',
    });

    const agentService = new AutocoderAgentService();
    await agentService.initialize();

    console.log(
      `Processing Eliza session for project ${projectId}, connected to server: ${agentService.getIsConnectedToServer()}`,
    );

    // Notify about requirements analysis
    notifyProjectUpdate(projectId, 'analysis', 'Analyzing project requirements...', {
      step: 'requirements_analysis',
    });

    // Generate detailed project analysis using the enhanced agent
    const projectAnalysis = await agentService.analyzeProjectRequirements(
      projectId,
      prompt,
      analysis.type,
    );

    // Notify about implementation planning
    notifyProjectUpdate(projectId, 'analysis', 'Generating implementation suggestions...', {
      step: 'implementation_planning',
    });

    // Generate implementation suggestions
    const suggestions = await agentService.generateImplementationSuggestions(
      analysis.type,
      analysis.specification.features,
      [],
    );

    // Notify about research phase
    notifyProjectUpdate(projectId, 'analysis', 'Researching best practices and solutions...', {
      step: 'research_phase',
    });

    // Enhanced research based on project type
    const research = await agentService.performResearch({
      projectType: analysis.type,
      features: analysis.specification.features,
      dependencies: analysis.specification.requirements,
    });

    // Create comprehensive specification with agent insights
    const enhancedSpecification = {
      ...analysis.specification,
      agentAnalysis: projectAnalysis,
      suggestions,
      research,
      agentId: agentService.getAgentId(),
      processedBy: agentService.getIsConnectedToServer()
        ? 'server-agent'
        : 'local-agent',
      status: 'analyzed',
      processingTimestamp: new Date().toISOString(),
    };

    // Notify about finalizing analysis
    notifyProjectUpdate(projectId, 'analysis', 'Finalizing analysis and preparing response...', {
      step: 'finalizing_analysis',
    });

    // Store enhanced results in project
    const sql = getSql();
    await sql.query(
      `
      UPDATE autocoder_projects 
      SET specification = $1, status = $2
      WHERE id = $3
      `,
      [JSON.stringify(enhancedSpecification), 'analyzed', projectId],
    );

    // Generate initial agent response message
    const responseMessage = `Great! I've analyzed your request for "${analysis.specification.name}". 

Here's what I found:
${projectAnalysis.analysis}

**Next Steps:**
${projectAnalysis.nextSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**Estimated Timeline:** ${projectAnalysis.estimatedTime}
**Complexity:** ${projectAnalysis.complexity}

I'm ready to start building this for you! Should I proceed with the implementation, or would you like to discuss any specific requirements first?`;

    // Store agent response message
    await sql.query(
      `
      INSERT INTO autocoder_messages (
        id, project_id, user_id, type, message, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      `,
      [
        randomUUID(),
        projectId,
        userId,
        'agent',
        responseMessage,
        JSON.stringify({
          agentId: agentService.getAgentId(),
          analysisComplete: true,
          projectType: analysis.type,
          complexity: projectAnalysis.complexity,
        }),
      ],
    );

    // Send final completion notification
    notifyProjectUpdate(projectId, 'completion', 'Analysis complete! Ready for next steps.', {
      step: 'analysis_complete',
      agentId: agentService.getAgentId(),
      complexity: projectAnalysis.complexity,
      nextStepsCount: projectAnalysis.nextSteps?.length || 0,
    });

    console.log(`Completed enhanced analysis for Eliza project ${projectId}`);
  } catch (error) {
    console.error('Eliza session processing failed:', error);

    // Store error message for user
    try {
      const sql = getSql();
      await sql.query(
        `
        INSERT INTO autocoder_messages (
          id, project_id, user_id, type, message, timestamp, metadata
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        `,
        [
          randomUUID(),
          projectId,
          userId,
          'agent',
          "I encountered an issue while analyzing your project. Let me try a different approach. Could you provide more details about what you'd like to build?",
          JSON.stringify({
            error: true,
            errorType: 'analysis_failed',
          }),
        ],
      );
    } catch (msgError) {
      console.error('Failed to store error message:', msgError);
    }
  }
}

export const { GET, POST } = wrapHandlers({
  handleGET,
  handlePOST,
});
