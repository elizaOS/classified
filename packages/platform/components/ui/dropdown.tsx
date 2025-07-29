'use client';

import { Menu, MenuButton, MenuItems } from '@headlessui/react';
import DropdownMenuItem from '@/components/ui/dropdown-menu-item';
import { ChevronDownIcon } from '@radix-ui/react-icons';

export default function Dropdown({
  children,
  menuItems,
  showIcon = true,
}: {
  children: React.ReactNode;
  menuItems: Array<{
    id: string;
    icon?: React.ReactNode;
    label: string;
    href?: string;
    kbd?: string;
    handleClick?: () => void;
  }>;
  showIcon?: boolean;
}) {
  return (
    <div className="relative">
      <Menu as="div" className="relative inline-block text-left">
        <MenuButton className="transition-effect flex items-center gap-2 hover:text-typography-strong">
          {children} {showIcon && <ChevronDownIcon className="h-4 w-4" />}
        </MenuButton>

        <MenuItems
          transition
          className="group absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-lg border border-stroke-weak bg-fill-solid p-1 shadow-lg focus:outline-none"
        >
          {menuItems.map((item) => (
            <DropdownMenuItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              kbd={item.kbd}
              href={item.href}
              handleClick={item.handleClick}
            />
          ))}
        </MenuItems>
      </Menu>
    </div>
  );
}
