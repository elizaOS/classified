import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
  ModelType,
} from '@elizaos/core';
import { GitHubService } from '../services/github';
import { z } from 'zod';

// Structured schemas for LLM responses
const IssueAnalysisSchema = z.object({
  canAutomate: z.boolean(),
  complexity: z.enum(['simple', 'medium', 'complex']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  issueType: z.enum(['bug', 'feature', 'documentation', 'refactor', 'other']),
  summary: z.string(),
  requiredFiles: z.array(z.string()),
  estimatedChanges: z.number().min(0),
  riskLevel: z.enum(['low', 'medium', 'high']),
  dependencies: z.array(z.string()).optional(),
});

const CodeChangeSchema = z.object({
  file: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  content: z.string().optional(),
  reasoning: z.string(),
  lineNumbers: z
    .object({
      start: z.number().optional(),
      end: z.number().optional(),
    })
    .optional(),
});

const CodeGenerationSchema = z.object({
  canGenerate: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  changes: z.array(CodeChangeSchema),
  testingNeeded: z.boolean(),
  deploymentNotes: z.string().optional(),
});

type IssueAnalysis = z.infer<typeof IssueAnalysisSchema>;
type CodeGeneration = z.infer<typeof CodeGenerationSchema>;

// Use LLM to validate if this should be an auto-coding action
async function shouldAutoCode(
  runtime: IAgentRuntime,
  issue: any,
  repository: any
): Promise<boolean> {
  const prompt = `Analyze this GitHub issue to determine if it's suitable for automated coding:

Repository: ${repository.full_name}
Issue #${issue.number}: ${issue.title}
Body: ${issue.body || 'No description provided'}
Labels: ${issue.labels.map((l: any) => l.name).join(', ') || 'None'}
Author: ${issue.user.login}

Consider:
1. Is this a request that can be automated?
2. Does it involve code changes?
3. Is the scope clear and limited?
4. Would automation be safe and helpful?

Respond with JSON:
{
  "shouldAutoCode": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of decision"
}`;

  try {
    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt,
      temperature: 0.2,
      max_tokens: 300,
    });

    const result = JSON.parse(response);
    return result.shouldAutoCode && result.confidence > 0.7;
  } catch (_error) {
    logger.warn('Failed to evaluate auto-coding suitability:', _error);
    return false;
  }
}

export const autoCodeIssueAction: Action = {
  name: 'AUTO_CODE_ISSUE',
  similes: ['FIX_ISSUE', 'SOLVE_ISSUE', 'AUTO_FIX_ISSUE'],
  description:
    'Intelligently analyze a GitHub issue and create a pull request with a real code fix',

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: '@agent please fix this issue',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll analyze this issue using AI and create a pull request with a real fix.",
          actions: ['AUTO_CODE_ISSUE'],
        },
      },
    ],
  ],

  async validate(runtime: IAgentRuntime, _message: Memory, state?: State): Promise<boolean> {
    const githubService = runtime.getService<GitHubService>('github');
    if (!githubService) {
      return false;
    }

    // If this is from a webhook event, validate the issue is suitable for auto-coding
    const { issue, repository } = state?.data || {};
    if (issue && repository) {
      return await shouldAutoCode(runtime, issue, repository);
    }

    // For manual triggers, just check service availability
    return true;
  },

  async handler(
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State = { values: {}, data: {}, text: '' },
    options?: any,
    callback?: HandlerCallback
  ): Promise<void> {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service is not available');
      }

      const { issue, repository, action: _eventAction } = options || {};

      if (!issue || !repository) {
        await callback?.({
          text: 'This action requires issue and repository information from a GitHub webhook event.',
          thought: 'Missing required webhook data',
        });
        return;
      }

      logger.info(`Intelligent auto-coding for issue #${issue.number} in ${repository.full_name}`);

      // Check if already handled
      if (issue.assignee && issue.assignee.login !== runtime.character.name) {
        await callback?.({
          text: `Issue #${issue.number} is already assigned to ${issue.assignee.login}. I won't interfere.`,
          thought: 'Issue already assigned to someone else',
        });
        return;
      }

      // Step 1: Deep analysis of the issue using structured LLM output
      const analysisPrompt = `Analyze this GitHub issue comprehensively:

Repository: ${repository.full_name}
Language: ${repository.language || 'Unknown'}
Description: ${repository.description || 'No description'}

Issue #${issue.number}: ${issue.title}
Body: ${issue.body || 'No description provided'}
Labels: ${issue.labels.map((l: any) => l.name).join(', ') || 'None'}
Author: ${issue.user.login}

Provide a detailed analysis as JSON:
{
  "canAutomate": boolean,
  "complexity": "simple" | "medium" | "complex",
  "confidence": 0.0-1.0,
  "reasoning": "detailed explanation",
  "issueType": "bug" | "feature" | "documentation" | "refactor" | "other",
  "summary": "what needs to be done",
  "requiredFiles": ["file1.js", "file2.py"],
  "estimatedChanges": 5,
  "riskLevel": "low" | "medium" | "high",
  "dependencies": ["optional array of dependencies"]
}`;

      const analysisResponse = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: analysisPrompt,
        temperature: 0.2,
        max_tokens: 1000,
      });

      let analysis: IssueAnalysis;
      try {
        analysis = IssueAnalysisSchema.parse(JSON.parse(analysisResponse));
      } catch (error) {
        logger.error('Failed to parse issue analysis:', error);
        await callback?.({
          text: `I analyzed issue #${issue.number} but the analysis was inconclusive. This likely indicates the issue is too complex or ambiguous for automated fixing.`,
          thought: 'Failed to parse structured analysis',
        });
        return;
      }

      // Intelligent decision making based on analysis
      if (!analysis.canAutomate || analysis.confidence < 0.6 || analysis.riskLevel === 'high') {
        await callback?.({
          text: `Issue #${issue.number} analysis complete:

**Complexity**: ${analysis.complexity}
**Risk Level**: ${analysis.riskLevel}
**Confidence**: ${Math.round(analysis.confidence * 100)}%

**Reasoning**: ${analysis.reasoning}

This issue requires human intervention due to its complexity or risk level. I recommend reviewing the requirements and breaking it down into smaller, more specific tasks.`,
          thought: `Issue too complex/risky for automation: ${analysis.reasoning}`,
        });
        return;
      }

      // Step 2: Get repository structure for intelligent file analysis
      const repoStructure = await analyzeRepositoryStructure(githubService, repository);

      // Step 3: Generate code changes using AI with repository context
      const codeGenPrompt = `Generate specific code changes for this issue:

Repository: ${repository.full_name}
Issue: ${issue.title}
Type: ${analysis.issueType}
Files to modify: ${analysis.requiredFiles.join(', ')}

Repository structure context:
${repoStructure}

Issue details:
${issue.body || 'No description provided'}

Generate actual code changes as JSON:
{
  "canGenerate": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "changes": [
    {
      "file": "path/to/file.js",
      "action": "create" | "update" | "delete",
      "content": "actual file content or changes",
      "reasoning": "why this change is needed",
      "lineNumbers": {"start": 10, "end": 20}
    }
  ],
  "testingNeeded": boolean,
  "deploymentNotes": "any deployment considerations"
}`;

      const codeResponse = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: codeGenPrompt,
        temperature: 0.1,
        max_tokens: 7777,
      });

      let codeGeneration: CodeGeneration;
      try {
        codeGeneration = CodeGenerationSchema.parse(JSON.parse(codeResponse));
      } catch (error) {
        logger.error('Failed to parse code generation:', error);
        await callback?.({
          text: `I understand what needs to be done for issue #${issue.number}, but I couldn't generate the specific code changes reliably. This suggests the changes are too complex for automated implementation.`,
          thought: 'Failed to generate code changes',
        });
        return;
      }

      if (!codeGeneration.canGenerate || codeGeneration.confidence < 0.7) {
        await callback?.({
          text: `While I can analyze issue #${issue.number}, I'm not confident enough (${Math.round(codeGeneration.confidence * 100)}%) to generate the code changes automatically.

**Reasoning**: ${codeGeneration.reasoning}

I recommend having a human developer review this issue.`,
          thought: `Low confidence in code generation: ${codeGeneration.reasoning}`,
        });
        return;
      }

      // Step 4: Create branch and implement changes
      const defaultBranch = await githubService.getDefaultBranch(
        repository.owner.login,
        repository.name
      );
      const branchName = `auto-fix/issue-${issue.number}`;

      const defaultBranchRef = await githubService.getRef(
        repository.owner.login,
        repository.name,
        `heads/${defaultBranch}`
      );

      await githubService.createBranch(
        repository.owner.login,
        repository.name,
        branchName,
        defaultBranchRef.object.sha
      );

      logger.info(`Created branch ${branchName} for issue #${issue.number}`);

      // Step 5: Apply intelligent code changes
      const changedFiles: string[] = [];

      for (const change of codeGeneration.changes) {
        try {
          if (change.action === 'create') {
            await githubService.createOrUpdateFile(
              repository.owner.login,
              repository.name,
              change.file,
              change.content || '',
              `Auto-fix: Create ${change.file} for issue #${issue.number}`,
              branchName
            );
          } else if (change.action === 'update') {
            // Get existing file content for intelligent updates
            let existingContent = '';
            let fileSha: string | undefined;

            try {
              const fileData = await githubService.getFileContent(
                repository.owner.login,
                repository.name,
                change.file,
                defaultBranch
              );
              existingContent = fileData.content;
              fileSha = fileData.sha;
            } catch (error) {
              logger.warn(`File ${change.file} not found, will create new file`);
            }

            // Apply intelligent content update
            const updatedContent = change.content || existingContent;

            await githubService.createOrUpdateFile(
              repository.owner.login,
              repository.name,
              change.file,
              updatedContent,
              `Auto-fix: Update ${change.file} for issue #${issue.number}`,
              branchName,
              fileSha
            );
          } else if (change.action === 'delete') {
            const fileData = await githubService.getFileContent(
              repository.owner.login,
              repository.name,
              change.file,
              defaultBranch
            );

            await githubService.deleteFile(
              repository.owner.login,
              repository.name,
              change.file,
              `Auto-fix: Delete ${change.file} for issue #${issue.number}`,
              fileData.sha,
              branchName
            );
          }

          changedFiles.push(change.file);
          logger.info(`${change.action} ${change.file} in branch ${branchName}`);
        } catch (error) {
          logger.error(`Failed to ${change.action} file ${change.file}:`, error);
          // Continue with other changes
        }
      }

      if (changedFiles.length === 0) {
        await callback?.({
          text: `I analyzed issue #${issue.number} and generated a solution, but encountered errors applying the changes to the repository. This may be due to file permissions or repository structure changes.`,
          thought: 'No files were successfully changed',
        });
        return;
      }

      // Step 6: Create intelligent pull request
      const prBody = `## 🤖 Automated Fix for Issue #${issue.number}

**Analysis Summary**: ${analysis.summary}

**Issue Type**: ${analysis.issueType}
**Complexity**: ${analysis.complexity}
**Risk Level**: ${analysis.riskLevel}
**AI Confidence**: ${Math.round(codeGeneration.confidence * 100)}%

### 🔧 Changes Made

${codeGeneration.changes
  .map((change) => `- **${change.action.toUpperCase()}** \`${change.file}\`: ${change.reasoning}`)
  .join('\n')}

### 🧪 Testing ${codeGeneration.testingNeeded ? 'Required' : 'Recommended'}

${
  codeGeneration.testingNeeded
    ? '⚠️ **Testing is required** before merging these changes.'
    : '✅ Changes are low-risk but testing is still recommended.'
}

${
  codeGeneration.deploymentNotes ? `### 📋 Deployment Notes\n${codeGeneration.deploymentNotes}` : ''
}

### 🔍 Review Checklist

- [ ] Code changes implement the requested functionality
- [ ] No unintended side effects introduced
- [ ] Documentation updated if necessary
- [ ] Tests pass (if applicable)

---
*This PR was automatically generated using AI analysis. Generated with confidence level: ${Math.round(codeGeneration.confidence * 100)}%*

Fixes #${issue.number}`;

      const pr = await githubService.createPullRequest(repository.owner.login, repository.name, {
        title: `🤖 Auto-fix: ${issue.title}`,
        body: prBody,
        head: branchName,
        base: defaultBranch,
      });

      logger.info(`Created intelligent PR #${pr.number} for issue #${issue.number}`);

      // Step 7: Comment on the issue with analysis
      await githubService.createIssueComment(
        repository.owner.login,
        repository.name,
        issue.number,
        `🤖 **Automated Analysis Complete**

I've analyzed this issue and created an automated fix: **PR #${pr.number}**

**Analysis Results:**
- **Type**: ${analysis.issueType}
- **Complexity**: ${analysis.complexity}
- **Risk Level**: ${analysis.riskLevel}
- **AI Confidence**: ${Math.round(codeGeneration.confidence * 100)}%

**Files Modified**: ${changedFiles.join(', ')}

${
  codeGeneration.testingNeeded
    ? '⚠️ **Testing is required** before merging.'
    : '✅ Changes appear safe but review is recommended.'
}

Please review the PR and let me know if adjustments are needed!`
      );

      await callback?.({
        text: `🤖 **Automated fix created for issue #${issue.number}**

**Analysis**: ${analysis.issueType} (${analysis.complexity} complexity)
**Solution**: PR #${pr.number} with ${changedFiles.length} file changes
**Confidence**: ${Math.round(codeGeneration.confidence * 100)}%

The solution has been implemented based on AI analysis of the repository structure and issue requirements.`,
        thought: `Created intelligent automated fix with ${changedFiles.length} changes`,
        actions: ['AUTO_CODE_ISSUE'],
      });
    } catch (error) {
      logger.error('Failed to auto-code issue:', error);
      await callback?.({
        text: `❌ Failed to create automated fix: ${error instanceof Error ? error.message : String(error)}

This could be due to:
- Repository access permissions
- Complex code requirements
- API rate limits
- File structure changes`,
        thought: 'Error in intelligent auto-coding process',
      });
    }
  },
};

// Helper function for repository analysis
async function analyzeRepositoryStructure(
  githubService: GitHubService,
  repository: any
): Promise<string> {
  try {
    // Get repository tree structure
    const tree = await githubService.getRepositoryTree(repository.owner.login, repository.name);

    // Analyze key files and structure
    const keyFiles = tree
      .filter(
        (item: any) =>
          item.type === 'blob' &&
          (item.path.endsWith('.js') ||
            item.path.endsWith('.ts') ||
            item.path.endsWith('.py') ||
            item.path.endsWith('.java') ||
            item.path.endsWith('.md') ||
            item.path === 'package.json' ||
            item.path === 'requirements.txt' ||
            item.path === 'pom.xml')
      )
      .slice(0, 20); // Limit to first 20 files

    return `Key files found:
${keyFiles.map((f: any) => `- ${f.path}`).join('\n')}

Total files: ${tree.length}
Primary language: ${repository.language || 'Unknown'}`;
  } catch (error) {
    logger.warn('Could not analyze repository structure:', error);
    return `Repository: ${repository.full_name}
Language: ${repository.language || 'Unknown'}
Structure analysis unavailable`;
  }
}

// Schema for mention analysis
const MentionAnalysisSchema = z.object({
  requestType: z.enum(['code_fix', 'question', 'review', 'clarification', 'other']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  shouldAutoCode: z.boolean(),
  suggestedResponse: z.string(),
  urgency: z.enum(['low', 'medium', 'high']),
  requiresHuman: z.boolean(),
});

type MentionAnalysis = z.infer<typeof MentionAnalysisSchema>;

// Intelligent mention analysis using LLM
async function analyzeMention(
  runtime: IAgentRuntime,
  mentionText: string,
  issue: any,
  repository: any,
  isComment: boolean
): Promise<MentionAnalysis> {
  const prompt = `Analyze this GitHub mention to understand what the user wants:

Repository: ${repository.full_name}
Context: ${isComment ? 'Comment on existing issue' : 'New issue'}
Issue: #${issue.number} - ${issue.title}
Mention text: "${mentionText}"

User profile: ${issue.user?.login || 'unknown'}
Issue labels: ${issue.labels?.map((l: any) => l.name).join(', ') || 'none'}

Analyze what they're asking for and how I should respond:

{
  "requestType": "code_fix" | "question" | "review" | "clarification" | "other",
  "confidence": 0.0-1.0,
  "reasoning": "detailed explanation of what they want",
  "shouldAutoCode": boolean,
  "suggestedResponse": "my response message",
  "urgency": "low" | "medium" | "high",
  "requiresHuman": boolean
}`;

  try {
    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt,
      temperature: 0.3,
      max_tokens: 800,
    });

    return MentionAnalysisSchema.parse(JSON.parse(response));
  } catch (error) {
    logger.warn('Failed to analyze mention:', error);
    return {
      requestType: 'other',
      confidence: 0.1,
      reasoning: 'Failed to parse mention intent',
      shouldAutoCode: false,
      suggestedResponse:
        "I see you've mentioned me! Could you please clarify what you'd like me to help with?",
      urgency: 'low',
      requiresHuman: false,
    };
  }
}

export const respondToMentionAction: Action = {
  name: 'RESPOND_TO_GITHUB_MENTION',
  similes: ['HANDLE_GITHUB_MENTION', 'REPLY_TO_MENTION'],
  description: 'Intelligently respond when the agent is mentioned in a GitHub issue or comment',

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: '@agent can you help fix this bug?',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll analyze this issue and see if I can provide an automated fix.",
          actions: ['RESPOND_TO_GITHUB_MENTION'],
        },
      },
    ],
  ],

  async validate(runtime: IAgentRuntime, _message: Memory, state?: State): Promise<boolean> {
    const githubService = runtime.getService<GitHubService>('github');
    if (!githubService) {
      return false;
    }

    // Validate this is actually a mention of the agent
    const { issue, comment, repository } = state?.data || {};
    if (!issue || !repository) {
      return false;
    }

    const mentionText = comment?.body || issue?.body || '';
    const agentName = runtime.character.name;

    // Use more sophisticated mention detection
    const mentionPatterns = [
      new RegExp(`@${agentName}\\b`, 'i'),
      new RegExp(`@${agentName.toLowerCase()}\\b`, 'i'),
      new RegExp(`${agentName}\\b.*help`, 'i'),
      new RegExp(`${agentName}\\b.*fix`, 'i'),
    ];

    return mentionPatterns.some((pattern) => pattern.test(mentionText));
  },

  async handler(
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State = { values: {}, data: {}, text: '' },
    options?: any,
    callback?: HandlerCallback
  ): Promise<void> {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service is not available');
      }

      const { issue, comment, repository, action: eventAction } = options || {};

      if (!repository || !issue) {
        throw new Error('Repository and issue information is required');
      }

      logger.info(`Intelligent mention response in ${repository.full_name}#${issue.number}`);

      const isIssueComment = !!comment;
      const mentionText = isIssueComment ? comment.body : issue.body;

      // Use AI to analyze the mention
      const analysis = await analyzeMention(
        runtime,
        mentionText,
        issue,
        repository,
        isIssueComment
      );

      // Generate intelligent response based on analysis
      let responseText = analysis.suggestedResponse;

      // Add context based on analysis
      if (analysis.confidence < 0.5) {
        responseText += `\n\n*Note: I'm ${Math.round(analysis.confidence * 100)}% confident in understanding your request. Please feel free to clarify if needed.*`;
      }

      if (analysis.urgency === 'high') {
        responseText = `🚨 **High Priority Request Detected**\n\n${responseText}`;
      }

      if (analysis.requiresHuman) {
        responseText += `\n\n⚠️ **Human Review Recommended**: ${analysis.reasoning}`;
      }

      // Post intelligent response
      await githubService.createIssueComment(
        repository.owner.login,
        repository.name,
        issue.number,
        responseText
      );

      // Decide whether to trigger auto-coding based on analysis
      if (
        analysis.shouldAutoCode &&
        analysis.confidence > 0.6 &&
        analysis.requestType === 'code_fix' &&
        !analysis.requiresHuman
      ) {
        logger.info(`Triggering auto-code for mention with confidence ${analysis.confidence}`);

        // Use the action system to trigger auto-coding
        try {
          // Find and execute the auto-code action
          const autoCodeAction = runtime.actions.find((a) => a.name === 'AUTO_CODE_ISSUE');
          if (autoCodeAction) {
            await autoCodeAction.handler(
              runtime,
              _message,
              _state,
              {
                issue,
                repository,
                action: eventAction,
              },
              callback
            );
          }
        } catch (error) {
          logger.error('Failed to trigger auto-coding:', error);

          // Post a follow-up comment about the auto-coding failure
          await githubService.createIssueComment(
            repository.owner.login,
            repository.name,
            issue.number,
            'I attempted to create an automated fix but encountered an issue. A human developer should review this request.'
          );
        }
      }

      await callback?.({
        text: `🤖 **Intelligent mention response generated**

**Analysis**: ${analysis.requestType} (confidence: ${Math.round(analysis.confidence * 100)}%)
**Auto-coding**: ${analysis.shouldAutoCode ? 'Triggered' : 'Not suitable'}
**Urgency**: ${analysis.urgency}

**Reasoning**: ${analysis.reasoning}`,
        thought: `Intelligent mention handling: ${analysis.requestType} with ${Math.round(analysis.confidence * 100)}% confidence`,
        actions: ['RESPOND_TO_GITHUB_MENTION'],
      });
    } catch (error) {
      logger.error('Failed to handle GitHub mention intelligently:', error);

      // Fallback to simple response
      try {
        const { issue, repository } = options || {};
        if (issue && repository) {
          const githubService = runtime.getService<GitHubService>('github');
          await githubService?.createIssueComment(
            repository.owner.login,
            repository.name,
            issue.number,
            "I see you've mentioned me, but I encountered an error processing your request. Please try again or contact a human developer."
          );
        }
      } catch (fallbackError) {
        logger.error('Fallback response also failed:', fallbackError);
      }

      await callback?.({
        text: `❌ Failed to handle mention intelligently: ${error instanceof Error ? error.message : String(error)}`,
        thought: 'Error in intelligent mention handling',
      });
    }
  },
};
