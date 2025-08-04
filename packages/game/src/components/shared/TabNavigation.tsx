/**
 * Tab Navigation Component
 * Handles the tab switching interface for the game
 */

import React from 'react';
import './TabNavigation.css';
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
    <div className="tab-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            data-testid={`${tab.id}-tab`}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
    </div>
  );
};

export default TabNavigation;
