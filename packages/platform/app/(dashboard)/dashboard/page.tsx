'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  RocketIcon,
  TokensIcon,
  BarChartIcon,
  PlusIcon,
  PersonIcon,
  GearIcon as _GearIcon,
  ActivityLogIcon,
  ExclamationTriangleIcon,
  CheckCircledIcon,
  ClockIcon,
  ArrowRightIcon,
} from '@radix-ui/react-icons';
import toast from '@/lib/toast';
import { getResponseMessage } from '@/messages';
import Button from '@/components/ui/button';

interface DashboardStats {
  agentCount: number;
  userCount: number;
  creditBalance: string;
  subscriptionTier: string;
  apiRequests24h: number;
  totalCost24h: string;
  activeAgents: number;
  pendingInvites: number;
}

interface RecentActivity {
  id: string;
  type:
    | 'agent_created'
    | 'agent_deployed'
    | 'user_invited'
    | 'api_key_created'
    | 'credit_added';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
  color: string;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  isNew?: boolean;
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'agent_deployed':
      return <CheckCircledIcon className="h-4 w-4" />;
    case 'agent_created':
      return <RocketIcon className="h-4 w-4" />;
    case 'agent_stopped':
      return <ClockIcon className="h-4 w-4" />;
    case 'user_invited':
    case 'user_joined':
      return <PersonIcon className="h-4 w-4" />;
    case 'api_key_created':
      return <ActivityLogIcon className="h-4 w-4" />;
    case 'credit_added':
      return <TokensIcon className="h-4 w-4" />;
    default:
      return <ActivityLogIcon className="h-4 w-4" />;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'agent_deployed':
      return 'text-green-600';
    case 'agent_created':
      return 'text-blue-600';
    case 'agent_stopped':
      return 'text-gray-600';
    case 'user_invited':
    case 'user_joined':
      return 'text-indigo-600';
    case 'api_key_created':
      return 'text-orange-600';
    case 'credit_added':
      return 'text-purple-600';
    default:
      return 'text-gray-600';
  }
}

function DashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const message = searchParams ? searchParams.get('message') || '' : '';
  const errorMessage = searchParams ? searchParams.get('error') || '' : '';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle URL messages
  useEffect(() => {
    if (message) {
      toast({
        message: getResponseMessage(message),
        mode: 'success',
      });

      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete('message');

      router.replace(
        `${pathname}${
          newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''
        }`,
        { scroll: false },
      );
    } else if (errorMessage) {
      toast({
        message: getResponseMessage(errorMessage),
        mode: 'error',
      });

      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete('error');

      router.replace(
        `${pathname}${
          newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''
        }`,
        { scroll: false },
      );
    }
  }, [errorMessage, message, router, searchParams, pathname]);

  // Load dashboard data
  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Fetch real dashboard statistics
        const statsResponse = await fetch('/api/dashboard/stats', {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!statsResponse.ok) {
          throw new Error(`Failed to fetch stats: ${statsResponse.status}`);
        }

        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData.data);
        } else {
          throw new Error(statsData.error || 'Failed to load stats');
        }

        // Fetch real dashboard activity
        const activityResponse = await fetch(
          '/api/dashboard/activity?limit=4',
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (!activityResponse.ok) {
          throw new Error(
            `Failed to fetch activity: ${activityResponse.status}`,
          );
        }

        const activityData = await activityResponse.json();
        if (activityData.success) {
          // Map activity data to include icons and colors
          const mappedActivity = activityData.data.map((activity: any) => ({
            ...activity,
            icon: getActivityIcon(activity.type),
            color: getActivityColor(activity.type),
          }));
          setRecentActivity(mappedActivity);
        } else {
          console.warn('Failed to load activity:', activityData.error);
          setRecentActivity([]); // Set empty array if activity fails
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        toast({
          message: 'Failed to load dashboard data',
          mode: 'error',
        });
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const quickActions: QuickAction[] = [
    {
      id: 'create-agent',
      title: 'Create Agent',
      description: 'Build a new AI agent with our visual editor',
      href: '/dashboard/agents/create',
      icon: <PlusIcon className="h-5 w-5" />,
      color: 'bg-blue-500 hover:bg-blue-600',
      isNew: true,
    },
    {
      id: 'manage-api-keys',
      title: 'Manage API Keys',
      description: 'Create and manage your API keys',
      href: '/dashboard/api-keys',
      icon: <TokensIcon className="h-5 w-5" />,
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      id: 'view-usage',
      title: 'View Billing',
      description: 'Monitor your usage and billing',
      href: '/dashboard/billing',
      icon: <BarChartIcon className="h-5 w-5" />,
      color: 'bg-green-500 hover:bg-green-600',
    },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-6 h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded bg-gray-200"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="h-96 rounded bg-gray-200"></div>
            <div className="h-96 rounded bg-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8" data-cy="dashboard-header">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back! Here's what's happening with your agents and
          organization.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div
          className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
          data-cy="stats-section"
        >
          <div
            className="rounded-lg border border-gray-200 bg-white p-6"
            data-cy="stats-agents"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Agents</p>
                <p
                  className="text-2xl font-bold text-gray-900"
                  data-cy="agent-count"
                >
                  {stats.agentCount}
                </p>
                <p className="text-xs text-gray-500" data-cy="active-agents">
                  {stats.activeAgents} active
                </p>
              </div>
              <RocketIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div
            className="rounded-lg border border-gray-200 bg-white p-6"
            data-cy="stats-team"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Team Members
                </p>
                <p
                  className="text-2xl font-bold text-gray-900"
                  data-cy="user-count"
                >
                  {stats.userCount}
                </p>
                <p className="text-xs text-gray-500" data-cy="pending-invites">
                  {stats.pendingInvites} pending invites
                </p>
              </div>
              <PersonIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div
            className="rounded-lg border border-gray-200 bg-white p-6"
            data-cy="stats-credits"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Credit Balance
                </p>
                <p
                  className="text-2xl font-bold text-gray-900"
                  data-cy="credit-balance"
                >
                  ${stats.creditBalance}
                </p>
                <p
                  className="text-xs text-gray-500"
                  data-cy="subscription-tier"
                >
                  {stats.subscriptionTier} plan
                </p>
              </div>
              <TokensIcon className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div
            className="rounded-lg border border-gray-200 bg-white p-6"
            data-cy="stats-api"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  API Requests (24h)
                </p>
                <p
                  className="text-2xl font-bold text-gray-900"
                  data-cy="api-requests"
                >
                  {stats.apiRequests24h.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500" data-cy="api-cost">
                  ${stats.totalCost24h} cost
                </p>
              </div>
              <BarChartIcon className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Quick Actions */}
        <div
          className="rounded-lg border border-gray-200 bg-white p-6"
          data-cy="quick-actions"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="group relative rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300"
                data-cy={`quick-action-${action.id}`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`rounded-lg p-2 text-white ${action.color}`}>
                    {action.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-medium text-gray-900 group-hover:text-gray-700">
                        {action.title}
                      </h3>
                      {action.isNew && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {action.description}
                    </p>
                  </div>
                </div>
                <ArrowRightIcon className="absolute right-4 top-4 h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div
          className="rounded-lg border border-gray-200 bg-white p-6"
          data-cy="recent-activity"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Activity
            </h2>
            <Link
              href="/dashboard/analytics"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4" data-cy="activity-list">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start space-x-3"
                data-cy={`activity-item-${activity.type}`}
              >
                <div
                  className={`rounded-full bg-gray-100 p-1.5 ${activity.color}`}
                >
                  {activity.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-medium text-gray-900"
                    data-cy="activity-title"
                  >
                    {activity.title}
                  </p>
                  <p
                    className="text-xs text-gray-500"
                    data-cy="activity-description"
                  >
                    {activity.description}
                  </p>
                  <p
                    className="mt-1 text-xs text-gray-400"
                    data-cy="activity-timestamp"
                  >
                    {activity.timestamp}
                  </p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="py-8 text-center">
                <ClockIcon className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Low Credit Warning */}
      {stats && parseFloat(stats.creditBalance) < 10 && (
        <div className="mt-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-yellow-400" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                Low Credit Balance
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Your credit balance is running low. Add credits to avoid service
                interruption.
              </p>
              <div className="mt-3">
                <Button
                  href="/settings/billing"
                  className="bg-yellow-600 px-4 py-2 text-sm text-white hover:bg-yellow-700"
                >
                  Add Credits
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
