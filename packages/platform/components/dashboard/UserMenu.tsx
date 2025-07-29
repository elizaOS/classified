'use client';

import Dropdown from '@/components/ui/dropdown';
import { MobileMenuButton } from '@/components/ui/sidebar';
import { ExitIcon, GearIcon } from '@radix-ui/react-icons';

interface UserMenuProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLogout: () => Promise<void>;
}

export function UserMenu({
  sidebarOpen,
  onToggleSidebar,
  onLogout,
}: UserMenuProps) {
  const menuItems = [
    {
      id: 'settings',
      label: 'Settings',
      icon: <GearIcon />,
      href: '/settings/account',
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: <ExitIcon />,
      handleClick: onLogout,
    },
  ];

  return (
    <div className="flex items-center space-x-4">
      <MobileMenuButton isOpen={sidebarOpen} onToggle={onToggleSidebar} />
      <Dropdown menuItems={menuItems}>Account</Dropdown>
    </div>
  );
}
