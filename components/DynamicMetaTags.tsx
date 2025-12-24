'use client';

import { useEffect } from 'react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';

export function DynamicMetaTags() {
  const { user } = useCurrentUser();
  const businessName = user?.businessName || 'POS System';

  useEffect(() => {
    // Update apple-mobile-web-app-title meta tag
    let metaTag = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', businessName);

    // Update document title if needed
    if (document.title === 'POS System' || document.title === 'Grocery POS') {
      document.title = businessName;
    }
  }, [businessName]);

  return null;
}

