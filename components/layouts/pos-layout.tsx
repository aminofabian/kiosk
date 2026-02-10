import { ReactNode } from 'react';

interface POSLayoutProps {
  children: ReactNode;
  header?: ReactNode;
}

export function POSLayout({ children, header }: POSLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#f6f8f6] dark:bg-[#0f1a0d]">
      {header && (
        <header className="sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/95 dark:bg-[#1c2e18]/95 backdrop-blur-xl shadow-sm">
          {header}
        </header>
      )}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
