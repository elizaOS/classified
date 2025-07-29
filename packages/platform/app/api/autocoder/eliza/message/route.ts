import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getSql } from '@/lib/database';
import { randomUUID } from 'crypto';
import { authService } from '@/lib/auth/session';
import { AutocoderAgentService } from '@/lib/autocoder/agent-service';

interface MessageRequest {
  projectId: string;
  message: string;
}

// Handle new messages in the Eliza session
async function handlePOST(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: MessageRequest = await request.json();

  if (!body.projectId || !body.message?.trim()) {
    return NextResponse.json(
      { error: 'Project ID and message are required' },
      { status: 400 },
    );
  }

  const sql = getSql();

  try {
    // Verify project ownership
    const projects = await sql.query(
      `
      SELECT * FROM autocoder_projects 
      WHERE id = $1 AND user_id = $2
      `,
      [body.projectId, user.id],
    );

    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];

    // Store the user message
    const messageId = randomUUID();
    await sql.query(
      `
      INSERT INTO autocoder_messages (
        id, project_id, user_id, type, message, timestamp
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [messageId, body.projectId, user.id, 'user', body.message],
    );

    // Get conversation history
    const messages = await sql.query(
      `
      SELECT * FROM autocoder_messages 
      WHERE project_id = $1 
      ORDER BY timestamp ASC
      LIMIT 20
      `,
      [body.projectId],
    );

    const conversationHistory = messages.map((msg: any) => ({
      type: msg.type as 'user' | 'agent',
      message: msg.message,
      timestamp: new Date(msg.timestamp),
    }));

    // Process message with agent in the background
    setTimeout(async () => {
      try {
        await processAgentResponse(
          body.projectId,
          user.id,
          body.message,
          conversationHistory,
          project,
        );
      } catch (error) {
        console.error('Background agent processing failed:', error);
      }
    }, 100);

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Message sent successfully',
    });
  } catch (error) {
    console.error('Failed to send message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 },
    );
  }
}

async function processAgentResponse(
  projectId: string,
  userId: string,
  userMessage: string,
  conversationHistory: Array<{
    type: 'user' | 'agent';
    message: string;
    timestamp: Date;
  }>,
  project: any,
) {
  try {
    const agentService = new AutocoderAgentService();
    await agentService.initialize();

    // Generate agent response based on project status and context
    let agentResponse = '';
    const lowerMessage = userMessage.toLowerCase();

    if (project.status === 'analyzed' || project.status === 'planning') {
      // User is discussing requirements
      if (
        lowerMessage.includes('start') ||
        lowerMessage.includes('proceed') ||
        lowerMessage.includes('build')
      ) {
        agentResponse = `Excellent! Let me start building your ${project.name}. 

I'll begin by:
1. Setting up the project structure
2. Implementing the core smart contracts
3. Creating the necessary integrations
4. Building comprehensive tests

This will take a few minutes. I'll update you as I make progress. You can ask me questions at any time!`;

        // Update project status
        await updateProjectStatus(projectId, 'building');

        // Start the build process
        setTimeout(async () => {
          await startBuildingProject(projectId, userId, project);
        }, 2000);
      } else if (
        lowerMessage.includes('change') ||
        lowerMessage.includes('modify') ||
        lowerMessage.includes('different')
      ) {
        agentResponse = await agentService.processConversationMessage(
          projectId,
          userMessage,
          conversationHistory,
        );
      } else {
        // General conversation about the project
        agentResponse = await agentService.processConversationMessage(
          projectId,
          userMessage,
          conversationHistory,
        );
      }
    } else if (project.status === 'building') {
      // Project is being built
      agentResponse = `Your project is currently being built! 

The process typically takes a few minutes. I'm working on:
- Smart contract implementation
- Testing infrastructure
- Documentation

Feel free to ask questions about the implementation or let me know if you'd like to modify anything.`;
    } else if (project.status === 'completed') {
      // Project is completed
      agentResponse = `Your ${project.name} is complete! 

You can:
- Review the generated code in the Preview tab
- Run the comprehensive test suite
- Deploy to your preferred network
- Download the complete project

Is there anything specific you'd like me to explain or modify?`;
    } else {
      // Default response
      agentResponse = await agentService.processConversationMessage(
        projectId,
        userMessage,
        conversationHistory,
      );
    }

    // Store agent response
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
        agentResponse,
        JSON.stringify({
          agentId: agentService.getAgentId(),
          projectStatus: project.status,
          responseType: 'conversation',
        }),
      ],
    );

    // If the agent is connected to the server, we can also trigger WebSocket updates
    // This would be handled by the WebSocket server monitoring the database
  } catch (error) {
    console.error('Failed to process agent response:', error);

    // Store error response
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
        "I apologize, but I'm having trouble processing your message right now. Could you please try rephrasing your request?",
        JSON.stringify({
          error: true,
          errorType: 'processing_failed',
        }),
      ],
    );
  }
}

async function updateProjectStatus(projectId: string, status: string) {
  const sql = getSql();
  await sql.query(
    `
    UPDATE autocoder_projects 
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    `,
    [status, projectId],
  );
}

async function startBuildingProject(
  projectId: string,
  userId: string,
  project: any,
) {
  try {
    const agentService = new AutocoderAgentService();
    await agentService.initialize();

    // Get the specification
    const specification = project.specification || {};

    // Create implementation plan
    const plan = await agentService.createImplementationPlan({
      specification,
      researchResults: specification.research || {
        references: [],
        bestPractices: [],
        recommendations: [],
        warnings: [],
      },
    });

    // Generate code
    const code = await agentService.generateCode({
      specification,
      plan,
      researchContext: specification.research || {
        references: [],
        bestPractices: [],
        recommendations: [],
        warnings: [],
      },
    });

    // Generate tests
    const tests = await agentService.generateTests({
      specification,
      code,
      testCases: [
        'Basic functionality test',
        'Edge case handling',
        'Security validation',
        'Integration testing',
      ],
    });

    // Analyze quality
    const quality = await agentService.analyzeQuality({
      code,
      tests,
      securityRequirements: [
        'No vulnerabilities in smart contracts',
        'Proper access control',
        'Safe external calls',
      ],
    });

    // Store build results
    const sql = getSql();
    await sql.query(
      `
      UPDATE autocoder_projects 
      SET 
        specification = $1,
        build_result = $2,
        status = $3,
        updated_at = NOW()
      WHERE id = $4
      `,
      [
        JSON.stringify({
          ...specification,
          plan,
          buildComplete: true,
        }),
        JSON.stringify({
          code,
          tests,
          quality,
          completedAt: new Date().toISOString(),
        }),
        'completed',
        projectId,
      ],
    );

    // Send completion message
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
        `🎉 Your ${project.name} is complete!

**Build Summary:**
- Code Quality: ${quality.codeQuality}%
- Test Coverage: ${quality.testCoverage}%
- Security Score: ${quality.security}%
- Documentation: ${quality.documentation}%

I've generated:
- ${Object.keys(code.files).length} source files
- ${tests.tests.length} comprehensive tests
- Complete documentation
- Deployment scripts

You can now:
1. Review the code in the Preview tab
2. Run the test suite
3. Deploy to your preferred network
4. Download the complete project

Would you like me to walk you through any part of the implementation?`,
        JSON.stringify({
          buildComplete: true,
          quality,
          fileCount: Object.keys(code.files).length,
          testCount: tests.tests.length,
        }),
      ],
    );
  } catch (error) {
    console.error('Failed to build project:', error);

    // Update status and send error message
    await updateProjectStatus(projectId, 'failed');

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
        'I encountered an issue while building your project. Let me analyze what went wrong and try a different approach. Could you provide any additional requirements or constraints?',
        JSON.stringify({
          error: true,
          errorType: 'build_failed',
        }),
      ],
    );
  }
}

export const { POST } = wrapHandlers({
  handlePOST,
});
