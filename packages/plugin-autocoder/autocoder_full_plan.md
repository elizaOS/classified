# Autocoder Full Sandboxing Implementation Plan

## Executive Summary

This plan outlines the implementation of a sophisticated autocoder system using
E2B sandboxing where each container runs a full Eliza agent with autocoder
capabilities. The system will enable:

1. **Git-based collaborative workflow** - Agents work together through GitHub
   like human developers
2. **Real-time agent communication** - Agents share context in a "room" without
   interrupting each other
3. **E2B container isolation** - Each agent runs in its own secure sandbox
4. **Autocoder planning providers** - Shared understanding of current project
   state

## Current State Analysis

### Existing Components

- ✅ **ContainerOrchestrator** - Already handles Docker-based sub-agents
- ✅ **AgentCommunicationBridge** - Enables agent-to-agent messaging
- ✅ **GitHubIntegrationService** - Handles PR creation, reviews, and issue
  management
- ✅ **ImprovedE2BService** - Advanced E2B integration with resource management
- ✅ **DockerService** - Low-level container management
- ✅ **PluginCreationService** - Plugin generation capabilities

### Gaps to Address

- ❌ E2B templates for autocoder agents
- ❌ Git-based agent workflow orchestration
- ❌ Shared room context for agents
- ❌ Provider for current plan/state
- ❌ Agent GitHub account management
- ❌ PR review and merge workflow

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Eliza Agent                         │
│  (Orchestrator with plugin-autocoder & plugin-e2b)          │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┴────────────┬─────────────┬──────────────┐
        │                        │             │              │
┌───────▼─────────┐   ┌─────────▼───────┐  ┌─▼──────────┐  ┌─▼──────────┐
│ E2B Container 1 │   │ E2B Container 2 │  │ Container 3│  │ Container 4│
│ Coder Agent #1  │   │ Coder Agent #2  │  │  Reviewer  │  │   Tester   │
│ (Frontend)      │   │ (Backend)       │  │   Agent    │  │   Agent    │
└────────┬────────┘   └────────┬─────────┘  └─────┬──────┘  └─────┬──────┘
         │                     │                   │                │
         └─────────────────────┴───────────────────┴────────────────┘
                                       │
                            ┌──────────▼──────────┐
                            │   GitHub Repo      │
                            │ (Private Org)      │
                            └───────────────────┘
```

## Implementation Phases

### Phase 1: E2B Agent Templates

Create custom E2B templates for different agent roles:

1. **Base Autocoder Template**

   - Full Eliza runtime
   - Autocoder plugin
   - Git integration
   - Communication bridge client

2. **Role-Specific Templates**
   - Coder Agent: IDE tools, language runtimes
   - Reviewer Agent: Static analysis tools, security scanners
   - Tester Agent: Testing frameworks, coverage tools

### Phase 2: Git Workflow Implementation

Implement GitHub-based collaboration:

1. **Agent GitHub Accounts**

   - Automated account creation/management
   - SSH key generation and storage
   - Repository access management

2. **PR Workflow**
   - Branch creation per task
   - Commit with meaningful messages
   - PR creation with detailed descriptions
   - Review request assignment
   - Merge conflict resolution

### Phase 3: Agent Communication Room

Implement shared context without interruption:

1. **Room Context Provider**

   - Current plan state
   - Task assignments
   - Progress updates
   - Shared knowledge base

2. **Message Broadcasting**
   - Non-blocking updates
   - Context enrichment
   - Priority-based filtering

### Phase 4: Orchestration Enhancement

Enhance the container orchestrator:

1. **E2B Integration**

   - Replace Docker with E2B for agents
   - Template selection based on role
   - Resource optimization

2. **Workflow Management**
   - Task decomposition
   - Agent assignment
   - Progress monitoring
   - Result aggregation

## Detailed Implementation Steps

### 1. Create E2B Agent Templates

#### a. Base Template Structure

```dockerfile
# e2b.Dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Create agent user
RUN useradd -m -s /bin/bash agent

# Install Eliza
WORKDIR /home/agent
COPY . ./eliza
RUN cd eliza && npm install && npm run build

# Configure agent
COPY agent-config.json /home/agent/.eliza/config.json
COPY start-agent.sh /home/agent/start-agent.sh
RUN chmod +x /home/agent/start-agent.sh

USER agent
WORKDIR /home/agent

CMD ["/home/agent/start-agent.sh"]
```

#### b. Agent Configuration

```json
{
  "name": "autocoder-agent",
  "plugins": ["autocoder", "github", "e2b-client"],
  "settings": {
    "communication": {
      "bridge": "websocket",
      "room": "${ROOM_ID}",
      "heartbeat": 10000
    },
    "git": {
      "username": "${GIT_USERNAME}",
      "email": "${GIT_EMAIL}",
      "sshKey": "${SSH_KEY_PATH}"
    }
  }
}
```

### 2. Enhance ContainerOrchestrator for E2B

```typescript
// New E2BAgentOrchestrator service
export class E2BAgentOrchestrator extends Service {
  private e2bService: ImprovedE2BService;
  private communicationBridge: AgentCommunicationBridge;
  private githubService: GitHubIntegrationService;

  async spawnE2BAgent(request: {
    role: 'coder' | 'reviewer' | 'tester';
    taskId: string;
    requirements: string[];
    gitCredentials: GitCredentials;
  }): Promise<E2BAgentHandle> {
    // Create E2B sandbox with appropriate template
    const template = this.getTemplateForRole(request.role);
    const sandboxId = await this.e2bService.createSandbox({
      template,
      envs: {
        TASK_ID: request.taskId,
        AGENT_ROLE: request.role,
        GIT_USERNAME: request.gitCredentials.username,
        GIT_EMAIL: request.gitCredentials.email,
        ROOM_ID: this.getRoomId(request.taskId),
        MAIN_AGENT_ID: this.runtime.agentId,
      },
    });

    // Initialize agent in sandbox
    await this.initializeAgentInSandbox(sandboxId, request);

    // Register with communication bridge
    await this.registerAgentCommunication(sandboxId, request.role);

    return { sandboxId, role: request.role, taskId: request.taskId };
  }
}
```

### 3. Implement Shared Room Context

```typescript
// RoomContextProvider
export class RoomContextProvider extends Provider {
  private roomStates: Map<string, RoomState> = new Map();

  async provideContext(roomId: string): Promise<RoomContext> {
    const state = this.roomStates.get(roomId);
    return {
      currentPlan: state?.plan,
      assignments: state?.assignments,
      recentMessages: state?.messages.slice(-10),
      sharedKnowledge: state?.knowledge,
    };
  }

  async updateRoomContext(
    roomId: string,
    update: Partial<RoomState>
  ): Promise<void> {
    const current = this.roomStates.get(roomId) || this.createDefaultRoom();
    this.roomStates.set(roomId, { ...current, ...update });

    // Broadcast update to room members
    await this.broadcastToRoom(roomId, {
      type: 'context-update',
      data: update,
    });
  }
}
```

### 4. Git Workflow Manager

```typescript
// GitWorkflowManager
export class GitWorkflowManager extends Service {
  private github: GitHubIntegrationService;

  async createAgentWorkflow(task: {
    id: string;
    description: string;
    agents: AgentAssignment[];
  }): Promise<WorkflowHandle> {
    // Create feature branch
    const branchName = `feature/${task.id}-${this.slugify(task.description)}`;
    await this.createBranch(branchName);

    // Assign agents to branches
    for (const agent of task.agents) {
      await this.assignAgentToBranch(agent, branchName);
    }

    // Create initial PR
    const pr = await this.github.createPullRequest(this.owner, this.repo, {
      title: `[WIP] ${task.description}`,
      body: this.generatePRDescription(task),
      head: branchName,
      base: 'main',
      draft: true,
    });

    return { prNumber: pr.number, branchName, taskId: task.id };
  }

  async handleAgentCommit(
    agent: AgentIdentity,
    changes: FileChange[]
  ): Promise<void> {
    // Agents commit to their branch
    const commitMessage = await this.generateCommitMessage(agent, changes);
    await this.commitChanges(agent.branch, changes, commitMessage);

    // Update PR
    await this.updatePRProgress(agent.workflowHandle);
  }
}
```

### 5. Autocoder Plan Provider

```typescript
// AutocoderPlanProvider
export class AutocoderPlanProvider extends Provider {
  get description(): string {
    return 'Provides current autocoding plan and progress';
  }

  async get(runtime: IAgentRuntime, context: any): Promise<string> {
    const taskId = context.taskId || runtime.getSetting('CURRENT_TASK_ID');
    const plan = await this.getPlan(taskId);

    return `Current Autocoding Plan:
    
Project: ${plan.projectName}
Status: ${plan.status}
Progress: ${plan.completedSteps}/${plan.totalSteps}

Current Phase: ${plan.currentPhase}
Active Agents: ${plan.activeAgents.map((a) => `${a.role}: ${a.currentTask}`).join('\n')}

Recent Updates:
${plan.recentUpdates.map((u) => `- ${u.timestamp}: ${u.message}`).join('\n')}

Next Steps:
${plan.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`;
  }
}
```

## Implementation Checklist

### Phase 1: Foundation (Week 1) - COMPLETED ✅

- [x] Create E2B Dockerfile templates for each agent role
- [x] Implement E2BAgentOrchestrator service
- [x] Extend AgentCommunicationBridge for E2B sandboxes
- [x] Create agent startup scripts and configurations
- [x] Test basic E2B agent spawning

### Additional Completed Items:

- [x] Implement GitWorkflowManager service
- [x] Implement RoomContextProvider
- [x] Implement AutocoderPlanProvider
- [x] Create spawn-e2b-agents action
- [x] Update plugin index with new components

### Phase 2: Git Integration (Week 2)

- [ ] Implement GitWorkflowManager service
- [ ] Create agent GitHub account management
- [ ] Implement branch creation and PR workflow
- [ ] Add commit message generation
- [ ] Test multi-agent Git collaboration

### Phase 3: Communication & Context (Week 3)

- [ ] Implement RoomContextProvider
- [ ] Create shared knowledge base for agents
- [ ] Add non-blocking message broadcasting
- [ ] Implement AutocoderPlanProvider
- [ ] Test agent coordination and context sharing

### Phase 4: Advanced Features (Week 4)

- [ ] Implement code review workflow
- [ ] Add merge conflict resolution
- [ ] Create test result aggregation
- [ ] Implement progress monitoring dashboard
- [ ] Add failure recovery and retry logic

### Phase 5: Testing & Optimization (Week 5)

- [ ] Create comprehensive E2E tests
- [ ] Optimize resource usage
- [ ] Implement agent performance monitoring
- [ ] Add security scanning
- [ ] Document the complete system

## Configuration Requirements

### Environment Variables

```bash
# E2B Configuration
E2B_API_KEY=your_e2b_api_key
E2B_TEMPLATE_CODER=template_id_for_coder
E2B_TEMPLATE_REVIEWER=template_id_for_reviewer
E2B_TEMPLATE_TESTER=template_id_for_tester

# GitHub Configuration
GITHUB_ORG=your_private_org
GITHUB_TOKEN=org_admin_token
GITHUB_AGENT_PREFIX=eliza-agent

# Communication
WEBSOCKET_URL=wss://your-websocket-server
ROOM_PERSISTENCE=redis://your-redis-server

# Resource Limits
MAX_AGENTS_PER_TASK=5
MAX_SANDBOX_LIFETIME=3600000
MAX_CONCURRENT_TASKS=3
```

### Agent Templates Configuration

```yaml
# e2b-templates.yaml
templates:
  coder:
    base: node:20
    packages:
      - typescript
      - prettier
      - eslint
      - '@elizaos/core'
      - '@elizaos/plugin-autocoder'
    tools:
      - vscode-server
      - git

  reviewer:
    base: node:20
    packages:
      - '@elizaos/core'
      - '@elizaos/plugin-autocoder'
      - eslint
      - sonarjs
    tools:
      - git
      - security-scanner

  tester:
    base: node:20
    packages:
      - '@elizaos/core'
      - '@elizaos/plugin-autocoder'
      - jest
      - playwright
    tools:
      - git
      - coverage-reporter
```

## Success Metrics

1. **Agent Collaboration**

   - Agents successfully create PRs: >95%
   - Code review completion rate: >90%
   - Merge success rate: >85%

2. **Performance**

   - Agent spawn time: <30s
   - Task completion time: <5min for simple tasks
   - Resource efficiency: <500MB per agent

3. **Quality**
   - Generated code passes tests: >95%
   - Security scan pass rate: >90%
   - Code review approval rate: >80%

## Next Steps

1. Begin with Phase 1 implementation
2. Set up E2B development environment
3. Create initial agent templates
4. Implement core orchestration services
5. Test basic agent spawning and communication

## Implementation Summary

### What Was Implemented

1. **E2BAgentOrchestrator Service** (`src/services/E2BAgentOrchestrator.ts`)

   - Manages E2B sandboxes for autocoder agents
   - Handles agent lifecycle (spawn, terminate, status)
   - Maintains room state for agent collaboration
   - Integrates with Git workflow and communication bridge

2. **GitWorkflowManager Service** (`src/services/GitWorkflowManager.ts`)

   - Creates GitHub PRs for agent workflows
   - Tracks agent commits and progress
   - Manages code review workflow
   - Generates progress reports

3. **RoomContextProvider** (`src/providers/RoomContextProvider.ts`)

   - Provides shared context for agents in a room
   - Tracks current plan and assignments
   - Maintains recent messages and shared knowledge

4. **AutocoderPlanProvider** (`src/providers/AutocoderPlanProvider.ts`)

   - Provides current autocoding plan details
   - Shows progress and active agents
   - Estimates completion time

5. **SpawnE2BAgents Action** (`src/actions/spawn-e2b-agents.ts`)

   - Main entry point for spawning agent teams
   - Parses user requests to determine agents needed
   - Creates Git workflow if available
   - Provides progress updates

6. **E2B Templates** (`e2b-templates/`)
   - Base template with full Eliza runtime
   - Docker configuration for agent containers
   - Startup scripts with Git and WebSocket setup
   - Health monitoring

### Usage Example

```typescript
// User message: "Create a React todo app with authentication"
// The system will:
// 1. Parse the request and determine needed agents (frontend coder, backend coder, reviewer, tester)
// 2. Create a GitHub PR for the workflow
// 3. Spawn E2B sandboxed agents with appropriate specializations
// 4. Agents collaborate through Git commits and shared room context
// 5. Progress is tracked and reported back to the user
```

### Configuration Required

```env
# E2B Configuration
E2B_API_KEY=your_e2b_api_key
E2B_TEMPLATE_CODER=template_id_for_coder
E2B_TEMPLATE_REVIEWER=template_id_for_reviewer
E2B_TEMPLATE_TESTER=template_id_for_tester

# GitHub Configuration
GITHUB_ORG=your_private_org
GITHUB_TOKEN=org_admin_token
GITHUB_REPO=autocoder-workspace

# Communication
WEBSOCKET_URL=wss://your-websocket-server
```

### Next Development Steps

1. Build and upload E2B templates to E2B platform
2. Test agent spawning with real E2B sandboxes
3. Implement WebSocket server for agent communication
4. Create specialized templates for different roles
5. Add more sophisticated task decomposition
6. Implement merge conflict resolution
7. Add agent performance monitoring dashboard
