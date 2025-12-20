import { ReactNode } from 'react';

interface POSLayoutProps {
  children: ReactNode;
  header?: ReactNode;
}

export function POSLayout({ children, header }: POSLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {header && (
        <header className="border-b border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm p-4 sticky top-0 z-10">
          {header}
        </header>
      )}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

