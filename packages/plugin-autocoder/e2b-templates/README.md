# E2B Shared Workspace Template for ElizaOS Autocoder

This directory contains the E2B template for the shared workspace environment
where multiple Eliza agents collaborate on the same codebase.

## Architecture Overview

The autocoder system uses a **single shared workspace** approach:

1. **Main agent** analyzes project complexity and determines team composition
2. **Shared repository** is created on GitHub for all agents to collaborate
3. **Dynamic team** is spawned based on project requirements
4. **Non-blocking tasks** are distributed with dependency management
5. **Agents can sleep/wake** when waiting for dependencies

## Template Structure

### `workspace/` - Shared Workspace Environment

The single environment template that all agents use, containing:

- Full development stack (Node.js, Python, etc.)
- Databases (PostgreSQL, Redis)
- Git for collaboration
- VS Code Server for development
- Testing frameworks
- Security scanning tools

## How It Works

### 1. Project Analysis

When you describe a project, the system:

- Analyzes complexity factors (technologies, features, integrations)
- Estimates project hours and complexity level
- Determines optimal team composition
- Generates task breakdown with dependencies

### 2. Team Spawning

Based on analysis, the system spawns:

- **Lead agent** - Project coordination and architecture
- **Backend agents** - API and server development (1-3 based on complexity)
- **Frontend agents** - UI development (1-2 based on complexity)
- **Database agent** - Schema design and optimization (if needed)
- **Testing agent** - Test creation and execution
- **Reviewer agent** - Code review and quality assurance

### 3. Shared Repository

All agents work on the same codebase:

```bash
# Main agent creates repo
git init
git remote add origin https://github.com/org/project

# Each agent clones and creates branch
git clone https://github.com/org/project
git checkout -b agent-{id}/{task}

# Agents push changes
git add .
git commit -m "Implement {task}"
git push origin agent-{id}/{task}
```

### 4. Task Distribution

Tasks are assigned based on:

- Agent role and specialization
- Task dependencies
- Current agent workload
- Priority levels

### 5. Sleep/Wake Mechanism

Agents intelligently manage their activity:

- **Sleep** when all their tasks depend on incomplete work
- **Wake** when dependencies are resolved
- **Monitor** for new tasks every 30 seconds
- **Redistribute** work if agents become available

## Building the Template

```bash
# Navigate to workspace template
cd workspace

# Build and upload to E2B
e2b template build

# Note the template ID
export E2B_TEMPLATE_WORKSPACE=<template-id>
```

## Environment Variables

```env
# E2B Configuration
E2B_API_KEY=your_e2b_api_key
E2B_TEMPLATE_WORKSPACE=your_template_id

# GitHub Configuration (for shared repo)
GITHUB_ORG=your_github_org
GITHUB_TOKEN=your_github_token
GITHUB_USERNAME=your_username
GITHUB_EMAIL=your_email@example.com

# WebSocket Server (for agent communication)
WEBSOCKET_URL=wss://your-websocket-server
WEBSOCKET_PORT=8080
```

## Usage Examples

### Simple Project

```
"Create a todo app with React"
→ Spawns 3-4 agents (frontend, backend, tester, reviewer)
→ Estimated time: 10-15 hours
```

### Complex Project

```
"Build a full-stack e-commerce platform with React, Node.js, PostgreSQL,
Stripe payments, real-time notifications, and admin dashboard"
→ Spawns 7-9 agents (multiple backend/frontend, database, tester, reviewer)
→ Estimated time: 50-80 hours
```

## Monitoring Progress

The system provides real-time updates on:

- Agent status (working, sleeping, completed)
- Task progress and dependencies
- Git commits and pull requests
- Test results and code reviews

## Advanced Features

### Dynamic Scaling

- Agents are spawned based on actual project needs
- No over-provisioning of resources
- Automatic task redistribution

### Intelligent Coordination

- Agents communicate through shared room state
- Non-blocking task execution
- Dependency-aware scheduling

### Git-Based Workflow

- Each agent works on feature branches
- Automatic PR creation
- Code review before merge
- Conflict resolution

## Troubleshooting

### Agents Not Starting

- Check E2B template is built and ID is correct
- Verify WebSocket server is running
- Ensure Git credentials are configured

### Task Distribution Issues

- Review task dependencies in project analysis
- Check agent role assignments
- Monitor room state for blocked tasks

### Repository Access

- Verify GitHub token has necessary permissions
- Check organization/repo settings
- Ensure agents have SSH keys configured
