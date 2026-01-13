'use client';

import { ReactNode } from 'react';

interface ScrollToSectionProps {
  targetId: string;
  children: ReactNode;
  className?: string;
}

export function ScrollToSection({ targetId, children, className }: ScrollToSectionProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a href={`#${targetId}`} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
