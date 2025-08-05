/**
 * Tab Navigation Component
 * Handles the tab switching interface for the game
 */

import React from 'react';
// Define TabType directly here since it's specific to this component
export type TabType = 'terminal' | 'config' | 'logs' | 'agent-screen';

interface TabNavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'terminal', label: 'TERMINAL', icon: '⚡' },
  { id: 'config', label: 'CONFIG', icon: '⚙️' },
  { id: 'logs', label: 'LOGS', icon: '📋' },
  { id: 'agent-screen', label: 'SCREEN', icon: '📺' },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({ currentTab, onTabChange }) => {
  return (
    <nav
      className="flex h-12 bg-black/90 border-b border-terminal-green-border relative overflow-x-auto no-scrollbar before:content-[''] before:absolute before:bottom-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-terminal-green/50 before:to-transparent"
      role="tablist"
      aria-label="Interface Navigation"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`px-6 py-3 font-mono text-xs uppercase tracking-wider transition-all duration-200 border-0 cursor-pointer bg-transparent relative flex items-center gap-2 before:content-[''] before:absolute before:bottom-0 before:left-0 before:right-0 before:h-0.5 before:bg-terminal-green before:transform before:scale-x-0 before:transition-transform before:duration-200 ${
            currentTab === tab.id
              ? 'text-terminal-green bg-terminal-green/10 font-bold before:scale-x-100'
              : 'text-terminal-green/60 hover:text-terminal-green hover:bg-terminal-green/5'
          }`}
          onClick={() => onTabChange(tab.id)}
          data-testid={`${tab.id}-tab`}
          role="tab"
          aria-selected={currentTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          title={`Switch to ${tab.label} view`}
        >
          <span
            className={`text-base leading-none ${currentTab === tab.id ? 'text-terminal-green drop-shadow-[0_0_4px_rgba(0,255,0,0.8)]' : ''}`}
            aria-hidden="true"
          >
            {tab.icon}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default TabNavigation;
