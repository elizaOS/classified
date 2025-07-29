import Link from 'next/link';

export default function Header({ children }: { children: React.ReactNode }) {
  return (
    <header className="w-full border-b border-stroke-weak bg-background px-4 py-4 md:px-6">
      <nav className="flex items-center justify-between">
        <Link
          className="text-lg font-medium text-typography-strong no-underline transition-opacity hover:opacity-80"
          href="/dashboard"
        >
          <span className="hidden md:inline">Dashboard</span>
          <span className="md:hidden">ElizaOS</span>
        </Link>
        <div className="flex items-center space-x-2">{children}</div>
      </nav>
    </header>
  );
}
