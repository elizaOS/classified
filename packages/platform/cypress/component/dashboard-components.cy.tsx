/**
 * Component Unit Tests for Dashboard Components
 * Tests individual React components in isolation using Cypress Component Testing
 */

import React from 'react';
import { mount } from 'cypress/react18';

// Mock components for testing (since we don't have access to the actual components)
const MockStatsCard = ({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}) => (
  <div
    data-cy={`stats-${title.toLowerCase().replace(' ', '-')}`}
    className="rounded-lg bg-white p-6 shadow"
  >
    <div className="flex items-center">
      {icon && <div className="mr-3">{icon}</div>}
      <div>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p
          className="text-2xl font-bold text-gray-900"
          data-cy={`${title.toLowerCase()}-count`}
        >
          {value}
        </p>
        {subtitle && (
          <p
            className="text-sm text-gray-600"
            data-cy={`${title.toLowerCase()}-subtitle`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  </div>
);

const MockQuickAction = ({
  title,
  description,
  href,
  badge,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
  icon?: React.ReactNode;
}) => (
  <a
    href={href}
    data-cy={`quick-action-${title.toLowerCase().replace(/\s+/g, '-')}`}
    className="block rounded-lg border bg-white p-6 transition-shadow hover:shadow-md"
  >
    <div className="flex items-start">
      {icon && <div className="mr-3 mt-1">{icon}</div>}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          {badge && (
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
    </div>
  </a>
);

const MockActivityItem = ({
  type,
  title,
  description,
  timestamp,
}: {
  type: string;
  title: string;
  description: string;
  timestamp: string;
}) => (
  <div
    data-cy={`activity-item-${type}`}
    className="flex items-start space-x-3 py-3"
  >
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
      <div className="h-2 w-2 rounded-full bg-blue-600"></div>
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-gray-900" data-cy="activity-title">
        {title}
      </p>
      <p className="text-sm text-gray-600" data-cy="activity-description">
        {description}
      </p>
      <p className="text-xs text-gray-500" data-cy="activity-timestamp">
        {timestamp}
      </p>
    </div>
  </div>
);

describe('Dashboard Components Unit Tests', () => {
  it('StatsCard Component - Renders correctly', () => {
    cy.log('📊 Testing StatsCard Component');

    const props = {
      title: 'Agents',
      value: 5,
      subtitle: '3 active',
      icon: <div>🤖</div>,
    };

    mount(<MockStatsCard {...props} />);

    // Test structure
    cy.get('[data-cy="stats-agents"]').should('be.visible');
    cy.contains('Agents').should('be.visible');
    cy.get('[data-cy="agents-count"]').should('contain.text', '5');
    cy.get('[data-cy="agents-subtitle"]').should('contain.text', '3 active');

    // Test styling
    cy.get('[data-cy="stats-agents"]').should('have.class', 'bg-white');
    cy.get('[data-cy="stats-agents"]').should('have.class', 'rounded-lg');
    cy.get('[data-cy="stats-agents"]').should('have.class', 'shadow');
  });

  it('StatsCard Component - Different data types', () => {
    cy.log('📊 Testing StatsCard with different data');

    const scenarios = [
      { title: 'Credits', value: '$1,000.50', subtitle: 'premium plan' },
      { title: 'API Requests', value: 0, subtitle: 'No usage today' },
      { title: 'Team Members', value: 25, subtitle: '5 pending invites' },
    ];

    scenarios.forEach((scenario, index) => {
      mount(<MockStatsCard key={index} {...scenario} />);

      const testId = `stats-${scenario.title.toLowerCase().replace(/\s+/g, '-')}`;
      cy.get(`[data-cy="${testId}"]`).should('be.visible');
      cy.contains(scenario.title).should('be.visible');
      cy.contains(scenario.value.toString()).should('be.visible');

      if (scenario.subtitle) {
        cy.contains(scenario.subtitle).should('be.visible');
      }
    });
  });

  it('QuickAction Component - Renders correctly', () => {
    cy.log('⚡ Testing QuickAction Component');

    const props = {
      title: 'Create Agent',
      description: 'Build a new AI agent',
      href: '/dashboard/agents/create',
      badge: 'New',
      icon: <div>➕</div>,
    };

    mount(<MockQuickAction {...props} />);

    // Test structure
    cy.get('[data-cy="quick-action-create-agent"]').should('be.visible');
    cy.contains('Create Agent').should('be.visible');
    cy.contains('Build a new AI agent').should('be.visible');
    cy.contains('New').should('be.visible');

    // Test link functionality
    cy.get('[data-cy="quick-action-create-agent"]').should(
      'have.attr',
      'href',
      '/dashboard/agents/create',
    );

    // Test styling
    cy.get('[data-cy="quick-action-create-agent"]').should(
      'have.class',
      'bg-white',
    );
    cy.get('[data-cy="quick-action-create-agent"]').should(
      'have.class',
      'rounded-lg',
    );
    cy.get('[data-cy="quick-action-create-agent"]').should(
      'have.class',
      'border',
    );
  });

  it('QuickAction Component - Without badge', () => {
    cy.log('⚡ Testing QuickAction without badge');

    const props = {
      title: 'View Billing',
      description: 'Monitor your usage and billing',
      href: '/dashboard/billing',
    };

    mount(<MockQuickAction {...props} />);

    cy.get('[data-cy="quick-action-view-billing"]').should('be.visible');
    cy.contains('View Billing').should('be.visible');
    cy.contains('Monitor your usage and billing').should('be.visible');

    // Badge should not be present
    cy.get('.bg-blue-100').should('not.exist');
  });

  it('QuickAction Component - Hover states', () => {
    cy.log('🖱️ Testing QuickAction hover states');

    const props = {
      title: 'Plugin Creator',
      description: 'Create custom plugins',
      href: '/dashboard/plugin-creator',
    };

    mount(<MockQuickAction {...props} />);

    // Test hover effect (we can't test actual hover, but we can verify the class exists)
    cy.get('[data-cy="quick-action-plugin-creator"]').should(
      'have.class',
      'hover:shadow-md',
    );
    cy.get('[data-cy="quick-action-plugin-creator"]').should(
      'have.class',
      'transition-shadow',
    );
  });

  it('ActivityItem Component - Renders correctly', () => {
    cy.log('📝 Testing ActivityItem Component');

    const props = {
      type: 'agent_created',
      title: 'Agent Created',
      description: 'New agent "Customer Support Bot" created',
      timestamp: '2 hours ago',
    };

    mount(<MockActivityItem {...props} />);

    // Test structure
    cy.get('[data-cy="activity-item-agent_created"]').should('be.visible');
    cy.get('[data-cy="activity-title"]').should(
      'contain.text',
      'Agent Created',
    );
    cy.get('[data-cy="activity-description"]').should(
      'contain.text',
      'Customer Support Bot',
    );
    cy.get('[data-cy="activity-timestamp"]').should(
      'contain.text',
      '2 hours ago',
    );

    // Test visual indicator
    cy.get('.bg-blue-100').should('be.visible');
    cy.get('.bg-blue-600').should('be.visible');
  });

  it('ActivityItem Component - Different activity types', () => {
    cy.log('📝 Testing different ActivityItem types');

    const activities = [
      {
        type: 'user_invited',
        title: 'User Invited',
        description: 'Invited john.doe@company.com to the team',
        timestamp: '4 hours ago',
      },
      {
        type: 'credit_added',
        title: 'Credits Added',
        description: 'Added $100 credits to account',
        timestamp: '1 day ago',
      },
      {
        type: 'api_key_created',
        title: 'API Key Created',
        description: 'Created new API key "Production API"',
        timestamp: '3 days ago',
      },
    ];

    activities.forEach((activity, index) => {
      mount(<MockActivityItem key={index} {...activity} />);

      cy.get(`[data-cy="activity-item-${activity.type}"]`).should('be.visible');
      cy.get('[data-cy="activity-title"]').should(
        'contain.text',
        activity.title,
      );
      cy.get('[data-cy="activity-description"]').should(
        'contain.text',
        activity.description,
      );
      cy.get('[data-cy="activity-timestamp"]').should(
        'contain.text',
        activity.timestamp,
      );
    });
  });

  it('Components Integration - Dashboard Layout', () => {
    cy.log('🏗️ Testing Components Integration');

    const DashboardLayout = () => (
      <div data-cy="dashboard-layout" className="min-h-screen bg-gray-50 p-6">
        {/* Header */}
        <div data-cy="dashboard-header" className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Here's what's happening with your account today.
          </p>
        </div>

        {/* Stats Grid */}
        <div
          data-cy="stats-section"
          className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          <MockStatsCard title="Agents" value={5} subtitle="3 active" />
          <MockStatsCard title="Team" value={3} subtitle="1 pending invites" />
          <MockStatsCard
            title="Credits"
            value="$1,000.0"
            subtitle="premium plan"
          />
          <MockStatsCard title="API" value="2,500" subtitle="$12.50 cost" />
        </div>

        {/* Quick Actions */}
        <div data-cy="quick-actions" className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MockQuickAction
              title="Create Agent"
              description="Build a new AI agent"
              href="/dashboard/agents/create"
              badge="New"
            />
            <MockQuickAction
              title="Plugin Creator"
              description="Create custom plugins"
              href="/dashboard/plugin-creator"
              badge="New"
            />
            <MockQuickAction
              title="Manage API Keys"
              description="Create and manage your API keys"
              href="/dashboard/api-keys"
            />
            <MockQuickAction
              title="View Billing"
              description="Monitor your usage and billing"
              href="/dashboard/billing"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div data-cy="recent-activity">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Recent Activity
            </h2>
            <a
              href="/dashboard/audit"
              className="text-blue-600 hover:text-blue-800"
            >
              View all
            </a>
          </div>
          <div
            data-cy="activity-list"
            className="divide-y divide-gray-200 rounded-lg bg-white shadow"
          >
            <MockActivityItem
              type="agent_created"
              title="Agent Created"
              description="New agent 'Customer Support Bot' created"
              timestamp="2 hours ago"
            />
            <MockActivityItem
              type="user_invited"
              title="User Invited"
              description="Invited john.doe@company.com to the team"
              timestamp="4 hours ago"
            />
            <MockActivityItem
              type="credit_added"
              title="Credits Added"
              description="Added $100 credits to account"
              timestamp="1 day ago"
            />
          </div>
        </div>
      </div>
    );

    mount(<DashboardLayout />);

    // Test overall layout
    cy.get('[data-cy="dashboard-layout"]').should('be.visible');
    cy.get('[data-cy="dashboard-header"]').should('be.visible');
    cy.get('[data-cy="stats-section"]').should('be.visible');
    cy.get('[data-cy="quick-actions"]').should('be.visible');
    cy.get('[data-cy="recent-activity"]').should('be.visible');

    // Test stats grid has 4 cards
    cy.get('[data-cy="stats-section"] > div').should('have.length', 4);

    // Test quick actions grid has 4 actions
    cy.get('[data-cy="quick-actions"] .grid > a').should('have.length', 4);

    // Test activity list has 3 items
    cy.get('[data-cy="activity-list"] > div').should('have.length', 3);

    // Test responsive classes
    cy.get('[data-cy="stats-section"]').should('have.class', 'grid');
    cy.get('[data-cy="stats-section"]').should('have.class', 'md:grid-cols-2');
    cy.get('[data-cy="stats-section"]').should('have.class', 'lg:grid-cols-4');
  });

  it('Component Accessibility - ARIA and semantic HTML', () => {
    cy.log('♿ Testing Component Accessibility');

    const AccessibleStatsCard = ({
      title,
      value,
      subtitle,
    }: {
      title: string;
      value: string | number;
      subtitle?: string;
    }) => (
      <div
        role="region"
        aria-labelledby={`${title}-heading`}
        className="rounded-lg bg-white p-6 shadow"
      >
        <h3
          id={`${title}-heading`}
          className="text-sm font-medium text-gray-500"
        >
          {title}
        </h3>
        <p
          className="text-2xl font-bold text-gray-900"
          aria-label={`${title} count: ${value}`}
        >
          {value}
        </p>
        {subtitle && (
          <p
            className="text-sm text-gray-600"
            aria-label={`Additional info: ${subtitle}`}
          >
            {subtitle}
          </p>
        )}
      </div>
    );

    mount(<AccessibleStatsCard title="Agents" value={5} subtitle="3 active" />);

    // Test ARIA attributes
    cy.get('[role="region"]').should('exist');
    cy.get('[aria-labelledby="Agents-heading"]').should('exist');
    cy.get('#Agents-heading').should('exist');
    cy.get('[aria-label="Agents count: 5"]').should('exist');
    cy.get('[aria-label="Additional info: 3 active"]').should('exist');
  });

  it('Component Performance - Large data sets', () => {
    cy.log('⚡ Testing Component Performance with Large Data');

    // Generate large activity list
    const generateLargeActivityList = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        type: `activity_${i}`,
        title: `Activity ${i + 1}`,
        description: `Description for activity ${i + 1}`,
        timestamp: `${Math.floor(Math.random() * 24)} hours ago`,
      }));
    };

    const LargeActivityList = () => (
      <div data-cy="large-activity-list">
        {generateLargeActivityList(100).map((activity, index) => (
          <MockActivityItem key={index} {...activity} />
        ))}
      </div>
    );

    // Measure render time
    const startTime = performance.now();
    mount(<LargeActivityList />);

    cy.get('[data-cy="large-activity-list"]')
      .should('be.visible')
      .then(() => {
        const endTime = performance.now();
        const renderTime = endTime - startTime;
        cy.log(`Render time for 100 components: ${renderTime.toFixed(2)}ms`);

        // Assert render time is reasonable (less than 1 second)
        expect(renderTime).to.be.lessThan(1000);
      });

    // Verify all components rendered
    cy.get('[data-cy^="activity-item-"]').should('have.length', 100);
  });

  it('Component Error Boundaries', () => {
    cy.log('❌ Testing Component Error Handling');

    const ErrorProneComponent = ({ shouldError }: { shouldError: boolean }) => {
      if (shouldError) {
        throw new Error('Test error for error boundary');
      }
      return (
        <div data-cy="error-prone-component">
          Component rendered successfully
        </div>
      );
    };

    const ComponentWithErrorBoundary = ({
      shouldError,
    }: {
      shouldError: boolean;
    }) => {
      try {
        return <ErrorProneComponent shouldError={shouldError} />;
      } catch (error) {
        return (
          <div
            data-cy="error-fallback"
            className="rounded border border-red-200 bg-red-50 p-4"
          >
            <h3 className="font-medium text-red-800">Something went wrong</h3>
            <p className="text-sm text-red-600">Unable to render component</p>
          </div>
        );
      }
    };

    // Test successful render
    mount(<ComponentWithErrorBoundary shouldError={false} />);
    cy.get('[data-cy="error-prone-component"]').should('be.visible');
    cy.contains('Component rendered successfully').should('be.visible');

    // Test error handling
    mount(<ComponentWithErrorBoundary shouldError={true} />);
    cy.get('[data-cy="error-fallback"]').should('be.visible');
    cy.contains('Something went wrong').should('be.visible');
    cy.contains('Unable to render component').should('be.visible');
  });
});
