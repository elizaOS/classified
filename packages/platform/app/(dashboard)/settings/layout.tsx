'use client';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="m-4 mx-24 flex h-full flex-grow gap-6">
      <div className="flex h-full w-full flex-grow flex-col items-center justify-start gap-8 py-8">
        {children}
      </div>
    </div>
  );
}
