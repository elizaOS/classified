'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Home,
  Bot,
  MessageSquare,
  Settings,
  Menu,
  Bell,
  Search,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from './button';

interface MobileLayoutProps {
  children: ReactNode;
}

const bottomNavItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/dashboard/agents', icon: Bot, label: 'Agents' },
  { href: '/characters', icon: MessageSquare, label: 'Chat' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function MobileLayout({ children }: MobileLayoutProps) {
  const [showSearch, setShowSearch] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">ElizaOS</h1>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Search Bar (collapsible) */}
      {showSearch && (
        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <input
            type="text"
            placeholder="Search agents, characters..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16">{children}</main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-around py-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center rounded-lg px-3 py-2 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="mb-1 h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
        size="sm"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
