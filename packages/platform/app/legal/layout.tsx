import Logo from '@/components/ui/logo';

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-grow flex-col items-center justify-between gap-6 py-8">
      <Logo />
      <div className="flex w-full max-w-lg flex-col gap-6">{children}</div>
    </div>
  );
}
