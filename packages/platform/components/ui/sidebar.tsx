/**
 * Dashboard Sidebar Navigation Component
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  HomeIcon,
  PersonIcon,
  GearIcon,
  TokensIcon,
  RocketIcon,
  BarChartIcon,
  PlusIcon,
  MixIcon,
  FileTextIcon,
  ChatBubbleIcon,
  LightningBoltIcon,
  ImageIcon,
  VideoIcon,
  SpeakerLoudIcon,
  CubeIcon,
  MagicWandIcon,
  LayersIcon,
  Share1Icon,
  ActivityLogIcon,
  HamburgerMenuIcon,
  Cross1Icon,
} from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme/theme-switcher';

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  isNew?: boolean;
}

interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

const sidebarSections: SidebarSection[] = [
  {
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: <HomeIcon className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Agent Platform',
    items: [
      {
        id: 'agent-editor',
        label: 'Agent Editor',
        href: '/dashboard/agents/editor',
        icon: <MixIcon className="h-4 w-4" />,
      },
      {
        id: 'agent-marketplace',
        label: 'Marketplace',
        href: '/dashboard/agents/marketplace',
        icon: <Share1Icon className="h-4 w-4" />,
      },
      {
        id: 'agent-templates',
        label: 'Templates',
        href: '/dashboard/agents/templates',
        icon: <LayersIcon className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Generation Studio',
    items: [
      {
        id: 'generation-studio',
        label: 'Studio Dashboard',
        href: '/dashboard/generation',
        icon: <MagicWandIcon className="h-4 w-4" />,
      },
      {
        id: 'text-generation',
        label: 'Text & Chat',
        href: '/dashboard/generation/text',
        icon: <ChatBubbleIcon className="h-4 w-4" />,
      },
      {
        id: 'image-generation',
        label: 'Images',
        href: '/dashboard/generation/image',
        icon: <ImageIcon className="h-4 w-4" />,
      },
      {
        id: 'video-generation',
        label: 'Videos',
        href: '/dashboard/generation/video',
        icon: <VideoIcon className="h-4 w-4" />,
      },
      {
        id: 'audio-generation',
        label: 'Audio & Speech',
        href: '/dashboard/generation/audio',
        icon: <SpeakerLoudIcon className="h-4 w-4" />,
      },
      {
        id: '3d-generation',
        label: '3D & Avatars',
        href: '/dashboard/generation/3d',
        icon: <CubeIcon className="h-4 w-4" />,
      },
      {
        id: 'projects',
        label: 'Projects',
        href: '/dashboard/generation/projects',
        icon: <LayersIcon className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Platform',
    items: [
      {
        id: 'api-keys',
        label: 'API Keys',
        href: '/api-keys',
        icon: <TokensIcon className="h-4 w-4" />,
      },
      {
        id: 'storage',
        label: 'Storage',
        href: '/dashboard/storage',
        icon: <FileTextIcon className="h-4 w-4" />,
      },
      {
        id: 'webhooks',
        label: 'Webhooks',
        href: '/dashboard/webhooks',
        icon: <ChatBubbleIcon className="h-4 w-4" />,
      },
      {
        id: 'workflows',
        label: 'Workflows',
        href: '/dashboard/workflows',
        icon: <ActivityLogIcon className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Analytics',
    items: [
      {
        id: 'analytics',
        label: 'Usage Analytics',
        href: '/dashboard/analytics',
        icon: <BarChartIcon className="h-4 w-4" />,
      },
      {
        id: 'billing',
        label: 'Billing & Credits',
        href: '/dashboard/billing',
        icon: <TokensIcon className="h-4 w-4" />,
      },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        href: '/dashboard/audit',
        icon: <FileTextIcon className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        id: 'account',
        label: 'Account',
        href: '/settings/account',
        icon: <PersonIcon className="h-4 w-4" />,
      },
      {
        id: 'settings-billing',
        label: 'Billing Settings',
        href: '/settings/billing',
        icon: <TokensIcon className="h-4 w-4" />,
      },
    ],
  },
];

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({
  className,
  isOpen = false,
  onToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={onToggle}
          data-cy="sidebar-backdrop"
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar-navigation"
        className={cn(
          'flex h-full flex-col border-r border-stroke-weak bg-sidebar transition-transform duration-300 ease-in-out',
          isMobile
            ? `fixed inset-y-0 left-0 z-50 w-64 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'relative w-64',
          className,
        )}
        data-cy="sidebar"
        aria-label="Main navigation"
      >
        {/* Header with Logo and Mobile Close Button */}
        <div className="flex h-16 items-center justify-between border-b border-stroke-weak px-4">
          <Link
            href="/dashboard"
            className="flex items-center space-x-2 no-underline transition-opacity hover:opacity-80"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600"></div>
            <span className="text-lg font-semibold text-typography-strong">
              ElizaOS
            </span>
          </Link>

          {/* Mobile Close Button */}
          {isMobile && (
            <button
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-typography-weak transition-colors hover:bg-fill hover:text-typography-strong md:hidden"
              data-cy="sidebar-close"
              aria-label="Close sidebar"
            >
              <Cross1Icon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-6 px-3">
            {sidebarSections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {section.title && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-typography-weak">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--focus-ring)]',
                          'min-h-[44px]', // WCAG touch target size
                          isActive
                            ? 'bg-purple-500/20 font-semibold text-purple-400'
                            : 'text-typography-weak hover:bg-hover hover:text-typography-strong',
                        )}
                        data-cy={`sidebar-link-${item.id}`}
                      >
                        <span className="mr-3 flex-shrink-0">{item.icon}</span>
                        <span className="flex-1">{item.label}</span>

                        {/* Badge */}
                        {item.badge && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-fill px-2 py-0.5 text-xs font-medium text-typography-strong">
                            {item.badge}
                          </span>
                        )}

                        {/* New indicator */}
                        {item.isNew && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            New
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-stroke-weak p-4">
          <div className="mb-3 flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-fill"></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-typography-strong">
                Organization
              </p>
              <p className="truncate text-xs text-typography-weak">Free Plan</p>
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-typography-weak">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}

// Mobile Menu Button Component (for use in layouts)
export function MobileMenuButton({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex h-10 min-h-[44px] w-10 min-w-[44px] items-center justify-center rounded-lg bg-fill text-typography-strong transition-colors hover:bg-fill-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--focus-ring)] md:hidden"
      data-cy="mobile-menu-button"
      aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
      aria-expanded={isOpen}
      aria-controls="sidebar-navigation"
    >
      {isOpen ? (
        <Cross1Icon className="h-5 w-5" />
      ) : (
        <HamburgerMenuIcon className="h-5 w-5" />
      )}
    </button>
  );
}
