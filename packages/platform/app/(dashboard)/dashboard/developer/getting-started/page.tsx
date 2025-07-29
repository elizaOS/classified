/**
 * Developer Getting Started Page
 *
 * Provides a comprehensive onboarding experience for new developers
 * using the ElizaOS Platform, including tutorials, examples, and setup guides.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  Circle,
  BookOpen,
  Code,
  Terminal,
  Rocket,
  Download,
  ExternalLink,
  Copy,
  Play,
  GitBranch,
  Package,
  Settings,
  Zap,
  Shield,
  Database,
  Cloud,
  Users,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  optional?: boolean;
  estimatedTime: string;
  category: 'setup' | 'development' | 'deployment' | 'advanced';
}

interface TutorialExample {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  codeExample: string;
  fullExample?: string;
}

export default function DeveloperGettingStarted() {
  const { toast } = useToast();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('quickstart');
  const [showFullExample, setShowFullExample] = useState<string | null>(null);

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'environment',
      title: 'Set up Development Environment',
      description: 'Install Node.js, npm/bun, and clone the ElizaOS repository',
      completed: false,
      estimatedTime: '10 min',
      category: 'setup',
    },
    {
      id: 'dependencies',
      title: 'Install Dependencies',
      description:
        'Run npm install or bun install to get all required packages',
      completed: false,
      estimatedTime: '5 min',
      category: 'setup',
    },
    {
      id: 'api-key',
      title: 'Create API Key',
      description:
        'Generate your first API key for authenticating with the platform',
      completed: false,
      estimatedTime: '2 min',
      category: 'setup',
    },
    {
      id: 'first-agent',
      title: 'Create Your First Agent',
      description: 'Build a simple AI agent using the ElizaOS framework',
      completed: false,
      estimatedTime: '15 min',
      category: 'development',
    },
    {
      id: 'plugin-install',
      title: 'Install a Plugin',
      description: 'Add functionality to your agent with community plugins',
      completed: false,
      estimatedTime: '5 min',
      category: 'development',
    },
    {
      id: 'custom-action',
      title: 'Create Custom Action',
      description: 'Build a custom action to extend your agent capabilities',
      completed: false,
      estimatedTime: '20 min',
      category: 'development',
    },
    {
      id: 'testing',
      title: 'Write Tests',
      description: 'Add unit and integration tests for your agent',
      completed: false,
      estimatedTime: '15 min',
      category: 'development',
    },
    {
      id: 'deploy-local',
      title: 'Deploy Locally',
      description: 'Run your agent in a local development environment',
      completed: false,
      estimatedTime: '10 min',
      category: 'deployment',
    },
    {
      id: 'deploy-cloud',
      title: 'Deploy to Production',
      description: 'Deploy your agent to the ElizaOS cloud platform',
      completed: false,
      optional: true,
      estimatedTime: '30 min',
      category: 'deployment',
    },
    {
      id: 'monitoring',
      title: 'Set up Monitoring',
      description: 'Configure analytics and monitoring for your agent',
      completed: false,
      optional: true,
      estimatedTime: '15 min',
      category: 'advanced',
    },
  ];

  const tutorialExamples: TutorialExample[] = [
    {
      id: 'hello-world',
      title: 'Hello World Agent',
      description: 'Create a simple agent that responds to greetings',
      difficulty: 'beginner',
      tags: ['basic', 'getting-started'],
      codeExample: `import { Character } from '@elizaos/core';

const helloWorldAgent: Character = {
  name: 'HelloBot',
  bio: 'A friendly greeting bot',
  messageExamples: [
    [
      { user: 'user', content: { text: 'Hello!' } },
      { user: 'HelloBot', content: { text: 'Hi there! How can I help you today?' } }
    ]
  ]
};`,
      fullExample: `import { Character, createAgent } from '@elizaos/core';

const helloWorldAgent: Character = {
  name: 'HelloBot',
  bio: 'A friendly greeting bot that welcomes users',
  messageExamples: [
    [
      { user: 'user', content: { text: 'Hello!' } },
      { user: 'HelloBot', content: { text: 'Hi there! How can I help you today?' } }
    ],
    [
      { user: 'user', content: { text: 'Good morning' } },
      { user: 'HelloBot', content: { text: 'Good morning! I hope you have a wonderful day!' } }
    ]
  ],
  knowledge: [
    'I am a helpful assistant created with ElizaOS',
    'I love to greet people and make them feel welcome'
  ]
};

// Create and start the agent
const agent = createAgent(helloWorldAgent);
agent.start();`,
    },
    {
      id: 'weather-action',
      title: 'Weather Action',
      description: 'Build an action that fetches weather information',
      difficulty: 'intermediate',
      tags: ['actions', 'api-integration'],
      codeExample: `import { Action } from '@elizaos/core';

export const weatherAction: Action = {
  name: 'GET_WEATHER',
  description: 'Get current weather for a location',
  handler: async (runtime, message, state) => {
    const location = extractLocation(message.content.text);
    const weather = await fetchWeather(location);
    
    return {
      text: \`The weather in \${location} is \${weather.description} with a temperature of \${weather.temp}°F\`
    };
  }
};`,
    },
    {
      id: 'memory-system',
      title: 'Advanced Memory System',
      description: 'Implement custom memory management for your agent',
      difficulty: 'advanced',
      tags: ['memory', 'advanced', 'database'],
      codeExample: `import { Memory, MemoryManager } from '@elizaos/core';

class CustomMemoryManager extends MemoryManager {
  async storeMemory(memory: Memory): Promise<void> {
    // Custom storage logic
    await this.database.memories.create({
      ...memory,
      embedding: await this.generateEmbedding(memory.content.text),
      importance: this.calculateImportance(memory)
    });
  }
  
  async searchMemories(query: string, limit = 10): Promise<Memory[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    return await this.database.memories.findSimilar(queryEmbedding, limit);
  }
}`,
    },
  ];

  const quickStartCommands = [
    {
      title: 'Clone Repository',
      command: 'git clone https://github.com/elizaos/eliza.git',
      description: 'Clone the ElizaOS repository to your local machine',
    },
    {
      title: 'Install Dependencies',
      command: 'cd eliza && bun install',
      description: 'Navigate to the project directory and install dependencies',
    },
    {
      title: 'Set Environment Variables',
      command: 'cp .env.example .env.local',
      description:
        'Copy the example environment file and configure your settings',
    },
    {
      title: 'Start Development Server',
      command: 'bun run dev',
      description: 'Start the development server with hot reloading',
    },
  ];

  const progressPercentage =
    (completedSteps.size / onboardingSteps.length) * 100;

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: 'Code copied to clipboard',
      });
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the code manually',
        variant: 'destructive',
      });
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className="container mx-auto max-w-6xl px-4 py-8"
      data-cy="developer-getting-started"
    >
      <div className="mb-8">
        <h1
          className="mb-4 text-4xl font-bold text-gray-900"
          data-cy="page-title"
        >
          Developer Getting Started
        </h1>
        <p className="mb-6 text-xl text-gray-600">
          Welcome to ElizaOS! This guide will help you get started building AI
          agents and plugins.
        </p>

        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-blue-900">
              Your Progress
            </h3>
            <span className="text-sm text-blue-700">
              {completedSteps.size} of {onboardingSteps.length} steps completed
            </span>
          </div>
          <Progress
            value={progressPercentage}
            className="h-3"
            data-cy="progress-bar"
          />
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
          <TabsTrigger value="onboarding">Step-by-Step</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="quickstart" className="space-y-6">
          <Card data-cy="quickstart-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Quick Start Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-gray-600">
                Get up and running with ElizaOS in just a few minutes. Follow
                these commands to create your first agent.
              </p>

              <div className="space-y-4">
                {quickStartCommands.map((cmd, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">
                        {cmd.title}
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(cmd.command)}
                        data-cy={`copy-command-${index}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <code className="mb-2 block rounded bg-gray-100 p-3 font-mono text-sm">
                      {cmd.command}
                    </code>
                    <p className="text-sm text-gray-600">{cmd.description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <h4 className="mb-2 font-semibold text-green-900">
                  🎉 You're Ready!
                </h4>
                <p className="text-green-800">
                  Once you've completed these steps, you'll have a fully
                  functional ElizaOS development environment. Visit{' '}
                  <code>http://localhost:3000</code> to see your platform in
                  action!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-6">
          <div className="grid gap-6">
            {['setup', 'development', 'deployment', 'advanced'].map(
              (category) => (
                <Card key={category} data-cy={`onboarding-${category}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {category === 'setup' && <Settings className="h-5 w-5" />}
                      {category === 'development' && (
                        <Code className="h-5 w-5" />
                      )}
                      {category === 'deployment' && (
                        <Cloud className="h-5 w-5" />
                      )}
                      {category === 'advanced' && <Zap className="h-5 w-5" />}
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {onboardingSteps
                        .filter((step) => step.category === category)
                        .map((step) => (
                          <div
                            key={step.id}
                            className={`flex items-center gap-3 rounded-lg border p-4 transition-colors ${
                              completedSteps.has(step.id)
                                ? 'border-green-200 bg-green-50'
                                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                            }`}
                            data-cy={`step-${step.id}`}
                          >
                            <button
                              onClick={() => toggleStep(step.id)}
                              className="flex-shrink-0"
                            >
                              {completedSteps.has(step.id) ? (
                                <CheckCircle className="h-6 w-6 text-green-600" />
                              ) : (
                                <Circle className="h-6 w-6 text-gray-400" />
                              )}
                            </button>

                            <div className="flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900">
                                  {step.title}
                                </h4>
                                {step.optional && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Optional
                                  </Badge>
                                )}
                                <span className="text-xs text-gray-500">
                                  {step.estimatedTime}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">
                                {step.description}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        </TabsContent>

        <TabsContent value="examples" className="space-y-6">
          <div className="grid gap-6">
            {tutorialExamples.map((example) => (
              <Card key={example.id} data-cy={`example-${example.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      {example.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={getDifficultyColor(example.difficulty)}>
                        {example.difficulty}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600">{example.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {example.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="relative">
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                      <code>
                        {showFullExample === example.id
                          ? example.fullExample || example.codeExample
                          : example.codeExample}
                      </code>
                    </pre>
                    <div className="absolute right-2 top-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            showFullExample === example.id
                              ? example.fullExample || example.codeExample
                              : example.codeExample,
                          )
                        }
                        className="border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
                        data-cy={`copy-example-${example.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {example.fullExample && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setShowFullExample(
                              showFullExample === example.id
                                ? null
                                : example.id,
                            )
                          }
                          className="border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
                          data-cy={`expand-example-${example.id}`}
                        >
                          {showFullExample === example.id
                            ? 'Collapse'
                            : 'Expand'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-cy="documentation-links">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Documentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  href="/docs/api"
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
                  data-cy="api-docs-link"
                >
                  <div>
                    <h4 className="font-semibold">API Reference</h4>
                    <p className="text-sm text-gray-600">
                      Complete API documentation
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>

                <a
                  href="/docs/guides"
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <h4 className="font-semibold">Developer Guides</h4>
                    <p className="text-sm text-gray-600">
                      In-depth tutorials and guides
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>

                <a
                  href="/docs/plugins"
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <h4 className="font-semibold">Plugin Development</h4>
                    <p className="text-sm text-gray-600">
                      Build and publish plugins
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>
              </CardContent>
            </Card>

            <Card data-cy="community-links">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Community
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  href="https://github.com/elizaos/eliza"
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cy="github-link"
                >
                  <div>
                    <h4 className="font-semibold">GitHub Repository</h4>
                    <p className="text-sm text-gray-600">
                      Source code and issues
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>

                <a
                  href="https://discord.gg/elizaos"
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div>
                    <h4 className="font-semibold">Discord Community</h4>
                    <p className="text-sm text-gray-600">
                      Chat with other developers
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>

                <a
                  href="/examples"
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <h4 className="font-semibold">Example Projects</h4>
                    <p className="text-sm text-gray-600">
                      Browse community examples
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>
              </CardContent>
            </Card>

            <Card data-cy="tools-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Development Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <h4 className="font-semibold">ElizaOS CLI</h4>
                  <p className="mb-2 text-sm text-gray-600">
                    Command-line interface for agent management
                  </p>
                  <code className="rounded bg-gray-100 px-2 py-1 text-xs">
                    npm install -g @elizaos/cli
                  </code>
                </div>

                <div className="rounded-lg border p-3">
                  <h4 className="font-semibold">VS Code Extension</h4>
                  <p className="mb-2 text-sm text-gray-600">
                    Syntax highlighting and debugging support
                  </p>
                  <Button size="sm" variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Install Extension
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card data-cy="support-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Support & Help
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3">
                  <h4 className="font-semibold">Technical Support</h4>
                  <p className="mb-2 text-sm text-gray-600">
                    Get help with technical issues
                  </p>
                  <Button size="sm" variant="outline">
                    Contact Support
                  </Button>
                </div>

                <div className="rounded-lg border p-3">
                  <h4 className="font-semibold">Bug Reports</h4>
                  <p className="mb-2 text-sm text-gray-600">
                    Report bugs and request features
                  </p>
                  <Button size="sm" variant="outline">
                    <GitBranch className="mr-2 h-4 w-4" />
                    Create Issue
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
