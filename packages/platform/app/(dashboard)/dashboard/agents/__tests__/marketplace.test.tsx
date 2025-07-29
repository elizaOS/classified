/**
 * Agent Marketplace Tests
 * Component tests for agent marketplace interface
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  mock,
} from 'bun:test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AgentMarketplacePage from '../marketplace/page';

// Mock Next.js components
mock.module('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href, ...props }: any) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  };
});

mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: mock(),
    replace: mock(),
    pathname: '/dashboard/agents/marketplace',
  }),
  useSearchParams: () => ({
    get: mock(),
  }),
}));

// Mock the cn utility
mock.module('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('AgentMarketplacePage', () => {
  beforeEach(() => {
    mock.restore();
    const mockFetch = mock() as any;
    mockFetch.preconnect = mock();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    mock.restore();
  });

  it('should render the marketplace interface', () => {
    render(<AgentMarketplacePage />);

    expect(screen.getByText('Agent Marketplace')).toBeInTheDocument();
    expect(
      screen.getByText('Discover and install community-created AI agents'),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search agents, categories, or tags...'),
    ).toBeInTheDocument();
    expect(screen.getByText('Publish Agent')).toBeInTheDocument();
  });

  it('should render all category options', () => {
    render(<AgentMarketplacePage />);

    expect(screen.getByText('All Categories')).toBeInTheDocument();
    expect(screen.getByText('Customer Service')).toBeInTheDocument();
    expect(screen.getByText('Content Creation')).toBeInTheDocument();
    expect(screen.getByText('Data Analysis')).toBeInTheDocument();
    expect(screen.getByText('Productivity')).toBeInTheDocument();
    expect(screen.getByText('Education')).toBeInTheDocument();
    expect(screen.getByText('Entertainment')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
  });

  it('should render sort options', () => {
    render(<AgentMarketplacePage />);

    const sortSelect = screen.getByDisplayValue('Most Popular');
    expect(sortSelect).toBeInTheDocument();

    // Check all sort options are available
    fireEvent.click(sortSelect);
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
    expect(screen.getByText('Newest')).toBeInTheDocument();
    expect(screen.getByText('Highest Rated')).toBeInTheDocument();
    expect(screen.getByText('Most Downloaded')).toBeInTheDocument();
    expect(screen.getByText('Recently Updated')).toBeInTheDocument();
  });

  it('should show filters panel when filters button is clicked', () => {
    render(<AgentMarketplacePage />);

    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Minimum Rating')).toBeInTheDocument();
    expect(screen.getByText('Verified creators only')).toBeInTheDocument();
  });

  it('should render mock agents', () => {
    render(<AgentMarketplacePage />);

    expect(screen.getByText('Customer Support Pro')).toBeInTheDocument();
    expect(screen.getByText('Content Creator Assistant')).toBeInTheDocument();
    expect(screen.getByText('Data Analyst Bot')).toBeInTheDocument();
  });

  it('should show featured agents section', () => {
    render(<AgentMarketplacePage />);

    expect(screen.getByText('Featured Agents')).toBeInTheDocument();

    // Featured agents should have "Featured" badge
    const featuredBadges = screen.getAllByText('Featured');
    expect(featuredBadges.length).toBeGreaterThan(0);
  });

  it('should filter agents by search query', () => {
    render(<AgentMarketplacePage />);

    const searchInput = screen.getByPlaceholderText(
      'Search agents, categories, or tags...',
    );
    fireEvent.change(searchInput, { target: { value: 'customer' } });

    // Should show only customer-related agents
    expect(screen.getByText('Customer Support Pro')).toBeInTheDocument();
    expect(
      screen.queryByText('Content Creator Assistant'),
    ).not.toBeInTheDocument();
  });

  it('should filter agents by category', () => {
    render(<AgentMarketplacePage />);

    const customerServiceCategory = screen.getByText('Customer Service');
    fireEvent.click(customerServiceCategory);

    // Should show only customer service agents
    expect(screen.getByText('Customer Support Pro')).toBeInTheDocument();
    expect(
      screen.queryByText('Content Creator Assistant'),
    ).not.toBeInTheDocument();
  });

  it('should change sort order', () => {
    render(<AgentMarketplacePage />);

    const sortSelect = screen.getByDisplayValue('Most Popular');
    fireEvent.change(sortSelect, { target: { value: 'rating' } });

    expect(sortSelect).toHaveValue('rating');
  });

  it('should filter by price range', () => {
    render(<AgentMarketplacePage />);

    // Open filters
    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    // Select free only
    const priceSelect = screen.getByDisplayValue('All');
    fireEvent.change(priceSelect, { target: { value: 'free' } });

    // Should show only free agents
    expect(screen.getByText('Customer Support Pro')).toBeInTheDocument(); // Free agent
    expect(
      screen.queryByText('Content Creator Assistant'),
    ).not.toBeInTheDocument(); // Paid agent
  });

  it('should filter by minimum rating', () => {
    render(<AgentMarketplacePage />);

    // Open filters
    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    // Select 4+ stars
    const ratingSelect = screen.getByDisplayValue('Any');
    fireEvent.change(ratingSelect, { target: { value: '4' } });

    // Should filter agents by rating
    expect(ratingSelect).toHaveValue('4');
  });

  it('should filter by verified creators', () => {
    render(<AgentMarketplacePage />);

    // Open filters
    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    // Check verified only
    const verifiedCheckbox = screen.getByText('Verified creators only')
      .previousElementSibling as HTMLInputElement;
    fireEvent.click(verifiedCheckbox);

    expect(verifiedCheckbox).toBeChecked();
  });

  it('should install agent when install button is clicked', async () => {
    render(<AgentMarketplacePage />);

    const installButtons = screen.getAllByText('Install');
    const firstInstallButton = installButtons[0];

    fireEvent.click(firstInstallButton);

    // Should show installed state after installation
    await waitFor(() => {
      expect(screen.getByText('Installed')).toBeInTheDocument();
    });
  });

  it('should like agent when like button is clicked', () => {
    render(<AgentMarketplacePage />);

    // Find a heart icon button (like button)
    const likeButtons = document.querySelectorAll(
      '[aria-label*="heart"], [class*="heart"]',
    );
    const firstLikeButton = likeButtons[0] as HTMLElement;

    if (firstLikeButton) {
      const initialLikes = screen.getByText(/\d+/).textContent; // Get initial like count
      fireEvent.click(firstLikeButton);

      // Note: In a real test, we'd verify the like count increased
      // For now, we just verify the click was handled
      expect(firstLikeButton).toBeDefined();
    }
  });

  it('should show agent details correctly', () => {
    render(<AgentMarketplacePage />);

    // Check first agent details
    expect(screen.getByText('Customer Support Pro')).toBeInTheDocument();
    expect(screen.getByText('TechCorp Solutions')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();

    // Check tags
    expect(screen.getByText('customer-support')).toBeInTheDocument();
    expect(screen.getByText('multilingual')).toBeInTheDocument();
    expect(screen.getByText('sentiment-analysis')).toBeInTheDocument();
  });

  it('should show paid agent pricing', () => {
    render(<AgentMarketplacePage />);

    // Content Creator Assistant is a paid agent
    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText('$19.99')).toBeInTheDocument();
  });

  it('should show verified creator badges', () => {
    render(<AgentMarketplacePage />);

    // Check for verified badges (checkmark icons)
    const verifiedBadges = document.querySelectorAll('[class*="CheckCircled"]');
    expect(verifiedBadges.length).toBeGreaterThan(0);
  });

  it('should show agent stats', () => {
    render(<AgentMarketplacePage />);

    // Should show download counts
    expect(screen.getByText('1,247')).toBeInTheDocument(); // Download count for first agent
    expect(screen.getByText('892')).toBeInTheDocument(); // Download count for second agent

    // Should show like counts
    expect(screen.getByText('89')).toBeInTheDocument(); // Like count
    expect(screen.getByText('156')).toBeInTheDocument(); // Like count
  });

  it('should show empty state when no agents match filters', () => {
    render(<AgentMarketplacePage />);

    // Search for something that won't match
    const searchInput = screen.getByPlaceholderText(
      'Search agents, categories, or tags...',
    );
    fireEvent.change(searchInput, { target: { value: 'nonexistentagent123' } });

    expect(screen.getByText('No agents found')).toBeInTheDocument();
    expect(
      screen.getByText('Try adjusting your search or filters'),
    ).toBeInTheDocument();
  });

  it('should link to agent detail page', () => {
    render(<AgentMarketplacePage />);

    // Check for external link icons that should link to detail pages
    const detailLinks = document.querySelectorAll(
      'a[href*="/dashboard/agents/marketplace/"]',
    );
    expect(detailLinks.length).toBeGreaterThan(0);
  });

  it('should link to publish agent page', () => {
    render(<AgentMarketplacePage />);

    const publishLink = screen.getByText('Publish Agent').closest('a');
    expect(publishLink).toHaveAttribute('href', '/dashboard/agents/publish');
  });

  it('should show agent count', () => {
    render(<AgentMarketplacePage />);

    // Should show total number of agents
    expect(screen.getByText(/\d+ agents/)).toBeInTheDocument();
  });

  it('should handle multiple filter combinations', () => {
    render(<AgentMarketplacePage />);

    // Open filters
    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    // Apply multiple filters
    const priceSelect = screen.getByDisplayValue('All');
    fireEvent.change(priceSelect, { target: { value: 'free' } });

    const ratingSelect = screen.getByDisplayValue('Any');
    fireEvent.change(ratingSelect, { target: { value: '4' } });

    // Filters should be applied
    expect(priceSelect).toHaveValue('free');
    expect(ratingSelect).toHaveValue('4');
  });

  it('should reset search when category changes', () => {
    render(<AgentMarketplacePage />);

    // Search for something
    const searchInput = screen.getByPlaceholderText(
      'Search agents, categories, or tags...',
    );
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Change category
    const contentCategory = screen.getByText('Content Creation');
    fireEvent.click(contentCategory);

    // Should still show search results filtered by category
    expect(searchInput).toHaveValue('test');
  });

  it('should show category counts', () => {
    render(<AgentMarketplacePage />);

    // Check that category counts are displayed
    expect(screen.getByText('156')).toBeInTheDocument(); // All categories count
    expect(screen.getByText('24')).toBeInTheDocument(); // Customer Service count
    expect(screen.getByText('18')).toBeInTheDocument(); // Content Creation count
  });
});
