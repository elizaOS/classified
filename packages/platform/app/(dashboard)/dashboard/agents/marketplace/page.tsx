/**
 * Agent Marketplace Page
 * Browse, discover, and install community agents
 */

'use client';

import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  StarIcon,
  DownloadIcon,
  Share1Icon,
  PersonIcon,
  TargetIcon,
  MixerVerticalIcon,
  HeartIcon,
  CheckCircledIcon,
  ExternalLinkIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  description: string;
  creator: {
    id: string;
    name: string;
    avatar?: string;
    verified: boolean;
  };
  category: string;
  tags: string[];
  rating: number;
  downloads: number;
  likes: number;
  price: number; // 0 for free
  featured: boolean;
  preview?: string;
  lastUpdated: Date;
  installed?: boolean;
}

const categories = [
  { id: 'all', name: 'All Categories', count: 156 },
  { id: 'customer-service', name: 'Customer Service', count: 24 },
  { id: 'content-creation', name: 'Content Creation', count: 18 },
  { id: 'data-analysis', name: 'Data Analysis', count: 12 },
  { id: 'productivity', name: 'Productivity', count: 21 },
  { id: 'education', name: 'Education', count: 15 },
  { id: 'entertainment', name: 'Entertainment', count: 19 },
  { id: 'finance', name: 'Finance', count: 8 },
  { id: 'healthcare', name: 'Healthcare', count: 6 },
  { id: 'development', name: 'Development', count: 13 },
];

const sortOptions = [
  { id: 'popular', name: 'Most Popular' },
  { id: 'newest', name: 'Newest' },
  { id: 'rating', name: 'Highest Rated' },
  { id: 'downloads', name: 'Most Downloaded' },
  { id: 'updated', name: 'Recently Updated' },
];

const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Customer Support Pro',
    description:
      'Advanced customer support agent with multilingual capabilities, sentiment analysis, and escalation handling.',
    creator: {
      id: 'creator-1',
      name: 'TechCorp Solutions',
      verified: true,
    },
    category: 'customer-service',
    tags: ['customer-support', 'multilingual', 'sentiment-analysis'],
    rating: 4.8,
    downloads: 1247,
    likes: 89,
    price: 0,
    featured: true,
    lastUpdated: new Date('2024-01-15'),
  },
  {
    id: 'agent-2',
    name: 'Content Creator Assistant',
    description:
      'AI assistant specialized in social media content creation, hashtag optimization, and trend analysis.',
    creator: {
      id: 'creator-2',
      name: 'CreativeAI Labs',
      verified: true,
    },
    category: 'content-creation',
    tags: ['social-media', 'content', 'marketing'],
    rating: 4.6,
    downloads: 892,
    likes: 156,
    price: 9.99,
    featured: false,
    lastUpdated: new Date('2024-01-10'),
  },
  {
    id: 'agent-3',
    name: 'Data Analyst Bot',
    description:
      'Comprehensive data analysis agent that can process CSV files, generate insights, and create visualizations.',
    creator: {
      id: 'creator-3',
      name: 'DataWorks Inc',
      verified: false,
    },
    category: 'data-analysis',
    tags: ['analytics', 'csv', 'visualization'],
    rating: 4.4,
    downloads: 634,
    likes: 72,
    price: 19.99,
    featured: true,
    lastUpdated: new Date('2024-01-08'),
  },
];

export default function AgentMarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    priceRange: 'all', // 'free', 'paid', 'all'
    rating: 0,
    verified: false,
  });

  useEffect(() => {
    // Filter and sort agents
    let filteredAgents = mockAgents;

    // Search filter
    if (searchQuery) {
      filteredAgents = filteredAgents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filteredAgents = filteredAgents.filter(
        (agent) => agent.category === selectedCategory,
      );
    }

    // Price filter
    if (filters.priceRange === 'free') {
      filteredAgents = filteredAgents.filter((agent) => agent.price === 0);
    } else if (filters.priceRange === 'paid') {
      filteredAgents = filteredAgents.filter((agent) => agent.price > 0);
    }

    // Rating filter
    if (filters.rating > 0) {
      filteredAgents = filteredAgents.filter(
        (agent) => agent.rating >= filters.rating,
      );
    }

    // Verified filter
    if (filters.verified) {
      filteredAgents = filteredAgents.filter((agent) => agent.creator.verified);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        filteredAgents.sort(
          (a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime(),
        );
        break;
      case 'rating':
        filteredAgents.sort((a, b) => b.rating - a.rating);
        break;
      case 'downloads':
        filteredAgents.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'updated':
        filteredAgents.sort(
          (a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime(),
        );
        break;
      default: // popular
        filteredAgents.sort(
          (a, b) => b.downloads + b.likes - (a.downloads + a.likes),
        );
    }

    setAgents(filteredAgents);
  }, [searchQuery, selectedCategory, sortBy, filters]);

  const handleInstallAgent = async (agentId: string) => {
    setLoading(true);
    try {
      // Mock installation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? { ...agent, installed: true, downloads: agent.downloads + 1 }
            : agent,
        ),
      );
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLikeAgent = (agentId: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === agentId ? { ...agent, likes: agent.likes + 1 } : agent,
      ),
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-stroke-weak p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-typography-strong">
              Agent Marketplace
            </h1>
            <p className="text-typography-weak">
              Discover and install community-created AI agents
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/agents/publish"
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
            >
              <Share1Icon className="h-4 w-4" />
              Publish Agent
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-typography-weak" />
            <input
              type="text"
              placeholder="Search agents, categories, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-stroke-weak py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-stroke-weak px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
              showFilters
                ? 'border-purple-200 bg-purple-500/10 text-purple-600'
                : 'border-stroke-weak hover:bg-hover',
            )}
          >
            <MixerVerticalIcon className="h-4 w-4" />
            Filters
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 rounded-lg border border-stroke-weak bg-background p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Price</label>
                <select
                  value={filters.priceRange}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      priceRange: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-stroke-weak p-2"
                >
                  <option value="all">All</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Minimum Rating
                </label>
                <select
                  value={filters.rating}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      rating: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-stroke-weak p-2"
                >
                  <option value={0}>Any</option>
                  <option value={3}>3+ Stars</option>
                  <option value={4}>4+ Stars</option>
                  <option value={4.5}>4.5+ Stars</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.verified}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        verified: e.target.checked,
                      }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm font-medium">
                    Verified creators only
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1">
        {/* Categories Sidebar */}
        <div className="w-64 border-r border-stroke-weak p-6">
          <h3 className="mb-4 font-semibold">Categories</h3>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors',
                  selectedCategory === category.id
                    ? 'bg-purple-500/10 text-purple-600'
                    : 'hover:bg-hover',
                )}
              >
                <span className="text-sm">{category.name}</span>
                <span className="text-xs text-typography-weak">
                  {category.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Featured Agents */}
          {selectedCategory === 'all' && !searchQuery && (
            <div className="mb-8">
              <h2 className="mb-4 text-xl font-semibold">Featured Agents</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {agents
                  .filter((agent) => agent.featured)
                  .map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onInstall={handleInstallAgent}
                      onLike={handleLikeAgent}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* All Agents */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {selectedCategory === 'all'
                  ? 'All Agents'
                  : categories.find((c) => c.id === selectedCategory)?.name}
              </h2>
              <span className="text-sm text-typography-weak">
                {agents.length} agents
              </span>
            </div>

            {agents.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <PersonIcon className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-typography-strong">
                  No agents found
                </h3>
                <p className="text-typography-weak">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onInstall={handleInstallAgent}
                    onLike={handleLikeAgent}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AgentCardProps {
  agent: Agent;
  onInstall: (agentId: string) => void;
  onLike: (agentId: string) => void;
}

function AgentCard({ agent, onInstall, onLike }: AgentCardProps) {
  return (
    <div className="bg-card rounded-lg border border-stroke-weak p-6 transition-shadow hover:shadow-lg">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-semibold text-typography-strong">
              {agent.name}
            </h3>
            {agent.featured && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                Featured
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-typography-weak">
            <span>{agent.creator.name}</span>
            {agent.creator.verified && (
              <CheckCircledIcon className="h-4 w-4 text-blue-500" />
            )}
          </div>
        </div>

        <div className="text-right">
          {agent.price === 0 ? (
            <span className="text-sm font-medium text-green-600">Free</span>
          ) : (
            <span className="text-sm font-medium">${agent.price}</span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="mb-4 line-clamp-3 text-sm text-typography-weak">
        {agent.description}
      </p>

      {/* Tags */}
      <div className="mb-4 flex flex-wrap gap-1">
        {agent.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-xs"
          >
            <TargetIcon className="h-3 w-3" />
            {tag}
          </span>
        ))}
        {agent.tags.length > 3 && (
          <span className="text-xs text-typography-weak">
            +{agent.tags.length - 3} more
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mb-4 flex items-center gap-4 text-sm text-typography-weak">
        <div className="flex items-center gap-1">
          <StarIcon className="h-4 w-4 fill-current text-yellow-500" />
          <span>{agent.rating}</span>
        </div>
        <div className="flex items-center gap-1">
          <DownloadIcon className="h-4 w-4" />
          <span>{agent.downloads.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <HeartIcon className="h-4 w-4" />
          <span>{agent.likes}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onInstall(agent.id)}
          disabled={agent.installed}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors',
            agent.installed
              ? 'cursor-default bg-green-100 text-green-700'
              : 'bg-purple-600 text-white hover:bg-purple-700',
          )}
        >
          {agent.installed ? (
            <>
              <CheckCircledIcon className="h-4 w-4" />
              Installed
            </>
          ) : (
            <>
              <PlusIcon className="h-4 w-4" />
              Install
            </>
          )}
        </button>

        <button
          onClick={() => onLike(agent.id)}
          className="rounded-lg border border-stroke-weak p-2 transition-colors hover:bg-hover"
        >
          <HeartIcon className="h-4 w-4" />
        </button>

        <Link
          href={`/dashboard/agents/marketplace/${agent.id}`}
          className="rounded-lg border border-stroke-weak p-2 transition-colors hover:bg-hover"
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
